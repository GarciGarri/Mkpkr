/* ================= descargas ================= */
let dlP=null;(async()=>{try{if(window.claude&&claude.use)dlP=await claude.use('downloads');}catch(e){dlP=null;}})();
const slug=()=>(S.project.name||'cocina').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'cocina';
async function saveFile(name,data){
  if(!dlP){toast('Las descargas no están disponibles en esta vista.');return;}
  try{await dlP.save({filename:name,data});toast('Guardado: '+name);}
  catch(e){if(e?.code==='declined')return;toast(e?.code==='rate_limited'?'Espera un momento y vuelve a intentarlo.':'No se ha podido guardar el archivo.');}
}
function budgetCSV(){const b=budget();const q=s=>'"'+String(s).replace(/"/g,'""')+'"';const n=v=>String(Math.round(v*100)/100).replace('.',',');
  const rows=[['Capítulo','Partida','Cantidad','Unidad','Precio','Importe'],...b.lines.filter(l=>l.on).map(l=>[l.cap,l.label,n(l.q),l.unit,n(l.price),n(l.amount)]),[],['','Suma','','','',n(b.sub)],['','Margen '+S.margin+' %','','','',n(b.margin)],['','Base imponible','','','',n(b.base)],['','IVA '+S.iva+' %','','','',n(b.iva)],['','Total','','','',n(b.total)]];
  return '﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n');}
$('#dl-svg').addEventListener('click',()=>saveFile(slug()+'-planta.svg',planSVG({exp:true,mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta · cm'})));
$('#dl-dxf').addEventListener('click',async()=>{if(!window.JSZip){toast('No se ha cargado el compresor.');return;}const z=new JSZip();z.file(slug()+'-planta.dxf',dxf());saveFile(slug()+'-planta-dxf.zip',await z.generateAsync({type:'blob'}));});
$('#dl-csv').addEventListener('click',()=>saveFile(slug()+'-presupuesto.csv',budgetCSV()));
$('#btn-zip').addEventListener('click',async()=>{
  if(!window.JSZip){toast('No se ha cargado el compresor.');return;}
  geom();const z=new JSZip(),s=slug();
  z.file('planta.svg',planSVG({exp:true,mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta · cm'}));
  z.file('planta.dxf',dxf());
  for(const i of [...new Set(S.modules.map(m=>m.wall))].sort()) z.file(`alzado-${L(i)}.svg`,elevSVG(i,true));
  z.file('presupuesto.csv',budgetCSV());
  z.file('proyecto.json',JSON.stringify(S,null,1));
  if(S.memo) z.file('memoria.txt',S.memo);
  if(S.notes) z.file('notas-de-obra.txt',S.notes);
  z.file('render-prompt.txt',renderPrompt());
  if(three.ready){const b=await three.png();if(b)z.file('render.png',b);}
  for(const [i,f] of frames.entries()) z.file(`fotos/fotograma-${i+1}.jpg`,f.blob);
  saveFile(s+'.zip',await z.generateAsync({type:'blob'}));
});

