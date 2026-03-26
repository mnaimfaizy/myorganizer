# Google OAuth Setup for YouTube Integration

This guide walks through creating Google OAuth 2.0 credentials required for the YouTube integration feature. You will set up a Google Cloud project, enable the YouTube Data API, configure the OAuth consent screen, and create client credentials for both development and production environments.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top of the page and select **New Project**.
3. Enter a project name (e.g. `MyOrganizer` or `MyOrganizer Dev`).
4. Click **Create**.
5. Make sure the new project is selected in the project dropdown.

> **Tip:** Create separate projects for development/testing and production to keep credentials and quotas isolated.

---

## Step 2: Enable the YouTube Data API v3

1. In the left sidebar, go to **APIs & Services** > **Library**.
2. Search for **YouTube Data API v3**.
3. Click on it and press **Enable**.

This is the only API required. The integration uses the `youtube.readonly` scope, which provides read-only access to subscriptions and videos — no write or delete permissions.

---

## Step 3: Configure the OAuth Consent Screen

1. In the left sidebar, go to **Google Auth platform** > **Branding** (or **APIs & Services** > **OAuth consent screen** on older console layouts).
2. If prompted with "Google Auth platform not configured yet", click **Get Started**.
3. Fill in the required fields:
   - **App name:** `MyOrganizer` (or your app name)
   - **User support email:** your email address
4. Click **Next**.

### Choose User Type

| Type         | When to Use                                                                   |
| ------------ | ----------------------------------------------------------------------------- |
| **Internal** | Only users within your Google Workspace organization. No verification needed. |
| **External** | Any Google account user (most common for personal/public projects).           |

> For personal projects or development, choose **External**. The app will start in **Testing** mode (see below).

5. Click **Next**.
6. Enter a contact email for developer notifications.
7. Review and agree to the Google API Services User Data Policy.
8. Click **Continue** > **Create**.

### Add Test Users (External + Testing Mode)

When your app is in **Testing** publishing status (the default for External apps):

- Only explicitly listed test users can complete the OAuth flow.
- Maximum of 100 test users.
- No Google app verification required.

To add test users:

1. Go to **Google Auth platform** > **Audience**.
2. Under **Test users**, click **Add users**.
3. Enter the Google email addresses of anyone who needs to test the integration.
4. Click **Save**.

### Configure Scopes (Data Access)

1. Go to **Google Auth platform** > **Data Access** (or the Scopes section of the consent screen).
2. Click **Add or Remove Scopes**.
3. Search for and select: `https://www.googleapis.com/auth/youtube.readonly`
4. Click **Save**.

