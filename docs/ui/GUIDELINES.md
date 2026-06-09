# UI Guidelines — Web App

> For current package versions see [TECH_STACK.md](../../TECH_STACK.md).
> For domain language see [CONTEXT.md](../../CONTEXT.md).
> These guidelines apply to both UI Primitives (`libs/web-ui/`) and Feature Components (`libs/web/pages/<route>/`).
> ComponentBuilder and ComponentReviewer agents enforce these rules on every component they touch.

---

## 1. Component Scopes

There are exactly two places a React component may live. Choosing the wrong one is the most common structural mistake in this codebase.

### UI Primitive — `libs/web-ui/src/lib/components/<Name>/`

A component belongs here if:

- It has **no knowledge of domain state** (no Vault, Todo, Subscription, User data)
- It can be **fully developed in Storybook** with mock props only
- It is **reusable across multiple routes** or could reasonably be reused in the future

Every UI Primitive must:

- Live in its own folder: `libs/web-ui/src/lib/components/<Name>/<Name>.tsx`
- Be exported from `libs/web-ui/src/index.ts` via `export *`
- Use the compound/composition pattern when it has named slots or sections (see §3)

### Feature Component — `libs/web/pages/<route>/src/components/`

A component belongs here if:

- It is **private to a single route** and has no reason to be shared
- It **composes UI Primitives** from `@myorganizer/web-ui` with domain logic
- It knows about React Hook Form, Zod schemas, API calls, or vault data

Feature components must **never** import directly from `libs/web-ui/src/...`. Always use the public path:

```typescript
// ✅ correct
import { Button, Form, FormField } from '@myorganizer/web-ui';

// ❌ wrong — bypasses the barrel and breaks Nx module boundaries
import { Button } from '../../../libs/web-ui/src/lib/components/Button/Button';
```

---

## 2. File Placement Rules

```
libs/web-ui/src/lib/components/
└── <Name>/
    └── <Name>.tsx          ← component + all sub-components in one file

libs/web/pages/<route>/src/
├── page.tsx                ← thin Next.js route wrapper only (no logic)
├── components/
│   ├── <Route>PageClient.tsx   ← top-level client compositor; stays thin
│   ├── <SectionName>Card.tsx   ← extracted section (e.g. SubscriptionsTotalsCard)
│   ├── <Action>Dialog.tsx      ← extracted dialog (e.g. CreateListDialog)
│   └── <Item>Item.tsx          ← extracted list item (e.g. TodoItem)
├── hooks/
│   └── use-<feature>.ts    ← custom hooks private to this route
└── schemas/
    └── <feature>.ts        ← Zod schemas shared between add and edit forms
```

### Split signals — extract a component when any of these are true

- A component file exceeds **~150 lines of JSX**
- A visual section (card, panel, dialog, list row) can be described independently
- The same JSX block is repeated more than once in the file
- A section has its own form, its own loading state, or its own error boundary
- The section could stand alone in a Storybook story

**Reference: `SubscriptionsPageClient.tsx` (796 lines) is the counter-example.** It contains three hidden sections — a totals card, an add-form card, and a subscriptions table — that should each be their own file.

**Reference: `DashboardHomeClient.tsx` (36 lines) is the target pattern** — a thin compositor that imports and arranges isolated widget files.

---

## 3. Compound / Composition Pattern

### When to use compound components

Use the compound pattern for any UI Primitive that has **named slots or sections**. If a consumer needs to control the arrangement or content of sub-parts, expose those sub-parts as named exports rather than monolithic props.

```typescript
// ✅ compound pattern — consumer controls the layout
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>

// ❌ prop-drilling pattern — avoid for slot-heavy components
<Card title="Title" description="Description" footer={<Button />} />
```

### When to fall back to a single component

Use a single component (no sub-components) when:

- The component has no named slots — it is purely a styled wrapper or interactive control
- All variation is expressed through props/variants (see CVA below), not structural composition

