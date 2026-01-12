# Address & Mobile Usage Locations (E2EE) — Implementation Plan

## Goals

- Provide a dedicated detail page per **Address** and per **Mobile Number**.
- On each detail page, show a list of **where it is used** (government, bank, insurance, school, university, etc.).
- Provide a form to add a new usage location.
- Store these records **only inside the encrypted vault** (Option B). Plaintext must never be stored on the server.
- Keep server sync allowed **only as ciphertext**.
- Ensure the user can **download the recovery key** immediately after creating their vault passphrase.

## Scope

- Add per-record routes:
  - `/dashboard/addresses/[id]`
  - `/dashboard/mobile-numbers/[id]`
- Extend the existing encrypted vault plaintext payload shape for addresses/mobileNumbers.
- No editing/deleting of usage locations in this phase (can be added later).

## Data Model (plaintext inside vault)

These types are shared from `@myorganizer/core`:

- `AddressRecord`
  - `id`, `label`, `address`, `status: AddressStatus`, `usageLocations: UsageLocationRecord[]`, `createdAt`
- `MobileNumberRecord`
  - `id`, `label`, `mobileNumber`, `usageLocations: UsageLocationRecord[]`, `createdAt`
- `UsageLocationRecord`
  - `organisationName`, `organisationType`, `updateMethod`, `changed`, `link?`, `priority`, `createdAt`, `changedAt?`

### Enums

- `OrganisationType` (rich + `Other`)
- `UpdateMethod` (`online | inPerson | phone | mail`)
- `Priority` (`low | normal | medium | high`)
- `AddressStatus` (`current | old`)

## Storage Architecture

- Local vault ciphertext is stored under localStorage key `myorganizer_vault_v1`.
- Plaintext is **only** present in memory after unlock.
- Server sync uses the existing `VaultBlobType.Addresses` and `VaultBlobType.MobileNumbers` blobs.
- To avoid backend/schema expansion, usage locations are embedded inside the existing blobs.

## UI Flow

### Addresses list

- Page: `/dashboard/addresses`
- Stores/loads `AddressRecord[]` via `loadDecryptedData({ type: 'addresses' })`.
- Each list item links to `/dashboard/addresses/[id]`.

### Address detail

- Page: `/dashboard/addresses/[id]`
- Displays:
  - label, address, status
  - `usageLocations[]` list
  - “Add location where used” form

### Mobile numbers list

- Page: `/dashboard/mobile-numbers`
- Stores/loads `MobileNumberRecord[]` via `loadDecryptedData({ type: 'mobileNumbers' })`.
- Each list item links to `/dashboard/mobile-numbers/[id]`.

### Mobile number detail

- Page: `/dashboard/mobile-numbers/[id]`
- Displays:
  - label, number
  - `usageLocations[]` list
  - “Add location where used” form

## Migration / Normalization

Because vault blobs are schemaless JSON, old users may have:

- missing `usageLocations`
- missing `status` on addresses
- potentially older formats (strings)

We normalize on load:

- ensure stable `id`
- default `status = current`
- default `usageLocations = []`
- drop invalid usage location entries

## Recovery Key Download

### Requirement

Provide an option to download the recovery key once the user sets up the passphrase.

### Why it must be immediate

The recovery key **must not be stored** (even encrypted) in the vault; if it were, it could be recovered without user action, weakening the security model. Therefore it must be shown and downloadable **only at creation time**.

### UX

After vault creation:

- show recovery key
- provide “Download recovery key”
- provide “Copy”
- provide “I saved it” to proceed to unlock

## Pseudocode

### Normalize address list

```ts
function normalizeAddresses(raw: unknown): { value: AddressRecord[]; changed: boolean } {
  if (!Array.isArray(raw)) return { value: [], changed: raw != null };

  changed = false
  out = []

  for item of raw:
    if item is string:
      changed = true
      out.push({ id: uuid(), label: 'Address', address: item, status: 'current', usageLocations: [], createdAt: nowIso() })
      continue

    if item is not object:
      changed = true
      continue

    out.push({
      id: item.id ?? uuid(),
      label: item.label ?? 'Address',
      address: item.address ?? '',
      status: item.status === 'old' ? 'old' : 'current',
      usageLocations: normalizeUsageList(item.usageLocations),
      createdAt: item.createdAt ?? nowIso()
    })

  return { value: out, changed }
}
```

### Add usage location

```ts
async function addUsageLocationAddress(masterKeyBytes, addressId, form) {
  raw = await loadDecryptedData({ masterKeyBytes, type: 'addresses', defaultValue: [] });
  normalized = normalizeAddresses(raw);

  nextUsage = [
    {
      id: uuid(),
      organisationName: form.orgName,
      organisationType: parseOrgType(form.orgType),
      updateMethod: parseUpdateMethod(form.updateMethod),
      changed: form.changed,
      link: form.link || undefined,
      priority: parsePriority(form.priority),
      createdAt: nowIso(),
      changedAt: form.changed ? nowIso() : undefined,
    },
    ...found.usageLocations,
  ];

  nextAddresses = normalized.value.map((a) => (a.id === addressId ? { ...a, usageLocations: nextUsage } : a));

  await saveEncryptedData({ masterKeyBytes, type: 'addresses', value: nextAddresses });
}
```

### Vault creation (recovery key download)

```ts
async function createVault(passphrase) {
  result = await initializeVault({ passphrase });

  // IMPORTANT: do NOT store recovery key.
  // Show it once, provide download/copy.
  setRecoveryKey(result.recoveryKey);

  // Only after user confirms they saved it:
  // setVaultExists(true) -> show unlock UI
}
```

## Files / Ownership

- Shared types: `libs/core/src/lib/vault/contactRecords.ts`
- Normalization: `apps/myorganizer/src/lib/vault/contactRecordNormalization.ts`
- Addresses list: `apps/myorganizer/src/app/dashboard/addresses/page.tsx`
- Address detail: `apps/myorganizer/src/app/dashboard/addresses/[id]/page.tsx`
- Mobile list: `apps/myorganizer/src/app/dashboard/mobile-numbers/page.tsx`
- Mobile detail: `apps/myorganizer/src/app/dashboard/mobile-numbers/[id]/page.tsx`
- Recovery key UX: `apps/myorganizer/src/components/vault-gate.tsx`
