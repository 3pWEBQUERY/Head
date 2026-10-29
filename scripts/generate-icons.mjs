// Erzeugt die PWA-Icons aus dem Lapis-Stein. Aufruf: npm run icons
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const gem = (scale) => {
  const s = 512 * scale, o = (512 - s) / 2, k = s / 26;
  const t = (x, y) => `${(o + x * k).toFixed(1)} ${(o + y * k).toFixed(1)}`;
  return `<path d="M${t(13, 1.5)} L${t(24.5, 10)} L${t(13, 24.5)} L${t(1.5, 10)}Z" fill="#213885"/>
          <path d="M${t(1.5, 10)} L${t(24.5, 10)} L${t(13, 24.5)}Z" fill="#5F3475"/>
          <path d="M${t(7, 10)} L${t(13, 24.5)} L${t(19, 10)}Z" fill="#893172"/>`;
};
const svg = (scale, radius) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
     <rect width="512" height="512" rx="${radius}" fill="#F7F4F0"/>${gem(scale)}</svg>`,
);

await mkdir('web/public/icons', { recursive: true });
await sharp(svg(0.62, 0)).resize(512).png().toFile('web/public/icons/maskable-512.png');
await sharp(svg(0.72, 0)).resize(512).png().toFile('web/public/icons/icon-512.png');
await sharp(svg(0.72, 0)).resize(192).png().toFile('web/public/icons/icon-192.png');
await sharp(svg(0.7, 0)).resize(180).png().toFile('web/public/apple-touch-icon.png');
console.log('Icons erzeugt');
