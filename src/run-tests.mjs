import { readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const testsRoot = resolve(root, 'tests');

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) return collect(file);
    return /\.test\.(?:js|mjs)$/.test(entry.name) ? [file] : [];
  });
}

const files = collect(testsRoot).sort();
if (files.length === 0) {
  console.error('No .test.js or .test.mjs files found under tests/.');
  process.exit(1);
}

console.log(`Running ${files.length} test files (.test.js and .test.mjs):`);
for (const file of files) console.log(`  ${relative(root, file)}`);

const result = spawnSync(process.execPath, [
  '--experimental-default-type=module',
  '--test',
  ...files
], { cwd: root, stdio: 'inherit' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
