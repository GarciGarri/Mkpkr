// Presupuesto: cuentas que cuadran, nada interno en lo que ve el cliente, y exportaciones completas.
const { open, check } = require('./harness.cjs');
const zlib = require('zlib');
// Lector mínimo de ZIP (sin dependencias): lista de nombres y contenido de un archivo.
function unzip(buf) {
  const out = {}; let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
    const name = buf.slice(p + 30, p + 30 + nlen).toString('utf8'), data = buf.slice(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : data; p += 30 + nlen + xlen + csize;
  }
  return out;
}
const parseEur = s => Number(s.replace(/[^\d,−-]/g, '').replace('−', '-').replace(',', '.'));
module.exports = async () => {
  const h = await open({ hash: 'presupuesto' });
  // descuento y una partida libre
  await h.page.fill('#b-disc', '5'); await h.page.dispatchEvent('#b-disc', 'change');
  await h.page.click('#bv-internal'); await h.page.click('#add-extra'); await h.page.waitForTimeout(100);
  const ex = await h.page.$('#bud-table tr[data-x]');
  await (await ex.$('[data-f="label"]')).fill('Retirada de azulejos'); await (await ex.$('[data-f="label"]')).dispatchEvent('change');
  await (await h.page.$('#bud-table tr[data-x] [data-f="price"]')).fill('133.33'); await (await h.page.$('#bud-table tr[data-x] [data-f="price"]')).dispatchEvent('change');
  await h.page.waitForTimeout(100);
  await h.page.click('#bv-client'); await h.page.waitForTimeout(100);
  // la suma de los importes visibles coincide con la suma visible
  const vis = await h.page.evaluate(() => ({ rows: [...document.querySelectorAll('#bud-table tr:not(.cap) td:last-child')].map(td => td.textContent), foot: [...document.querySelectorAll('#bud-foot tr')].map(tr => [tr.children[tr.children.length - 2].textContent, tr.lastElementChild.textContent]) }));
  const sumRows = vis.rows.reduce((a, s) => a + parseEur(s), 0), f = Object.fromEntries(vis.foot.map(([k, v]) => [k.replace(/\s+\d.*$/, '').trim(), parseEur(v)]));
  check('los importes visibles suman la «Suma de partidas»', Math.abs(sumRows - f['Suma de partidas']) < 0.005, `${sumRows.toFixed(2)} frente a ${f['Suma de partidas']}`);
  check('suma − descuento = base; base + IVA = total', Math.abs(f['Suma de partidas'] + f['Descuento'] - f['Base imponible']) < 0.005 && Math.abs(f['Base imponible'] + f['IVA'] - f['Total']) < 0.005, JSON.stringify(f));
  check('la vista del cliente no muestra margen ni costes', await h.page.evaluate(() => !/margen|coste|beneficio/i.test(document.querySelector('.bud').textContent)));
  check('la partida libre aparece en el presupuesto del cliente', await h.page.evaluate(() => document.querySelector('.bud').textContent.includes('Retirada de azulejos')));
  // precio propio: se marca y se puede restablecer; la gama no lo pisa
  await h.page.click('#bv-internal');
  const inp = await h.page.$('#bud-table tr[data-k="bajo"] [data-price]'); await inp.fill('300'); await inp.dispatchEvent('change'); await h.page.waitForTimeout(100);
  await h.go('diseno'); await h.page.selectOption('#d-gama', 'alta'); await h.go('presupuesto');
  const pr = await h.page.evaluate(() => { const b = budget(); return { bajo: b.lines.find(l => l.k === 'bajo'), alto: b.lines.find(l => l.k === 'alto') }; });
  check('un precio propio se respeta y se señala; el resto sigue la gama', pr.bajo.price === 300 && pr.bajo.manual && pr.alto.price === 304 && await h.page.$('#bud-table tr[data-k="bajo"] [data-reset]') !== null);
  await h.page.click('#bud-table tr[data-k="bajo"] [data-reset]'); await h.page.waitForTimeout(100);
  check('«restablecer» vuelve al precio de tarifa', await h.page.evaluate(() => budget().lines.find(l => l.k === 'bajo').price === 416));
  // datos de cliente y empresa
  await h.page.fill('#c-name', 'María López'); await h.page.fill('#c-nif', '12345678Z'); await h.page.fill('#c-address', 'C/ Mayor 12, 3.º B, Madrid');
  await h.page.click('details summary:has-text("Datos de tu empresa")'); await h.page.fill('[data-emp="name"]', 'Cocinas Ejemplo S.L.'); await h.page.fill('[data-emp="nif"]', 'B12345678');
  // memoria: el texto enviado a Claude solo lleva cifras de cliente
  await h.page.click('#ai-memo'); await h.page.waitForTimeout(200);
  const prompt = await h.page.evaluate(() => window.__sampleCalls.at(-1).input);
  check('la memoria se pide solo con cifras de cliente', !/Margen|coste|beneficio bruto/i.test(prompt.replace('No menciones costes internos, márgenes ni beneficios.', '')) && /total/.test(prompt), prompt.slice(-200));
  // CSV del cliente e interno
  await h.page.evaluate(() => { window.__saved = {}; });
  await h.page.click('#dl-csv'); await h.page.click('#dl-csv-int'); await h.page.waitForTimeout(300);
  const saved = await h.page.evaluate(() => Object.fromEntries(Object.entries(window.__saved).map(([k, v]) => [k, atob(v)])));
  const dec = s => Buffer.from(s, 'latin1').toString('utf8');
  const cli = dec(Object.entries(saved).find(([k]) => k.endsWith('-presupuesto.csv'))[1]), int = dec(Object.entries(saved).find(([k]) => k.endsWith('-interno.csv'))[1]);
  check('el CSV del cliente no incluye margen ni costes', !/margen|coste|beneficio/i.test(cli) && /María López/.test(cli) && /Retirada de azulejos/.test(cli));
  check('el CSV interno incluye coste y beneficio', /Coste total/.test(int) && /Beneficio bruto/.test(int));
  // PDF
  await h.page.evaluate(() => { window.__saved = {}; }); await h.page.click('#dl-pdf');
  await h.page.waitForFunction(() => Object.keys(window.__saved).some(k => k.endsWith('.pdf')), null, { timeout: 30000 });
  const pdfName = await h.page.evaluate(() => Object.keys(window.__saved).find(k => k.endsWith('.pdf')));
  const pdf = Buffer.from(await h.page.evaluate(n => window.__saved[n], pdfName), 'base64');
  const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
  check('el PDF se genera con número de presupuesto, planos y render', pdf.slice(0, 4).toString() === '%PDF' && /P-\d{4}-\d{3}/.test(pdfName) && pages >= 5, `${pdfName}, ${pages} páginas, ${(pdf.length / 1024).toFixed(0)} KB`);
  // texto del PDF: descomprime los flujos (FlateDecode) y los concatena
  let txt = '', raw = pdf.toString('latin1'), re = /stream\r?\n/g, m;
  while ((m = re.exec(raw))) { const st = m.index + m[0].length, en = raw.indexOf('endstream', st); if (en < 0) break; try { txt += zlib.inflateSync(pdf.slice(st, en)).toString('latin1'); } catch (e) { txt += raw.slice(st, en); } re.lastIndex = en; }
  if (process.env.PDF_OUT) require('fs').writeFileSync(process.env.PDF_OUT, pdf);
  check('el PDF lleva cliente, empresa y total, y no el margen', /Mar\S*a L\S*pez/.test(txt) && /Cocinas Ejemplo S\.L\./.test(txt) && /TOTAL/.test(txt) && !/Margen|Beneficio/.test(txt));
  // paquete completo sin haber visitado Render
  await h.page.evaluate(() => { window.__saved = {}; }); await h.page.click('#btn-zip');
  await h.page.waitForFunction(() => Object.keys(window.__saved).some(k => k.endsWith('.zip')), null, { timeout: 30000 });
  const zipName = await h.page.evaluate(() => Object.keys(window.__saved).find(k => k.endsWith('.zip')));
  const files = unzip(Buffer.from(await h.page.evaluate(n => window.__saved[n], zipName), 'base64'));
  const names = Object.keys(files);
  check('el paquete incluye planos, DXF, PDF, CSV, proyecto y render', ['planta.svg', 'planta.dxf', 'presupuesto-cliente.csv', 'interno/presupuesto-interno.csv', 'proyecto.json', 'render.png'].every(n => names.includes(n)) && names.some(n => n.endsWith('.pdf')) && names.some(n => n.startsWith('alzado-')), names.join(', '));
  const png = files['render.png']; check('el render del paquete es de 2400 px de ancho', png && png.readUInt32BE(16) === 2400, png ? String(png.readUInt32BE(16)) : 'sin render');
  const dxf = files['planta.dxf'].toString('latin1');
  check('el DXF es válido (secciones, capas y arcos de puerta)', /^0\r\nSECTION/.test(dxf) && /\r\nEOF$/.test(dxf) && /\r\nARC\r\n/.test(dxf) && /MUEBLES_BAJOS/.test(dxf));
  check('sin errores de consola', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
  await h.close();
};
