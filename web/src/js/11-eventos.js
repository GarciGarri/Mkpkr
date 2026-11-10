/* ================= eventos ================= */
// Regla: todo cambio del proyecto llama antes a touch() (instantánea para «Deshacer»).
const noExample=()=>{if(S.example){S.example=false;renderSummary();}};

/* ---- proyecto y archivos ---- */
$('#pname').addEventListener('input',e=>{noExample();S.project.name=e.target.value.slice(0,120);save();});
$('#notes').addEventListener('input',e=>{noExample();S.notes=e.target.value;save();});
$('#btn-undo').addEventListener('click',undo);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')){e.preventDefault();undo();}});
const errBox=(t,m)=>ask(t,m,[{label:'Entendido',value:1,primary:true}]);
$('#f-project').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  let raw;try{raw=JSON.parse(await f.text());}catch(err){errBox('No se puede abrir el archivo','No es un archivo JSON válido.');return;}
  if(raw&&typeof raw==='object'&&raw.shape){await openProjectData(raw);return;}
  if(raw&&typeof raw==='object'&&(raw.walls||raw.rooms||raw.capturedRoom||raw.mkpkr)){try{await importRoomPlan(raw);}catch(err){errBox('No se ha importado el escaneo',err.message||String(err));}return;}
  errBox('No se puede abrir el archivo','No es ni un proyecto de Mkpkr Cocinas ni un escaneo de Mkpkr Scan o RoomPlan.');});
async function openProjectData(raw){
  let s;try{s=sanitizeProject(raw);}catch(err){errBox('No se puede abrir el proyecto',err.message);return;}
  if(listProjects().some(p=>p.id===s.id)){
    const r=await ask('Este proyecto ya está guardado',`«${s.project.name||'Sin nombre'}» ya existe en este navegador. ¿Sustituyes lo guardado por el archivo o lo abres como copia?`,[{label:'Abrir como copia',value:'copy',primary:true},{label:'Sustituir lo guardado',value:'replace',danger:true},{label:'Cancelar',value:null}]);
    if(!r)return;
    if(r==='copy'){s.id=uid();s.project.name=(s.project.name||'Sin nombre')+' (copia)';s.quote.number='';}
  }
  if(S&&S.id===s.id)S=null;
  activate(s);await media.load();location.hash='#diseno';renderAll();toast('Proyecto abierto');
}

/* ---- lista de proyectos ---- */
$('#p-search').addEventListener('input',renderProjects);
$('#p-new').addEventListener('click',async()=>{activate(blankState());await media.load();location.hash='#captura';renderAll();toast('Proyecto nuevo creado');});
$('#p-example').addEventListener('click',async()=>{activate(exampleState());await media.load();location.hash='#diseno';renderAll();});
$('#p-table').addEventListener('click',async e=>{const b=e.target.closest('button[data-act]');if(!b)return;const id=b.closest('tr').dataset.p;
  if(b.dataset.act==='open'){if(id===S.id){location.hash='#diseno';return;}const s=loadProject(id);if(!s){errBox('No se puede abrir','El proyecto guardado está dañado.');return;}activate(s);await media.load();location.hash='#diseno';renderAll();return;}
  if(b.dataset.act==='dup'){const s=id===S.id?sanitizeProject(JSON.parse(JSON.stringify(S))):loadProject(id);if(!s)return;s.id=uid();s.project.name=(s.project.name||'Sin nombre')+' (copia)';s.quote.number='';s.example=false;store.set(K_PROJ(s.id),s);const idx=listProjects();idx.unshift(indexEntry(s));store.set(K_INDEX,idx);renderProjects();toast('Proyecto duplicado');return;}
  if(b.dataset.act==='del'){const p=listProjects().find(p=>p.id===id);
    const ok=await ask('¿Borrar el proyecto?',`Se borrará «${p?.name||'Sin nombre'}» de este navegador, con sus fotos. No se puede deshacer. Si quieres conservarlo, expórtalo antes.`,[{label:'Borrar',value:1,danger:true},{label:'Cancelar',value:null,primary:true}]);
    if(!ok)return;deleteProject(id);media.drop(id);
    if(id===S.id){const next=listProjects()[0];S=null;activate(next&&loadProject(next.id)||blankState());await media.load();}
    renderAll();toast('Proyecto borrado');}});

