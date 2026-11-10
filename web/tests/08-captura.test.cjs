// Captura: nubes de puntos, fotos que se guardan con el proyecto, vídeo no compatible y respuestas de Claude inesperadas.
const { open, check } = require('./harness.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
function ply(file, n, { up = 'y', scale = 1, ascii = false } = {}) {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const W = 4.2, D = 3.1, H = 2.55, pts = [];
  for (let i = 0; i < n; i++) { const r = rnd(), y = rnd() * H; let p;
    if (r < 0.2) p = [rnd() * W, 0, rnd() * D]; else if (r < 0.4) p = [rnd() * W, H, rnd() * D];
    else { const k = i % 4, t = rnd(); p = k === 0 ? [t * W, y, 0] : k === 1 ? [W, y, t * D] : k === 2 ? [t * W, y, D] : [0, y, t * D]; }
    if (up === 'z') p = [p[0], -p[2], p[1]]; pts.push(p.map(v => v * scale)); }
  if (ascii) { fs.writeFileSync(file, `ply\nformat ascii 1.0\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nend_header\n` + pts.map(p => p.map(v => v.toFixed(4)).join(' ')).join('\n') + '\n'); return; }
  const hdr = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nend_header\n`;
  const buf = Buffer.alloc(hdr.length + n * 12); buf.write(hdr); let o = hdr.length; for (const p of pts) { buf.writeFloatLE(p[0], o); buf.writeFloatLE(p[1], o + 4); buf.writeFloatLE(p[2], o + 8); o += 12; } fs.writeFileSync(file, buf);
}
function png(file, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h, 200); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) >>> 0 : 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
module.exports = async () => {
  const tmp = os.tmpdir();
  const h = await open({ hash: 'captura' });
  for (const [name, n, o] of [['binario, eje Y, metros', 120000, {}], ['ASCII', 60000, { ascii: true }], ['eje Z en milímetros', 120000, { up: 'z', scale: 1000 }]]) {
    const f = path.join(tmp, 'mkpkr-t.ply'); ply(f, n, o);
    await h.page.setInputFiles('#f-scan', f);
    await h.page.waitForFunction(() => /corte con|No se ha podido|Solo hay/.test(document.querySelector('#scan-info').textContent), null, { timeout: 30000 });
    await h.page.click('#scan-auto'); await h.page.waitForTimeout(100);
    const r = await h.page.evaluate(() => scan.trace.length === 4 ? [Math.round(scan.trace[1].x - scan.trace[0].x), Math.round(scan.trace[2].y - scan.trace[1].y), scan.height] : null);
    check(`nube de puntos ${name}: planta 420 × 310 y altura 255`, r && Math.abs(r[0] - 420) <= 2 && Math.abs(r[1] - 310) <= 2 && Math.abs(r[2] - 255) <= 2, JSON.stringify(r));
  }
  // trazado con teclado
  await h.page.click('#scan-clear'); await h.page.focus('#scan-canvas');
  for (const k of ['ArrowLeft', 'Enter', 'ArrowRight', 'Enter', 'ArrowDown', 'Enter']) await h.page.keyboard.press(k);
  check('el contorno del escaneo se puede marcar con teclado', await h.page.evaluate(() => scan.trace.length === 3));
  // usar como planta en el ejemplo crea un proyecto nuevo
  await h.page.click('#scan-auto'); await h.page.click('#scan-use'); await h.page.waitForTimeout(250);
  check('«Usar como planta» crea la estancia del escaneo', await h.page.evaluate(() => S.shape.type === 'poly' && Math.abs(G.walls[0].len - 420) < 3));

  // fotos: se guardan con el proyecto
  await h.go('captura');
  const img = path.join(tmp, 'mkpkr-foto.png'); png(img, 800, 600);
  await h.page.setInputFiles('#f-media', [img, img]); await h.page.waitForTimeout(800);
  await h.page.click('#m-ref'); const bb = await h.page.$eval('#m-canvas', c => { c.scrollIntoView(); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / c.width }; });
  const at = (x, y) => h.page.mouse.click(bb.x + x * bb.k, bb.y + y * bb.k);
  await at(100, 100); await at(300, 100); await h.page.fill('#ref-cm', '100'); await h.page.dispatchEvent('#ref-cm', 'change');
  Object.assign(bb, await h.page.$eval('#m-canvas', c => { c.scrollIntoView(); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / c.width }; }));
  await at(100, 200); await at(500, 200); await h.page.waitForTimeout(700);
  const id = await h.page.evaluate(() => S.id);
  await h.page.reload(); await h.page.waitForTimeout(1200);
  const r = await h.page.evaluate(() => ({ id: S.id, n: frames.length, meas: frames.flatMap(f => f.meas.map(m => Math.round(m.cm))) }));
  check('las fotos y sus medidas se conservan al recargar', r.id === id && r.n === 2 && r.meas && r.meas[0] === 200, JSON.stringify(r));

  // vídeo que el navegador no puede leer
  h.errs.length = 0;
  await h.page.setInputFiles('#f-media', { name: 'visita.mp4', mimeType: 'video/mp4', buffer: Buffer.from('00000018667479706d703432000000006d7034326d7034310000', 'hex') });
  const t = await h.page.waitForSelector('#dlg:not([hidden])', { timeout: 5000 }).then(() => h.page.textContent('#dlg-title')).catch(() => null);
  check('un vídeo no compatible se explica en vez de fallar', t === 'No se puede reproducir el vídeo' && h.errs.length === 0, t || h.errs.join(' | '));
  if (t) await h.answer('Entendido');

  // respuestas de Claude
  await h.page.evaluate(() => { window.__sampleJson = { resumen: 'x', elementos: 'no es una lista' }; });
  await h.page.click('#ai-frames'); await h.page.waitForTimeout(300);
  await h.go('diseno'); await h.go('captura');
  check('una respuesta de Claude con forma inesperada no se guarda ni rompe la vista', h.errs.length === 0 && /formato esperado/.test(await h.page.textContent('#ai-frames-msg')) && await h.page.evaluate(() => S.findings.length === 0));
  await h.page.evaluate(() => { window.__sampleJson = { resumen: 'Cocina antigua', elementos: [{ tipo: 'toma_agua', descripcion: 'Bajo la ventana <b>x</b>', medida: '50 cm', confianza: 'alta' }], estado: 'bien', recomendaciones: [], comprobar: ['altura'] }; });
  await h.page.click('#ai-frames'); await h.page.waitForTimeout(300);
  check('el análisis de fotos se muestra escapado y se guarda', await h.page.evaluate(() => S.findings.length === 1 && document.querySelectorAll('#findings .finding').length === 1 && !document.querySelector('#findings .finding span b')));
  check('sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
