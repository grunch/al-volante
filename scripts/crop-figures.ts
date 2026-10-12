// Renders every figure of specs/catalog/figures.json into public/figures/ and every sign of specs/catalog/signs.json
// that has a box into public/signs/, from the official PDFs (PNG).
// Usage: node scripts/crop-figures.ts [--figures file.json] [--signs file.json] [--out dir] [id …]
// --figures, --signs and --out let a reviewer preview crops of a draft elsewhere; --signs also accepts a map
// { "<signId>": { "box": {…} } }. Ids select figures or signs; without ids everything is rendered.
// Requires poppler-utils (pdfinfo, pdftoppm) and ImageMagick (convert), which reduces each crop to a 256-colour palette.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureFile, signFile } from '../src/content/figures.ts';
import { FigureCatalogSchema, ManifestSchema, PageBoxSchema } from '../src/content/schemas.ts';
import type { PageBox } from '../src/content/schemas.ts';

/** Enough resolution for small print in infographics while keeping crops light. */
const DPI = 110;
/** Signs are small on the page: more resolution keeps their legends legible. */
const SIGN_DPI = 180;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

const OPTIONS = ['--figures', '--signs', '--out'] as const;

/** Splits `--figures <file>`, `--signs <file>`, `--out <dir>` and the ids to render (all when none is given). */
function parseArgs(args: readonly string[]) {
  let figuresPath = join(root, 'specs/catalog/figures.json');
  let signsPath = join(root, 'specs/catalog/signs.json');
  let outDir = join(root, 'public');
  const ids = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    const value = args[i + 1];
    if (!(OPTIONS as readonly string[]).includes(arg)) {
      ids.add(arg);
      continue;
    }
    if (value === undefined) throw new Error(`${arg} needs a value`);
    if (arg === '--figures') figuresPath = resolve(value);
    else if (arg === '--signs') signsPath = resolve(value);
    else outDir = resolve(value);
    i += 1;
  }
  return { figuresPath, signsPath, outDir, ids };
}

/** Sign boxes from the catalog (an array of signs) or from a draft map { signId: { box } }. */
function signBoxes(json: unknown): Array<{ id: string; box: PageBox; page: number }> {
  const catalog = readJson('specs/catalog/signs.json') as Array<{ id: string; page: number; box?: unknown }>;
  const pageOf = new Map(catalog.map((sign) => [sign.id, sign.page]));
  const entries: Array<[string, unknown]> = Array.isArray(json)
    ? (json as Array<{ id: string; box?: unknown }>).map((sign) => [sign.id, sign.box])
    : Object.entries(json as Record<string, { box?: unknown }>).map(([id, value]) => [id, value.box]);
  return entries.flatMap(([id, box]) => {
    const page = pageOf.get(id);
    if (box === undefined) return [];
    if (page === undefined) throw new Error(`${id}: not in specs/catalog/signs.json`);
    return [{ id, page, box: PageBoxSchema.parse(box) }];
  });
}

const { figuresPath, signsPath, outDir, ids: only } = parseArgs(process.argv.slice(2));
const manifest = ManifestSchema.parse(readJson('specs/fuentes/manifest.json'));
const figures = FigureCatalogSchema.parse(JSON.parse(readFileSync(figuresPath, 'utf8')));
const signs = signBoxes(JSON.parse(readFileSync(signsPath, 'utf8')));

/** Page size in points, as pdfinfo reports it for that physical page. */
function pageSizePt(pdf: string, page: number): { width: number; height: number } {
  const info = execFileSync('pdfinfo', ['-f', String(page), '-l', String(page), pdf], { encoding: 'utf8' });
  const match = new RegExp(`Page\\s+${page} size:\\s+([\\d.]+) x ([\\d.]+) pts`).exec(info);
  if (!match) throw new Error(`pdfinfo did not report the size of page ${page} of ${pdf}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Crops `box` of a page of `sourceId` at `dpi` into `output` (PNG, 256-colour palette). */
function crop(sourceId: string, page: number, box: PageBox, dpi: number, output: string): void {
  const source = manifest.find((item) => item.id === sourceId);
  if (!source) throw new Error(`unknown source ${sourceId}`);
  const pdf = join(root, 'specs/fuentes', source.path);
  const size = pageSizePt(pdf, page);
  const scale = dpi / 72;
  const pixels = (fraction: number, points: number) => String(Math.round(fraction * points * scale));
  mkdirSync(dirname(output), { recursive: true });
  execFileSync('pdftoppm', [
    '-png',
    '-r',
    String(dpi),
    '-f',
    String(page),
    '-l',
    String(page),
    '-x',
    pixels(box.x, size.width),
    '-y',
    pixels(box.y, size.height),
    '-W',
    pixels(box.width, size.width),
    '-H',
    pixels(box.height, size.height),
    '-singlefile',
    pdf,
    output.replace(/\.png$/, ''),
  ]);
  // Infographics and signs use few flat colours: a palette keeps them legible at about a quarter of the size;
  // -strip drops the timestamps ImageMagick writes, so the same crop always gives the same file.
  execFileSync('convert', [output, '-strip', '-colors', '256', `PNG8:${output}`]);
  console.log(`${output}`);
}

for (const figure of figures) {
  if (only.size > 0 && !only.has(figure.id)) continue;
  crop(figure.source, figure.page, figure.box, DPI, join(outDir, figureFile(figure.id)));
}
for (const sign of signs) {
  if (only.size > 0 && !only.has(sign.id)) continue;
  crop('manual', sign.page, sign.box, SIGN_DPI, join(outDir, signFile(sign.id)));
}
