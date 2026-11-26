import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['src', 'tests', 'demo'];
function collect(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(relative) : /\.(?:js|mjs)$/.test(entry.name) ? [relative] : [];
  });
}
function resolveImport(fromFile, specifier) {
  const base = path.resolve(root, path.dirname(fromFile), specifier);
  return [base, base + '.js', base + '.mjs', path.join(base, 'index.js'), path.join(base, 'index.mjs')].some(candidate => fs.existsSync(candidate));
}
test('all relative imports in source, tests and demo resolve', () => {
  const broken = [];
  for (const file of scanRoots.flatMap(collect)) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const imports = [...source.matchAll(/(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]|import\(['\"]([^'\"]+)['\"]\)/g)];
    for (const match of imports) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.') && !resolveImport(file, specifier)) broken.push(file + ' -> ' + specifier);
    }
  }
  assert.deepEqual(broken, [], 'unresolved relative module imports');
});
