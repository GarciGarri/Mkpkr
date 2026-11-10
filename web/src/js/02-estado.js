/* ================= estado ================= */
// Formato de proyecto, versión 2. Todo lo que entra de fuera (archivo o almacenamiento) pasa por sanitizeProject().
const SCHEMA=2;
const K_INDEX='mkpkr-cocinas-proyectos', K_CUR='mkpkr-cocinas-actual', K_OLD='mkpkr-cocinas-v1', K_EMP='mkpkr-cocinas-empresa';
const K_PROJ=id=>'mkpkr-cocinas-p-'+id;

function exampleState(){
  return {
    v:SCHEMA, id:uid(), created:Date.now(), updated:Date.now(), example:true,
    project:{name:'Ejemplo · Cocina en C/ Mayor 12, 3.º B'},
    client:{name:'',nif:'',address:'',phone:'',email:''},
    quote:{number:'',date:'',validDays:30},
    notes:'Ejemplo. Paredes en buen estado. Caldera mural en pared C, junto a la puerta: no se toca.\nToma de agua y desagüe bajo la ventana.',
    shape:{type:'rect',w:380,d:290,W:420,D:360,w2:150,d2:140,pts:null,real:{},open:[]},
    height:255,
    openings:[{id:uid(),type:'ventana',wall:0,x:140,w:110,h:120,sill:100},{id:uid(),type:'puerta',wall:2,x:40,w:82,h:210,sill:0}],
    services:[{id:uid(),type:'agua',wall:0,x:190},{id:uid(),type:'desague',wall:0,x:205},{id:uid(),type:'humos',wall:1,x:150},{id:uid(),type:'enchufe',wall:1,x:60}],
    design:{walls:[0,1],sinkW:80,hobW:60,oven:'bajo',fridge:true,dw:true,uppers:true,gama:'media'},
    finish:{front:'salvia',counter:'cuarzo',floor:'roble',wall:'blanco'},
    modules:[],
    prices:{}, off:{suelo:true}, extra:[], margin:15, discount:0, iva:21,
    memo:'', findings:[]
  };
}
function blankState(){
  const s=exampleState();
  Object.assign(s,{example:false,project:{name:''},notes:'',openings:[],services:[],memo:'',findings:[]});
  s.shape={type:'rect',w:300,d:250,W:420,D:360,w2:150,d2:140,pts:null,real:{},open:[]};
  s.design.walls=[0];
  return s;
}

