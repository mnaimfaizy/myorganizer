import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GITHUB_LABELS_CATALOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../config/github-labels.json',
);

function isLabelRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.color === 'string' &&
    typeof value.description === 'string'
  );
}

export function loadGithubLabelCatalog(
  catalogPath = GITHUB_LABELS_CATALOG_PATH,
) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

  if (catalog?.schemaVersion !== 1) {
    throw new Error(
      `Unsupported github-labels catalog schemaVersion: ${catalog?.schemaVersion}`,
    );
  }

  if (
    !Array.isArray(catalog.orchestration) ||
    !catalog.orchestration.every(isLabelRecord)
  ) {
    throw new Error(
      'github-labels catalog orchestration must be an array of label records.',
    );
  }

  if (
    !Array.isArray(catalog.surface?.kind) ||
    !catalog.surface.kind.every(isLabelRecord) ||
    !Array.isArray(catalog.surface?.area) ||
    !catalog.surface.area.every(isLabelRecord)
  ) {
    throw new Error(
      'github-labels catalog surface.kind and surface.area must be arrays of label records.',
    );
  }

  return catalog;
}

export function surfaceLabelNames(catalog) {
  return new Set([
    ...catalog.surface.kind.map((label) => label.name),
    ...catalog.surface.area.map((label) => label.name),
  ]);
}

export function provisionLabels(catalog) {
  return [
    ...catalog.orchestration,
    ...catalog.surface.kind,
    ...catalog.surface.area,
  ];
}

export function normalizeLabelArgs(values) {
  const seen = new Set();
  const labels = [];

  for (const value of values) {
    for (const part of String(value).split(',')) {
      const name = part.trim();

      if (!name || seen.has(name)) {
        continue;
      }

      seen.add(name);
      labels.push(name);
    }
  }

  return labels;
}

export function rejectedPrLabels(labels, catalog) {
  const allowed = surfaceLabelNames(catalog);
  return labels.filter((name) => !allowed.has(name));
}

export function syncSurfaceLabelChanges({
  currentNames,
  desiredNames,
  surfaceNames,
}) {
  const current = new Set(currentNames);
  const desired = [...new Set(desiredNames)];

  return {
    toAdd: desired.filter((name) => !current.has(name)),
    toRemove: [...current].filter(
      (name) => surfaceNames.has(name) && !desired.includes(name),
    ),
  };
}
