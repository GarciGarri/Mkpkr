// Compila web/src en un único archivo: ../cocinas.html (el artefacto que se publica).
// Uso: node web/build.mjs          → escribe cocinas.html
//      node web/build.mjs --check  → falla si cocinas.html no está al día
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const read = f => readFileSync(join(src, f), 'utf8').replace(/\n$/, '');

const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

export function jsFiles() {
  return readdirSync(join(src, 'js')).filter(f => f.endsWith('.js')).sort();
}

export function build() {
  const js = jsFiles().map(f => read('js/' + f)).join('\n');
  return [
    read('head.html'),
    '<style>', read('styles.css'), '</style>', '',
    read('body.html'), '',
    ...LIBS.map(u => `<script src="${u}"></script>`),
    '<script>', '"use strict";', js, '</script>', '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(here, '..', 'cocinas.html');
  const html = build();
  if (process.argv.includes('--check')) {
    if (readFileSync(out, 'utf8') !== html) { console.error('cocinas.html no está al día: ejecuta "node web/build.mjs"'); process.exit(1); }
    console.log('cocinas.html está al día');
  } else {
    writeFileSync(out, html);
    console.log(`cocinas.html: ${html.length} bytes, ${jsFiles().length} módulos`);
  }
}
