// Recorrido básico: todas las vistas sin errores, en claro y oscuro.
const { open, check } = require('./harness.cjs');
module.exports = async () => {
  for (const scheme of ['light', 'dark']) {
    const h = await open({ colorScheme: scheme });
    for (const v of ['proyectos', 'captura', 'estancia', 'diseno', 'planos', 'presupuesto', 'render']) await h.go(v);
    await h.go('presupuesto'); await h.page.click('#bv-internal'); await h.page.waitForTimeout(100); await h.page.click('#bv-client');
    check(`sin errores de consola en las 7 vistas (${scheme})`, h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
    await h.close();
  }
  const h = await open();
  const st = await h.page.evaluate(() => ({ ex: S.example, mods: S.modules.length, total: document.querySelector('#s-total').textContent, list: listProjects().length }));
  check('arranca con el ejemplo distribuido y guardado en la lista', st.ex && st.mods > 8 && /€/.test(st.total) && st.list === 1, JSON.stringify(st));
  const v = await h.page.evaluate(() => CHECKS.filter(c => c[0] === 'bad').map(c => c[1]));
  check('el ejemplo no tiene problemas en las comprobaciones', v.length === 0, v.join(' | '));
  await h.close();
};
