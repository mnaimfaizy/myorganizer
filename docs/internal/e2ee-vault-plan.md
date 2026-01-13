# E2EE Vault + Address/Phone Feature Plan (Web now, Mobile later)

Status: draft/internal

## Goal

Add **Addresses** and **Mobile Numbers** features that:

- Support multiple entries per user (multiple addresses, multiple numbers)
- Provide a clear UI navigation flow (separate pages)
- Protect sensitive data using **end-to-end encryption (E2EE)** so the backend/database cannot read plaintext
- Provide a **forgot passphrase recovery option**
- Are designed to be portable to a future mobile app

This doc includes pseudocode and recommended architecture. The current codebase already contains a first-pass web vault prototype (local-only) which this plan generalizes.

---

## Threat Model & Scope (What we are protecting against)

### Primary goals

- **Database leak protection:** If Postgres/Prisma DB is stolen, attackers should only see ciphertext.
- **Blind server/storage:** Backend cannot read addresses/phone numbers in normal operation.
- **Cloud backup safety:** Export/backup files are safe to store anywhere because they contain ciphertext only.

### Non-goals (explicitly out of scope)

- **Compromised device/session:** If the user’s browser/device is compromised while unlocked, E2EE cannot help.
- **Server-side plaintext search/filtering on sensitive fields:** Not possible without weakening E2EE.

### Important product decisions (must be confirmed)

- Multi-device behavior: “user enters passphrase on every device” vs “device enrollment/QR transfer”.
- Recovery policy: is the recovery key sufficient, or do we need a second recovery method (see Recovery Options below)?

---

## WhatsApp-Like Clarification (What we mean by “E2EE” here)

WhatsApp’s E2EE is built around the Signal protocol for **message transport** (asymmetric ratchets, forward secrecy).

This feature is different: it’s primarily **encrypted personal records at rest** + **encrypted backups**. We do not need the full Signal protocol unless we later add:

- real-time device-to-device sync with forward secrecy guarantees, or
- sharing encrypted data between multiple users.

For this project, “WhatsApp-like” means:

- keys remain on user devices,
- server can’t read data,
- recovery/migration is possible (recovery key, QR transfer),
- backups are encrypted exports.

---

## Architecture Overview

### Data classification

- **Sensitive (E2EE):** addresses, phone numbers, any provider-account identifiers, notes, proof documents
- **Non-sensitive (plaintext OK):** provider catalog (e.g., banks, government orgs), checklists templates, UI preferences

### High-level design

We implement a **client-side vault**:

- Client encrypts sensitive records before sending/storing.
- Server stores only ciphertext + minimal metadata.
- Decryption keys never leave the user’s devices.

We use envelope encryption:

- Master Key (MK): random 32 bytes
- Data blobs (per feature): encrypted using MK
- MK is wrapped (encrypted) using:
  - Passphrase-derived key (for normal unlock)
  - Recovery key (for forgot-passphrase recovery)

In the prototype, ciphertext is stored in localStorage. In the production version, ciphertext should be stored in the backend DB so users can sync across devices.

---

## Feature Model: “Where do I need to update my address?”

This feature has two separate concepts:

1. **User’s sensitive contact data** (E2EE):

- home address(es), office address(es)
- mobile number(s)

2. **Update targets / providers** (mostly non-sensitive):

- government organizations, banks, utilities, etc.

Recommended split:

- Store the **provider catalog** in plaintext (name, category, country, website URL, phone number, general instructions).
- Store the user’s **provider-specific notes/identifiers** encrypted (e.g., “account number”, “contract reference”, “branch”, “login email used there”).

Minimal conceptual model:

```ts
type Provider = {
  id: string;
  name: string;
  category: 'Government' | 'Bank' | 'Utility' | 'Other';
  country?: string;
  contactUrl?: string;
};

// Non-sensitive linkage (or encrypt if you want maximum privacy)
type ProviderLink = {
  id: string;
  providerId: string;
  needsUpdate: boolean;
  lastUpdatedAt?: string;
};

// Sensitive, store encrypted in the vault
type ProviderPrivateNote = {
  providerId: string;
  note: string;
};
```

