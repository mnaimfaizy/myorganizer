# web-pages-account

Dashboard Account page (Settings).

## Route

- `/dashboard/account`

Route wrapper lives under `apps/myorganizer/src/app/**` and should remain thin. The actual page logic lives in this library and is exported via `@myorganizer/web-pages/account`.

## What it stores

- Preferred **country** and **currency** settings (client-side settings used by vault-backed views).

These preferences are intentionally kept out of the encrypted vault (they are not sensitive like addresses/subscriptions) and are used for display and currency conversion in pages such as Subscriptions.
