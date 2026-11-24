import { build, transform } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceHtml = await readFile(resolve('..', 'demo', 'orca-adventure.html'), 'utf8');
const cssSource = await readFile(resolve('ui', 'ui.css'), 'utf8');
const [bundle, css] = await Promise.all([
  build({
    entryPoints: ['browser-entry.js'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none'
  }),
  transform(cssSource, { loader: 'css', minify: true })
]);
const js = bundle.outputFiles[0]?.text;
if (!js) throw new Error('esbuild did not produce the browser JavaScript bundle');

const inlineScript = `<script type="module">\n${js}\n</script>`;
const htmlWithScript = sourceHtml.replace(
  '<script type="module" src="../src/browser-entry.js"></script>',
  inlineScript
);
if (htmlWithScript === sourceHtml) throw new Error('Browser entry script placeholder was not found');
const html = htmlWithScript.replace(
  '</head>',
  `<style data-orca-inline-styles>\n${css.code}\n</style>\n</head>`
);
const outputDir = resolve('..', 'dist');
await mkdir(outputDir, { recursive: true });
const outputPath = resolve(outputDir, 'orca-adventure.html');
await writeFile(outputPath, html, 'utf8');
process.stdout.write(`Built self-contained game: ${outputPath}\n`);