If you want to hide even the list of banks/utilities a user has, then encrypt `ProviderLink` too.

Update (Jan 2026): we are treating address/mobile "where used" lists as vault-private.

- Usage locations are stored **inside the encrypted vault blobs** alongside addresses/mobile numbers.
- Dedicated detail pages render these encrypted usage-location records.

See: `docs/internal/address-mobile-usage-plan.md`.

---

## UI Navigation Flow

### Navigation

Sidebar links (already started in app):

- Home (/)
- Todos (/todo)
- Addresses (/addresses)
- Mobile Numbers (/mobile-numbers)

### Page flows

#### Addresses page (/addresses)

1. Vault gate appears if vault is locked/uninitialized.
2. Once unlocked:
   - List existing addresses
   - Form to add a new address
   - Delete an address

#### Mobile numbers page (/mobile-numbers)

1. Vault gate
2. Once unlocked:
   - List existing numbers
   - Form to add a number
   - Delete a number

#### Vault Gate UX

- If no vault exists:
  - Create passphrase
  - Confirm passphrase
  - Generate recovery key
  - Prompt user to save recovery key (download/copy)
- If vault exists:
  - Unlock with passphrase
  - OR “Forgot passphrase” => input recovery key => unlock => set new passphrase

Notes:

- For web: the “unlock” is per session/page refresh. A future improvement is to store an in-memory unlock state in a client store and keep it across pages.

---

## Crypto Design (Web)

### Algorithms (prototype vs recommended)

- Prototype (already implemented):
  - KDF: PBKDF2-SHA256 (high iteration count)
  - AEAD: AES-256-GCM (WebCrypto)
- Recommended for production / cross-platform parity:
  - KDF: Argon2id (memory-hard)
  - AEAD: XChaCha20-Poly1305 (libsodium)

Reason: Argon2id + XChaCha20-Poly1305 are easier to keep consistent across web + mobile and have strong misuse resistance.

### Recovery Options (forgot passphrase)

Baseline (implemented in concept):

- **Recovery key**: a random high-entropy secret shown once to the user and used to unwrap the Master Key.

Optional future enhancements (do not implement until needed):

- **Shamir secret sharing**: split recovery secret into N shares (e.g., 2-of-3) stored across user’s devices or trusted locations.
- **Trusted contacts**: user designates contacts; recovery requires multiple approvals.

Avoid “email reset” of vault passphrase unless you accept server-side escrow (which breaks true E2EE).

### Key material

- Master Key (MK): random 32 bytes
- Recovery Key (RK): random 32 bytes encoded for the user (base64 or word list)
- Passphrase-derived key (PK): derived from user passphrase using KDF + stored salt/params

### Stored vault metadata (conceptual)

```ts
VaultStorage {
  version: 1
  kdf: {
    name: 'PBKDF2' | 'Argon2id'
    params: { iterations? memory? parallelism? }
    salt: base64
  }

  // Wrapped master keys
  masterKeyWrappedWithPassphrase: { iv, ciphertext }
  masterKeyWrappedWithRecoveryKey: { iv, ciphertext }

  // Encrypted data blobs
  data: {
    addresses?: { iv, ciphertext }
    mobileNumbers?: { iv, ciphertext }
  }
}
```

---

## Pseudocode: Vault Core

### Initialize vault

```ts
function initializeVault(passphrase): { recoveryKey } {
  salt = randomBytes(16);
  PK = KDF(passphrase, salt, params);

  MK = randomBytes(32);

  recoveryKey = encodeBase64(randomBytes(32));
  RK = decodeBase64(recoveryKey);
  RKKey = importKey(RK);

  wrappedMK_passphrase = AEAD_Encrypt(PK, (iv = randomBytes(12)), (plaintext = MK));
  wrappedMK_recovery = AEAD_Encrypt(RKKey, (iv = randomBytes(12)), (plaintext = MK));

  vault = {
    version: 1,
    kdf: { name, params, salt },
    masterKeyWrappedWithPassphrase: wrappedMK_passphrase,
    masterKeyWrappedWithRecoveryKey: wrappedMK_recovery,
    data: {},
  };

  storage.save(vault);
  return { recoveryKey };
}
```

