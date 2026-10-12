// Renders every figure of specs/catalog/figures.json from its official PDF into public/figures/ (PNG).
// Usage: node scripts/crop-figures.ts [--figures file.json] [--out dir] [figure-id …]
// --figures and --out let a reviewer preview crops of a draft catalog elsewhere.
// Requires poppler-utils (pdfinfo, pdftoppm) and ImageMagick (convert), which reduces each crop to a 256-colour palette.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureFile } from '../src/content/figures.ts';
import { FigureCatalogSchema, ManifestSchema } from '../src/content/schemas.ts';

/** Enough resolution for small print in infographics while keeping crops light. */
const DPI = 110;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** Splits `--figures <file>`, `--out <dir>` and the figure ids to render (all when none is given). */
function parseArgs(args: readonly string[]) {
  let figuresPath = join(root, 'specs/catalog/figures.json');
  let outDir = join(root, 'public');
  const ids = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    const value = args[i + 1];
    if ((arg === '--figures' || arg === '--out') && value === undefined) throw new Error(`${arg} needs a value`);
    if (arg === '--figures') figuresPath = resolve(value as string);
    else if (arg === '--out') outDir = resolve(value as string);
    else ids.add(arg);
    if (arg === '--figures' || arg === '--out') i += 1;
  }
  return { figuresPath, outDir, ids };
}

const { figuresPath, outDir, ids: only } = parseArgs(process.argv.slice(2));
const manifest = ManifestSchema.parse(readJson('specs/fuentes/manifest.json'));
const figures = FigureCatalogSchema.parse(JSON.parse(readFileSync(figuresPath, 'utf8')));

/** Page size in points, as pdfinfo reports it for that physical page. */
function pageSizePt(pdf: string, page: number): { width: number; height: number } {
  const info = execFileSync('pdfinfo', ['-f', String(page), '-l', String(page), pdf], { encoding: 'utf8' });
  const match = new RegExp(`Page\\s+${page} size:\\s+([\\d.]+) x ([\\d.]+) pts`).exec(info);
  if (!match) throw new Error(`pdfinfo did not report the size of page ${page} of ${pdf}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

for (const figure of figures) {
  if (only.size > 0 && !only.has(figure.id)) continue;
  const source = manifest.find((item) => item.id === figure.source);
  if (!source) throw new Error(`${figure.id}: unknown source ${figure.source}`);
  const pdf = join(root, 'specs/fuentes', source.path);
  const size = pageSizePt(pdf, figure.page);
  const scale = DPI / 72;
  const pixels = (fraction: number, points: number) => String(Math.round(fraction * points * scale));
  const output = join(outDir, figureFile(figure.id));
  mkdirSync(dirname(output), { recursive: true });
  execFileSync('pdftoppm', [
    '-png',
    '-r',
    String(DPI),
    '-f',
    String(figure.page),
    '-l',
    String(figure.page),
    '-x',
    pixels(figure.box.x, size.width),
    '-y',
    pixels(figure.box.y, size.height),
    '-W',
    pixels(figure.box.width, size.width),
    '-H',
    pixels(figure.box.height, size.height),
    '-singlefile',
    pdf,
    output.replace(/\.png$/, ''),
  ]);
  // Infographics use few flat colours: a palette keeps them legible at about a quarter of the size.
  execFileSync('convert', [output, '-colors', '256', `PNG8:${output}`]);
  console.log(`${figure.id} → ${output}`);
}
