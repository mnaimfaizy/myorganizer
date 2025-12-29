import { execSync } from 'node:child_process';

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(
    'utf8'
  );
}

const porcelain = run('git status --porcelain').trim();

if (porcelain.length > 0) {
  console.error('[openapi-check] Working tree is not clean after generation.');
  console.error(
    '[openapi-check] Commit the regenerated outputs or fix the pipeline.'
  );
  console.error('--- git status --porcelain ---');
  console.error(porcelain);
  process.exit(1);
}

console.log('[openapi-check] Working tree is clean.');