/* ---- estancia ---- */
$('#shape-type').addEventListener('change',e=>{touch();S.shape.type=e.target.value;if(S.shape.type==='poly'&&!S.shape.pts)S.shape.type='rect';fixRefs();changed({relayout:true});});
$('#room-h').addEventListener('change',e=>{touch();S.height=num(e.target.value,250,200,400);changed();});
for(const [id,k] of [['#r-w','w'],['#r-d','d'],['#l-W','W'],['#l-D','D'],['#l-w2','w2'],['#l-d2','d2']]) $(id).addEventListener('change',e=>{touch();S.shape[k]=num(e.target.value,S.shape[k],30,3000);if(S.shape.type==='L'){S.shape.W=Math.max(S.shape.W,90);S.shape.D=Math.max(S.shape.D,90);S.shape.w2=Math.min(S.shape.w2,S.shape.W-60);S.shape.d2=Math.min(S.shape.d2,S.shape.D-60);}fitOpenings();changed({relayout:true});});
$('#wall-table').addEventListener('change',e=>{const t=e.target;
  if(t.dataset.real!==undefined){touch();const i=+t.dataset.real,v=t.value.trim();if(v==='')delete S.shape.real[i];else S.shape.real[i]=num(v,0,10,3000);fitOpenings();changed({relayout:true});return;}
  if(t.dataset.open!==undefined){touch();const i=+t.dataset.open;const set=new Set(S.shape.open);t.checked?set.add(i):set.delete(i);S.shape.open=[...set];fixRefs();changed({relayout:true});}});
// Mantiene huecos y tomas dentro de su pared tras un cambio de medidas.
function fitOpenings(){geom();let n=0;
  for(const o of S.openings){const w=G.walls[o.wall];if(!w)continue;const w0=o.w,x0=o.x;o.w=Math.min(o.w,w.len);o.x=clamp(o.x,0,Math.max(0,w.len-o.w));if(o.w!==w0||o.x!==x0)n++;}
  for(const s of S.services){const w=G.walls[s.wall];if(!w)continue;const x0=s.x;s.x=clamp(s.x,0,w.len);if(s.x!==x0)n++;}
  if(n)setTimeout(()=>toast(`${n} hueco${n>1?'s':''} o toma${n>1?'s':''} se ha${n>1?'n':''} ajustado a la nueva medida de la pared.`),300);}
function bindRowTable(sel,list){
  $(sel).addEventListener('change',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;const it=S[list].find(x=>x.id===tr.dataset.id);const k=e.target.dataset.k;if(!it||!k)return;
    touch();const v=e.target.value;
    if(k==='type')it.type=v;
    else if(k==='h'&&list==='services'){if(v.trim()==='')delete it.h;else it.h=num(v,0,0,400);}
    else{it[k]=num(v,it[k]??0,k==='wall'?0:-1e4,1e4);if(k==='wall')it.wall=clamp(Math.round(it.wall),0,G.n-1);}
    const w=G.walls[it.wall];
    if(list==='openings'&&w){const before=JSON.stringify(it);it.w=clamp(it.w,10,w.len);it.x=clamp(it.x,0,Math.max(0,w.len-it.w));it.h=clamp(it.h,10,400);it.sill=clamp(it.sill,0,390);if(JSON.stringify(it)!==before)toast('Valor ajustado para que el hueco quepa en la pared '+L(it.wall)+'.');}
    if(list==='services'&&w){const x0=it.x;it.x=clamp(it.x,0,w.len);if(it.x!==x0)toast('La toma se ha ajustado a la longitud de la pared.');}
    changed({relayout:true});});
  $(sel).addEventListener('click',e=>{if(!e.target.matches('[data-del]'))return;const tr=e.target.closest('tr[data-id]');touch();S[list]=S[list].filter(x=>x.id!==tr.dataset.id);changed({relayout:true});toast('Quitado',{label:'Deshacer',run:undo});});
}
bindRowTable('#open-table','openings');bindRowTable('#serv-table','services');
const firstWall=()=>S.design.walls.find(i=>G.walls[i]&&!G.walls[i].open)??G.walls.find(w=>!w.open)?.i??0;
$('#add-open').addEventListener('click',()=>{touch();const wi=firstWall(),w=G.walls[wi];S.openings.push({id:uid(),type:'ventana',wall:wi,x:r1(Math.max(0,(w.len-100)/2)),w:Math.min(100,w.len),h:120,sill:100});changed({relayout:true});});
$('#add-serv').addEventListener('click',()=>{touch();const wi=firstWall();S.services.push({id:uid(),type:'agua',wall:wi,x:r1(G.walls[wi].len/2)});changed({relayout:true});});

