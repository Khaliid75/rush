// Génère l'icône Rush (grille de carte de chaleur sur dégradé lavande) dans le projet Android.
// Lancé par le workflow après « npx cap add android ».
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'android/app/src/main/res';
const LV = [
  [1, 2, 1, 3],
  [2, 4, 5, 2],
  [1, 3, 4, 2],
  [0, 1, 2, 1],
];
const ALPHA = [0.14, 0.3, 0.5, 0.72, 1, 1];

const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a80ff"/><stop offset="1" stop-color="#3a2a8a"/></linearGradient></defs>`;

// Grille 4 × 4 centrée en (0,0), côté total = 68
const grid = LV.map((row, r) =>
  row
    .map((v, c) => `<rect x="${-34 + c * 17}" y="${-34 + r * 17}" width="15" height="15" rx="4" fill="#ffffff" fill-opacity="${ALPHA[v]}"/>`)
    .join('')
).join('');

const wrap = (size, view, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}">${defs}${body}</svg>`;

const background = (size) => wrap(size, 108, `<rect width="108" height="108" fill="url(#g)"/>`);
// Calque avant de l'icône adaptative (zone sûre ≈ 66/108)
const foreground = (size) => wrap(size, 108, `<g transform="translate(54 54) scale(0.68)">${grid}</g>`);
const square = (size) =>
  wrap(size, 100, `<rect width="100" height="100" rx="22" fill="url(#g)"/><g transform="translate(50 50) scale(0.9)">${grid}</g>`);
const round = (size) =>
  wrap(size, 100, `<circle cx="50" cy="50" r="50" fill="url(#g)"/><g transform="translate(50 50) scale(0.8)">${grid}</g>`);

const DENSITIES = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };

const write = async (svg, file) => {
  mkdirSync(join(file, '..'), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(file);
};

for (const [d, [launcher, layer]] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${d}`);
  await write(square(launcher), join(dir, 'ic_launcher.png'));
  await write(round(launcher), join(dir, 'ic_launcher_round.png'));
  await write(foreground(layer), join(dir, 'ic_launcher_foreground.png'));
  await write(background(layer), join(dir, 'ic_launcher_background.png'));
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
mkdirSync(join(RES, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
writeFileSync(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);

mkdirSync(join(RES, 'values'), { recursive: true });
writeFileSync(
  join(RES, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#5b3fd1</color>
</resources>
`
);

console.log('Icône Rush générée.');