### Unlock with passphrase

```ts
function unlockWithPassphrase(passphrase): MK {
  vault = storage.load();
  PK = KDF(passphrase, vault.kdf.salt, vault.kdf.params);
  MK = AEAD_Decrypt(PK, vault.masterKeyWrappedWithPassphrase);
  return MK;
}
```

### Unlock with recovery key (forgot passphrase)

```ts
function unlockWithRecoveryKey(recoveryKey): MK {
  vault = storage.load();
  RK = decodeRecoveryKey(recoveryKey);
  RKKey = importKey(RK);
  MK = AEAD_Decrypt(RKKey, vault.masterKeyWrappedWithRecoveryKey);
  return MK;
}
```

### Reset passphrase after recovery

```ts
function setNewPassphrase(MK, newPassphrase): void {
  vault = storage.load();
  PK = KDF(newPassphrase, vault.kdf.salt, vault.kdf.params);
  vault.masterKeyWrappedWithPassphrase = AEAD_Encrypt(PK, (iv = randomBytes(12)), (plaintext = MK));
  storage.save(vault);
}
```

### Encrypt/decrypt feature data

```ts
function saveEncryptedData(MK, type, value): void {
  vault = storage.load();
  blob = AEAD_Encrypt(importKey(MK), (iv = randomBytes(12)), (plaintext = UTF8(JSON.stringify(value))));
  vault.data[type] = blob;
  storage.save(vault);
}

function loadDecryptedData(MK, type, defaultValue): T {
  vault = storage.load();
  blob = vault.data[type];
  if (!blob) return defaultValue;
  plaintext = AEAD_Decrypt(importKey(MK), blob);
  return JSON.parse(UTF8Decode(plaintext));
}
```

---

## Data Models (Client)

### Addresses

```ts
type AddressItem = {
  id: string;
  label: 'Home' | 'Office' | string;
  address: string;
  createdAt: string;
};
```

### Mobile numbers

```ts
type MobileNumberItem = {
  id: string;
  label: 'Primary' | 'Work' | string;
  e164: string; // recommended normalized format
  country?: string;
  createdAt: string;
};
```

---

## Server/DB Plan (Phase 2: sync + multi-device)

Right now, localStorage proves the concept. To make it usable across devices and for a future mobile app, move storage to the backend.

### Minimal DB schema (ciphertext only)

```sql
Table EncryptedVault (
  id uuid pk,
  userId uuid unique,

  version int,

  kdf_name text,
  kdf_salt text,
  kdf_params jsonb,

  wrapped_mk_passphrase jsonb,
  wrapped_mk_recovery jsonb,

  createdAt timestamp,
  updatedAt timestamp
)

Table EncryptedVaultBlob (
  id uuid pk,
  userId uuid,
  type text,                 -- 'addresses' | 'mobileNumbers'
  blob jsonb,                -- {iv, ciphertext}
  updatedAt timestamp,
  unique(userId, type)
)
```

### API endpoints (blind storage)

```http
GET    /vault
PUT    /vault
GET    /vault/blob/:type
PUT    /vault/blob/:type
POST   /vault/export
POST   /vault/import
```

Notes:

- Server never sees plaintext.
- Auth uses existing JWT.
- Rate-limit vault endpoints.

---

## Phase 1 → Phase 2 Migration Playbook (Local → Server Sync)

This section makes the sync layer unambiguous: **exact request/response shapes**, validation rules, and a safe migration path.

### Guiding rules

- Backend stores **ciphertext only**.
- Backend does **not** validate user content (addresses/phones) beyond size/shape.
- Client remains responsible for encryption/decryption and schema evolution.

