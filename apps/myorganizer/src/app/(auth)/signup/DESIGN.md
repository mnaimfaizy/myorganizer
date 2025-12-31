# Sign Up Page - Visual Design Documentation

## Page Structure

The sign-up page (`/signup`) has been implemented with the following visual structure:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FULL SCREEN (Gradient Background)                    │
│                     Blue-50 to Indigo-100 Gradient                       │
│                                                                           │
│  ┌──────────────────────┐    ┌─────────────────────────────────────┐   │
│  │                      │    │                                     │   │
│  │   LEFT ILLUSTRATION  │    │        SIGN UP FORM CARD            │   │
│  │   (Hidden on mobile) │    │                                     │   │
│  │                      │    │  ┌────────────────────────────────┐ │   │
│  │   ┌──────────────┐   │    │  │  Sign up                       │ │   │
│  │   │   📱 Icon    │   │    │  │  Let's get you all set up...   │ │   │
│  │   │              │   │    │  └────────────────────────────────┘ │   │
│  │   │  Welcome to  │   │    │                                     │   │
│  │   │ MyOrganizer  │   │    │  ┌──────────┐  ┌──────────┐        │   │
│  │   │              │   │    │  │First Name│  │Last Name │        │   │
│  │   │ Organize...  │   │    │  └──────────┘  └──────────┘        │   │
│  │   │              │   │    │                                     │   │
│  │   └──────────────┘   │    │  ┌──────────┐  ┌────────────┐      │   │
│  │                      │    │  │  Email   │  │Phone Number│      │   │
│  │  Purple-Indigo Box   │    │  └──────────┘  └────────────┘      │   │
│  │  (Rounded, Shadow)   │    │                                     │   │
│  │                      │    │  ┌────────────────────────────┐    │   │
│  └──────────────────────┘    │  │Password           [👁]     │    │   │
│                               │  └────────────────────────────┘    │   │
│                               │                                     │   │
│                               │  ┌────────────────────────────┐    │   │
│                               │  │Confirm Password   [👁]     │    │   │
│                               │  └────────────────────────────┘    │   │
│                               │                                     │   │
│                               │  ☐ I agree to Terms and Privacy    │   │
│                               │                                     │   │
│                               │  ┌────────────────────────────┐    │   │
│                               │  │    Create account          │    │   │
│                               │  │      (Blue Button)         │    │   │
│                               │  └────────────────────────────┘    │   │
│                               │                                     │   │
│                               │  Already have an account? Login    │   │
│                               │                                     │   │
│                               │  ─────── Or Sign up with ───────   │   │
│                               │                                     │   │
│                               │  ┌────┐  ┌────┐  ┌────┐           │   │
│                               │  │ f  │  │ G  │  │ 🍎 │           │   │
│                               │  └────┘  └────┘  └────┘           │   │
│                               │  Facebook Google Apple             │   │
│                               │                                     │   │
│                               └─────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Design Elements

### Colors
- **Background**: Gradient from light blue (`blue-50`) to light indigo (`indigo-100`)
- **Primary Button**: Blue (`bg-blue-600`, hover: `bg-blue-700`)
- **Links**: Red (`text-red-500`)
- **Card**: White with shadow
- **Left Panel**: Purple to Indigo gradient (`from-purple-400 to-indigo-500`)

### Typography
- **Main Heading**: 4xl, bold, dark gray
- **Subheading**: Gray-600
- **Labels**: Small, medium weight
- **Placeholders**: Sample email format

### Layout
- **Two-column layout** on large screens (lg+)
- **Single column** on mobile/tablet
- **Max width**: 6xl (1152px)
- **Card padding**: 8 (2rem)
- **Form spacing**: 4 (1rem)

### Form Fields
1. **First Name** (text input) - Left column
2. **Last Name** (text input) - Right column
3. **Email** (email input) - Left column
4. **Phone Number** (tel input) - Right column
5. **Password** (password input, full width) - With eye icon toggle
6. **Confirm Password** (password input, full width) - With eye icon toggle
7. **Terms Checkbox** - With links to Terms and Privacy

### Interactive Elements
- **Eye/EyeOff Icons**: Toggle password visibility
- **Checkbox**: Terms and Privacy agreement
- **Submit Button**: Full width, prominent blue
- **Login Link**: For existing users
- **SSO Buttons**: Three equal-width buttons in a grid

### SSO Buttons
1. **Facebook**: 
   - Border: blue-200
   - Hover: blue-50
   - Icon: Facebook (blue-600)

2. **Google**:
   - Border: red-200
   - Hover: red-50
   - Icon: Mail/Google (red-600)

3. **Apple**:
   - Border: gray-200
   - Hover: gray-50
   - Icon: Apple SVG (black)

## Responsive Behavior

- **Mobile (< 1024px)**: 
  - Left illustration panel hidden
  - Single column form
  - Full screen card

- **Desktop (>= 1024px)**:
  - Two column layout visible
  - Left illustration panel shown
  - Form fields in 2-column grid

## Accessibility
- Proper form labels for all inputs
- ARIA attributes from Radix UI components
- Keyboard navigation support
- Focus visible states
- Error messages displayed inline

## Implementation Files

- **Page Component**: `apps/myorganizer/src/app/signup/page.tsx`
- **Layout**: `apps/myorganizer/src/app/signup/layout.tsx`
- **Checkbox Component**: `libs/web-ui/src/lib/components/Checkbox/Checkbox.tsx`

## Testing Checklist

- [x] Form renders correctly
- [x] All fields are present
- [x] Validation schema works
- [x] Password toggle works
- [x] Checkbox component works
- [x] Responsive layout adapts
- [x] SSO buttons render
- [x] Links are present
- [x] No TypeScript errors
- [x] No linting errors
- [x] Build succeeds
