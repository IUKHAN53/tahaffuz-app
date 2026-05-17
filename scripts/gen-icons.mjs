// Rasterize the Tahaffuz Speech-Shield mark into the PNGs Expo expects.
//
// Pipeline:
//   1. download Noto Nastaliq Urdu TTF once (cached in scripts/.fonts/)
//   2. HarfBuzz-shape "تحفظ" → glyph IDs + positions (Nastaliq needs full GSUB)
//   3. opentype.js converts each glyph ID into SVG path data
//   4. compose the mark SVG (shield + Urdu paths + amber dots) in memory
//   5. rasterize with sharp into icon.png / adaptive-icon.png / splash-icon.png / favicon.png
//
// Run:  node scripts/gen-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { Blob as HBBlob, Face as HBFace, Font as HBFont, Buffer as HBBuffer, shape as hbShape } from 'harfbuzzjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets');
const FONT_DIR = path.join(__dirname, '.fonts');
const FONT_PATH = path.join(FONT_DIR, 'NotoNastaliqUrdu-Regular.ttf');
const FONT_URL = 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io@main/fonts/NotoNastaliqUrdu/full/ttf/NotoNastaliqUrdu-Regular.ttf';

const INK = '#07203F';

async function ensureFont() {
  if (fs.existsSync(FONT_PATH)) return;
  fs.mkdirSync(FONT_DIR, { recursive: true });
  console.log(`Downloading Noto Nastaliq Urdu → ${FONT_PATH}`);
  const res = await fetch(FONT_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Font download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(FONT_PATH, buf);
  console.log(`  ${(buf.length / 1024).toFixed(0)} KB`);
}

/**
 * Shape `text` with HarfBuzz, then look up each shaped glyph's outline via
 * opentype.js. Returns combined SVG path data centered at (cx, baselineY).
 */
function shapeToPath(otFont, hbFont, text, { cx, baselineY, fontSize }) {
  const upem = otFont.unitsPerEm;
  const scale = fontSize / upem;

  const buffer = new HBBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hbShape(hbFont, buffer);
  const glyphs = buffer.getGlyphInfosAndPositions();

  let cursorX = 0;
  const segments = [];
  for (const g of glyphs) {
    const glyph = otFont.glyphs.get(g.codepoint);
    if (!glyph || !glyph.path) continue;
    const px = cursorX + (g.xOffset || 0) * scale;
    const py = -((g.yOffset || 0) * scale);
    const p = glyph.getPath(px, py, fontSize);
    segments.push(p.toPathData(2));
    cursorX += (g.xAdvance || 0) * scale;
  }
  const totalWidth = cursorX;

  const translateX = cx - totalWidth / 2;
  const translateY = baselineY;
  return {
    d: segments.join(' '),
    transform: `translate(${translateX.toFixed(3)} ${translateY.toFixed(3)})`,
    width: totalWidth,
  };
}

function buildMarkSvg({ withText = true, textPath = null } = {}) {
  const textBlock = withText && textPath
    ? `<g transform="${textPath.transform}"><path d="${textPath.d}" fill="#F4EEE3"/></g>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="1024" height="1024">
  <defs>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1F4F8A"/>
      <stop offset="1" stop-color="#0B2C55"/>
    </linearGradient>
  </defs>
  <path d="M100 20 L168 42 V100 C168 134 142 156 110 170 L96 184 L92 168 C68 162 32 142 32 100 V42 Z" fill="url(#shield)"/>
  ${textBlock}
  <circle cx="76" cy="146" r="6" fill="#E0A24A"/>
  <circle cx="100" cy="146" r="6" fill="#E0A24A" opacity="0.78"/>
  <circle cx="124" cy="146" r="6" fill="#E0A24A" opacity="0.55"/>
</svg>`;
}

async function render(name, svg, { size, padding = 0, background = null }) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const mark = await sharp(Buffer.from(svg), { density: 600 }).resize(inner, inner).png().toBuffer();
  const canvas = sharp({
    create: {
      width: size, height: size, channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  await canvas.composite([{ input: mark, top: offset, left: offset }]).png().toFile(path.join(OUT, name));
  console.log(`  ${name}  (${size}×${size}${background ? ' on bg' : ' transparent'})`);
}

await ensureFont();
const fontBuffer = fs.readFileSync(FONT_PATH);
const otFont = opentype.parse(fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength));
const hbBlob = new HBBlob(fontBuffer);
const hbFace = new HBFace(hbBlob, 0);
const hbFont = new HBFont(hbFace);

const textPath = shapeToPath(otFont, hbFont, 'تحفظ', { cx: 100, baselineY: 110, fontSize: 48 });
const svgWithText = buildMarkSvg({ withText: true, textPath });
const svgNoText = buildMarkSvg({ withText: false });

fs.writeFileSync(path.join(OUT, 'brand-source.svg'), svgWithText);

console.log('Generating Tahaffuz brand PNGs');
await render('icon.png',          svgWithText, { size: 1024, padding: 0.12, background: INK });
await render('adaptive-icon.png', svgWithText, { size: 1024, padding: 0.22 });
await render('splash-icon.png',   svgWithText, { size: 1024, padding: 0.20 });
await render('favicon.png',       svgNoText,   { size: 48,   padding: 0.06 });
console.log('Done.');