### Types (wire format)

All ciphertext payloads use this shape:

```ts
type EncryptedBlobV1 = {
  v: 1;
  alg: 'AES-256-GCM' | 'XCHACHA20-POLY1305';
  iv: string; // base64
  ciphertext: string; // base64 (includes auth tag if AES-GCM)
};
```

Vault metadata (server-stored, no plaintext secrets):

```ts
type VaultMetaV1 = {
  v: 1;
  kdf: {
    name: 'PBKDF2' | 'ARGON2ID';
    salt: string; // base64
    params: Record<string, number>;
  };
  wrappedMkPassphrase: EncryptedBlobV1;
  wrappedMkRecovery: EncryptedBlobV1;
};
```

Notes:

- `alg` is informational for clients; server treats it as opaque.
- Keep `v` to allow future migrations.

### Endpoint contracts

#### `GET /vault`

Returns the vault metadata for the authenticated user.

Response:

```json
{
  "meta": {
    "v": 1,
    "kdf": { "name": "PBKDF2", "salt": "...", "params": { "iterations": 310000 } },
    "wrappedMkPassphrase": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." },
    "wrappedMkRecovery": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }
  },
  "updatedAt": "2025-12-27T00:00:00.000Z",
  "etag": "W/\"vaultmeta:...\""
}
```

Status codes:

- `200` exists
- `404` vault not initialized for this user

#### `PUT /vault`

Creates or replaces vault metadata.

Headers:

- `If-Match: <etag>` (optional but recommended for concurrency)

Request:

```json
{
  "meta": {
    "v": 1,
    "kdf": { "name": "PBKDF2", "salt": "...", "params": { "iterations": 310000 } },
    "wrappedMkPassphrase": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." },
    "wrappedMkRecovery": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }
  }
}
```

Response:

```json
{ "ok": true, "etag": "W/\"vaultmeta:...\"", "updatedAt": "..." }
```

Status codes:

- `200` updated
- `201` created
- `409` conflict (etag mismatch) if `If-Match` is provided and stale
- `422` invalid shape / too large

#### `GET /vault/blob/:type`

`type ∈ {'addresses','mobileNumbers'}`

Response:

```json
{
  "type": "addresses",
  "blob": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." },
  "updatedAt": "...",
  "etag": "W/\"vaultblob:addresses:...\""
}
```

Status codes:

- `200` exists
- `404` blob not set

#### `PUT /vault/blob/:type`

Stores a ciphertext blob.

Headers:

- `If-Match: <etag>` (optional but recommended)

Request:

```json
{
  "type": "addresses",
  "blob": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }
}
```

Response:

```json
{ "ok": true, "etag": "W/\"vaultblob:addresses:...\"", "updatedAt": "..." }
```

Status codes:

- `200` updated
- `201` created
- `409` conflict (etag mismatch)
- `422` invalid shape / too large

#### `POST /vault/export`

Server returns a single JSON document for backup.

Response:

```json
{
  "exportVersion": 1,
  "exportedAt": "...",
  "meta": { "v": 1, "kdf": { "name": "PBKDF2", "salt": "...", "params": { "iterations": 310000 } }, "wrappedMkPassphrase": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }, "wrappedMkRecovery": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." } },
  "blobs": {
    "addresses": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." },
    "mobileNumbers": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }
  }
}
```

#### `POST /vault/import`

Client uploads a previously exported ciphertext bundle.

Request:

```json
{
  "exportVersion": 1,
  "meta": { "v": 1, "kdf": { "name": "PBKDF2", "salt": "...", "params": { "iterations": 310000 } }, "wrappedMkPassphrase": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }, "wrappedMkRecovery": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." } },
  "blobs": {
    "addresses": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." },
    "mobileNumbers": { "v": 1, "alg": "AES-256-GCM", "iv": "...", "ciphertext": "..." }
  }
}
```

Response:

```json
{ "ok": true }
```

### Validation & limits (server)

To prevent abuse while staying blind:

