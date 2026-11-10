// Archivos no fiables: ningún dato del proyecto ejecuta código y los proyectos defectuosos se sanean o se rechazan.
const { open, check } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
module.exports = async () => {
  const h = await open({ hash: 'estancia' });
  const tmp = path.join(require('os').tmpdir(), 'mkpkr-sec.json');
  const base = JSON.parse(await h.page.evaluate(() => JSON.stringify(S)));
  const load = async (obj, view = 'estancia') => {
    await h.page.evaluate(() => { localStorage.clear(); activate(exampleState()); renderAll(); });
    fs.writeFileSync(tmp, typeof obj === 'string' ? obj : JSON.stringify(obj)); h.errs.length = 0;
    await h.page.setInputFiles('#f-project', tmp); await h.page.waitForTimeout(250);
    if (await h.page.evaluate(() => !document.querySelector('#dlg').hidden)) { const t = await h.page.textContent('#dlg-title'); const btn = await h.page.$$eval('#dlg-btns button', bs => bs.map(b => b.textContent)); await h.answer(btn.includes('Abrir como copia') ? 'Abrir como copia' : btn[0]); return t; }
    for (const v of ['estancia', 'diseno', 'planos', 'presupuesto', 'captura', 'proyectos']) await h.go(v);
    return null;
  };
  const XSS = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">';
  const payloads = {
    'openings[].x': s => { s.openings[0].x = XSS; }, 'openings[].w': s => { s.openings[0].w = XSS; }, 'services[].id': s => { s.services[0].id = XSS; },
    'modules[].id': s => { s.modules[0].id = XSS; }, 'project.name': s => { s.project.name = '<img src=x onerror="window.__xss=(window.__xss||0)+1">'; },
    'client.name': s => { s.client = { name: XSS }; }, 'extra[].label': s => { s.extra = [{ id: 'a', label: XSS, q: 1, unit: XSS, price: 1 }]; },
    'findings': s => { s.findings = [{ resumen: XSS, elementos: [{ tipo: XSS, descripcion: XSS, medida: XSS, confianza: XSS }] }]; },
    'design.walls': s => { s.design.walls = [XSS]; }, 'finish.front': s => { s.finish.front = XSS; },
  };
  for (const [k, mut] of Object.entries(payloads)) {
    const s = JSON.parse(JSON.stringify(base)); mut(s); await load(s);
    await h.go('presupuesto'); await h.page.click('#bv-internal'); await h.go('captura');
    const x = await h.page.evaluate(() => window.__xss || 0);
    check(`no se ejecuta código desde ${k}`, x === 0 && h.errs.length === 0, `ejecuciones ${x}; ${h.errs.slice(0, 1)}`);
  }
  await h.page.reload(); await h.page.waitForTimeout(400);
  for (const v of ['estancia', 'diseno', 'presupuesto']) await h.go(v);
  check('tras recargar tampoco se ejecuta nada guardado', await h.page.evaluate(() => (window.__xss || 0) === 0));

  const broken = {
    'gama desconocida': s => { s.design.gama = 'premium'; }, 'acabado desconocido': s => { s.finish.front = 'rojo'; },
    'tipo de módulo desconocido': s => { s.modules[0].type = 'isla'; }, 'tipo de hueco desconocido': s => { s.openings[0].type = 'arco'; },
    'módulo en pared inexistente': s => { s.modules[0].wall = 9; }, 'hueco en pared inexistente': s => { s.openings[0].wall = 9; },
    'sin finish': s => { delete s.finish; }, 'sin design.walls': s => { delete s.design.walls; }, 'shape.w = 0': s => { s.shape.w = 0; },
    'altura en texto': s => { s.height = 'alto'; }, 'listas que no son listas': s => { s.openings = 'x'; s.services = { a: 1 }; s.modules = 5; },
    'formato antiguo v1 con edición manual': s => { s.v = 1; s.manual = true; delete s.id; },
  };
  for (const [k, mut] of Object.entries(broken)) {
    const s = JSON.parse(JSON.stringify(base)); mut(s); const dlg = await load(s);
    const st = await h.page.evaluate(() => ({ total: document.querySelector('#s-total').textContent, v: S.v }));
    check(`proyecto defectuoso «${k}» se abre saneado`, h.errs.length === 0 && /€/.test(st.total) && st.v === 2 && (!dlg || dlg === 'Este proyecto ya está guardado'), `${h.errs.slice(0, 1)} ${dlg || ''} ${st.total}`);
  }
  const s0 = JSON.parse(JSON.stringify(base)); s0.v = 9;
  check('un proyecto de una versión más nueva se rechaza con mensaje', /No se puede abrir/.test(await load(s0) || ''));
  check('un JSON que no es proyecto ni escaneo se rechaza con mensaje', /No se puede abrir/.test(await load('{"hola":1}') || ''));
  check('un archivo que no es JSON se rechaza con mensaje', /No se puede abrir/.test(await load('{mal json') || ''));
  await h.close();
};
