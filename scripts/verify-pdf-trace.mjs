import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const manifest = path.resolve('.next/server/app/api/documents/pdf/route.js.nft.json');
const files = JSON.parse(readFileSync(manifest, 'utf8')).files;
const traced = new Set(files.map(file => path.resolve(path.dirname(manifest), file)));
const fonts = [...traced].filter(file => /pdfkit[/\\]js[/\\]standard-fonts[/\\].*\.mjs$/.test(file));
if (!fonts.length) throw new Error('No PDFKit runtime fonts were traced');
const missing = fonts.map(file => file.replace(/\.mjs$/, '.cjs')).filter(file => existsSync(file) && !traced.has(file));
if (missing.length) throw new Error(`PDF runtime requires untraced CommonJS fonts: ${missing.map(file => path.basename(file)).join(', ')}`);
for (const file of ['public/fonts/NotoSans-Regular.ttf', 'public/fonts/NotoSans-Bold.ttf', 'public/azarraga-logo-mark.jpg']) {
  if (!traced.has(path.resolve(file))) throw new Error(`PDF asset missing from trace: ${file}`);
}
console.log(`PDF deployment assets verified: ${fonts.length} font modules, CommonJS counterparts, peso fonts and logo.`);