- `iv` must be base64 and decode to a reasonable size (e.g., 12–24 bytes)
- `ciphertext` must be base64
- Recommended limits:
  - vault meta payload <= 32 KB
  - each blob <= 256 KB
  - total export/import <= 1 MB

Server should reject with `422` if sizes exceed limits.

### Concurrency & conflict handling

Use optimistic concurrency with ETags.

Client algorithm:

```ts
// update flow
remote = GET /vault/blob/addresses; // yields etag
nextBlob = encrypt(updatedAddresses);

try PUT /vault/blob/addresses with If-Match: remote.etag
if 409:
  latest = GET /vault/blob/addresses
  // simplest: last-write-wins with user confirmation
  // better: decrypt both, merge by id, re-encrypt, and PUT again
```

### Migration steps

1. Implement Phase 2 endpoints and DB tables.
2. On client startup (after auth):
   - If server has no vault (`404`) and local vault exists => upload local vault (meta + blobs).
   - If server has a vault and local vault exists but differs => prompt user which to keep or attempt merge.
3. Once Phase 2 is stable, prefer server-backed storage; keep localStorage as a cached copy only.

### Multi-device strategy (recommended progression)

Phase 2A (simple):

- User enters passphrase on each device.
- Backend stores ciphertext blobs only.

Phase 2B (better UX):

- Add device enrollment.
- Each device has a device keypair (stored in Keychain/Keystore on mobile).
- Wrap MK to each enrolled device (or transfer wrapped MK via QR).

---

## Backup/Restore Plan

### Export

- Client pulls the ciphertext blobs (either from local storage or server)
- Writes a single file that contains:
  - vault metadata (kdf, wrapped keys)
  - encrypted blobs per type

### Restore

- Client imports file
- User unlocks via passphrase or recovery key
- Client uploads ciphertext back to server or stores locally

Pseudocode:

```ts
function exportVaultFile(): string {
  vault = storage.loadOrFetch();
  return JSON.stringify(vault);
}

function importVaultFile(fileJson): void {
  vault = JSON.parse(fileJson);
  validateVersionAndShape(vault);
  storage.saveOrUpload(vault);
}
```

---

## Mobile App Considerations

- Prefer libsodium-based crypto so the exact same algorithms are available on:
  - Web (via WASM wrapper)
  - iOS/Android (native bindings)
- Store MK (or device keys) in:
  - iOS Keychain
  - Android Keystore
- Multi-device setup options:
  - QR code transfer of a wrapped MK
  - Recovery key entry

---

## Security Notes / UX Warnings

- Recovery key is effectively a “master password”. Anyone who has it can decrypt.
- If both passphrase and recovery key are lost, data is unrecoverable (true for real zero-knowledge).
- E2EE limits server-side search/filtering; do client-side search after decrypt.

Additional operational notes:

- Logging: never log decrypted payloads client-side or server-side.
- Crash reporting: ensure no sensitive values are included in errors/telemetry.
- Rate limits: apply to vault endpoints and auth endpoints.

---

## Implementation Notes (Current Repo)

This section anchors the plan to the existing codebase structure.

### Frontend (Next.js)

- App router lives under `apps/myorganizer/src/app`.
- Sidebar nav is implemented in `apps/myorganizer/src/components/app-sidebar.tsx` and `apps/myorganizer/src/components/nav-main.tsx`.
- The vault utilities are intended to be a reusable module for future mobile clients.

Recommended file structure (conceptual):

```text
libs/web-vault/src/lib/vault/
  crypto.ts
  vault.ts
libs/web-vault-ui/src/lib/
  vaultGate.tsx
apps/myorganizer/src/app/
  addresses/page.tsx
  mobile-numbers/page.tsx
```

### Backend (Express + Prisma)

- Current backend uses Express + tsoa + Prisma.
- For Phase 2 sync, add “blind storage” endpoints that store ciphertext only.

Implementation guidance:

