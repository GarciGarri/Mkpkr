// Interfaz: sin desbordes en móvil, tableta y escritorio; accesibilidad sin incidencias críticas ni graves.
const { open, check } = require('./harness.cjs');
const fs = require('fs');
const path = require('path');
const AXE = fs.readFileSync(path.resolve(__dirname, '..', 'node_modules/axe-core/axe.min.js'), 'utf8');
const VIEWS = ['proyectos', 'captura', 'estancia', 'diseno', 'planos', 'presupuesto', 'render'];
module.exports = async () => {
  for (const [name, vp] of [['móvil 390', { width: 390, height: 844 }], ['tableta 768', { width: 768, height: 1024 }], ['escritorio 1300', { width: 1300, height: 900 }]]) {
    const h = await open({ viewport: vp });
    const bad = [];
    for (const v of VIEWS) { await h.go(v); const o = await h.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 0) bad.push(`${v} +${o}px`); }
    check(`sin desplazamiento horizontal de la página (${name})`, bad.length === 0, bad.join(', '));
    if (vp.width === 390) {
      await h.go('diseno');
      const r = await h.page.evaluate(() => ({ top: Math.round(document.querySelector('[data-view]:not([hidden])').getBoundingClientRect().top), total: (() => { const b = document.querySelector('#s-total'); return b.scrollWidth <= b.clientWidth; })() }));
      check('en móvil el contenido empieza en la primera pantalla y el total se lee entero', r.top < 420 && r.total, JSON.stringify(r));
      await h.go('render');
      check('en móvil la pestaña activa queda visible en la barra', await h.page.evaluate(() => { const a = document.querySelector('nav.tabs a[aria-current]'), n = document.querySelector('nav.tabs'); const r = a.getBoundingClientRect(), q = n.getBoundingClientRect(); return r.left >= q.left - 1 && r.right <= q.right + 1; }));
    }
    await h.close();
  }
  for (const scheme of ['light', 'dark']) {
    const h = await open({ colorScheme: scheme }); const agg = {};
    for (const v of VIEWS) {
      await h.go(v); if (v === 'presupuesto') { await h.page.click('#bv-internal'); await h.page.waitForTimeout(100); }
      await h.page.evaluate(AXE);
      const res = await h.page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.filter(x => x.impact === 'critical' || x.impact === 'serious').map(x => ({ id: x.id, n: x.nodes.length, ej: x.nodes[0].target.join(' ').slice(0, 70) })));
      for (const x of res) { agg[x.id] = agg[x.id] || []; agg[x.id].push(`${v}:${x.n} (${x.ej})`); }
    }
    check(`accesibilidad sin incidencias críticas ni graves (${scheme})`, Object.keys(agg).length === 0, Object.entries(agg).map(([k, v]) => k + ' → ' + v.join('; ')).join(' | '));
    await h.close();
  }
  // Teclado: trazar la planta del escaneo sin ratón
  const h = await open({ hash: 'captura' });
  check('los lienzos de trazado y medida admiten teclado', await h.page.evaluate(() => ['scan-canvas', 'm-canvas'].every(id => document.getElementById(id).tabIndex === 0)));
  check('el documento declara idioma español y región principal', await h.page.evaluate(() => document.documentElement.lang === 'es' && !!document.querySelector('main')));
  await h.close();
};
