# Sign Up Page

## Overview
This directory contains the sign-up/registration page for MyOrganizer. The page allows users to create an account using traditional email/password registration or through SSO providers.

## Features

### Traditional Registration
The form includes the following fields with validation:
- **First Name** - Required field
- **Last Name** - Required field  
- **Email** - Required, validated email format
- **Phone Number** - Required, minimum 10 digits
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
- **Login Link**: `/login` (referenced, to be implemented)
- **Terms Link**: `/terms` (referenced, to be implemented)
- **Privacy Link**: `/privacy` (referenced, to be implemented)

## Usage

Users can access the sign-up page by navigating to `/signup`. The page provides:
1. Form submission handler (currently logs to console)
2. SSO button handlers (currently logs to console)
3. Link to existing login page

## Future Enhancements

The following items need backend integration:
- [ ] Connect form submission to authentication API
- [ ] Implement SSO OAuth flows for Facebook, Google, and Apple
- [ ] Add email verification workflow
- [ ] Implement password strength indicator
- [ ] Add CAPTCHA for bot protection
- [ ] Create Terms of Service and Privacy Policy pages
- [ ] Implement error handling for duplicate accounts
- [ ] Add success redirect after registration

## Development

To view the page locally:
```bash
yarn start:myorganizer
# Navigate to http://localhost:3000/signup
```

To build:
```bash
yarn build:myorganizer
```

To lint:
```bash
yarn nx lint myorganizer
```
