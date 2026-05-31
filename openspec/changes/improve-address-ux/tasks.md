## 1. Foundations

- [x] 1.1 Export the existing `Sheet` component family from `@myorganizer/web-ui`.
- [x] 1.2 Add reusable address form helpers for country mapping, schema validation, formatting preview data, and canonical duplicate fingerprints.
- [x] 1.3 Add focused Jest tests for address validation, country defaults, formatting preview data, and duplicate matching.

## 2. Address Drawer Flow

- [x] 2.1 Replace the always-visible add-address card with a drawer-based address form using `FormField`, inline messages, account country defaults, and live preview.
- [x] 2.2 Add duplicate warning and explicit save-anyway behavior before persisting matching addresses.
- [x] 2.3 Add saved-state actions for viewing the new address or adding a usage location after save.

## 3. Address List Experience

- [x] 3.1 Add list summary counts, search/filter controls, and a stronger empty state with an add-address action.
- [x] 3.2 Make address list item actions visible and touch-accessible while preserving existing detail navigation.

## 4. Usage Location Validation

- [x] 4.1 Add offline URL validation and duplicate organisation detection to the address usage-location form.
- [x] 4.2 Surface usage-location validation and duplicate warnings inline in the form UI.

## 5. Playwright and Verification

- [x] 5.1 Update focused Playwright address CRUD coverage for the drawer flow.
- [x] 5.2 Run `yarn nx test web-pages-addresses` and fix failures.
- [x] 5.3 Run `yarn nx lint web-pages-addresses` and fix failures.
- [x] 5.4 Run `yarn nx test web-ui` and `yarn nx lint web-ui` if `web-ui` behavior changes beyond exporting `Sheet`.
- [x] 5.5 Run `yarn format:write` for touched files.
- [x] 5.6 Confirm no OpenAPI, API client, Prisma, or vault migration codegen is required.

## 6. Verification Checklist

- [x] 6.1 Address drawer opens from the list and empty state.
- [x] 6.2 Invalid address fields show inline errors and do not save.
- [x] 6.3 Duplicate address warning appears and save-anyway persists only after explicit confirmation.
- [x] 6.4 Saved addresses persist through the encrypted vault blob after reload.
- [x] 6.5 Usage-location URL and duplicate organisation warnings work without backend plaintext calls.
- [x] 6.6 Build, lint, and focused tests pass.
