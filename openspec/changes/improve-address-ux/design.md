## Context

Addresses are vault-backed records stored in the encrypted `addresses` blob. The current frontend in `libs/web/pages/addresses` uses a basic always-visible form with limited Zod validation, no inline messages, no duplicate review, and a list that provides minimal filtering or workflow guidance. The Next.js app wrappers remain thin and are not expected to change.

Relevant workflow guidance: `frontend-page-library-workflow`, `vault-feature-workflow`, and `playwright-e2e-workflow`.

Touched Nx projects:

- `web-pages-addresses`: owns address form, list, validation helpers, duplicate matching, and focused Jest tests.
- `web-ui`: exports the existing Radix-based `Sheet` primitive for page libraries.
- `myorganizer-e2e`: updates encrypted address CRUD coverage for drawer interactions.

Backend/API impact: no new TSOA endpoints, Prisma models, OpenAPI sync, generated API client regeneration, or migration.

Vault impact: existing blob type `addresses`, existing schema version, no export/import or vault migration changes. Plaintext remains in browser memory and continues through `loadDecryptedData`, `normalizeAddresses`, and `saveEncryptedData`.

## Goals / Non-Goals

**Goals:**

- Provide an accessible drawer-based add-address flow with inline validation and save states.
- Use account country settings and the shared country list to reduce manual entry friction.
- Warn users about matching existing addresses while allowing an explicit override.
- Improve address list scanning, filtering, and action affordances.
- Tighten usage-location URL validation and duplicate organisation warnings.

**Non-Goals:**

- External address autocomplete or provider integration.
- Plaintext server validation or storage.
- Address blob shape changes.
- Reworking the whole mobile-number module.

## Decisions

1. Use a drawer via the existing `Sheet` primitive.
   - Rationale: keeps the list visible, avoids new dependencies, and matches the user's preferred flow shape.
   - Alternative considered: full wizard route. It adds navigation overhead and makes duplicate review feel heavier.

2. Keep duplicate detection browser-only and advisory.
   - Rationale: vault plaintext must not leave the client, and the selected behavior is warning plus override.
   - Alternative considered: hard-block exact duplicates. It would prevent legitimate same-building or corrected-address cases.

3. Store the existing country name on `AddressRecord` while using country code in the form.
   - Rationale: preserves compatibility with existing vault records and formatters while allowing account default reuse.
   - Alternative considered: change persisted records to country code. That would require broader migration/export/import work.

4. Put validation and matching helpers in the address page library.
   - Rationale: these rules are UI workflow concerns, not shared vault normalization rules.
   - Alternative considered: move dedupe into `web-vault`. That would risk silently changing imported data rather than guiding the user.

## Risks / Trade-offs

- Duplicate matching can produce false positives. Mitigation: show the match clearly and allow override.
- Generic postal-code validation cannot verify every country. Mitigation: keep it conservative and avoid external providers in this change.
- Exporting `Sheet` increases public UI surface. Mitigation: reuse the existing component as-is and avoid page-specific behavior in `web-ui`.
- E2E selectors may need updates after the drawer refactor. Mitigation: rely on role/name queries and stable field labels.

## Migration Plan

1. Ship frontend changes behind the existing address route with no data migration.
2. Existing records continue to normalize through `normalizeAddresses`.
3. Rollback is a frontend revert because no persisted schema, backend, or API contract changes are introduced.

## Open Questions

- Whether usage-location add/edit should also become a drawer in a follow-up after the main add-address drawer is stable.
