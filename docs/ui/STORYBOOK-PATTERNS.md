# Storybook Authoring Patterns

> Code-level patterns for writing `*.stories.tsx` in this repo.
> Setup, Chromatic, and commands live in [`docs/storybook/README.md`](../storybook/README.md).
> Component rules live in [`GUIDELINES.md`](./GUIDELINES.md).
> This file is the single home for story patterns — `StorybookCurator` reads it instead of carrying copies in its prompt.

Only three stories exist today against 27 UI primitives, so there is little in-repo precedent to imitate. Follow the patterns here rather than generalising from whichever story you happened to open.

---

## 1. Where stories live

| Library             | Story location                                                        | Picked up by                                  |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| `libs/web-ui`       | Next to the component: `src/lib/components/<Name>/<Name>.stories.tsx` | `../src/lib/**/*.stories.@(js\|jsx\|ts\|tsx)` |
| `libs/web-vault-ui` | Next to the component under `src/lib/`                                | Also globbed by the `web-ui` Storybook config |

Both libraries are served by the **same** Storybook instance (`libs/web-ui/.storybook/main.ts`). A story placed outside `src/lib/` is silently never loaded — no error, it just does not appear.

Feature Components in `libs/web/pages/` are **not** in any story glob. They depend on domain state, so they belong in tests, not Storybook. If a feature component seems worth a story, that is a signal it should have been a UI Primitive — raise it rather than adding a glob.

## 2. Title and metadata

```typescript
const meta: Meta<typeof Card> = {
  component: Card,
  title: 'Components/Card', // always Components/<ComponentName>
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Card>;
```

`title` is `Components/<Name>` matching the component folder — the sidebar grouping depends on it. `tags: ['autodocs']` is standard for every story file here.

## 3. Pattern A — single component with CVA variants

Use `args` and `argTypes`. This is the only case where plain `args` is the right tool.

Enumerate every CVA variant and size in `argTypes.options` so the Controls panel is explorable, then export one named story per variant that a reviewer would actually want to compare side by side. `Button.stories.tsx` is the reference implementation.

```typescript
const meta: Meta<typeof Badge> = {
  component: Badge,
  title: 'Components/Badge',
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
  },
};

export const Destructive: Story = {
  args: { children: 'Overdue', variant: 'destructive' },
};
```

Prefer realistic content over placeholder text. `children: 'Overdue'` tells a reviewer what a destructive badge is _for_; `children: 'Badge'` does not.

## 4. Pattern B — compound components need a wrapper

**A compound component cannot be driven by `args`.** `Card`, `Dialog`, `Select`, `Table`, `DropdownMenu`, and `Form` are composed of a JSX tree, and a tree is not a prop. Passing `children` through `args` gives you an unreadable story and a useless Controls panel.

Write a wrapper component in the story file and type `Meta` against **the wrapper**, not the primitive:

```typescript
function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>Review the details before confirming.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>OK</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const meta: Meta<typeof DialogExample> = {
  component: DialogExample,
  title: 'Components/Dialog',
  tags: ['autodocs'],
};
```

`Dialog.stories.tsx` is the reference. Where several arrangements are worth showing (a Card with and without a footer, say), write one wrapper per arrangement rather than one wrapper with boolean props — the point of the story is to show the composition.

The trade-off: `argTypes` controls are lost, because the wrapper has no interesting props. That is correct. Anyone exploring a compound component is exploring its structure, not its prop surface.

## 5. Pattern C — controlled and stateful primitives

`Checkbox`, `Select`, `Combobox`, `Popover`, `Collapsible`, and `Sheet` are controlled. A story with a static `checked` value renders a control that visibly does not respond to clicks, which reads as a bug.

Use `render` with local state:

```typescript
export const Interactive: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false);
    return <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />;
  },
};
```

Declare `render` as a **named function** (`function Render()`), not an arrow — hooks inside an anonymous arrow trip the rules-of-hooks lint.

## 6. Radix portals

`Dialog`, `Sheet`, `Popover`, `Tooltip`, `Select`, and `DropdownMenu` render their content through a portal, attached to `document.body` rather than inside the story canvas.

Consequences to plan for:

- The autodocs snapshot shows **only the trigger** — the interesting part is invisible until opened.
- Chromatic captures the closed state unless the story opens the content.

