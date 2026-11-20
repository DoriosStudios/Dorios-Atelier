import fs from 'node:fs/promises';
import path from 'node:path';
import {zipSync, strToU8} from 'fflate';
import {build} from 'esbuild';
import {createCatalogSource, ROOT} from './package-builder/catalog.mjs';
import {compilePackage} from './package-builder/compiler.mjs';

const args = process.argv.slice(2);
const argument = name => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
};
const output = path.resolve(argument('--out') ?? path.join(ROOT, '.cache/atelier-builder'));
const {catalog, source} = await createCatalogSource();
const selectionPath = argument('--selection');
if (selectionPath) {
  const preset = JSON.parse(await fs.readFile(path.resolve(selectionPath), 'utf8'));
  if (preset.fingerprint && preset.fingerprint !== catalog.fingerprint) {
    throw new Error('This selection belongs to another source version. Save it again with the current builder.');
  }
  const compiled = compilePackage(catalog, source, preset.selection ?? preset);
  await fs.mkdir(path.dirname(output), {recursive: true});
  await fs.writeFile(output, compiled.bytes);
  console.log(JSON.stringify({output, ...compiled.summary}, null, 2));
} else {
  await fs.mkdir(output, {recursive: true});
  source['builder-catalog.json'] = strToU8(JSON.stringify(catalog));
  await fs.writeFile(path.join(output, catalog.archive), zipSync(source, {level: 6}));
  await fs.writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog));
  await fs.copyFile(path.join(ROOT, 'node_modules/fflate/LICENSE'), path.join(output, 'fflate-LICENSE.txt'));
  await build({entryPoints: [path.join(ROOT, 'tools/package-builder/worker.mjs')],
    outfile: path.join(output, 'builder-worker.js'), bundle: true, minify: true,
    platform: 'browser', target: 'es2020', format: 'iife', legalComments: 'eof'});
  console.log(`Atelier builder ${catalog.source.version}: ${catalog.families.length} families, ${catalog.records.length} definitions → ${output}`);
}