- Do not attempt to decrypt in the backend.
- Validate only:
  - blob shape (has `iv`, `ciphertext`, version)
  - sizes/limits
  - authZ (user owns the vault)

#### How to align with our current tsoa structure

In this repo:

- tsoa controllers live under `apps/backend/src/controllers/*Controller.ts`
- tsoa routes/spec are generated via `apps/backend/tsoa.json` into `apps/backend/src/routes` and `apps/backend/src/swagger`
- tsoa auth hook is `apps/backend/src/middleware/authentication.ts` (exports `expressAuthentication`)

Recommendation: implement vault endpoints as a **tsoa controller** (not as an additional Express router), so Swagger/OpenAPI is accurate and the TypeScript client can be generated cleanly.

#### Important: route prefix consistency

Today, `apps/backend/src/main.ts` mounts manual routers under `ROUTER_PREFIX`, but `RegisterRoutes(app)` registers tsoa routes without that prefix.

For Vault Phase 2, pick one approach and keep it consistent:

Option A (recommended): mount tsoa routes under the same prefix:

```ts
// main.ts (conceptual)
const api = express.Router();
RegisterRoutes(api);
app.use(`${routerPrefix}`, api);
```

Option B: drop manual routers and rely on tsoa routes only, and remove `ROUTER_PREFIX` usage.

#### Prisma models (schema-folder layout)

This project uses Prisma’s schema folder feature (`previewFeatures = ["prismaSchemaFolder"]`), so add models as a new file:

`apps/backend/src/prisma/schema/vault.prisma`

Pseudocode model definitions:

```prisma
model EncryptedVault {
  id        String   @id @default(cuid())
  userId    String   @unique

  version   Int
  kdf_name  String
  kdf_salt  String
  kdf_params Json

  wrapped_mk_passphrase Json
  wrapped_mk_recovery   Json

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  blobs     EncryptedVaultBlob[]

  @@index([userId])
}

model EncryptedVaultBlob {
  id        String   @id @default(cuid())
  userId    String
  type      String
  blob      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  vault     EncryptedVault @relation(fields: [userId], references: [userId], onDelete: Cascade)

  @@unique([userId, type])
  @@index([userId])
}
```

Notes:

- We store `blob`/wrapped keys as JSON to keep the backend blind.
- Keep `type` constrained in app logic to `addresses | mobileNumbers`.

#### tsoa Controller skeleton (aligned to existing patterns)

Add:

`apps/backend/src/controllers/VaultController.ts`

Controller pseudocode:

```ts
@Tags('Vault')
@Route('/vault')
export class VaultController extends Controller {
  // GET /vault
  @Get()
  @Security('jwt')
  public async getVaultMeta(@Request() req: ExRequest): Promise<GetVaultMetaResponse> {
    // userId resolved from req.user (jwt)
    // prisma.encryptedVault.findUnique({ where: { userId } })
    // if missing => 404
    // return { meta, updatedAt, etag }
  }

  // PUT /vault
  @Put()
  @Security('jwt')
  @ValidateBody(VaultMetaSchema) // Zod schema
  public async putVaultMeta(@Request() req: ExRequest, @Body() body: PutVaultMetaRequest, @Header('If-Match') ifMatch?: string): Promise<OkResponse> {
    // optional ETag check (conflict => 409)
    // upsert meta
    // return new etag
  }

  // GET /vault/blob/{type}
  @Get('blob/{type}')
  @Security('jwt')
  public async getBlob(@Request() req: ExRequest, @Path() type: 'addresses' | 'mobileNumbers'): Promise<GetBlobResponse> {
    // prisma.encryptedVaultBlob.findUnique({ where: { userId_type: { userId, type } } })
  }

  // PUT /vault/blob/{type}
  @Put('blob/{type}')
  @Security('jwt')
  @ValidateBody(PutBlobSchema)
  public async putBlob(@Request() req: ExRequest, @Path() type: 'addresses' | 'mobileNumbers', @Body() body: PutBlobRequest, @Header('If-Match') ifMatch?: string): Promise<OkResponse> {
    // validate size/shape; store JSON blob
  }

  // POST /vault/export
  @Post('export')
  @Security('jwt')
  public async exportVault(@Request() req: ExRequest): Promise<VaultExportResponse> {
    // fetch meta + all blobs; return as JSON
  }

  // POST /vault/import
  @Post('import')
  @Security('jwt')
  @ValidateBody(VaultImportSchema)
  public async importVault(@Request() req: ExRequest, @Body() body: VaultImportRequest): Promise<OkResponse> {
    // upsert meta + blobs
  }
}
```