To show the open state, either set the primitive's `open`/`defaultOpen` prop in the wrapper, or drive it with a `play` function (§7). Prefer `defaultOpen` for a pure visual story; use `play` when the opening interaction itself is what you are documenting.

## 7. Interaction tests with `play`

`@storybook/test` and `@storybook/addon-interactions` are installed. A `play` function turns a story into an assertion that runs under `npx nx test-storybook web-ui`.

```typescript
import { expect, userEvent, within } from '@storybook/test';

export const OpensOnClick: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
    // Portalled content lives outside canvasElement — query the document body.
    await expect(within(document.body).getByRole('dialog')).toBeVisible();
  },
};
```

The portal caveat matters here: `within(canvasElement)` will not find portalled content. Query `document.body` for anything Radix portals out.

Add `play` for behaviour a static image cannot show — open/close, validation appearing, a disabled control refusing input. Do not re-test logic that already has Jest coverage.

## 8. Required coverage

A story set is not done at "Default". Cover what a reviewer needs to make a judgment:

| Applies when                             | Story to add                                                       |
| ---------------------------------------- | ------------------------------------------------------------------ |
| The component has CVA variants           | One per variant, plus every size                                   |
| The component can be disabled            | `Disabled`                                                         |
| It accepts user input                    | Error/invalid state, and empty state                               |
| It renders a collection                  | Empty, one item, many items                                        |
| It renders user-supplied text            | Long-content overflow — the truncation/wrap behaviour is the point |
| It has an async or loading state         | Loading/skeleton                                                   |
| It is interactive (opens, toggles, etc.) | Open/expanded state, via `defaultOpen` or `play`                   |

Long-content and empty states are the two most often skipped and the two that most often expose layout bugs.

## 9. Accessibility in stories

Stories are where a11y defects become visible, so do not encode them into the examples.

**Every icon-only control needs an accessible name.** `Button.stories.tsx` currently has:

```typescript
export const Icon: Story = {
  args: { children: '🔍', size: 'icon' }, // ← no accessible name
};
```

That violates GUIDELINES §7 and teaches the wrong pattern to anyone copying it. The correct form:

```typescript
export const Icon: Story = {
  args: {
    children: <Search aria-hidden="true" className="h-4 w-4" />,
    size: 'icon',
    'aria-label': 'Search',
  },
};
```

Also: label every form input in a story the way a real page would, and prefer `lucide-react` icons over emoji — emoji are announced by screen readers with their unicode name.

## 10. Determinism

Stories are rendered by Chromatic and the test-runner, so anything non-deterministic becomes a flaky diff.

- No `fetch`, no API clients, no `@myorganizer/app-api-client`. Pass data as props.
- No `new Date()`, `Date.now()`, `Math.random()`, or `crypto.randomUUID()` — pin a fixed date and fixed ids.
- No vault data, no decryption, no domain records. If a primitive appears to need them, it belongs in `libs/web/pages/`, not `libs/web-ui/` (GUIDELINES §1).
- No `setTimeout`-driven visual states.

## Anti-patterns

| Anti-pattern                                                             | Why it fails                                              | Instead                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| `args: { children: <CardHeader>…</CardHeader> }` on a compound component | Unreadable story, useless controls                        | Wrapper component (§4)                     |
| Static `checked`/`value` on a controlled primitive                       | Control appears broken                                    | `render` with local state (§5)             |
| Story file outside `src/lib/`                                            | Silently never loaded                                     | Colocate with the component (§1)           |
| `render: () => { const [x] = useState() … }`                             | Rules-of-hooks violation in an anonymous arrow            | `render: function Render() { … }` (§5)     |
| `within(canvasElement)` for portalled content                            | Radix renders to `document.body`; the query finds nothing | `within(document.body)` (§7)               |
| Only a `Default` story                                                   | Reviewers cannot see the states that break                | Coverage table (§8)                        |
| Emoji or bare icon as the whole button label                             | No accessible name                                        | Icon + `aria-label` (§9)                   |
| Fetching or generating data in a story                                   | Non-deterministic Chromatic diffs                         | Fixed props (§10)                          |
| A story for a `libs/web/pages/` component                                | Not in any glob; depends on domain state                  | Test it, or promote it to a primitive (§1) |
