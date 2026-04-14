import { existsSync, readFileSync } from 'node:fs';

const PROJECT_METADATA_PATH = '.vercel/project.json';
const VERCEL_CONFIG_PATH = 'vercel.json';
const DEFAULT_NODE_VERSION = '22.x';

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const normalize = (value) => (value === undefined ? null : value);

const pickSettings = (source) => ({
  framework: normalize(source.framework),
  rootDirectory: normalize(source.rootDirectory),
  installCommand: normalize(source.installCommand),
  buildCommand: normalize(source.buildCommand),
  outputDirectory: normalize(source.outputDirectory),
  nodeVersion: normalize(source.nodeVersion),
});

const createProjectUrl = (projectId, teamId) => {
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}`,
  );

  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }

  return url;
};

if (!existsSync(VERCEL_CONFIG_PATH)) {
  console.error(`Missing ${VERCEL_CONFIG_PATH}.`);
  process.exit(1);
}

if (!existsSync(PROJECT_METADATA_PATH)) {
  console.error(
    `Missing ${PROJECT_METADATA_PATH}. Run 'vercel pull' before syncing project settings.`,
  );
  process.exit(1);
}

const vercelConfig = readJson(VERCEL_CONFIG_PATH);
const projectMetadata = readJson(PROJECT_METADATA_PATH);

const desiredSettings = pickSettings({
  framework: vercelConfig.framework ?? 'nextjs',
  rootDirectory: null,
  installCommand:
    vercelConfig.installCommand ?? 'corepack yarn install --immutable',
  buildCommand: vercelConfig.buildCommand ?? 'npx nx build myorganizer --prod',
  outputDirectory:
    vercelConfig.outputDirectory ?? 'dist/apps/myorganizer/.next',
  nodeVersion: process.env.VERCEL_NODE_VERSION ?? DEFAULT_NODE_VERSION,
});

const currentSettings = pickSettings(projectMetadata.settings ?? {});
const driftKeys = Object.keys(desiredSettings).filter(
  (key) => currentSettings[key] !== desiredSettings[key],
);

console.log('Current Vercel project settings (sanitized):');
console.log(JSON.stringify(currentSettings, null, 2));

if (driftKeys.length === 0) {
  console.log('Vercel project settings already match the repo configuration.');
  process.exit(0);
}

const projectId = process.env.VERCEL_PROJECT_ID ?? projectMetadata.projectId;
const orgId = process.env.VERCEL_ORG_ID ?? projectMetadata.orgId;
const token = process.env.VERCEL_TOKEN;

if (!projectId) {
  console.error(
    'Missing VERCEL_PROJECT_ID and no projectId was found in .vercel/project.json.',
  );
  process.exit(1);
}

if (!token) {
  console.error('Missing VERCEL_TOKEN.');
  process.exit(1);
}

console.log(`Syncing Vercel project settings: ${driftKeys.join(', ')}`);

const patchProjectSettings = async (teamId) =>
  fetch(createProjectUrl(projectId, teamId), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(desiredSettings),
  });

let response = await patchProjectSettings(orgId);

if (!response.ok && orgId) {
  response = await patchProjectSettings('');
}

if (!response.ok) {
  const body = await response.text();

  console.error(
    `Failed to update Vercel project settings (${response.status} ${response.statusText}).`,
  );
  console.error(body);
  console.error(
    'Manual fix: set Install Command to "corepack yarn install --immutable", Build Command to "npx nx build myorganizer --prod", Output Directory to "dist/apps/myorganizer/.next", Root Directory to the project root, and Node.js to 22.x.',
  );
  process.exit(1);
}

const updatedProject = await response.json();
const updatedSettings = pickSettings(updatedProject);

console.log('Updated Vercel project settings (sanitized):');
console.log(JSON.stringify(updatedSettings, null, 2));