/* ---- diseño ---- */
$('#wallpick').addEventListener('change',()=>{touch();S.design.walls=$$('#wallpick input:checked').map(i=>+i.value);changed({relayout:true});});
$('#layout-presets').addEventListener('click',e=>{const p=e.target.dataset.preset;if(!p)return;geom();
  const closed=G.walls.filter(w=>!w.open);if(!closed.length)return;
  const longest=[...closed].sort((a,b)=>b.len-a.len)[0].i, n=G.n, nx=k=>(longest+k+n)%n;
  touch();
  S.design.walls=(p==='lineal'?[longest]:p==='L'?[longest,nx(1)]:p==='U'?[nx(-1),longest,nx(1)]:[longest,nx(Math.floor(n/2))]).filter(i=>!G.walls[i].open);
  changed({relayout:true});});
for(const [id,k,isNum] of [['#d-sinkW','sinkW',1],['#d-hobW','hobW',1],['#d-oven','oven',0],['#d-gama','gama',0]]) $(id).addEventListener('change',e=>{touch();S.design[k]=isNum?+e.target.value:e.target.value;changed({relayout:k!=='gama'});});
for(const [id,k] of [['#d-fridge','fridge'],['#d-dw','dw'],['#d-uppers','uppers']]) $(id).addEventListener('change',e=>{touch();S.design[k]=e.target.checked;changed({relayout:true});});
$('#d-auto').addEventListener('click',()=>{touch();autoLayout();renderAll();const n=S.modules.filter(m=>m.lock).length;toast(n?`Distribución recalculada respetando ${n} módulo${n>1?'s':''} bloqueado${n>1?'s':''}`:'Distribución recalculada',{label:'Deshacer',run:undo});});
$('#d-unlock').addEventListener('click',()=>{touch();S.modules.forEach(m=>m.lock=false);S.modules=S.modules.filter(m=>m.type!=='hueco');autoLayout();renderAll();toast('Módulos desbloqueados y distribución recalculada',{label:'Deshacer',run:undo});});
$('#chk-all').addEventListener('change',renderDiseno);
$('#mod-table').addEventListener('change',e=>{const tr=e.target.closest('tr[data-id]');const m=S.modules.find(x=>x.id===tr?.dataset.id);if(!m)return;const k=e.target.dataset.k;if(!k)return;
  touch();if(k==='type')m.type=e.target.value;else m[k]=num(e.target.value,m[k],k==='w'?1:-50,3000);m.lock=true;renderAll();});
$('#mod-table').addEventListener('click',e=>{const tr=e.target.closest('tr[data-id]');const m=S.modules.find(x=>x.id===tr?.dataset.id);if(!m)return;
  if(e.target.closest('[data-lock]')){touch();m.lock=!m.lock;renderAll();return;}
  if(!e.target.closest('[data-del]'))return;
  touch();
  if(m.type==='hueco'){S.modules=S.modules.filter(x=>x!==m);renderAll();toast('Hueco quitado: al recalcular se rellenará.',{label:'Deshacer',run:undo});return;}
  // Un módulo quitado deja un hueco libre bloqueado; si no, «Recalcular» volvería a ponerlo.
  m.type='hueco';m.lock=true;renderAll();toast('Módulo quitado. Queda un hueco libre; quítalo también si quieres que se rellene.',{label:'Deshacer',run:undo});});
$('#am-level').addEventListener('change',e=>{$('#am-type').innerHTML=typeOptions(e.target.value,e.target.value==='high'?'alto':e.target.value==='col'?'nevera':'base');});
$('#am-add').addEventListener('click',()=>{
  const wall=+$('#am-wall').value, level=$('#am-level').value, type=$('#am-type').value, w=G.walls[wall];
  const x=num($('#am-x').value,0,0,3000), wd=num($('#am-w').value,60,1,400), msg=$('#am-msg');
  if(!w||w.open){msg.textContent='Elige una pared con muro.';return;}
  if(x+wd>w.len+0.5){msg.textContent=`No cabe: la pared ${L(wall)} mide ${fmt(w.len)} cm.`;return;}
  touch();S.modules.push({id:uid(),type,level,wall,x:r1(x),w:r1(wd),lock:true});
  if(!S.design.walls.includes(wall))S.design.walls.push(wall);
  msg.textContent='';renderAll();
  const clash=CHECKS.find(c=>c[0]==='bad'&&/se solapan/.test(c[1]));toast(clash?'Módulo añadido. Ojo: se solapa con otro; pulsa «Recalcular» para recolocar los no bloqueados.':'Módulo añadido y bloqueado',{label:'Deshacer',run:undo});});