/* ---- validación y migración ---- */
// Devuelve un proyecto saneado o lanza un Error con un mensaje para el usuario.
function sanitizeProject(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!raw.shape||typeof raw.shape!=='object') throw new Error('El archivo no contiene un proyecto de Mkpkr Cocinas.');
  const ver=num(raw.v,1);
  if(ver>SCHEMA) throw new Error('El proyecto se creó con una versión más nueva de Mkpkr Cocinas. Actualiza la página y vuelve a abrirlo.');
  const d=exampleState(), pick=(v,cat,def)=>Object.prototype.hasOwnProperty.call(cat,v)?v:def;
  const s={v:SCHEMA,id:okId(raw.id),created:num(raw.created,Date.now()),updated:num(raw.updated,Date.now()),example:raw.example===true};
  s.project={name:str(raw.project?.name,120)};
  const c=raw.client||{};s.client={name:str(c.name,120),nif:str(c.nif,20),address:str(c.address,200),phone:str(c.phone,30),email:str(c.email,120)};
  const q=raw.quote||{};s.quote={number:str(q.number,30),date:/^\d{4}-\d{2}-\d{2}$/.test(q.date)?q.date:'',validDays:num(q.validDays,30,1,365)};
  s.notes=str(raw.notes,20000);s.memo=str(raw.memo,20000);
  // estancia
  const sh=raw.shape;
  const pts=Array.isArray(sh.pts)?sh.pts.filter(p=>p&&Number.isFinite(+p.x)&&Number.isFinite(+p.y)).map(p=>({x:r1(+p.x),y:r1(+p.y)})):null;
  s.shape={type:pick(sh.type,{rect:1,L:1,poly:1},'rect'),w:num(sh.w,300,30,3000),d:num(sh.d,250,30,3000),W:num(sh.W,420,90,3000),D:num(sh.D,360,90,3000),w2:num(sh.w2,150,30,2900),d2:num(sh.d2,140,30,2900),pts:pts&&pts.length>=3&&pts.length<=40?pts:null,real:{},open:[]};
  if(s.shape.type==='poly'&&!s.shape.pts) s.shape.type='rect';
  s.shape.w2=Math.min(s.shape.w2,s.shape.W-60);s.shape.d2=Math.min(s.shape.d2,s.shape.D-60);
  const nW=s.shape.type==='poly'?s.shape.pts.length:(s.shape.type==='L'?6:4);
  if(sh.real&&typeof sh.real==='object') for(const [k,v] of Object.entries(sh.real)){const i=num(k,-1),l=num(v,0,10,3000);if(Number.isInteger(i)&&i>=0&&i<nW&&l>0) s.shape.real[i]=l;}
  if(Array.isArray(sh.open)) s.shape.open=[...new Set(sh.open.map(i=>num(i,-1)).filter(i=>Number.isInteger(i)&&i>=0&&i<nW))];
  s.height=num(raw.height,250,200,400);
  const wallIx=v=>{const i=num(v,0,0,nW-1);return Number.isInteger(i)?i:0;};
  s.openings=(Array.isArray(raw.openings)?raw.openings:[]).filter(o=>o&&typeof o==='object').slice(0,40).map(o=>({id:okId(o.id),type:pick(o.type,OPEN_T,'ventana'),wall:wallIx(o.wall),x:num(o.x,0,-50,3000),w:num(o.w,80,10,1000),h:num(o.h,120,10,400),sill:num(o.sill,0,0,390)}));
  s.services=(Array.isArray(raw.services)?raw.services:[]).filter(o=>o&&typeof o==='object').slice(0,80).map(o=>{const r={id:okId(o.id),type:pick(o.type,SERV_T,'enchufe'),wall:wallIx(o.wall),x:num(o.x,0,0,3000)};const h=num(o.h,NaN,0,400);if(Number.isFinite(h))r.h=h;return r;});
  // diseño
  const dg=raw.design||{};
  s.design={walls:[...new Set((Array.isArray(dg.walls)?dg.walls:[0]).map(i=>num(i,-1)).filter(i=>Number.isInteger(i)&&i>=0&&i<nW))],
    sinkW:pick(String(dg.sinkW),{60:1,80:1,90:1},'80')*1,hobW:pick(String(dg.hobW),{60:1,90:1},'60')*1,oven:pick(dg.oven,{bajo:1,col:1},'bajo'),
    fridge:dg.fridge!==false,dw:dg.dw!==false,uppers:dg.uppers!==false,gama:pick(dg.gama,GAMA,'media')};
  const f=raw.finish||{};s.finish={front:pick(f.front,FRONTS,d.finish.front),counter:pick(f.counter,COUNTERS,d.finish.counter),floor:pick(f.floor,FLOORS,d.finish.floor),wall:pick(f.wall,WALLS,d.finish.wall)};
  s.modules=(Array.isArray(raw.modules)?raw.modules:[]).filter(m=>m&&typeof m==='object'&&TYPES[m.type]&&LVL_T[m.level]&&(TYPES[m.type].lvl===m.level||TYPES[m.type].lvl==='any')).slice(0,200)
    .map(m=>({id:okId(m.id),type:m.type,level:m.level,wall:wallIx(m.wall),x:num(m.x,0,-50,3000),w:num(m.w,60,1,400),lock:m.lock===true||(ver<2&&raw.manual===true)}));
  // presupuesto
  s.prices={};const keys=new Set([...PRICE_DEFS.map(p=>p[0]),...Object.keys(COUNTERS).map(k=>'encimera_'+k)]);
  if(raw.prices&&typeof raw.prices==='object') for(const [k,v] of Object.entries(raw.prices)) if(keys.has(k)){const n=num(v,NaN,0,1e6);if(Number.isFinite(n))s.prices[k]=n;}
  s.off={};if(raw.off&&typeof raw.off==='object') for(const k of Object.keys(raw.off)) if(keys.has(k)&&raw.off[k]) s.off[k]=true;
  s.extra=(Array.isArray(raw.extra)?raw.extra:[]).filter(e=>e&&typeof e==='object').slice(0,60).map(e=>({id:okId(e.id),label:str(e.label,160),q:num(e.q,1,0,1e5),unit:str(e.unit,12)||'ud',price:num(e.price,0,0,1e6)}));
  s.margin=num(raw.margin,15,0,300);s.discount=num(raw.discount,0,0,100);s.iva=num(raw.iva,21,0,30);
  s.findings=(Array.isArray(raw.findings)?raw.findings:[]).map(sanitizeFinding).filter(Boolean).slice(0,5);
  return s;
}
// Resultado del análisis de fotos: solo se guarda si tiene la forma esperada.
function sanitizeFinding(r){
  if(!r||typeof r!=='object'||Array.isArray(r)) return null;
  if(r.elementos!==undefined&&!Array.isArray(r.elementos)) return null;
  const list=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.slice(0,300)).slice(0,20):[];
  const el=Array.isArray(r.elementos)?r.elementos.filter(x=>x&&typeof x==='object').slice(0,40).map(x=>({tipo:str(x.tipo,30),descripcion:str(x.descripcion,400),medida:str(x.medida,80),confianza:str(x.confianza,10)})):[];
  const out={resumen:str(r.resumen,1000),elementos:el,estado:str(r.estado,600),recomendaciones:list(r.recomendaciones),comprobar:list(r.comprobar)};
  return out.resumen||el.length?out:null;
}

