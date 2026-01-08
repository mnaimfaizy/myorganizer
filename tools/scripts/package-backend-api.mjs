import archiver from 'archiver';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, '..', '..');

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
}

function exists(p) {
  return fs.existsSync(p);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function log(msg) {
  console.log(msg);
}

function createZipFromDir({ dir, outFile }) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);

    // Include dotfiles and avoid zipping the zip itself.
    archive.glob('**/*', {
      cwd: dir,
      dot: true,
      ignore: [path.basename(outFile)],
    });

    archive.finalize();
  });
}

const buildOut = path.join(workspaceRoot, 'dist', 'apps', 'backend');
const deployRoot = path.join(workspaceRoot, 'dist', 'deploy', 'backend-api');

const prismaSrc = path.join(workspaceRoot, 'apps', 'backend', 'src', 'prisma');

const backendDistPackageJson = path.join(buildOut, 'package.json');

if (!exists(buildOut) || !exists(backendDistPackageJson)) {
  throw new Error(
    `Expected backend build output at: ${buildOut}. ` +
      `Run: yarn nx run backend:build:production`
  );
}

// Clean deploy output
rm(deployRoot);
mkdir(deployRoot);

// Copy backend build output (no node_modules)
for (const entry of fs.readdirSync(buildOut, { withFileTypes: true })) {
  const srcPath = path.join(buildOut, entry.name);
  const dstPath = path.join(deployRoot, entry.name);

  // We always generate a deploy-specific package.json below.
  if (entry.name === 'package.json') continue;

  if (entry.isDirectory()) {
    copyDir(srcPath, dstPath);
  } else if (entry.isFile()) {
    copyFile(srcPath, dstPath);
  }
}

// Copy Prisma folder for deploy-time generate/migrate on Linux.
// IMPORTANT: do NOT copy prisma-client (it contains Windows-generated engine binaries and paths).
if (exists(prismaSrc)) {
  copyDir(prismaSrc, path.join(deployRoot, 'prisma'));
  rm(path.join(deployRoot, 'prisma', 'prisma-client'));
}

const distPkg = readJson(backendDistPackageJson);
const rootPkg = readJson(path.join(workspaceRoot, 'package.json'));

const rootPrismaVersion =
  rootPkg?.dependencies?.prisma || rootPkg?.devDependencies?.prisma;
const rootPrismaClientVersion =
  rootPkg?.dependencies?.['@prisma/client'] ||
  rootPkg?.devDependencies?.['@prisma/client'];

const rootTslibVersion =
  rootPkg?.dependencies?.tslib || rootPkg?.devDependencies?.tslib;

// Start from Nx-generated runtime deps and filter obvious non-runtime deps.
const filteredDeps = { ...(distPkg.dependencies || {}) };
for (const name of Object.keys(filteredDeps)) {
  if (name === '@jest/globals' || name.startsWith('jest')) {
    delete filteredDeps[name];
  }
}

// Ensure Prisma runtime deps exist (now that we export from @prisma/client).
if (rootPrismaClientVersion) {
  filteredDeps['@prisma/client'] = rootPrismaClientVersion;
}

// Include Prisma CLI so postinstall can generate the client on the target Linux host.
if (rootPrismaVersion) {
  filteredDeps.prisma = rootPrismaVersion;
}

// Webpack output can require tslib at runtime; ensure it's present in deploy deps.
if (!filteredDeps.tslib && rootTslibVersion) {
  filteredDeps.tslib = rootTslibVersion;
}

const deployPkg = {
  name: 'backend-api',
  private: true,
  main: distPkg.main || 'main.js',
  scripts: {
    start: `node ${distPkg.main || 'main.js'}`,
    'prisma:generate': 'prisma generate --schema prisma/schema',
    'prisma:migrate:deploy': 'prisma migrate deploy --schema prisma/schema',
  },
  dependencies: Object.fromEntries(
    Object.entries(filteredDeps).sort(([a], [b]) => a.localeCompare(b))
  ),
};

// cPanel/shared-hosting friendly: generate Prisma client for the server OS.
// Must be resilient if npm executes scripts from nodevenv/lib (cPanel quirk).
const postinstallScriptRelPath = 'scripts/postinstall.cjs';
const postinstallScriptAbsPath = path.join(
  deployRoot,
  ...postinstallScriptRelPath.split('/')
);
mkdir(path.dirname(postinstallScriptAbsPath));

