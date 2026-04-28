import { VaultImportError } from './vaultImportError';

/**
 * Forward-only migration registry. A migration with key `N` transforms an
 * envelope at version `N` into one at version `N + 1`. Downgrade migrations
 * are not supported by design.
 *
 * Currently the only registered version is the current one ({@link CURRENT_VAULT_EXPORT_SCHEMA_VERSION}),
 * so no migrations exist yet. Add entries here when bumping the schema.
 */
export const migrationRegistry: Record<
  number,
  (envelope: Record<string, unknown>) => Record<string, unknown>
> = {};

/**
 * Migrate a parsed envelope forward to `targetVersion`.
 *
 * - Throws {@link VaultImportError} with `schema-version-downgrade` when the
 *   envelope's `schemaVersion` is greater than `targetVersion`.
 * - Throws {@link VaultImportError} with `schema-version-unsupported` when
 *   no forward migration path exists.
 */
export function migrateEnvelope(
  envelope: Record<string, unknown>,
  targetVersion: number,
): Record<string, unknown> {
  const fromValue = envelope.schemaVersion;
  if (typeof fromValue !== 'number' || !Number.isInteger(fromValue)) {
    throw new VaultImportError(
      'schema-version-unsupported',
      'Envelope is missing a numeric schemaVersion',
    );
  }

  if (fromValue > targetVersion) {
    throw new VaultImportError(
      'schema-version-downgrade',
      `Envelope version ${fromValue} is newer than supported version ${targetVersion}`,
    );
  }

  let current = envelope;
  let version = fromValue;
  while (version < targetVersion) {
    const step = migrationRegistry[version];
    if (!step) {
      throw new VaultImportError(
        'schema-version-unsupported',
        `No migration path from version ${version} to ${targetVersion}`,
      );
    }
    current = step(current);
    version += 1;
    current = { ...current, schemaVersion: version };
  }

  return current;
}
