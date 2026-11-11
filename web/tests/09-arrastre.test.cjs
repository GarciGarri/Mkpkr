// Mover a mano módulos e instalaciones: arrastrando en la planta, con el teclado y en el visor 3D.
const { open, check } = require('./harness.cjs');
module.exports = async () => {
  const h = await open();
  await h.page.evaluate(() => { activate(exampleState()); renderAll(); });
  await h.go('diseno');
  const box = async sel => { const el = await h.page.$(sel); await el.scrollIntoViewIfNeeded(); return el.boundingBox(); };
  const centre = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

  // Arrastrar la placa en la planta
  const hob = await h.page.evaluate(() => { const m = S.modules.find(m => m.type === 'placa' || m.type === 'placa_caj'); return { id: m.id, x: m.x, wall: m.wall }; });
  const sel = `#design-svg [data-drag="m:${hob.id}"]`;
  let c = centre(await box(sel));
  await h.page.mouse.move(c.x, c.y); await h.page.mouse.down();
  for (let i = 1; i <= 8; i++) { await h.page.mouse.move(c.x + i * 5, c.y + i * 4); await h.page.waitForTimeout(20); }
  // vuelve a buscar el sitio del cursor tras cada re-render: suelta lejos en la otra dirección
  await h.page.mouse.move(c.x - 60, c.y + 4); await h.page.waitForTimeout(60); await h.page.mouse.up(); await h.page.waitForTimeout(150);
  const after = await h.page.evaluate(id => { const m = S.modules.find(m => m.id === id); return m && { x: m.x, wall: m.wall, lock: m.lock }; }, hob.id);
  check('arrastrar la placa en la planta la mueve y la bloquea', after && after.lock && (after.x !== hob.x || after.wall !== hob.wall), JSON.stringify({ hob, after }));
  const bad = await h.page.evaluate(() => CHECKS.filter(c => c[0] === 'bad' && /solapan/.test(c[1])).length);
  check('tras moverla el resto se recoloca sin solapes', bad === 0);
  await h.page.click('#btn-undo'); await h.page.waitForTimeout(150);
  check('«Deshacer» devuelve la placa a su sitio', await h.page.evaluate(({ id, x }) => S.modules.find(m => m.id === id)?.x === x, hob));

  // Teclado sobre una instalación
  const sv = await h.page.evaluate(() => { const s = S.services.find(s => s.type === 'desague'); return { id: s.id, x: s.x, wall: s.wall }; });
  await h.page.focus(`#design-svg [data-drag="s:${sv.id}"]`);
  await h.page.keyboard.press('Shift+ArrowRight'); await h.page.keyboard.press('ArrowRight');
  const sx = await h.page.evaluate(id => S.services.find(s => s.id === id).x, sv.id);
  check('las flechas mueven el desagüe (Mayús = 10 cm)', Math.abs(sx - (sv.x + 11)) < 0.01, `${sv.x} → ${sx}`);
  check('el foco sigue en la instalación tras moverla', await h.page.evaluate(id => document.activeElement?.dataset?.drag === 's:' + id, sv.id));
  await h.page.keyboard.press('PageDown');
  check('Av Pág la pasa a otra pared', await h.page.evaluate(({ id, wall }) => S.services.find(s => s.id === id).wall !== wall, sv));

  // Arrastrar la toma en la planta de la estancia
  await h.go('estancia');
  const smoke = await h.page.evaluate(() => { const s = S.services.find(s => s.type === 'humos'); return { id: s.id, x: s.x }; });
  c = centre(await box(`#room-svg [data-drag="s:${smoke.id}"]`));
  await h.page.mouse.move(c.x, c.y); await h.page.mouse.down(); await h.page.mouse.move(c.x + 20, c.y + 1, { steps: 4 }); await h.page.mouse.move(c.x + 40, c.y + 2, { steps: 4 }); await h.page.mouse.up(); await h.page.waitForTimeout(150);
  check('arrastrar la salida de humos en la estancia la mueve', await h.page.evaluate(({ id, x }) => S.services.find(s => s.id === id).x !== x, smoke));

  // Visor 3D: arrastrar un mueble
  await h.go('render'); await h.page.waitForTimeout(600);
  const r = await h.page.evaluate(() => {
    const objs = three.group.children.filter(o => o.userData.drag && o.userData.drag.startsWith('m:') && o.visible);
    const cv = three.r.domElement.getBoundingClientRect();
    for (const o of objs) { const v = o.getWorldPosition(new THREE.Vector3()).project(three.cam); const x = cv.left + (v.x + 1) / 2 * cv.width, y = cv.top + (1 - v.y) / 2 * cv.height;
      if (x > cv.left + 20 && x < cv.right - 20 && y > cv.top + 20 && y < cv.bottom - 20) { const hit = three.hit({ clientX: x, clientY: y }); if (hit && hit.object.userData.drag === o.userData.drag) return { x, y, key: o.userData.drag }; } }
    return null; });
  check('el 3D tiene muebles que se pueden coger', !!r);
  if (r) {
    const id = r.key.slice(2); const before = await h.page.evaluate(id => { const m = S.modules.find(m => m.id === id); return { x: m.x, wall: m.wall }; }, id);
    await h.page.mouse.move(r.x, r.y); await h.page.mouse.down(); await h.page.mouse.move(r.x + 30, r.y, { steps: 5 }); await h.page.mouse.move(r.x + 70, r.y, { steps: 5 }); await h.page.mouse.up(); await h.page.waitForTimeout(200);
    const aft = await h.page.evaluate(id => { const m = S.modules.find(m => m.id === id); return m && { x: m.x, wall: m.wall, lock: m.lock }; }, id);
    check('arrastrar en el 3D mueve el mueble y lo bloquea', aft && aft.lock && (aft.x !== before.x || aft.wall !== before.wall), JSON.stringify({ before, aft }));
    check('la vista 3D vuelve a girar después', await h.page.evaluate(() => !three.ctl || three.ctl.enabled));
  }
  const png = await h.page.evaluate(async () => { let seen = null; const orig = three.r.render.bind(three.r); three.r.render = (sc, cam) => { if (seen === null) seen = three.markers.some(m => m.visible); orig(sc, cam); }; const b = await three.png(800); three.r.render = orig; return { ok: !!b && three.markers.length > 0 && seen === false }; });
  check('la imagen se genera con las marcas ocultas', png.ok);
  check('sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
