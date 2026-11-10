// Arnés de pruebas: abre cocinas.html en Chromium con las bibliotecas de las CDN servidas desde node_modules
// y un doble de window.claude (descargas y Claude) para ejercitar esas rutas sin red.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const NM = path.resolve(__dirname, '..', 'node_modules');
const LIBS = {
  'three.min.js': NM + '/three/build/three.min.js',
  'OrbitControls.js': NM + '/three/examples/js/controls/OrbitControls.js',
  'jszip.min.js': NM + '/jszip/dist/jszip.min.js',
  'jspdf.umd.min.js': NM + '/jspdf/dist/jspdf.umd.min.js',
};
const page_html = () => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${fs.readFileSync(ROOT + '/cocinas.html', 'utf8')}</body></html>`;

const MOCK = `
window.__saved = {}; window.__sampleCalls = []; window.__sampleMode = 'ok';
window.__sampleJson = {resumen:'ok',elementos:[],estado:'',recomendaciones:[],comprobar:[]};
(() => {
  const toB64 = async (data) => { const b = data instanceof Blob ? data : new Blob([data]); const buf = new Uint8Array(await b.arrayBuffer()); let s=''; for (let i=0;i<buf.length;i+=0x8000) s += String.fromCharCode.apply(null, buf.subarray(i,i+0x8000)); return btoa(s); };
  const downloads = { save: async ({filename, data}) => { window.__saved[filename] = await toB64(data); } };
  const sample = async (input, opts={}) => { window.__sampleCalls.push({input: typeof input==='string'?input:JSON.stringify(input), images:(opts.images||[]).length}); if (window.__sampleMode==='reject') throw {code:'rate_limited',message:'x'}; if (opts.onText) opts.onText({text:'MEMORIA DE PRUEBA',delta:'MEMORIA DE PRUEBA'}); return {text:'MEMORIA DE PRUEBA', truncated:false}; };
  sample.json = async (input, opts={}) => { window.__sampleCalls.push({input, images:(opts.images||[]).length}); if (window.__sampleMode==='reject') throw {code:'not_granted',message:'x'}; return window.__sampleJson; };
  sample.limits = async () => ({maxPromptBytes: 262144, images:{maxCount:4,maxInputBytes:5e6,mediaTypes:['image/jpeg','image/png']}});
  window.claude = { use: async (n) => n==='downloads' ? downloads : n==='sample' ? sample : null };
})();`;

let browser = null;
async function getBrowser() {
  if (!browser) browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  return browser;
}
async function open({ viewport = { width: 1300, height: 950 }, mock = true, hash = 'diseno', colorScheme = 'light' } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport, colorScheme });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u === 'http://test.local/') return r.fulfill({ body: page_html(), contentType: 'text/html' });
    for (const [k, f] of Object.entries(LIBS)) if (u.endsWith('/' + k)) return r.fulfill({ path: f, contentType: 'text/javascript' });
    if (u.startsWith('blob:') || u.startsWith('data:')) return r.continue();
    return r.fulfill({ body: '', contentType: 'text/css' });
  });
  if (mock) await page.addInitScript(MOCK);
  await page.goto('http://test.local/#' + hash);
  await page.waitForTimeout(300);
  const go = async v => { await page.evaluate(v => { location.hash = '#' + v; }, v); await page.waitForTimeout(v === 'render' ? 900 : 150); };
  // Responde al diálogo propio de la página pulsando el botón con ese texto.
  const answer = async label => { await page.waitForSelector('#dlg:not([hidden])', { timeout: 3000 }); await page.click(`#dlg-btns button:text-is("${label}")`); await page.waitForTimeout(150); };
  const close = () => ctx.close();
  return { ctx, page, errs, go, answer, close };
}
async function done() { if (browser) await browser.close(); browser = null; }

// Escaneo RoomPlan sintético a partir de tramos de pared [x1, z1, x2, z2] en metros.
function roomPlanJSON(walls, { H = 2.5, doors = [], windows = [], mkpkr } = {}) {
  const T = (x, y, z, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return [[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [x, y, z, 1]]; };
  const seg = ([x1, z1, x2, z2], h, y0 = 0) => ({ dimensions: [Math.hypot(x2 - x1, z2 - z1), h, 0], transform: T((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2, Math.atan2(z2 - z1, x2 - x1)), category: { wall: {} } });
  const at = ([x1, z1, x2, z2], t, w) => { const l = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / l, uz = (z2 - z1) / l; return [x1 + ux * t, z1 + uz * t, x1 + ux * (t + w), z1 + uz * (t + w)]; };
  const j = { walls: walls.map((w, i) => [(i * 7 + 3) % walls.length, seg(w, H)]).sort((a, b) => a[0] - b[0]).map(x => x[1]),
    doors: doors.map(([wi, t, w, h]) => ({ ...seg(at(walls[wi], t, w), h), category: { door: { isOpen: false } } })),
    windows: windows.map(([wi, t, w, h, sill]) => seg(at(walls[wi], t, w), h, sill)), openings: [], objects: [] };
  if (mkpkr) j.mkpkr = mkpkr;
  return j;
}

// Mini marco de pruebas
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); }
module.exports = { open, done, check, results, roomPlanJSON, ROOT };
