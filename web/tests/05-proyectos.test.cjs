// Varios proyectos, migración del formato de un solo proyecto, deshacer, persistencia y medida láser.
const { open, check } = require('./harness.cjs');
module.exports = async () => {
  // Migración: un proyecto guardado por la versión anterior (clave única) pasa a la lista sin perderse
  let h = await open();
  await h.page.evaluate(() => { localStorage.clear(); const old = exampleState(); old.v = 1; old.example = false; old.project.name = 'Proyecto antiguo'; delete old.id; old.manual = true; old.modules = []; localStorage.setItem('mkpkr-cocinas-v1', JSON.stringify(old)); });
  await h.page.reload(); await h.page.waitForTimeout(400);
  const m = await h.page.evaluate(() => ({ name: S.project.name, v: S.v, list: listProjects().map(p => p.name), old: localStorage.getItem('mkpkr-cocinas-v1') }));
  check('migra el proyecto de la versión anterior', m.name === 'Proyecto antiguo' && m.v === 2 && m.list.includes('Proyecto antiguo') && m.old === null, JSON.stringify(m));

  // Editar el ejemplo lo convierte en proyecto normal
  await h.page.evaluate(() => { activate(exampleState()); renderAll(); });
  await h.page.fill('#pname', 'Reforma Sra. López'); await h.page.waitForTimeout(100);
  check('al escribir en el ejemplo deja de ser ejemplo', await h.page.evaluate(() => !S.example && $('#exflag').hidden));

  // Proyecto nuevo no destruye el anterior; duplicar; borrar con confirmación
  await h.go('proyectos'); await h.page.click('#p-new'); await h.page.waitForTimeout(200);
  await h.page.fill('#pname', 'Segundo proyecto'); await h.page.waitForTimeout(400);
  await h.go('proyectos');
  const names = await h.page.$$eval('#p-table .plist-name', l => l.map(x => x.textContent));
  check('«Proyecto nuevo» conserva los anteriores en la lista', names.includes('Reforma Sra. López') && names.includes('Segundo proyecto') && names.includes('Proyecto antiguo'), names.join(', '));
  await h.page.click('#p-table tr:has-text("Reforma Sra. López") [data-act="dup"]'); await h.page.waitForTimeout(200);
  check('duplicar crea una copia', (await h.page.$$eval('#p-table .plist-name', l => l.map(x => x.textContent))).includes('Reforma Sra. López (copia)'));
  await h.page.click('#p-table tr:has-text("Reforma Sra. López (copia)") [data-act="del"]');
  await h.answer('Cancelar');
  check('borrar pide confirmación y «Cancelar» no borra', (await h.page.$$eval('#p-table .plist-name', l => l.map(x => x.textContent))).includes('Reforma Sra. López (copia)'));
  await h.page.click('#p-table tr:has-text("Reforma Sra. López (copia)") [data-act="del"]'); await h.answer('Borrar');
  check('«Borrar» lo quita de la lista', !(await h.page.$$eval('#p-table .plist-name', l => l.map(x => x.textContent))).includes('Reforma Sra. López (copia)'));
  await h.page.click('#p-table tr:has-text("Reforma Sra. López") [data-act="open"]'); await h.page.waitForTimeout(200);
  check('abrir un proyecto de la lista', await h.page.evaluate(() => S.project.name === 'Reforma Sra. López'));

  // Deshacer
  await h.go('estancia');
  const w0 = await h.page.inputValue('#r-w');
  await h.page.fill('#r-w', '410'); await h.page.dispatchEvent('#r-w', 'change'); await h.page.waitForTimeout(100);
  await h.page.click('#btn-undo'); await h.page.waitForTimeout(150);
  check('«Deshacer» devuelve la medida anterior', (await h.page.inputValue('#r-w')) === w0, `${w0} → ${await h.page.inputValue('#r-w')}`);

  // Persistencia tras recargar
  await h.go('captura'); await h.page.fill('#notes', 'Notas que deben sobrevivir'); await h.page.waitForTimeout(500);
  await h.page.reload(); await h.page.waitForTimeout(400);
  check('tras recargar se abre el mismo proyecto con sus notas', await h.page.evaluate(() => S.project.name === 'Reforma Sra. López' && S.notes === 'Notas que deben sobrevivir'));

  // Medida láser en una planta escaneada: la planta se reajusta y la pared queda verificada
  await h.page.evaluate(() => { activate(exampleState()); S.example = false; S.shape = { ...S.shape, type: 'poly', pts: [{ x: 0, y: 0 }, { x: 358, y: 0 }, { x: 358, y: 300 }, { x: 0, y: 300 }], real: {}, open: [] }; fixRefs(); autoLayout(); renderAll(); });
  await h.go('captura'); await h.go('estancia');
  await h.page.fill('[data-real="0"]', '360.5'); await h.page.dispatchEvent('[data-real="0"]', 'change'); await h.page.waitForTimeout(150);
  const r = await h.page.evaluate(() => ({ a: G.walls[0].len, c: G.walls[2].len, b: G.walls[1].len, simple: polySimple(G.pts), tag: document.querySelector('#wall-table').textContent.includes('láser') }));
  check('la medida láser reajusta la planta y cierra el contorno', Math.abs(r.a - 360.5) < 0.1 && Math.abs(r.c - 360.5) < 0.6 && Math.abs(r.b - 300) < 0.6 && r.simple && r.tag, JSON.stringify(r));
  await h.page.fill('[data-real="2"]', '355'); await h.page.dispatchEvent('[data-real="2"]', 'change'); await h.page.waitForTimeout(150);
  check('medidas láser incompatibles se avisan', await h.page.evaluate(() => CHECKS.some(c => /no cuadra con las demás/.test(c[1]))));
  await h.page.check('[data-open="3"]'); await h.page.waitForTimeout(150);
  check('marcar una pared como abierta la quita de muebles y del perímetro', await h.page.evaluate(() => G.walls[3].open && !S.modules.some(m => m.wall === 3) && Math.abs(G.perim - (G.walls[0].len + G.walls[1].len + G.walls[2].len)) < 0.1));
  check('sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
