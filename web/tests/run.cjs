// Ejecuta todas las baterías: node tests/run.cjs [filtro]
const fs = require('fs');
const path = require('path');
const { done, results } = require('./harness.cjs');

(async () => {
  const filter = process.argv[2] || '';
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.cjs') && f.includes(filter)).sort();
  for (const f of files) {
    console.log(`\n▶ ${f}`);
    const t0 = Date.now();
    try { await require(path.join(__dirname, f))(); }
    catch (e) { results.push({ name: f + ' (excepción)', ok: false, detail: e.stack || String(e) }); console.log('  ✗ excepción: ' + (e.stack || e)); }
    console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  await done();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length} de ${results.length} comprobaciones correctas.`);
  if (bad.length) { console.log('Fallos:\n' + bad.map(b => ' - ' + b.name + (b.detail ? ': ' + b.detail.split('\n')[0] : '')).join('\n')); process.exit(1); }
})();
