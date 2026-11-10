/* ================= descargas ================= */
let dlP=null;(async()=>{try{if(window.claude&&claude.use)dlP=await claude.use('downloads');}catch(e){dlP=null;}})();
const slug=()=>(S.project.name||'cocina').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'cocina';
async function saveFile(name,data){
  if(!dlP){toast('Las descargas no están disponibles en esta vista. Abre la página en claude.ai.');return false;}
  try{await dlP.save({filename:name,data});toast('Guardado: '+name);return true;}
  catch(e){if(e?.code==='declined')return false;toast(e?.code==='rate_limited'?'Espera un momento y vuelve a intentarlo.':'No se ha podido guardar el archivo.');return false;}
}
const csvNum=v=>String(r2(v)).replace('.',',');
const csvRow=r=>r.map(s=>'"'+String(s??'').replace(/"/g,'""')+'"').join(';');
// CSV para el cliente: precios con margen incluido; nunca muestra costes ni margen.
function budgetCSV(){const b=budget(),q=quoteMeta();
  const rows=[['Presupuesto',q.number,'','','',''],['Fecha',q.date,'Válido hasta',q.until,'',''],['Cliente',S.client.name,'Obra',S.project.name,'',''],[],
    ['Capítulo','Partida','Cantidad','Unidad','Precio','Importe'],...b.lines.filter(l=>l.on).map(l=>[l.cap,l.label,csvNum(l.q),l.unit,csvNum(l.cp),csvNum(l.amount)]),[],
    ['','Suma','','','',csvNum(b.sub)],...(b.discount?[['','Descuento '+S.discount+' %','','','','-'+csvNum(b.discount)]]:[]),['','Base imponible','','','',csvNum(b.base)],['','IVA '+S.iva+' %','','','',csvNum(b.iva)],['','Total','','','',csvNum(b.total)]];
  return '﻿'+rows.map(csvRow).join('\r\n');}
// CSV interno: coste, PVP y beneficio.
function budgetCSVInternal(){const b=budget();
  const rows=[['Capítulo','Partida','Incluida','Cantidad','Unidad','Coste unitario','PVP unitario','Coste','Importe'],...b.lines.map(l=>[l.cap,l.label,l.on?'sí':'no',csvNum(l.q),l.unit,csvNum(l.price),csvNum(l.cp),csvNum(l.cost),csvNum(l.amount)]),[],
    ['','Coste total','','','','','','',csvNum(b.cost)],['','Suma PVP','','','','','','',csvNum(b.sub)],['','Descuento','','','','','','',csvNum(-b.discount)],['','Base imponible','','','','','','',csvNum(b.base)],['','Beneficio bruto','','','','','','',csvNum(b.profit)],['','IVA','','','','','','',csvNum(b.iva)],['','Total','','','','','','',csvNum(b.total)]];
  return '﻿'+rows.map(csvRow).join('\r\n');}

function svgToPng(svg,width){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{const k=width/(img.width||width);const c=document.createElement('canvas');c.width=width;c.height=Math.round((img.height||width*0.7)*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);res({data:c.toDataURL('image/png'),w:c.width,h:c.height});};img.onerror=()=>rej(new Error('No se ha podido convertir el plano a imagen.'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});}
const blobToDataURL=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b);});
async function renderPNG(){try{if(window.THREE){return await three.png(2400);}}catch(e){}return null;}

