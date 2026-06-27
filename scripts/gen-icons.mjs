// Rasterize the Tika Dost "Chat Shield" mark (Concept B) into the PNGs Expo
// expects: icon / adaptive-icon / splash-icon / favicon.
//
// The mark is a shield with a speech-bubble tail + three amber dots — pure
// vector, no embedded text, so this just composes the SVG and rasterizes it.
//
// Run:  node scripts/gen-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets');

const CREAM = '#F4EEE3';
const AMBER = '#E0A24A';
const INDIGO = '#143C6C';

function markSvg(shield = CREAM) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  <path d="M50 9 L82 20 C84 20.8 85 22 85 24 L85 50 C85 70 71 83 56 89 L60 99 L43 88 C27 84 15 70 15 50 L15 24 C15 22 16 20.8 18 20 Z" fill="${shield}"/>
  <circle cx="35" cy="50" r="6.5" fill="${AMBER}"/>
  <circle cx="50" cy="50" r="6.5" fill="${AMBER}"/>
  <circle cx="65" cy="50" r="6.5" fill="${AMBER}"/>
</svg>`;
}

function rgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), alpha: 1 };
}

async function render(name, svg, { size, padding = 0, background = null }) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const mark = await sharp(Buffer.from(svg), { density: 600 }).resize(inner, inner).png().toBuffer();
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  await canvas.composite([{ input: mark, top: offset, left: offset }]).png().toFile(path.join(OUT, name));
  console.log(`  ${name}  (${size}×${size}${background ? ' on bg' : ' transparent'})`);
}

fs.writeFileSync(path.join(OUT, 'brand-source.svg'), markSvg(CREAM));

console.log('Generating Tika Dost (Chat Shield) brand PNGs');
// Launcher icon: cream shield on the indigo brand background.
await render('icon.png', markSvg(CREAM), { size: 1024, padding: 0.16, background: rgb(INDIGO) });
// Adaptive + splash foregrounds: cream shield on transparent (app.json sets the indigo bg).
await render('adaptive-icon.png', markSvg(CREAM), { size: 1024, padding: 0.26 });
await render('splash-icon.png', markSvg(CREAM), { size: 1024, padding: 0.24 });
// Favicon: keep it legible on light tabs — indigo shield on cream.
await render('favicon.png', markSvg(INDIGO), { size: 48, padding: 0.08, background: rgb(CREAM) });
console.log('Done.');