/* ---- almacén de proyectos (varios, en este navegador) ---- */
const store={
  get(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}},
  del(k){try{localStorage.removeItem(k);}catch(e){}}
};
function listProjects(){const l=store.get(K_INDEX);return Array.isArray(l)?l.filter(p=>p&&typeof p.id==='string'):[];}
function indexEntry(s,total){return {id:s.id,name:s.project.name||'Sin nombre',client:s.client?.name||'',updated:s.updated,total:total??null,example:!!s.example};}
function saveNow(){
  if(!S) return;
  S.updated=Date.now();
  let total=null;try{total=budget().total;}catch(e){}
  if(!store.set(K_PROJ(S.id),S)){toast('No se ha podido guardar: el almacenamiento del navegador está lleno o bloqueado. Exporta el proyecto.');return;}
  const idx=listProjects().filter(p=>p.id!==S.id);idx.unshift(indexEntry(S,total));
  store.set(K_INDEX,idx);store.set(K_CUR,S.id);
}
let saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,300);}
function flushSave(){clearTimeout(saveT);saveNow();}
function loadProject(id){const raw=store.get(K_PROJ(id));if(!raw)return null;try{return sanitizeProject(raw);}catch(e){return null;}}
function deleteProject(id){store.del(K_PROJ(id));store.set(K_INDEX,listProjects().filter(p=>p.id!==id));}
// Cambia de proyecto guardando antes el actual. `state` ya debe estar saneado.
function activate(state){
  if(S) flushSave();
  S=state;UNDO.length=0;
  geom();fixRefs();
  if(!S.modules.length) autoLayout();
  saveNow();
}
function company(){const c=store.get(K_EMP)||{};return {name:str(c.name,120),nif:str(c.nif,20),address:str(c.address,200),phone:str(c.phone,30),email:str(c.email,120),conditions:str(c.conditions,2000)||'Presupuesto orientativo. Las medidas se confirman en obra antes de fabricar. Forma de pago: 40 % a la aceptación, 50 % a la entrega y 10 % al finalizar el montaje.'};}

/* ---- deshacer ---- */
const UNDO=[];
// Clave para comparar estados: sin la hora de guardado ni los identificadores que genera la distribución.
const keyOf=s=>JSON.stringify({...s,updated:0,modules:s.modules.map(({id,...m})=>m)});
// Guarda una instantánea antes de cambiar el proyecto. La primera edición de un ejemplo lo convierte en proyecto normal.
function touch(keepExample){
  const key=keyOf(S);if(UNDO[UNDO.length-1]?.key!==key)UNDO.push({key,json:JSON.stringify(S)});if(UNDO.length>40)UNDO.shift();
  if(S.example&&!keepExample)S.example=false;
  $('#btn-undo')&&($('#btn-undo').disabled=false);
}
function undo(){
  // Las instantáneas idénticas al estado actual (cambios que no cambiaron nada) se saltan.
  const now=keyOf(S);let snap=UNDO.pop();while(snap&&snap.key===now&&UNDO.length)snap=UNDO.pop();
  if(!snap||snap.key===now){$('#btn-undo').disabled=true;toast('No hay nada que deshacer.');return;}
  try{S=sanitizeProject(JSON.parse(snap.json));}catch(e){toast('No se ha podido deshacer.');return;}
  geom();renderAll();$('#btn-undo').disabled=!UNDO.length;toast('Cambio deshecho');
}

/* ---- arranque del almacén ---- */
let S=null;
(function boot(){
  // Migración desde la versión de un solo proyecto.
  const old=store.get(K_OLD);
  if(old){try{const m=sanitizeProject(old);store.set(K_PROJ(m.id),m);const idx=listProjects();idx.unshift(indexEntry(m));store.set(K_INDEX,idx);store.set(K_CUR,m.id);}catch(e){}store.del(K_OLD);}
  const cur=store.get(K_CUR);
  S=(typeof cur==='string'&&loadProject(cur))||null;
  if(!S){for(const p of listProjects()){S=loadProject(p.id);if(S)break;}}
  if(!S) S=exampleState();
})();
