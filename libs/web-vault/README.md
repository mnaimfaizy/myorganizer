# web-vault

Web (browser) implementation of the encrypted vault.

This library still uses browser APIs (WebCrypto, localStorage).

## Supported Vault Blob Types

The vault supports the following encrypted blob types:

| Blob Type       | TypeScript interface | Normalization function   |
| --------------- | -------------------- | ------------------------ |
| `addresses`     | `Address`            | `normalizeAddresses`     |
| `groceries`     | `GroceryList[]`      | `normalizeGroceries`     |
| `mobileNumbers` | `MobileNumber`       | `normalizeMobileNumbers` |
| `subscriptions` | `Subscription`       | `normalizeSubscriptions` |
| `todos`         | `Todo[]`             | `normalizeTodos`         |

Each blob type is end-to-end encrypted on the client before being sent to the server. The
normalization functions handle validation, coercion, and migration of blob data when loading
from storage or vault exports.

For details on a specific feature (including user guide and vault schema), see:

- [Groceries List Keeper](../../docs/features/groceries.md)
- [Subscriptions](../../docs/features/subscriptions.md) (if available)
- [Addresses](../../docs/features/README.md#features-index) (if available)
- [Todos](../../docs/features/README.md#features-index) (if available)
- [Mobile Numbers](../../docs/features/README.md#features-index) (if available)
