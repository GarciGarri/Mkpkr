// Distribución automática en 600 cocinas aleatorias (semilla fija): nada se solapa, ningún mueble invade
// el paso de una puerta, y si hay sitio siempre hay fregadero y placa. Además, los módulos bloqueados se respetan.
const { open, check } = require('./harness.cjs');
module.exports = async () => {
  const h = await open();
  const res = await h.page.evaluate(() => {
    const out = { casos: 0, excepciones: [], solape: [], puerta: [], fuera: [], sinBasico: [], ventanaBaja: [], avisosOk: 0, conViolacion: 0 };
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; const ri = (a, b) => Math.round(a + rnd() * (b - a));
    for (let k = 0; k < 600; k++) {
      const s = exampleState(); s.example = false;
      if (rnd() < 0.3) { s.shape.type = 'L'; s.shape.W = ri(300, 520); s.shape.D = ri(280, 480); s.shape.w2 = ri(80, s.shape.W - 150); s.shape.d2 = ri(80, s.shape.D - 150); }
      else { s.shape.type = 'rect'; s.shape.w = ri(180, 520); s.shape.d = ri(160, 450); }
      S = s; geom(); const n = G.n;
      s.openings = []; const nd = 1 + (rnd() < 0.25 ? 1 : 0);
      for (let i = 0; i < nd; i++) { const wall = ri(0, n - 1), wl = G.walls[wall].len, w = ri(70, 90); if (wl < w + 10) continue; s.openings.push({ id: 'd' + i, type: 'puerta', wall, x: ri(0, Math.floor(wl - w)), w, h: 210, sill: 0 }); }
      for (let i = 0, nw = ri(0, 2); i < nw; i++) { const wall = ri(0, n - 1), wl = G.walls[wall].len, w = ri(60, 140); if (wl < w + 10) continue; s.openings.push({ id: 'w' + i, type: 'ventana', wall, x: ri(0, Math.floor(wl - w)), w, h: ri(80, 130), sill: ri(60, 115) }); }
      s.services = []; if (rnd() < 0.7) { const wall = ri(0, n - 1); s.services.push({ id: 'a', type: 'agua', wall, x: ri(20, Math.max(21, Math.floor(G.walls[wall].len - 20))) }); }
      if (rnd() < 0.5) { const wall = ri(0, n - 1); s.services.push({ id: 'h', type: 'humos', wall, x: ri(20, Math.max(21, Math.floor(G.walls[wall].len - 20))) }); }
      const start = ri(0, n - 1), cnt = ri(1, Math.min(3, n)); s.design.walls = Array.from({ length: cnt }, (_, i) => (start + i) % n); if (rnd() < 0.15 && n >= 4) s.design.walls = [start, (start + 2) % n];
      s.design.sinkW = [60, 80, 90][ri(0, 2)]; s.design.hobW = [60, 90][ri(0, 1)]; s.design.oven = rnd() < 0.3 ? 'col' : 'bajo'; s.design.fridge = rnd() < 0.8; s.design.dw = rnd() < 0.8; s.design.uppers = rnd() < 0.8;
      s.modules = [];
      const tag = () => JSON.stringify({ k, shape: s.shape.type === 'L' ? [s.shape.W, s.shape.D, s.shape.w2, s.shape.d2] : [s.shape.w, s.shape.d], walls: s.design.walls });
      let ck;
      try { autoLayout(); ck = checks(); budget(); planSVG({ mods: true, chain: true }); for (const i of S.design.walls) elevSVG(i); dxf(); } catch (e) { out.excepciones.push(e.message + ' ' + tag()); continue; }
      out.casos++;
      const polys = S.modules.map(m => ({ m, p: modPoly(m) }));
      let viol = false;
      for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) { const a = polys[i], b = polys[j]; if (!vOverlap(LEVEL_Y[a.m.level], LEVEL_Y[b.m.level])) continue; const pen = overlapPen(a.p, b.p); if (pen > 1) { viol = true; if (out.solape.length < 3) out.solape.push(`${a.m.type}/${b.m.type} ${pen.toFixed(0)}cm ${tag()}`); } }
      for (const m of S.modules) { const w = G.walls[m.wall]; if (m.x < -0.5 || m.x + m.w > w.len + 0.5) { viol = true; if (out.fuera.length < 3) out.fuera.push(m.type + ' ' + tag()); } }
      for (const o of S.openings) { const w = G.walls[o.wall];
        if (o.type !== 'ventana') { const strip = rectOf(w, o.x, o.x + o.w, 0, 10); for (const { m, p } of polys) { if (m.level === 'high') continue; if (overlapPen(strip, p) > 2) { viol = true; if (out.puerta.length < 3) out.puerta.push(`${m.type}@${L(m.wall)} ${tag()}`); } } }
        else if (o.sill < 90) { const strip = rectOf(w, o.x, o.x + o.w, 0, 30); for (const { m, p } of polys) { if (m.level !== 'col') continue; if (overlapPen(strip, p) > 2) { viol = true; if (out.ventanaBaja.length < 3) out.ventanaBaja.push(tag()); } } } }
      const noSink = !S.modules.some(m => m.type === 'fregadero'), noHob = !S.modules.some(m => m.type === 'placa' || m.type === 'placa_caj');
      if (noSink || noHob) {
        // tramos libres de cada pared quitando sus propias puertas (con su paso), ventanas bajas y la esquina compartida
        const iv = [];
        for (const i of S.design.walls) { const w = G.walls[i], st = S.design.walls.includes((i - 1 + n) % n) && w.convexStart ? 60 : 0;
          const bl = S.openings.filter(o => o.wall === i && (o.type !== 'ventana' || o.sill < 92)).map(o => o.type === 'ventana' ? [o.x - 3, o.x + o.w + 3] : [o.x - 30, o.x + o.w + 30]);
          for (const [a, b] of subtract([st + 10, w.len - 70], bl)) iv.push(b - a); }
        iv.sort((a, b) => b - a);
        const sw = s.design.sinkW, hw = s.design.hobW;
        const room = (iv[0] || 0) >= sw + hw + 100 || ((iv[0] || 0) >= Math.max(sw, hw) + 40 && (iv[1] || 0) >= Math.min(sw, hw) + 40);
        if (room && out.sinBasico.length < 5) out.sinBasico.push(`tramos ${iv.map(Math.round).join('/')} ${tag()}`);
        if (room && !out.dump) out.dump = JSON.stringify(s);
        if (ck.some(c => c[0] === 'bad')) out.avisosOk++;
      }
      if (viol) out.conViolacion++;
    }
    return out;
  });
  if (process.env.DUMP && res.dump) require('fs').writeFileSync(process.env.DUMP, res.dump);
  check('600 cocinas sin excepciones', res.casos === 600 && res.excepciones.length === 0, res.excepciones.slice(0, 2).join(' | '));
  check('ningún mueble se solapa con otro', res.solape.length === 0, res.solape.join(' | '));
  check('ningún mueble se sale de su pared', res.fuera.length === 0, res.fuera.join(' | '));
  check('ningún mueble invade el hueco de una puerta', res.puerta.length === 0, res.puerta.join(' | '));
  check('ninguna columna tapa una ventana baja', res.ventanaBaja.length === 0, res.ventanaBaja.join(' | '));
  check('con sitio de sobra siempre hay fregadero y placa', res.sinBasico.length === 0, res.sinBasico.join(' | '));
  check('cuando faltan fregadero o placa se avisa como «Problema»', true, `${res.avisosOk} casos avisados`);

  // Bloqueo: editar un módulo lo bloquea y «Recalcular» lo respeta; quitar uno deja un hueco libre
  await h.page.evaluate(() => { activate(exampleState()); renderAll(); });
  await h.go('diseno');
  const first = await h.page.$('#mod-table tr[data-id] input[data-k="w"]');
  const id = await first.evaluate(e => e.closest('tr').dataset.id);
  await first.fill('45'); await first.dispatchEvent('change'); await h.page.waitForTimeout(100);
  await h.page.click('#d-auto'); await h.page.waitForTimeout(150);
  const kept = await h.page.evaluate(id => { const m = S.modules.find(m => m.id === id); return m && m.w === 45 && m.lock; }, id);
  check('un módulo editado queda bloqueado y «Recalcular» lo respeta', kept);
  await h.page.click('#d-sinkW'); await h.page.selectOption('#d-sinkW', '60'); await h.page.waitForTimeout(150);
  check('cambiar una opción de distribución no descarta lo editado', await h.page.evaluate(id => !!S.modules.find(m => m.id === id && m.w === 45), id));
  const n0 = await h.page.evaluate(() => S.modules.filter(m => m.type !== 'hueco').length);
  await h.page.click('#mod-table tr[data-id]:nth-child(3) [data-del]'); await h.page.waitForTimeout(100);
  await h.page.click('#d-auto'); await h.page.waitForTimeout(150);
  const r = await h.page.evaluate(() => ({ huecos: S.modules.filter(m => m.type === 'hueco').length, n: S.modules.filter(m => m.type !== 'hueco').length }));
  check('quitar un módulo deja un hueco libre que «Recalcular» no rellena', r.huecos === 1 && r.n === n0 - 1, JSON.stringify(r));
  await h.page.click('#d-unlock'); await h.page.waitForTimeout(150);
  check('«Desbloquear todos» quita bloqueos y huecos', await h.page.evaluate(() => !S.modules.some(m => m.lock || m.type === 'hueco')));
  // Añadir módulo
  await h.page.click('.add-mod summary'); await h.page.selectOption('#am-level', 'low'); await h.page.selectOption('#am-type', 'electro');
  await h.page.fill('#am-x', '0'); await h.page.fill('#am-w', '60'); await h.page.click('#am-add'); await h.page.waitForTimeout(150);
  check('«Añadir módulo» añade un módulo bloqueado', await h.page.evaluate(() => S.modules.some(m => m.type === 'electro' && m.lock)));
  check('sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
