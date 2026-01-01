# Authentication

This project uses **Option A**:

- **Access token**: short-lived JWT, sent as `Authorization: Bearer <token>`.
- **Refresh token**: stored in an **HTTP-only cookie** (not accessible to JavaScript).
- Frontend stores **only the access token** (localStorage or sessionStorage).

## Backend endpoints

All endpoints are under the backend router prefix (see `ROUTER_PREFIX`).

- `POST /auth/register` – creates a user
  - Body: `firstName`, `lastName`, `email`, `password`, optional `phone`
- `POST /auth/login` – returns `{ token, expires_in, user }` and sets refresh cookie
- `POST /auth/refresh` – returns `{ token, expires_in, user }`
  - Refresh token is taken from the refresh cookie (request body is optional)
- `POST /auth/logout/:userId` – invalidates refresh token and clears refresh cookie

## Frontend behavior

Frontend auth logic lives in the monorepo library `@myorganizer/auth`.

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

## Security notes

- Refresh token is in an HTTP-only cookie, reducing XSS exposure.
- Access token in browser storage is still sensitive; keep token TTL short.
- Ensure CORS allows credentials and restricts origins.
- In production, refresh cookie should be `Secure` and an appropriate `SameSite`.
