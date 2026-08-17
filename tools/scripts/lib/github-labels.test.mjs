/**
 * Run with: yarn ai:create-pr:test  (node --test, no jest project covers tools/)
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadGithubLabelCatalog,
  normalizeLabelArgs,
  provisionLabels,
  rejectedPrLabels,
  surfaceLabelNames,
  syncSurfaceLabelChanges,
} from './github-labels.mjs';

const ADR_0025_SURFACE_LABELS = [
  'backend',
  'bug',
  'dependencies',
  'documentation',
  'enhancement',
  'github-actions',
  'maintenance',
  'mobile-app',
  'qa',
  'research',
  'security',
  'tooling',
  'web-app',
];

test('repo catalog surface names match ADR 0025', () => {
  const catalog = loadGithubLabelCatalog();
  assert.deepEqual(
    [...surfaceLabelNames(catalog)].sort(),
    ADR_0025_SURFACE_LABELS,
  );
  assert.equal(surfaceLabelNames(catalog).has('ready-for-agent'), false);
  assert.equal(surfaceLabelNames(catalog).has('frontend'), false);
  assert.equal(surfaceLabelNames(catalog).has('database'), false);
});

test('provision list includes orchestration and surface labels', () => {
  const catalog = loadGithubLabelCatalog();
  const names = provisionLabels(catalog).map((label) => label.name);
  assert.equal(names.includes('ready-for-agent'), true);
  assert.equal(names.includes('documentation'), true);
  assert.equal(names.includes('web-app'), true);
});

test('normalizeLabelArgs splits, trims, and dedupes like --reviewer', () => {
  assert.deepEqual(
    normalizeLabelArgs(['documentation, tooling', 'backend', 'documentation']),
    ['documentation', 'tooling', 'backend'],
  );
});

test('rejects orchestration and unknown names on a PR', () => {
  const catalog = loadGithubLabelCatalog();
  assert.deepEqual(
    rejectedPrLabels(['documentation', 'ready-for-agent', 'frontend'], catalog),
    ['ready-for-agent', 'frontend'],
  );
  assert.deepEqual(rejectedPrLabels(['bug', 'backend'], catalog), []);
});

test('sync adds missing Surface Labels and removes stale ones, leaving others', () => {
  const catalog = loadGithubLabelCatalog();
  const surfaceNames = surfaceLabelNames(catalog);

  assert.deepEqual(
    syncSurfaceLabelChanges({
      currentNames: ['documentation', 'needs-e2e-review', 'tooling'],
      desiredNames: ['documentation', 'backend'],
      surfaceNames,
    }),
    {
      toAdd: ['backend'],
      toRemove: ['tooling'],
    },
  );
});

test('sync to an empty draft removes Surface Labels only', () => {
  const catalog = loadGithubLabelCatalog();

  assert.deepEqual(
    syncSurfaceLabelChanges({
      currentNames: ['documentation', 'needs-e2e-review'],
      desiredNames: [],
      surfaceNames: surfaceLabelNames(catalog),
    }),
    {
      toAdd: [],
      toRemove: ['documentation'],
    },
  );
});
