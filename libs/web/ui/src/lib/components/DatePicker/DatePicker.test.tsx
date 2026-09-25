import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DatePicker } from './DatePicker';

const openAndReadMonth = async (value: string) => {
  render(<DatePicker value={value} onChange={() => undefined} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.queryByRole('grid')).not.toBeNull());
  const grid = screen.getByRole('grid');
  return grid.getAttribute('aria-label') ?? grid.textContent ?? '';
};

describe('DatePicker', () => {
  it('opens on the month of the selected value rather than the current month', async () => {
    // Without `defaultMonth`, react-day-picker ignores `selected` for the
    // displayed month: choosing a 2024 date and reopening put the User in the
    // present month with nothing selected in view, and moved the Storybook
    // snapshot every month.
    expect(await openAndReadMonth('2024-06-15')).toMatch(/June 2024/i);
  });

  it('falls back to the current month when no value is set', async () => {
    const label = new Date().toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    expect(await openAndReadMonth('')).toMatch(new RegExp(label, 'i'));
  });

  it('ignores an unparseable value and shows the placeholder', () => {
    render(
      <DatePicker
        value="not-a-date"
        onChange={() => undefined}
        placeholder="Pick a due date"
      />,
    );
    expect(screen.getByRole('button').textContent).toContain('Pick a due date');
  });
});
