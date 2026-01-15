# web-pages-subscriptions

Page library for the dashboard subscriptions routes.

## Routes

- List page: `/dashboard/subscriptions`
- Detail page: `/dashboard/subscriptions/[id]`

Route wrappers live under `apps/myorganizer/src/app/**` and should remain thin. The actual page logic lives in this library and is exported via `@myorganizer/web-pages/subscriptions`.

## Data + security model

- Subscriptions are stored **inside the encrypted vault** under the `subscriptions` vault blob type.
- The server stores **ciphertext only** (no plaintext subscription data).

## Currency + totals

- Amounts are stored with a currency code.
- The UI can optionally convert totals to the user's preferred currency (set in the Account page), using cached FX rates.