`Button`, `Input`, `Label`, `Checkbox` are all single-component examples.

### Shared state between sub-components

Use React Context to share state within a compound component. Create a private context in the same file — never export it.

```typescript
// From Form.tsx — the established pattern in this codebase
const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

const FormItem = React.forwardRef<...>(({ className, ...props }, ref) => {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn('space-y-2', className)} {...props} />
    </FormItemContext.Provider>
  )
})
```

---

## 4. UI Primitive Implementation Rules

Every component in `libs/web-ui/` must follow all of these:

### 4.1 Always use `React.forwardRef`

```typescript
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('...', className)} {...props} />
))
Card.displayName = 'Card'
```

- The first generic is the **DOM element type** (e.g. `HTMLDivElement`, `HTMLButtonElement`)
- The second generic is the **props type**
- Always set `displayName` — it shows in React DevTools and error messages

### 4.2 Always use `cn()` for className

```typescript
import { cn } from '../../utils'

// ✅ safe merge — cn() resolves Tailwind conflicts correctly
className={cn('rounded-md bg-primary', className)}

// ❌ naive concatenation — can produce conflicting classes
className={`rounded-md bg-primary ${className}`}
```

`cn()` combines `clsx` (conditional classes) and `tailwind-merge` (conflict resolution). Always use it for any `className` that can be overridden by a consumer.

### 4.3 Use CVA for components with visual variants

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center ...', // base classes
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
```

`VariantProps<typeof buttonVariants>` automatically types the `variant` and `size` props — never define them manually.

### 4.4 Use `asChild` / `Slot` for polymorphic rendering

```typescript
import { Slot } from '@radix-ui/react-slot'

const Comp = asChild ? Slot : 'button'
return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
```

`asChild` lets the consumer render any element or component in place of the default. This is how `Button` can render as an `<a>` or a Next.js `Link` without a separate prop for each.

### 4.5 Build on Radix UI primitives for interactive components

Never implement dialogs, dropdowns, selects, tooltips, popovers, or menus from scratch. Radix handles ARIA roles, keyboard navigation, focus management, and screen reader announcements.

```typescript
// ✅ wrap Radix — accessibility is handled
import * as DialogPrimitive from '@radix-ui/react-dialog';

// ❌ custom portal + event listeners from scratch — never do this
```

### 4.6 Barrel export every new primitive

After creating a new component, add it to `libs/web-ui/src/index.ts`:

```typescript
export * from './lib/components/<Name>/<Name>';
```

---

## 5. Feature Component Implementation Rules

### 5.1 `'use client'` directive

Add `'use client'` only when the component uses:

- React hooks (`useState`, `useEffect`, `useCallback`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `document`, `localStorage`)

Server components are the default. `'use client'` marks a client boundary — everything it imports becomes client-side too.

```typescript
// ✅ only when needed
'use client';

import { useState } from 'react';
```

### 5.2 Forms — React Hook Form + Zod

Every form in a feature component must use React Hook Form with a Zod resolver. No exceptions.

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const MyForm = ({ onSubmit }: { onSubmit: (name: string) => void }) => {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onSubmit(v.name))}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
};
```

### 5.3 Zod schema placement

| Scenario                          | Where the schema lives                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| One form only, not reused         | Inline in the component file, above the component                      |
| Shared between add and edit forms | `libs/web/pages/<route>/src/schemas/<feature>.ts`                      |
| Shared across routes              | `libs/core/src/` or `libs/app-api-client/` (discuss before doing this) |

### 5.4 Props interface

Always declare an explicit props interface — never use inline object types or `any`.

```typescript
// ✅ named interface
interface TodoFormProps {
  onAddTodo: (todo: string) => void;
}

const TodoForm = ({ onAddTodo }: TodoFormProps) => { ... }

// ❌ inline — harder to read and reuse
const TodoForm = ({ onAddTodo }: { onAddTodo: (todo: string) => void }) => { ... }
```