Notes:

- `@Security('jwt')` matches the existing `tsoa.json` security definition and `expressAuthentication` hook.
- Use existing `ValidateBody` + `Body` decorators (Zod schemas) to validate blob shape/size.

#### Fix/complete `expressAuthentication` for vault authZ

Current `apps/backend/src/middleware/authentication.ts` only handles a token when the Authorization header is missing.

For vault endpoints, the backend should reliably:

- Extract bearer token from header (or body fallback if you keep it)
- Verify token
- Load user by id
- Attach user to `request.user` and resolve

Pseudocode:

```ts
export async function expressAuthentication(req, securityName): Promise<UserInterface> {
  if (securityName !== 'jwt') throw new Error('Unsupported security scheme');

  token = extractBearerOrBodyToken(req);
  decoded = verifyJwt(token, ACCESS_JWT_SECRET);
  user = await userService.getById(decoded.userId);
  if (!user) throw new Error('User not found');
  (req as any).user = user;
  return user;
}
```

#### OpenAPI + generated client alignment (Nx)

Today you have two OpenAPI paths:

- tsoa generates: `apps/backend/src/swagger/swagger.yaml`
- client generator reads: `libs/api-specs/src/api-specs.openapi.yaml` (then generates `libs/app-api-client`)

Recommendation:

- Make `libs/api-specs/src/api-specs.openapi.yaml` a copy (or build artifact) of tsoa’s `swagger.yaml`, so the client always matches the backend.
- Add an Nx target/script that runs:
  1. `tsoa spec-and-routes` (already in package.json)
  2. copy `apps/backend/src/swagger/swagger.yaml` → `libs/api-specs/src/api-specs.openapi.yaml`
  3. run `nx run app-api-client:generate-sources`

This keeps a single source of truth: the tsoa controllers.

---

## Open Questions

- Should the provider link list be encrypted (maximum privacy) or plaintext (better server-side filtering)?
- Do we require on-device search only, or do we need server-side search later (would require different cryptographic design)?
- Will we support sharing vault items with another user (family)? If yes, we will need asymmetric encryption and a sharing protocol.

## Implementation Checklist

Phase 1 (Web local-only):

- [x] Sidebar routes for Addresses + Mobile Numbers: `apps/myorganizer/src/components/app-sidebar.tsx`
- [x] Vault gate with setup/unlock/recover: `libs/web-vault-ui/src/lib/vaultGate.tsx`
- [x] Addresses page with multi-entry encrypted storage: `apps/myorganizer/src/app/dashboard/addresses/page.tsx`
- [x] Mobile Numbers page with multi-entry encrypted storage: `apps/myorganizer/src/app/dashboard/mobile-numbers/page.tsx`
- [x] Vault utilities (encrypt/decrypt + local storage): `libs/web-vault/src/lib/vault/`

Phase 2 (Sync):

- [x] Add DB tables for ciphertext blobs: `apps/backend/src/prisma/schema/vault.prisma`
- [x] Add API routes to store/retrieve ciphertext: `apps/backend/src/controllers/VaultController.ts`
- [x] Add export/import flows (API + UI): `apps/backend/src/controllers/VaultController.ts`, `apps/myorganizer/src/app/dashboard/vault-export/page.tsx`

Phase 3 (Mobile):

- [ ] Replace KDF/AEAD with libsodium parity if desired
- [ ] Add device enrollment + QR transfer