/* ---- presupuesto ---- */
const setBV=v=>{BV=v;try{localStorage.setItem('mkpkr-cocinas-bv',v);}catch(e){}renderPresupuesto();};
$('#bv-client').addEventListener('click',()=>setBV('client'));$('#bv-internal').addEventListener('click',()=>setBV('internal'));
$('#bud-table').addEventListener('change',e=>{const t=e.target;
  const xr=t.closest('tr[data-x]');if(xr){const it=S.extra.find(x=>x.id===xr.dataset.x);if(!it)return;touch();const f=t.dataset.f;it[f]=f==='label'?t.value.slice(0,160):f==='unit'?t.value.slice(0,12):num(t.value,0,0,1e6);renderAll();return;}
  const tr=t.closest('tr[data-k]');if(!tr)return;const k=tr.dataset.k;touch();
  if(t.matches('[data-on]')){if(t.checked)delete S.off[k];else S.off[k]=true;}
  if(t.matches('[data-price]')){const key=k==='encimera'?'encimera_'+S.finish.counter:k;S.prices[key]=num(t.value,0,0,1e6);}
  renderAll();});
$('#bud-table').addEventListener('click',e=>{
  if(e.target.closest('[data-xdel]')){const id=e.target.closest('tr[data-x]').dataset.x;touch();S.extra=S.extra.filter(x=>x.id!==id);renderAll();return;}
  if(e.target.closest('[data-reset]')){const k=e.target.closest('tr[data-k]').dataset.k;touch();delete S.prices[k==='encimera'?'encimera_'+S.finish.counter:k];renderAll();}});
$('#add-extra').addEventListener('click',()=>{touch();S.extra.push({id:uid(),label:'Nueva partida',q:1,unit:'ud',price:0});renderAll();const el=$$('#bud-table tr[data-x] input[data-f="label"]').at(-1);el?.focus();el?.select();});
$('#b-margin').addEventListener('change',e=>{touch();S.margin=num(e.target.value,15,0,300);renderAll();});
$('#b-disc').addEventListener('change',e=>{touch();S.discount=num(e.target.value,0,0,100);renderAll();});
$('#b-iva').addEventListener('change',e=>{touch();S.iva=num(e.target.value,21,0,30);renderAll();});
$('#b-counter').addEventListener('change',e=>{touch();S.finish.counter=e.target.value;renderAll();});
for(const el of $$('[data-client]')) el.addEventListener('input',e=>{noExample();S.client[e.target.dataset.client]=e.target.value;save();});
$('#q-number').addEventListener('input',e=>{noExample();S.quote.number=e.target.value.slice(0,30);save();});
$('#q-date').addEventListener('change',e=>{touch();S.quote.date=/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)?e.target.value:'';save();});
$('#q-valid').addEventListener('change',e=>{touch();S.quote.validDays=num(e.target.value,30,1,365);save();});
for(const el of $$('[data-emp]')) el.addEventListener('input',e=>{const c=company();c[e.target.dataset.emp]=e.target.value;store.set(K_EMP,c);});
$('#memo').addEventListener('input',e=>{noExample();S.memo=e.target.value;save();});

/* ---- acabados ---- */
for(const [id,key] of [['#sw-front','front'],['#sw-counter','counter'],['#sw-floor','floor'],['#sw-wall','wall']]) $(id).addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;touch();S.finish[key]=b.dataset.k;renderAll();});
$('#copy-prompt').addEventListener('click',()=>{const t=renderPrompt();navigator.clipboard?.writeText(t).then(()=>toast('Descripción copiada'),()=>{selectText($('#render-prompt'));toast('Selecciona el texto y cópialo');});});
function selectText(el){const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);}

/* ---- ampliar planos ---- */
document.addEventListener('click',e=>{const b=e.target.closest('[data-zoom]');if(!b)return;const box=document.getElementById(b.dataset.zoom);const on=!box.classList.contains('zoom');box.classList.toggle('zoom',on);b.setAttribute('aria-pressed',on);b.textContent=on?'Reducir':'Ampliar';});
