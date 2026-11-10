// Importación de escaneos: geometrías con área conocida (shared/fixtures/rooms.json), formato de la app (v2),
// huecos e instalaciones, y que importar nunca sustituye datos sin preguntar.
const { open, check, roomPlanJSON, ROOT } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const FIX = JSON.parse(fs.readFileSync(ROOT + '/shared/fixtures/rooms.json', 'utf8'));

// Misma generación que ios/MkpkrScan/Tests/main.swift
function segmentsFor(c) {
  const segs = [];
  const P = c.poly, n = P.length;
  for (let i = 0; i < n && n >= 2; i++) {
    if ((c.drop || []).includes(i)) continue;
    const a = P[i], b = P[(i + 1) % n];
    if ((c.split || []).includes(i)) { const m = [a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4]; segs.push([a[0], a[1], m[0], m[1]], [m[0], m[1], b[0], b[1]]); }
    else segs.push([a[0], a[1], b[0], b[1]]);
  }
  for (const e of c.extra || []) segs.push(e.slice());
  const sh = c.shrink || 0, rot = c.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
  const out = segs.map(([x1, z1, x2, z2]) => {
    const l = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / l, uz = (z2 - z1) / l;
    const p = [x1 + ux * sh, z1 + uz * sh, x2 - ux * sh, z2 - uz * sh];
    const R = (x, z) => [x * cs - z * sn + 1.7, x * sn + z * cs - 0.9];
    return [...R(p[0], p[1]), ...R(p[2], p[3])];
  });
  return out.map((s, i) => [(i * 7 + 3) % out.length, s]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
module.exports = async () => {
  const h = await open({ hash: 'captura' });
  const tmp = path.join(require('os').tmpdir(), 'mkpkr-import.json');
  const importFile = async obj => { fs.writeFileSync(tmp, JSON.stringify(obj)); await h.page.setInputFiles('#f-project', tmp); await h.page.waitForTimeout(250); };
  for (const c of FIX.cases) {
    await h.page.evaluate(() => { activate(exampleState()); renderAll(); });
    const before = await h.page.evaluate(() => S.id);
    await importFile(roomPlanJSON(segmentsFor(c)));
    const dlg = await h.page.evaluate(() => !document.querySelector('#dlg').hidden ? document.querySelector('#dlg-title').textContent : null);
    if (c.reject) {
      const same = await h.page.evaluate(id => S.id === id, before);
      check(`rechaza: ${c.name}`, dlg === 'No se ha importado el escaneo' && same, dlg || 'sin aviso');
      if (dlg) await h.answer('Entendido');
      continue;
    }
    if (dlg) { const t = await h.page.textContent('#dlg-text'); check(`importa: ${c.name}`, false, 'diálogo: ' + t); await h.answer('Entendido'); continue; }
    const r = await h.page.evaluate(() => ({ area: G.area / 1e4, n: G.n, open: G.walls.filter(w => w.open).length, simple: polySimple(G.pts), newProject: true }));
    const ok = Math.abs(r.area - c.expect.area) / c.expect.area < 0.01 && r.n === c.expect.walls && r.open === c.expect.open && r.simple;
    check(`importa: ${c.name}`, ok, `área ${r.area.toFixed(2)} m² (esperada ${c.expect.area}), ${r.n} paredes, ${r.open} abiertas`);
  }

  // Formato v2 de Mkpkr Scan: la web usa la planta resuelta en la app tal cual
  await h.page.evaluate(() => { activate(exampleState()); renderAll(); });
  const v2 = roomPlanJSON(segmentsFor(FIX.cases[3]), { doors: [[0, 0.5, 0.82, 2.03]], windows: [[2, 0.3, 1.0, 1.1, 1.0]] });
  v2.mkpkr = { formato: 'mkpkr-scan', version: 2, nombre: 'Piso de prueba', medidas: [{ etiqueta: 'Altura toma', cm: 52.5 }],
    planta: { esquinas: [[0, 0], [4, 0], [4, 3], [0, 3]], abiertas: [], paredes_reales: { 0: 401.5 } },
    instalaciones: [{ tipo: 'agua', x: 2, z: 0.02, altura_cm: 50, origen: 'auto' }, { tipo: 'humos', x: 3.98, z: 1.5, altura_cm: 230, origen: 'manual' }] };
  await importFile(v2);
  const r2 = await h.page.evaluate(() => ({ name: S.project.name, n: G.n, area: G.area / 1e4, real: S.shape.real, serv: S.services.map(s => [s.type, s.wall, s.x, s.h]), notes: S.notes, lenA: G.walls[0].len }));
  check('formato v2: usa la planta de la app, la medida láser y las instalaciones', r2.name === 'Piso de prueba' && r2.n === 4 && Math.abs(r2.lenA - 401.5) < 0.6 && r2.serv.some(s => s[0] === 'agua' && s[3] === 50) && r2.serv.some(s => s[0] === 'humos'), JSON.stringify({ ...r2, notes: undefined }));
  check('formato v2: notas con medidas e instalaciones', /Altura toma: 52,5 cm/.test(r2.notes) && /2 instalaciones/.test(r2.notes), r2.notes.slice(0, 120));

  // Importar sobre un proyecto propio pregunta y no sustituye nada por defecto
  await h.page.evaluate(() => { const s = blankState(); s.project.name = 'Cliente real'; s.notes = 'Notas del cliente'; s.memo = 'Memoria escrita'; activate(s); S.modules[0].w = 77; S.modules[0].lock = true; renderAll(); });
  const realId = await h.page.evaluate(() => S.id);
  fs.writeFileSync(tmp, JSON.stringify(roomPlanJSON(segmentsFor(FIX.cases[0])))); await h.page.setInputFiles('#f-project', tmp);
  const t = await h.page.waitForSelector('#dlg:not([hidden])', { timeout: 3000 }).then(() => h.page.textContent('#dlg-title')).catch(() => null);
  check('importar sobre un proyecto propio pregunta antes', t === '¿Dónde cargo el escaneo?', t || 'no preguntó');
  await h.answer('Proyecto nuevo');
  const r3 = await h.page.evaluate(id => { const old = loadProject(id); return { newId: S.id !== id, oldName: old.project.name, oldNotes: old.notes, oldMemo: old.memo, oldMod: old.modules[0].w }; }, realId);
  check('«Proyecto nuevo» deja intacto el proyecto anterior', r3.newId && r3.oldName === 'Cliente real' && r3.oldNotes === 'Notas del cliente' && r3.oldMemo === 'Memoria escrita' && r3.oldMod === 77, JSON.stringify(r3));
  await h.page.evaluate(id => { activate(loadProject(id)); renderAll(); }, realId);
  fs.writeFileSync(tmp, JSON.stringify(roomPlanJSON(segmentsFor(FIX.cases[0])))); await h.page.setInputFiles('#f-project', tmp);
  await h.answer('Sustituir la estancia');
  const r4 = await h.page.evaluate(() => ({ name: S.project.name, notes: S.notes, shape: S.shape.type }));
  await h.page.click('#btn-undo'); await h.page.waitForTimeout(150);
  const r5 = await h.page.evaluate(() => ({ shape: S.shape.type, w: S.modules[0].w }));
  check('«Sustituir la estancia» conserva nombre y notas, y se puede deshacer', r4.name === 'Cliente real' && /Notas del cliente/.test(r4.notes) && r4.shape === 'poly' && r5.shape === 'rect' && r5.w === 77, JSON.stringify({ r4: { ...r4, notes: r4.notes.slice(0, 30) }, r5 }));
  check('importación sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
