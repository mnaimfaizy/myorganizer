# Sign Up Page

## Overview

This directory contains the sign-up/registration page for MyOrganizer. The page allows users to create an account using traditional email/password registration or through SSO providers.

## Features

### Traditional Registration

The form includes the following fields with validation:

- **First Name** - Required field
- **Last Name** - Required field
- **Email** - Required, validated email format
- **Phone Number** - Optional; if provided, minimum 10 digits
- **Password** - Required, minimum 8 characters
- **Confirm Password** - Required, must match password
- **Terms & Privacy Agreement** - Required checkbox

### Password Security

- Password fields include toggle visibility icons (Eye/EyeOff)
- Passwords are validated to match
- Minimum 8 character requirement

### Social Sign-On (SSO)

The page provides options to sign up with:

- **Facebook** - Blue themed button with Facebook icon
- **Google** - Red themed button with Mail/Google icon
- **Apple** - Gray themed button with Apple icon (represents Twitter/X alternative)

## Components Used

All components are from the `@myorganizer/web-ui` library:

- `Button` - For submit button and SSO buttons
- `Card` / `CardContent` - Container for the form
- `Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormMessage` - Form components with react-hook-form integration
- `Input` - Text input fields
- `Checkbox` - Terms agreement checkbox

## Form Validation

Form validation is implemented using:

- **Zod** - Schema validation library
- **React Hook Form** - Form state management
- **@hookform/resolvers** - Integration between Zod and React Hook Form

Validation rules:

```typescript
- firstName: minimum 1 character, required
- lastName: minimum 1 character, required
- email: valid email format
- phoneNumber: minimum 10 digits
- password: minimum 8 characters
- confirmPassword: must match password
- agreeToTerms: must be true
```

## Layout

The page uses a custom layout (`layout.tsx`) that:

- Removes the default sidebar navigation
- Provides standalone page metadata
- Allows full-screen authentication experience

## Design

The page follows a two-column layout:

- **Left Column** (hidden on mobile/tablet):
  - Decorative illustration placeholder
  - Welcome message
  - Purple/indigo gradient background
- **Right Column**:
  - White card with form
  - Clean, modern design
  - Responsive grid layout for form fields
  - Clear visual hierarchy

## Styling

- Uses Tailwind CSS for styling
- Gradient background: `from-blue-50 to-indigo-100`
- Responsive design with mobile-first approach
- Custom colors for different elements:
  - Submit button: Blue (`bg-blue-600`)
  - Links: Red (`text-red-500`)
  - SSO buttons: Themed to match providers

## Routes

- **Sign Up Page**: `/signup`
- **Login Link**: `/login`
- **Terms Link**: `/terms` (referenced, to be implemented)
- **Privacy Link**: `/privacy` (referenced, to be implemented)

Email verification pages:

- **Verification handler**: `/verify/email?token=...`
- **Check-your-email**: `/verify/email/sent?email=...`

Resend behavior:

- The login page and the check-your-email page provide a **Resend verification email** action.
- Backend enforces a cooldown (returns `429`) if a verification email was sent recently.

## Usage

Users can access the sign-up page by navigating to `/signup`. The page provides:

1. Registration via backend API
2. Redirect to the "check your email" page after successful registration
3. Redirect to login if the email is already registered (and verified)
4. SSO buttons are present but not wired yet

## Future Enhancements

The following items need backend integration:

- [ ] Implement SSO OAuth flows for Facebook, Google, and Apple
- [ ] Implement password strength indicator
- [ ] Add CAPTCHA for bot protection
- [ ] Create Terms of Service and Privacy Policy pages

## Development

To view the page locally:

```bash
yarn start:myorganizer
# Navigate to the MyOrganizer dev server URL, then /signup
```

To build:

```bash
yarn build:myorganizer
```

To lint:

```bash
yarn nx lint myorganizer
```