### 5.5 State ownership hierarchy

Choose the lowest level that satisfies the requirement:

1. **UI state** (open/closed, hover, focus) → Radix primitive handles it; if not, `useState` local to the component
2. **Form state** → React Hook Form exclusively; never `useState` for form fields
3. **Feature-level shared state** → custom hook in `src/hooks/use-<feature>.ts` within the route library
4. **Server/async data** → prefer Next.js server components; use client-side fetch only when server components cannot serve the data (e.g. vault-decrypted data that must stay on the client)

### 5.6 Handlers and callbacks

**Every handler passed as a prop to a child component must be wrapped in `useCallback`. No exceptions.**

Before finishing a component, grep the file for every prop passed to a child (`<Child onX={...} />`), confirm each handler is wrapped in `useCallback`, and verify the function signature (parameter names, types, return type) matches the child component's props interface exactly.

```typescript
const handleDelete = useCallback((id: string) => {
  // ...
}, [/* dependencies */]);

return <TodoItem onDelete={handleDelete} />;
```

---

## 6. Naming Conventions

### Files and folders

| Context             | Pattern                       | Example                                               |
| ------------------- | ----------------------------- | ----------------------------------------------------- |
| UI Primitive folder | `PascalCase/`                 | `Card/`, `DropdownMenu/`                              |
| UI Primitive file   | `<Name>.tsx` (matches folder) | `Card.tsx`, `DropdownMenu.tsx`                        |
| Feature component   | `<Purpose><Type>.tsx`         | `CreateListDialog.tsx`, `SubscriptionsTotalsCard.tsx` |
| Feature page client | `<Route>PageClient.tsx`       | `SubscriptionsPageClient.tsx`                         |
| Feature hook        | `use-<feature>.ts`            | `use-grocery-lists.ts`                                |
| Zod schema file     | `<feature>.ts`                | `subscription.ts`                                     |

### Components and sub-components

| Rule                                                    | Good                                             | Avoid                                      |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Compound sub-components use the parent name as a prefix | `CardHeader`, `CardContent`, `CardFooter`        | `Header`, `Content`, `Footer`              |
| Feature components describe the action or section       | `SubscriptionsTotalsCard`, `AddSubscriptionForm` | `Section`, `Panel`, `Container`, `Wrapper` |
| No abbreviations in component names                     | `SubscriptionsOverviewCard`                      | `SubsOvCard`                               |

### Exports

- UI Primitives: named exports only — `export { Card, CardHeader, CardContent }`
- Feature components: named export preferred — `export function TodoForm(...)`; default export acceptable for leaf components

---

## 7. Accessibility Checklist

Every component must satisfy this before being considered done:

- [ ] Interactive elements use semantic HTML (`<button>`, `<a>`, `<input>`, `<select>`)
- [ ] All Radix primitives are used as-is; not replaced with custom implementations
- [ ] Form inputs have associated `<Label>` via `FormLabel` (which sets `htmlFor` automatically)
- [ ] Error messages use `FormMessage` (which uses `aria-invalid` and `aria-describedby`)
- [ ] Icon-only buttons have an `aria-label` or `sr-only` text
- [ ] `displayName` is set on every `forwardRef` component (required for DevTools and error stacks)
- [ ] Focus is not trapped unintentionally; Radix Dialog/Sheet handle focus lock correctly

---

## 8. What ComponentBuilder Does With These Guidelines

ComponentBuilder reads these guidelines at the start of every run and applies them as hard constraints, not suggestions. If the Structured Spec conflicts with a rule here, ComponentBuilder flags the conflict to the main agent before writing any code.

ComponentReviewer checks the finished component against §§ 1–7 and reports any violation, along with the guideline section number, so the main agent can instruct ComponentBuilder to revise.

Neither agent invents conventions not present in this document or in `TECH_STACK.md`. If a situation is not covered, ComponentReviewer flags it as a gap rather than applying general React knowledge.
