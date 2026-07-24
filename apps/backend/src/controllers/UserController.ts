/**
 * Legacy `/user` HTTP surfaces have been removed (ADR-0011 / issue #198).
 * Registration lives at `POST /auth/register`.
 * Platform Admin directory lives at `GET /admin/users` and `GET /admin/users/{userId}`.
 *
 * This module remains only so existing imports (e.g. service helpers used by auth
 * tests that mocked UserController) do not break at compile time if reintroduced.
 * It intentionally exposes no TSOA routes.
 */
export class UserController {
  // no HTTP endpoints
}

const userController = new UserController();
export default userController;