This is a **sensitive scope**, meaning Google may show an "unverified app" warning during the consent flow in testing mode. Test users can bypass this by clicking **Advanced** > **Go to MyOrganizer (unsafe)**.

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. For **Application type**, select **Web application**.
4. Enter a name (e.g. `MyOrganizer Dev` or `MyOrganizer Production`).
5. Under **Authorized redirect URIs**, add the callback URL (see [Redirect URI](#understanding-the-redirect-uri) section below).
6. Click **Create**.

Google will display your **Client ID** and **Client Secret**. Copy these values — you'll need them for the `.env` file.

> **Important:** The Client Secret is shown only once on creation. You can always create a new one, but you cannot retrieve an existing secret later.

---

## Step 5: Configure Environment Variables

Add the credentials to your `.env` file:

```env
# YouTube Integration (Google OAuth + API)
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:4200/dashboard/youtube/callback

# 64-char hex key for encrypting YouTube OAuth tokens at rest.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
YOUTUBE_TOKEN_ENCRYPTION_KEY=<your-generated-64-char-hex-key>

# Shared secret for the /youtube/cron/sync-and-notify endpoint.
YOUTUBE_CRON_SECRET=<your-random-secret>
```

---

## Understanding the Redirect URI

The redirect URI is the URL where Google sends the user back after they authorize (or deny) the app on the consent screen. It is a critical part of the OAuth 2.0 flow.

### How the OAuth Flow Works

```
1. User clicks "Connect YouTube" in the frontend
       │
       ▼
2. Frontend calls GET /api/v1/youtube/auth-url (authenticated)
       │
       ▼
3. Backend builds the Google OAuth consent URL using:
   - GOOGLE_CLIENT_ID
   - GOOGLE_REDIRECT_URI
   - Scopes: youtube.readonly
   - access_type: offline (for refresh token)
   - state: the user's ID (CSRF protection)
       │
       ▼
4. Frontend redirects the browser to Google's consent page
   (window.location.href = consentUrl)
       │
       ▼
5. User authorizes on Google's consent screen
       │
       ▼
6. Google redirects the browser to GOOGLE_REDIRECT_URI with:
   - ?code=<authorization_code>&state=<user_id>
       │
       ▼
7. Frontend callback page (/dashboard/youtube/callback):
   - Extracts the authorization code from the URL
   - Sends POST /api/v1/youtube/callback with { code } + JWT auth
       │
       ▼
8. Backend exchanges the code for access + refresh tokens:
   - Encrypts and stores the tokens in the database
   - Returns { ok: true, message: "YouTube account connected" }
       │
       ▼
9. Frontend redirects the user to /dashboard/youtube
```

### Key Points About the Redirect URI

- **Must match exactly** — The redirect URI configured in Google Cloud Console must match `GOOGLE_REDIRECT_URI` in your `.env` file character-for-character (including trailing slashes, protocol, and port).
- **Must be HTTPS in production** — Google requires HTTPS for redirect URIs, except for `localhost` which allows HTTP.
- **Points to the frontend** — The redirect URI is a frontend page (`/dashboard/youtube/callback`) that captures the authorization code from Google, then calls the backend API (authenticated with JWT) to exchange it for tokens. This avoids the issue of Google redirecting to a backend endpoint without any authentication context.

### Environment-Specific Redirect URIs

| Environment | Redirect URI                                                |
| ----------- | ----------------------------------------------------------- |
| Development | `http://localhost:4200/dashboard/youtube/callback`          |
| Staging     | `https://staging.yourdomain.com/dashboard/youtube/callback` |
| Production  | `https://yourdomain.com/dashboard/youtube/callback`         |

Each redirect URI must be added to the **Authorized redirect URIs** list in the corresponding Google Cloud OAuth client.

---

## Development vs. Production Setup

### Development / Testing

| Setting                | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| Google Cloud Project   | Separate dev project (recommended)                           |
| Consent Screen Status  | **Testing** (only test users can authorize)                  |
| User Type              | External                                                     |
| Test Users             | Add your dev Google accounts under **Audience > Test users** |
| Redirect URI           | `http://localhost:4200/dashboard/youtube/callback`           |
| Unverified App Warning | Yes — click "Advanced" > "Go to app (unsafe)" to bypass      |

### Production

| Setting               | Value                                               |
| --------------------- | --------------------------------------------------- |
| Google Cloud Project  | Separate production project (recommended)           |
| Consent Screen Status | **In production** (any Google user can authorize)   |
| User Type             | External                                            |
| Redirect URI          | `https://yourdomain.com/dashboard/youtube/callback` |
| App Verification      | Required for sensitive scopes (see below)           |

### Publishing to Production

When you're ready to go live:

1. Go to **Google Auth platform** > **Audience**.
2. Change the publishing status from **Testing** to **In production**.
3. Google will require app verification since `youtube.readonly` is a **sensitive scope**.
4. You'll need to:
   - Provide a link to your app's privacy policy
   - Provide a link to your terms of service (optional but recommended)
   - Describe how the app uses the requested data
   - Submit for verification review (can take several days to weeks)
5. Until verified, users will see an "unverified app" warning screen.

> **Note:** If your app is only for personal use, you can keep it in **Testing** mode indefinitely and add your own Google account as a test user. No verification needed.

---

## Multiple OAuth Clients (Recommended)

For proper environment separation, create separate OAuth client IDs within the same or different Google Cloud projects:

1. **Development client:** Redirect URI points to `localhost:4200/dashboard/youtube/callback`
2. **Staging client:** Redirect URI points to your staging frontend domain
3. **Production client:** Redirect URI points to your production frontend domain

Each environment's `.env` file uses its own `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.

---

## Troubleshooting

| Issue                                           | Solution                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch` error                   | The `GOOGLE_REDIRECT_URI` in `.env` doesn't match what's configured in Google Cloud Console. Check for trailing slashes, protocol (http vs https), and port.                  |
| "Access blocked: This app's request is invalid" | The OAuth consent screen is not configured, or the app has been suspended.                                                                                                    |
| "Error 403: access_denied"                      | The user is not in the test users list (when app is in Testing mode).                                                                                                         |
| "This app isn't verified" warning               | Expected in Testing mode. Click **Advanced** > **Go to MyOrganizer (unsafe)**. For production, submit for verification.                                                       |
| No refresh token received                       | Google only returns a refresh token on the **first** authorization. The app uses `prompt: 'consent'` to force it every time. If tokens are missing, disconnect and reconnect. |
| `YOUTUBE_TOKEN_ENCRYPTION_KEY` errors           | Ensure the key is exactly 64 hex characters (32 bytes). Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`                             |

---

## Security Considerations

- **Never commit** `.env` or real credentials to source control.
- Keep `GOOGLE_CLIENT_SECRET` and `YOUTUBE_TOKEN_ENCRYPTION_KEY` unique per environment.
- OAuth tokens are encrypted at rest using AES-256-GCM before being stored in the database.
- The `youtube.readonly` scope provides the minimum access level needed — no write or delete permissions.
- The `state` parameter carries the user ID to prevent CSRF attacks during the OAuth callback.

---

## References

- [YouTube Data API — Getting Started](https://developers.google.com/youtube/v3/getting-started)
- [YouTube Data API — Obtaining Authorization Credentials](https://developers.google.com/youtube/registering_an_application)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Configure the OAuth Consent Screen](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials)