// PDF para el cliente: presupuesto, condiciones, memoria, planta, alzados y render.
async function buildPDF(){
  if(!window.jspdf?.jsPDF) throw new Error('No se ha cargado el generador de PDF. Recarga la página.');
  if(!S.quote.number){S.quote.number=nextQuoteNumber();}
  if(!S.quote.date){S.quote.date=new Date().toISOString().slice(0,10);}
  saveNow();
  const {jsPDF}=window.jspdf, doc=new jsPDF({unit:'mm',format:'a4'}), b=budget(), c=company(), q=quoteMeta(), cl=S.client;
  const W=210, M=16, bottom=282, ink=[23,25,28], muted=[91,99,109];
  const set=(size,style='normal',col=ink)=>{doc.setFont('helvetica',style);doc.setFontSize(size);doc.setTextColor(...col);};
  // cabecera
  set(14,'bold');doc.text(c.name||'Presupuesto de cocina',M,20);
  set(8.5,'normal',muted);let y=25;
  for(const t of [c.nif&&'NIF '+c.nif,c.address,[c.phone,c.email].filter(Boolean).join(' · ')].filter(Boolean)){doc.text(doc.splitTextToSize(t,100)[0],M,y);y+=4;}
  set(18,'bold');doc.text('PRESUPUESTO',W-M,20,{align:'right'});
  set(9);doc.text(`N.º ${q.number}`,W-M,26,{align:'right'});doc.text(`Fecha: ${q.date}`,W-M,30.5,{align:'right'});doc.text(`Válido hasta: ${q.until}`,W-M,35,{align:'right'});
  y=Math.max(y,38)+4;
  doc.setFillColor(244,246,247);doc.roundedRect(M,y,W-2*M,25,2,2,'F');
  set(7.5,'bold',muted);doc.text('CLIENTE',M+4,y+5.5);doc.text('OBRA',W/2+2,y+5.5);
  set(9.5);
  [cl.name||'—',cl.nif&&'NIF/DNI '+cl.nif,[cl.phone,cl.email].filter(Boolean).join(' · ')].filter(Boolean).forEach((t,i)=>doc.text(doc.splitTextToSize(t,W/2-M-8)[0],M+4,y+11+i*4.6));
  [S.project.name||'—',cl.address].filter(Boolean).forEach((t,i)=>doc.text(doc.splitTextToSize(t,W/2-M-8)[0],W/2+2,y+11+i*4.6));
  y+=33;
  // tabla de partidas
  const X={cant:132,ud:135,precio:166,imp:W-M}, labelW=X.cant-M-14;
  const head=()=>{set(8,'bold',muted);doc.text('PARTIDA',M,y);doc.text('CANT.',X.cant,y,{align:'right'});doc.text('UD.',X.ud,y);doc.text('PRECIO',X.precio,y,{align:'right'});doc.text('IMPORTE',X.imp,y,{align:'right'});y+=2;doc.setDrawColor(200);doc.line(M,y,W-M,y);y+=5;};
  const need=h=>{if(y+h>bottom){doc.addPage();y=20;head();}};
  head();let cap='';
  for(const l of b.lines.filter(l=>l.on)){
    if(l.cap!==cap){cap=l.cap;need(9);set(8.5,'bold');doc.text(cap.toUpperCase(),M,y+1);y+=5.5;}
    const lines=doc.splitTextToSize(l.label,labelW), h=lines.length*4.2+1.8;need(h);
    set(9.5);doc.text(lines,M,y);
    const qs=fmt(l.q,l.unit==='ud'||l.unit==='partida'?(l.q%1?2:0):2);
    doc.text(qs,X.cant,y,{align:'right'});set(9,'normal',muted);doc.text(l.unit,X.ud,y);set(9.5);doc.text(eur(l.cp),X.precio,y,{align:'right'});doc.text(eur(l.amount),X.imp,y,{align:'right'});
    y+=h;
  }
  need(40);y+=2;doc.setDrawColor(200);doc.line(110,y,W-M,y);y+=6;
  const tot=(t,v,bold)=>{set(bold?11:9.5,bold?'bold':'normal');doc.text(t,150,y,{align:'right'});doc.text(v,X.imp,y,{align:'right'});y+=bold?7:5.2;};
  tot('Suma',eur(b.sub));if(b.discount)tot(`Descuento ${fmt(S.discount,S.discount%1?1:0)} %`,'−'+eur(b.discount));tot('Base imponible',eur(b.base));tot(`IVA ${fmt(S.iva,S.iva%1?1:0)} %`,eur(b.iva));y+=1;tot('TOTAL',eur(b.total),true);
  // condiciones
  y+=4;const cond=doc.splitTextToSize(`${c.conditions}\nValidez del presupuesto: ${S.quote.validDays} días (hasta el ${q.until}).`,W-2*M);
  need(cond.length*4+8);set(8,'bold',muted);doc.text('CONDICIONES',M,y);y+=4.5;set(8.5,'normal',muted);doc.text(cond,M,y);y+=cond.length*4;
  // memoria
  if(S.memo.trim()){doc.addPage();y=20;set(13,'bold');doc.text('Memoria de la propuesta',M,y);y+=8;set(10);
    for(const par of S.memo.split('\n')){const ls=doc.splitTextToSize(par||' ',W-2*M);for(const ln of ls){if(y>bottom){doc.addPage();y=20;set(10);}doc.text(ln,M,y);y+=4.8;}}}
  // planos
  const LW=297, LH=210;
  const imgPage=async(title,png)=>{doc.addPage('a4','landscape');set(12,'bold');doc.text(title,M,15);set(8,'normal',muted);doc.text(`${S.project.name||'Cocina'} · cotas en cm · ${q.number}`,LW-M,15,{align:'right'});
    const mw=LW-2*M, mh=LH-30, k=Math.min(mw/png.w,mh/png.h);doc.addImage(png.data,'PNG',M+(mw-png.w*k)/2,22,png.w*k,png.h*k);};
  await imgPage('Planta de montaje',await svgToPng(planSVG({exp:true,mods:true,chain:true}),2400));
  const ws=[...new Set([...S.design.walls,...S.modules.map(m=>m.wall)])].filter(i=>i<G.n&&!G.walls[i].open).sort((a,b)=>a-b);
  for(const i of ws) await imgPage(`Alzado de la pared ${L(i)}`,await svgToPng(elevSVG(i,true),2000));
  const r=await renderPNG();
  if(r){const data=await blobToDataURL(r);const img=await loadImg(data);await imgPage('Vista 3D orientativa',{data,w:img.naturalWidth,h:img.naturalHeight});}
  // pie de página
  const n=doc.getNumberOfPages();
  for(let p=1;p<=n;p++){doc.setPage(p);const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();set(7.5,'normal',muted);doc.text(`${c.name?c.name+' · ':''}Presupuesto ${q.number}`,M,ph-8);doc.text(`Página ${p} de ${n}`,pw-M,ph-8,{align:'right'});}
  return doc.output('blob');
}

