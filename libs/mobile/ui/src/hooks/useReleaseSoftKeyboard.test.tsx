import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { Platform, TextInput } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { TextField } from '../components/TextField';

// The one command the hook sends, named by the input it was sent to.
const mockBlurCommand = jest.fn();
jest.mock('react-native/Libraries/Utilities/codegenNativeCommands', () => ({
  __esModule: true,
  default: () => ({ blur: mockBlurCommand }),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/** What React Native counts as the focused text input, for the next check. */
function focusedInputIs(input: unknown): void {
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockReturnValue(
      input as ReturnType<typeof TextInput.State.currentlyFocusedInput>,
    );
}

async function blur(testID: string): Promise<void> {
  const input = screen.getByTestId(testID);
  await act(async () => {
    input.props.onBlur?.({});
  });
}

/** Runs the check a blur left owing. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

describe('useReleaseSoftKeyboard, through TextField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBlurCommand.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('on Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('closes the keyboard when focus left for something that takes no text', async () => {
      await render(
        <Wrapper>
          <TextField testID="title" />
        </Wrapper>,
      );
      focusedInputIs(null);

      await blur('title');
      // Not yet: the next input has not been told it has focus.
      expect(mockBlurCommand).not.toHaveBeenCalled();

      await settle();
      expect(mockBlurCommand).toHaveBeenCalledTimes(1);
      expect(mockBlurCommand.mock.calls[0][0]).not.toBeNull();
    });

    it('leaves the keyboard up when focus moved to another text input', async () => {
      await render(
        <Wrapper>
          <TextField testID="title" />
          <TextField testID="description" />
        </Wrapper>,
      );

      await blur('title');
      focusedInputIs({});
      await settle();

      expect(mockBlurCommand).not.toHaveBeenCalled();
    });

    it('closes the keyboard as it leaves when its own blur removes the field', async () => {
      function Composer(): React.JSX.Element | null {
        const [open, setOpen] = React.useState(true);
        return open ? (
          <TextField testID="composer" onBlur={() => setOpen(false)} />
        ) : null;
      }
      await render(
        <Wrapper>
          <Composer />
        </Wrapper>,
      );
      focusedInputIs(null);

      await blur('composer');

      expect(screen.queryByTestId('composer')).toBeNull();
      expect(mockBlurCommand).toHaveBeenCalledTimes(1);
      // The check it was owed has been settled, not left to run twice.
      await settle();
      expect(mockBlurCommand).toHaveBeenCalledTimes(1);
    });

    it('sends nothing when a field that never blurred is removed', async () => {
      const view = await render(
        <Wrapper>
          <TextField testID="title" />
        </Wrapper>,
      );
      focusedInputIs(null);

      await view.unmount();

      expect(mockBlurCommand).not.toHaveBeenCalled();
    });

    it('still calls the caller’s onBlur', async () => {
      const onBlur = jest.fn();
      await render(
        <Wrapper>
          <TextField testID="title" onBlur={onBlur} />
        </Wrapper>,
      );

      await blur('title');

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing on iOS, where a view never takes keyboard focus', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(
      <Wrapper>
        <TextField testID="title" />
      </Wrapper>,
    );
    focusedInputIs(null);

    await blur('title');
    await settle();

    expect(mockBlurCommand).not.toHaveBeenCalled();
  });
});
