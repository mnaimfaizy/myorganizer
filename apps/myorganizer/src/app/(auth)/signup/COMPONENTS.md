# Sign-up Page - Component Breakdown

## Component Tree

```
SignUpPage (page.tsx)
│
├── Container (div with gradient background)
│   │
│   └── Main Layout (flex container, max-w-6xl)
│       │
│       ├── Left Panel (hidden on mobile, visible on lg+)
│       │   └── Illustration Card
│       │       ├── Icon: 📱
│       │       ├── Title: "Welcome to MyOrganizer"
│       │       └── Subtitle: "Organize your life..."
│       │
│       └── Right Panel (flex-1)
│           └── Card (white, shadow-2xl)
│               └── CardContent (p-8)
│                   │
│                   ├── Header Section
│                   │   ├── h1: "Sign up"
│                   │   └── p: "Let's get you all set up..."
│                   │
│                   └── Form (React Hook Form)
│                       │
│                       ├── Name Row (grid 2 columns)
│                       │   ├── FormField: firstName
│                       │   │   ├── FormLabel: "First Name"
│                       │   │   ├── FormControl
│                       │   │   │   └── Input (placeholder: "John")
│                       │   │   └── FormMessage
│                       │   │
│                       │   └── FormField: lastName
│                       │       ├── FormLabel: "Last Name"
│                       │       ├── FormControl
│                       │       │   └── Input (placeholder: "Doe")
│                       │       └── FormMessage
│                       │
│                       ├── Contact Row (grid 2 columns)
│                       │   ├── FormField: email
│                       │   │   ├── FormLabel: "Email"
│                       │   │   ├── FormControl
│                       │   │   │   └── Input type="email" (placeholder: "john.doe@gmail.com")
│                       │   │   └── FormMessage
│                       │   │
│                       │   └── FormField: phoneNumber
│                       │       ├── FormLabel: "Phone Number"
│                       │       ├── FormControl
│                       │       │   └── Input type="tel" (placeholder: "+1 (555) 000-0000")
│                       │       └── FormMessage
│                       │
│                       ├── Password Field (full width)
│                       │   └── FormField: password
│                       │       ├── FormLabel: "Password"
│                       │       ├── FormControl
│                       │       │   └── div (relative)
│                       │       │       ├── Input type="password/text" (••••••••)
│                       │       │       └── button (toggle visibility)
│                       │       │           └── Icon: Eye / EyeOff
│                       │       └── FormMessage
│                       │
│                       ├── Confirm Password Field (full width)
│                       │   └── FormField: confirmPassword
│                       │       ├── FormLabel: "Confirm Password"
│                       │       ├── FormControl
│                       │       │   └── div (relative)
│                       │       │       ├── Input type="password/text" (••••••••)
│                       │       │       └── button (toggle visibility)
│                       │       │           └── Icon: Eye / EyeOff
│                       │       └── FormMessage
│                       │
│                       ├── Terms Agreement
│                       │   └── FormField: agreeToTerms
│                       │       ├── FormControl
│                       │       │   └── Checkbox
│                       │       └── FormLabel
│                       │           ├── Text: "I agree to all the"
│                       │           ├── Link: "Terms" (href="/terms")
│                       │           ├── Text: "and"
│                       │           └── Link: "Privacy Policies" (href="/privacy")
│                       │
│                       ├── Submit Button (full width, blue)
│                       │   └── Button: "Create account"
│                       │
│                       ├── Login Link
│                       │   ├── Text: "Already have an account?"
│                       │   └── Link: "Login" (href="/login")
│                       │
│                       ├── Divider
│                       │   └── "Or Sign up with"
│                       │
│                       └── SSO Buttons (grid 3 columns)
│                           ├── Button: Facebook
│                           │   └── Icon: Facebook (blue)
│                           ├── Button: Google
│                           │   └── Icon: Mail (red)
│                           └── Button: Apple
│                               └── Icon: Apple SVG (black)
```

## State Management

### Form State (React Hook Form)
```typescript
{
  firstName: string,
  lastName: string,
  email: string,
  phoneNumber: string,
  password: string,
  confirmPassword: string,
  agreeToTerms: boolean
}
```

### Local State (useState)
```typescript
- showPassword: boolean (controls password visibility)
- showConfirmPassword: boolean (controls confirm password visibility)
```

## Validation Schema (Zod)

```typescript
signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms and privacy policies'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})
```

## Event Handlers

### onSubmit(data: SignUpFormValues)
- Called when form is submitted
- Validates all fields
- Currently logs to console
- **TODO**: Integrate with authentication API

### handleSSOLogin(provider: string)
- Called when SSO button is clicked
- Receives provider name ('facebook' | 'google' | 'apple')
- Currently logs to console
- **TODO**: Integrate with OAuth providers

### Password Toggle Handlers
- `setShowPassword(!showPassword)` - Toggle password visibility
- `setShowConfirmPassword(!showConfirmPassword)` - Toggle confirm password visibility

## Dependencies

### From @myorganizer/web-ui
- Button
- Card, CardContent
- Form, FormControl, FormField, FormItem, FormLabel, FormMessage
- Input
- Checkbox

### From react-hook-form
- useForm
- Controller (via Form components)

### From @hookform/resolvers
- zodResolver

### From zod
- z (for schema definition)

### From lucide-react
- Eye, EyeOff (password visibility)
- Facebook (SSO button)
- Mail (Google SSO button)

### From next/link
- Link (navigation)

## Styling Classes

### Container
- `min-h-screen` - Full viewport height
- `flex items-center justify-center` - Center content
- `bg-gradient-to-br from-blue-50 to-indigo-100` - Gradient background
- `p-4` - Padding

### Main Layout
- `w-full max-w-6xl` - Constrained width
- `flex gap-8 items-center` - Flex layout with gap

### Left Panel
- `hidden lg:flex` - Hidden on mobile, visible on large screens
- `flex-1` - Take available space
- `bg-gradient-to-br from-purple-400 to-indigo-500` - Gradient
- `rounded-3xl shadow-2xl` - Rounded corners and shadow

### Card
- `shadow-2xl border-0` - Large shadow, no border

### Form Fields
- `grid grid-cols-1 md:grid-cols-2 gap-4` - Responsive grid
- `space-y-4` - Vertical spacing between elements

### Buttons
- Submit: `w-full bg-blue-600 hover:bg-blue-700 text-white h-12`
- SSO: `h-12 border-{color}-200 hover:bg-{color}-50`

## Responsive Breakpoints

- **Mobile (< 768px)**: 
  - Single column layout
  - Left panel hidden
  - Full width form

- **Tablet (768px - 1024px)**:
  - Two-column form fields
  - Left panel still hidden
  - Constrained width

- **Desktop (>= 1024px)**:
  - Two-column layout with illustration
  - Left panel visible
  - Side-by-side panels