$('#dl-svg').addEventListener('click',()=>saveFile(slug()+'-planta.svg',planSVG({exp:true,mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta · cm'})));
$('#dl-dxf').addEventListener('click',async()=>{if(!window.JSZip){toast('No se ha cargado el compresor. Recarga la página.');return;}const z=new JSZip();z.file(slug()+'-planta.dxf',dxf());saveFile(slug()+'-planta-dxf.zip',await z.generateAsync({type:'blob'}));});
$('#dl-csv').addEventListener('click',()=>saveFile(slug()+'-presupuesto.csv',budgetCSV()));
$('#dl-csv-int').addEventListener('click',()=>saveFile(slug()+'-presupuesto-interno.csv',budgetCSVInternal()));
$('#dl-pdf').addEventListener('click',async e=>{const btn=e.currentTarget;busy(btn,true,'Generando PDF…');
  try{const blob=await buildPDF();renderAll();await saveFile(`${slug()}-presupuesto-${S.quote.number}.pdf`,blob);}
  catch(err){errBox('No se ha podido generar el PDF',err.message||String(err));}
  finally{busy(btn,false);}});
$('#r-png').addEventListener('click',async e=>{const btn=e.currentTarget;busy(btn,true,'Generando…');try{const b=await renderPNG();if(b)await saveFile(slug()+'-render.png',b);else toast('No se ha podido generar la imagen 3D.');}finally{busy(btn,false);}});
$('#btn-zip').addEventListener('click',async e=>{
  if(!window.JSZip){toast('No se ha cargado el compresor. Recarga la página.');return;}
  const btn=e.currentTarget;busy(btn,true,'Preparando…');
  try{
    geom();const z=new JSZip(),s=slug();
    z.file('planta.svg',planSVG({exp:true,mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta · cm'}));
    z.file('planta.dxf',dxf());
    for(const i of [...new Set(S.modules.map(m=>m.wall))].sort((a,b)=>a-b)) if(G.walls[i]&&!G.walls[i].open) z.file(`alzado-${L(i)}.svg`,elevSVG(i,true));
    z.file('presupuesto-cliente.csv',budgetCSV());
    z.file('interno/presupuesto-interno.csv',budgetCSVInternal());
    try{z.file(`presupuesto-${S.quote.number||'borrador'}.pdf`,await buildPDF());}catch(err){z.file('LEEME.txt','No se ha podido generar el PDF: '+(err.message||err));}
    z.file('proyecto.json',JSON.stringify(S,null,1));
    if(S.memo) z.file('memoria.txt',S.memo);
    if(S.notes) z.file('notas-de-obra.txt',S.notes);
    z.file('render-prompt.txt',renderPrompt());
    const r=await renderPNG();if(r)z.file('render.png',r);
    for(const [i,f] of frames.entries()) z.file(`fotos/foto-${i+1}.jpg`,f.blob);
    renderAll();
    await saveFile(s+'.zip',await z.generateAsync({type:'blob'}));
  }catch(err){errBox('No se ha podido preparar el paquete',err.message||String(err));}
  finally{busy(btn,false);}
});
