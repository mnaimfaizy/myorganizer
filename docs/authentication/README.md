# Authentication

This project uses **Option A**:

- **Access token**: short-lived JWT, sent as `Authorization: Bearer <token>`.
- **Refresh token**: stored in an **HTTP-only cookie** (not accessible to JavaScript).
- Frontend stores **only the access token** (localStorage or sessionStorage).

## Backend endpoints

All endpoints are under the backend router prefix (see `ROUTER_PREFIX`).

- `POST /auth/register` – creates a user
  - Body: `firstName`, `lastName`, `email`, `password`, optional `phone`
- Creates the user and sends a verification email
- Returns a message-based response (e.g. `{ message, user }`)
- `POST /auth/login` – returns `{ token, expires_in, user }` and sets refresh cookie
- `POST /auth/refresh` – returns `{ token, expires_in, user }`
  - Refresh token is taken from the refresh cookie (request body is optional)
- `POST /auth/logout/:userId` – invalidates refresh token and clears refresh cookie

Email verification:

- `PATCH /auth/verify/email` – verifies the email using a token
  - Body: `{ token: string }`
- `POST /auth/verify/resend` – resends the verification email (public)
  - Body: `{ email: string }`
  - Returns `429` if a non-expired verification token already exists (cooldown)
- `POST /auth/verify/resend/:userId` – resends the verification email (authenticated)
  - Requires JWT + ownership

## Frontend behavior

Frontend auth logic lives in the monorepo library `@myorganizer/auth`.

### Email verification UX

- After successful registration, the user is redirected to: `/verify/email/sent?email=...`
- The verification email links to the frontend: `/verify/email?token=...`
  - This page calls the backend `PATCH /auth/verify/email` endpoint.
- Login/refresh are blocked until the email is verified.
  - Backend responds with `403` and a user-friendly message (frontend displays it).
- The login page and the verification instructions page include a **Resend verification email** action.
  - If a verification email was sent recently, backend returns `429` to prevent spamming.

### Token storage

- If user checks **Remember me**, the access token is stored in `localStorage`.
- Otherwise it is stored in `sessionStorage`.

Keys used:

- `myorganizer_access_token`
- `myorganizer_user`

### Requests and refresh-on-401

`@myorganizer/auth` creates an Axios instance with:

- `withCredentials: true` (so the refresh cookie is sent)
- An interceptor that, on `401` for non-auth requests:
  1. Calls `POST /auth/refresh`
  2. Updates stored access token
  3. Retries the original request once

If refresh fails, the session is cleared.

## Configuration

Frontend expects `NEXT_PUBLIC_API_BASE_URL` to point at the backend base URL.

Examples:

- No prefix: `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`
- With prefix: `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1`

The value should match how the backend is started (notably `ROUTER_PREFIX`).

Backend uses `APP_FRONTEND_URL` to generate links inside emails (verification/reset).

Typical dev defaults:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:4200`

## Security notes

- Refresh token is in an HTTP-only cookie, reducing XSS exposure.
- Access token in browser storage is still sensitive; keep token TTL short.
- Ensure CORS allows credentials and restricts origins.
- In production, refresh cookie should be `Secure` and an appropriate `SameSite`.
- Email verification is required before issuing tokens.

## Anti-spam / cooldown behavior

To avoid email flooding, verification resends are guarded:

- Backend stores the last verification token in `User.email_verification_token`.
- While the token is still valid (currently `10m`, same as `VERIFY_JWT_SECRET` token TTL), resend requests return `429`.
- The token is persisted **only after** the verification email was sent successfully.
- When the user verifies (`PATCH /auth/verify/email`), the stored token is cleared.