const postinstallScript = [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const { spawnSync } = require('child_process');",
  '',
  'const npmPackageJson = process.env.npm_package_json;',
  'const npmPackageDir = npmPackageJson ? path.dirname(npmPackageJson) : undefined;',
  'const passengerRoot = process.env.PASSENGER_APP_ROOT;',
  '',
  'const candidates = [',
  '  npmPackageDir,',
  '  passengerRoot,',
  '  process.env.INIT_CWD,',
  '  process.env.npm_config_local_prefix,',
  '  process.env.PWD,',
  '  process.cwd(),',
  '  __dirname,',
  '].filter(Boolean);',
  '',
  "const hasPkg = (d) => fs.existsSync(path.join(d, 'package.json'));",
  "const hasSchema = (d) => fs.existsSync(path.join(d, 'prisma', 'schema'));",
  '',
  'const appRoot =',
  '  candidates.find((d) => hasPkg(d) && hasSchema(d)) ||',
  '  candidates.find(hasPkg) ||',
  '  process.cwd();',
  '',
  "const schemaDir = path.join(appRoot, 'prisma', 'schema');",
  "console.log('[postinstall] appRoot:', appRoot);",
  "console.log('[postinstall] schemaDir:', schemaDir);",
  "console.log('[postinstall] npm_package_json:', process.env.npm_package_json || '');",
  "console.log('[postinstall] PASSENGER_APP_ROOT:', process.env.PASSENGER_APP_ROOT || '');",
  '',
  'if (!fs.existsSync(schemaDir)) {',
  "  console.log('[postinstall] Skipping prisma generate: prisma/schema not found at', schemaDir);",
  "  console.log('[postinstall] cwd:', process.cwd());",
  '  process.exit(0);',
  '}',
  '',
  "const prismaBin = path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');",
  "const args = ['generate', '--schema', 'prisma/schema'];",
  'let r;',
  '',
  'if (fs.existsSync(prismaBin)) {',
  "  r = spawnSync(prismaBin, args, { stdio: 'inherit', cwd: appRoot });",
  '} else {',
  "  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';",
  "  r = spawnSync(npx, ['prisma', ...args], { stdio: 'inherit', cwd: appRoot });",
  '}',
  '',
  'process.exit(r.status ?? 1);',
  '',
].join('\n');

fs.writeFileSync(postinstallScriptAbsPath, `${postinstallScript}\n`, 'utf8');
// cPanel sometimes runs npm scripts from nodevenv/.../lib and can set npm_package_json
// to nodevenv/lib/package.json, so resolving files relative to npm_package_json is unreliable.
// Instead: locate the deployed bundle root (INIT_CWD / Passenger envs) and require the
// already-generated scripts/postinstall.cjs from there.
deployPkg.scripts.postinstall =
  "node -e \"const fs=require('fs');const path=require('path');const candidates=[process.env.INIT_CWD,process.env.PASSENGER_APP_ROOT,process.env.npm_config_local_prefix,process.env.PWD,process.cwd()].filter(Boolean);const scriptPath=(candidates.map((d)=>path.join(d,'scripts','postinstall.cjs')).find((p)=>fs.existsSync(p)))||path.join(process.cwd(),'scripts','postinstall.cjs');if(!fs.existsSync(scriptPath)){console.log('[postinstall] scripts/postinstall.cjs not found; skipping (likely cPanel ran install from nodevenv/lib)');console.log('[postinstall] cwd:',process.cwd());console.log('[postinstall] INIT_CWD:',process.env.INIT_CWD||'');console.log('[postinstall] PASSENGER_APP_ROOT:',process.env.PASSENGER_APP_ROOT||'');process.exit(0);}require(scriptPath);\"";

writeJson(path.join(deployRoot, 'package.json'), deployPkg);

fs.writeFileSync(
  path.join(deployRoot, 'CPANEL_STARTUP.md'),
  [
    '# cPanel backend startup',
    '',
    '- Startup file: `main.js`',
    '- Node.js app root: this folder',
    '- Run: `npm install` (required; this bundle does not include `node_modules`)',
    '- Recommended env vars:',
    '  - `NODE_ENV=production`',
    '  - `PORT=3000` (or set by cPanel)',
    '  - `DATABASE_URL=postgresql://...`',
    '  - `SESSION_SECRET=...`',
    '  - `CORS_ORIGINS=https://myorganiser.app`',
    '',
    'Notes:',
    '- `postinstall` runs `prisma generate` (when `prisma/schema` exists) so Prisma is built for the server OS.',
    '- `postinstall` is resilient to cPanel running npm scripts from `nodevenv/.../lib` by using `INIT_CWD`/prefix envs.',
    '- To apply DB migrations on the server, run: `npm run prisma:migrate:deploy`.',
    '',
  ].join('\n'),
  'utf8'
);

const zipPath = path.join(deployRoot, 'backend-api.zip');
await createZipFromDir({ dir: deployRoot, outFile: zipPath });
log(`Created archive: ${zipPath}`);
log(`Deploy folder ready at: ${deployRoot}`);
