// Renders the app icons (an original steering wheel in the app palette) into public/: the SVG favicon and the PNG
// sizes the web app manifest, browsers and iOS ask for.
// Usage: node scripts/render-icons.ts [--out dir]
// Requires ImageMagick (convert). Its SVG renderer is used at four times the largest size and then scaled down, and
// -strip drops the timestamps it writes, so the same artwork always gives the same files.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Design tokens of src/ui/theme.css (PROPUESTA §7). */
const NIGHT = '#13233a';
const IVORY = '#f7f2e8';
const TURQUOISE = '#1fa79b';
const ROAD_YELLOW = '#f2c230';

const VIEWBOX = 512;
/** ImageMagick's SVG renderer maps one user unit to one pixel at 96 dpi. */
const BASE_DENSITY = 96;
const SUPERSAMPLING = 4;

type Shape = 'rounded' | 'full-bleed';

/**
 * The artwork: a three-spoke steering wheel with a yellow top marker on a night-blue tile.
 * `rounded` is the tile itself (favicon and `any` icons); `full-bleed` fills the square and shrinks the wheel into the
 * maskable safe zone (a centred circle of 40 % of the size), for launchers and iOS, which cut their own shape.
 */
function iconSvg(shape: Shape): string {
  const scale = shape === 'full-bleed' ? 0.8 : 1;
  const centre = VIEWBOX / 2;
  const background =
    shape === 'full-bleed'
      ? `<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${NIGHT}"/>`
      : `<rect width="${VIEWBOX}" height="${VIEWBOX}" rx="112" fill="${NIGHT}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${VIEWBOX}" height="${VIEWBOX}">`,
    `  ${background}`,
    scale === 1
      ? '  <g>'
      : `  <g transform="translate(${centre} ${centre}) scale(${scale}) translate(${-centre} ${-centre})">`,
    `    <circle cx="256" cy="256" r="164" fill="none" stroke="${IVORY}" stroke-width="48"/>`,
    `    <path d="M 100 270 L 196 270 M 316 270 L 412 270 M 256 318 L 256 404" stroke="${IVORY}" stroke-width="40"/>`,
    `    <circle cx="256" cy="270" r="62" fill="${TURQUOISE}"/>`,
    `    <rect x="240" y="68" width="32" height="56" rx="8" fill="${ROAD_YELLOW}"/>`,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

interface PngIcon {
  file: string;
  size: number;
  shape: Shape;
}

/** Every PNG the manifest (src: vite.config.ts) and index.html reference. */
const PNG_ICONS: readonly PngIcon[] = [
  { file: 'icons/favicon-32.png', size: 32, shape: 'rounded' },
  { file: 'icons/icon-192.png', size: 192, shape: 'rounded' },
  { file: 'icons/icon-512.png', size: 512, shape: 'rounded' },
  { file: 'icons/icon-maskable-512.png', size: 512, shape: 'full-bleed' },
  { file: 'icons/apple-touch-icon-180.png', size: 180, shape: 'full-bleed' },
];

function render(svgPath: string, icon: PngIcon, outDir: string) {
  const output = join(outDir, icon.file);
  mkdirSync(dirname(output), { recursive: true });
  // Rounded tiles keep transparent corners; full-bleed icons are opaque (iOS fills transparency with black).
  const format = icon.shape === 'rounded' ? 'PNG32' : 'PNG24';
  execFileSync('convert', [
    '-background',
    'none',
    '-density',
    String(BASE_DENSITY * SUPERSAMPLING),
    svgPath,
    '-resize',
    `${icon.size}x${icon.size}`,
    '-strip',
    `${format}:${output}`,
  ]);
  return output;
}

function main(args: readonly string[]) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outIndex = args.indexOf('--out');
  const outArg = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (outIndex >= 0 && outArg === undefined) throw new Error('--out needs a directory');
  const outDir = outArg === undefined ? join(root, 'public') : resolve(outArg);
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'al-volante-icons-'));
  try {
    const sources: Record<Shape, string> = {
      rounded: join(work, 'rounded.svg'),
      'full-bleed': join(work, 'full-bleed.svg'),
    };
    for (const shape of Object.keys(sources) as Shape[]) writeFileSync(sources[shape], iconSvg(shape));
    writeFileSync(join(outDir, 'favicon.svg'), iconSvg('rounded'));
    for (const icon of PNG_ICONS) console.log(render(sources[icon.shape], icon, outDir));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main(process.argv.slice(2));
