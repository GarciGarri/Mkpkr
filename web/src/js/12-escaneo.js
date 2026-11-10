/* ================= escaneo LiDAR ================= */
const scan={raw:null,up:'y',scale:1,pts2:null,trace:[],view:null,closed:false,height:null,floor:0};
const dropScan=$('#drop-scan');
['dragover','dragenter'].forEach(ev=>dropScan.addEventListener(ev,e=>{e.preventDefault();dropScan.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dropScan.addEventListener(ev,e=>{e.preventDefault();dropScan.classList.remove('over');}));
dropScan.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadScan(f);});
$('#f-scan').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadScan(f);e.target.value='';});
async function loadScan(f){
  const name=f.name.toLowerCase();$('#scan-info').textContent='Leyendo '+f.name+'…';$('#scan-tools').hidden=false;
  try{
    if(name.endsWith('.json')){let j;try{j=JSON.parse(await f.text());}catch(e){throw new Error('el archivo no es un JSON válido.');}$('#scan-tools').hidden=true;try{await importRoomPlan(j);}catch(e){await ask('No se ha importado el escaneo',e.message||String(e),[{label:'Entendido',value:1,primary:true}]);}return;}
    let xyz;
    if(name.endsWith('.ply')) xyz=parsePLY(await f.arrayBuffer());
    else xyz=parseText(await f.text(),name.endsWith('.obj'));
    if(!xyz||xyz.length<300) throw new Error('El archivo no tiene puntos suficientes.');
    scan.raw=xyz; scan.trace=[]; scan.closed=false; scan.file=f.name;
    processScan();
  }catch(err){$('#scan-info').textContent='No se ha podido leer el escaneo: '+(err.message||err);}
}
function parseText(t,obj){
  const re=obj?/^v\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/gm:/^\s*(-?[\d.eE+-]+)[\s,;]+(-?[\d.eE+-]+)[\s,;]+(-?[\d.eE+-]+)/gm;
  const out=[];let m;while((m=re.exec(t))){out.push(+m[1],+m[2],+m[3]);}
  return subsample(new Float32Array(out));
}
function parsePLY(buf){
  const bytes=new Uint8Array(buf);const hdrEnd=(()=>{const s=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,20000)));const k=s.indexOf('end_header');if(k<0)throw new Error('Cabecera PLY no válida');return {text:s.slice(0,k),off:new TextEncoder().encode(s.slice(0,k+10)).length+(s[k+10]==='\r'?2:1)};})();
  const lines=hdrEnd.text.split(/\r?\n/);const format=(lines.find(l=>l.startsWith('format'))||'').split(/\s+/)[1];
  let elems=[],cur=null;for(const l of lines){const p=l.trim().split(/\s+/);if(p[0]==='element'){cur={name:p[1],count:+p[2],props:[]};elems.push(cur);}else if(p[0]==='property'&&cur){cur.props.push(p[1]==='list'?{list:true,ct:p[2],it:p[3],name:p[4]}:{type:p[1],name:p[2]});}}
  const v=elems.find(e=>e.name==='vertex');if(!v)throw new Error('El PLY no tiene vértices');
  const ix=['x','y','z'].map(n=>v.props.findIndex(p=>p.name===n));
  if(format==='ascii'){const t=new TextDecoder().decode(bytes.subarray(hdrEnd.off));const rows=t.split(/\r?\n/);const out=new Float32Array(v.count*3);let k=0;for(let i=0;i<v.count&&i<rows.length;i++){const p=rows[i].trim().split(/\s+/);out[k++]=+p[ix[0]];out[k++]=+p[ix[1]];out[k++]=+p[ix[2]];}return subsample(out.subarray(0,k));}
  const le=format!=='binary_big_endian';const size={char:1,uchar:1,int8:1,uint8:1,short:2,ushort:2,int16:2,uint16:2,int:4,uint:4,int32:4,uint32:4,float:4,float32:4,double:8,float64:8};
  if(v.props.some(p=>p.list))throw new Error('Formato de vértices no admitido');
  const offs=[];let stride=0;for(const p of v.props){offs.push(stride);stride+=size[p.type];}
  const dv=new DataView(buf,hdrEnd.off);const rd=(o,t)=>{switch(t){case 'double':case 'float64':return dv.getFloat64(o,le);case 'float':case 'float32':return dv.getFloat32(o,le);case 'int':case 'int32':return dv.getInt32(o,le);case 'uint':case 'uint32':return dv.getUint32(o,le);case 'short':case 'int16':return dv.getInt16(o,le);case 'ushort':case 'uint16':return dv.getUint16(o,le);case 'char':case 'int8':return dv.getInt8(o);default:return dv.getUint8(o);}};
  const step=Math.max(1,Math.floor(v.count/400000));const out=new Float32Array(Math.ceil(v.count/step)*3);let k=0;
  for(let i=0;i<v.count;i+=step){const base=i*stride;if(base+stride>dv.byteLength)break;for(let a=0;a<3;a++)out[k++]=rd(base+offs[ix[a]],v.props[ix[a]].type);}
  return out.subarray(0,k);
}
function subsample(a){const n=a.length/3;if(n<=400000)return a;const step=Math.ceil(n/400000);const out=new Float32Array(Math.ceil(n/step)*3);let k=0;for(let i=0;i<n;i+=step){out[k++]=a[i*3];out[k++]=a[i*3+1];out[k++]=a[i*3+2];}return out.subarray(0,k);}
function pct(arr,p){const s=Float32Array.from(arr).sort();return s[Math.min(s.length-1,Math.max(0,Math.floor(p*(s.length-1))))];}
function processScan(){
  const a=scan.raw,n=a.length/3;
  // unidades
  const ext=[0,1,2].map(k=>{let mi=Infinity,ma=-Infinity;for(let i=k;i<a.length;i+=3){const v=a[i];if(v<mi)mi=v;if(v>ma)ma=v;}return ma-mi;});
  const uSel=$('#scan-unit').value;const maxE=Math.max(...ext);
  const toCm=uSel==='m'?100:uSel==='cm'?1:uSel==='mm'?0.1:(maxE>300?0.1:maxE>30?1:100);
  // eje vertical
  let up=$('#scan-up').value;
  if(up==='auto'){let best=-1;for(const k of [0,1,2]){const vals=new Float32Array(n);for(let i=0;i<n;i++)vals[i]=a[i*3+k]*toCm;const mi=pct(vals,0.002),ma=pct(vals,0.998);if(ma-mi<180||ma-mi>500)continue;const bins=new Uint32Array(Math.ceil((ma-mi)/3)+1);for(const v of vals){if(v<mi||v>ma)continue;bins[Math.floor((v-mi)/3)]++;}const lo=Math.max(...bins.slice(0,6)),hi=Math.max(...bins.slice(-6));const sc=(lo+hi)/n;if(sc>best){best=sc;up='xyz'[k];}}if(up==='auto')up='y';}
  const ku='xyz'.indexOf(up), ka=ku===0?1:0, kb=ku===2?1:2;
  const hv=new Float32Array(n);for(let i=0;i<n;i++)hv[i]=a[i*3+ku]*toCm;
  const floor=pct(hv,0.01), ceil=pct(hv,0.99);
  scan.floor=floor;scan.height=R(ceil-floor);
  const z0=+$('#scan-z0').value||100,z1=+$('#scan-z1').value||180;
  const sl=[];for(let i=0;i<n;i++){const h=hv[i]-floor;if(h>=z0&&h<=z1)sl.push(a[i*3+ka]*toCm,a[i*3+kb]*toCm*(up==='y'?1:-1));}
  if(sl.length<200){$('#scan-info').textContent=`Solo hay ${sl.length/2} puntos entre ${z0} y ${z1} cm sobre el suelo. Cambia el eje vertical, las unidades o la altura del corte.`;scan.pts2=null;drawScan();return;}
  // orientación dominante
  const P=new Float32Array(sl);let bestA=0,bestArea=Infinity;
  const sampleIdx=[];const m=P.length/2;const st=Math.max(1,Math.floor(m/6000));for(let i=0;i<m;i+=st)sampleIdx.push(i);
  for(let deg=0;deg<90;deg+=1){const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);const xs=[],ys=[];for(const i of sampleIdx){const x=P[2*i],y=P[2*i+1];xs.push(x*c-y*s);ys.push(x*s+y*c);}const area=(pct(xs,.98)-pct(xs,.02))*(pct(ys,.98)-pct(ys,.02));if(area<bestArea){bestArea=area;bestA=t;}}
  const c=Math.cos(bestA),s=Math.sin(bestA);for(let i=0;i<m;i++){const x=P[2*i],y=P[2*i+1];P[2*i]=x*c-y*s;P[2*i+1]=x*s+y*c;}
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;for(let i=0;i<m;i++){const x=P[2*i],y=P[2*i+1];if(x<mnx)mnx=x;if(x>mxx)mxx=x;if(y<mny)mny=y;if(y>mxy)mxy=y;}
  for(let i=0;i<m;i++){P[2*i]-=mnx;P[2*i+1]-=mny;}
  scan.pts2=P;scan.bw=mxx-mnx;scan.bh=mxy-mny;scan.up=up;scan.toCm=toCm;
  $('#scan-info').innerHTML=`<b>${esc(scan.file)}</b> · ${fmt(n)} puntos · eje vertical ${up.toUpperCase()} · ${toCm===100?'metros':toCm===1?'centímetros':'milímetros'} · altura suelo–techo <b class="num">${fmt(scan.height)} cm</b> · corte con ${fmt(m)} puntos`;
  drawScan();
}
['#scan-up','#scan-unit','#scan-z0','#scan-z1'].forEach(id=>$(id).addEventListener('change',()=>{if(scan.raw){scan.trace=[];scan.closed=false;processScan();}}));
const scv=$('#scan-canvas');
function scanXf(){const W=scv.width,H=scv.height,pad=40;const k=Math.min((W-2*pad)/(scan.bw||1),(H-2*pad)/(scan.bh||1));return {k,ox:pad+((W-2*pad)-scan.bw*k)/2,oy:pad+((H-2*pad)-scan.bh*k)/2};}
function drawScan(hover,kb){
  const ctx=scv.getContext('2d'),W=scv.width,H=scv.height;const css=getComputedStyle(document.documentElement);
  ctx.fillStyle=css.getPropertyValue('--surface-2').trim()||'#f4f6f7';ctx.fillRect(0,0,W,H);
  if(!scan.pts2)return;const {k,ox,oy}=scanXf();
  const cell=2,gw=Math.ceil(W/cell),gh=Math.ceil(H/cell),grid=new Uint16Array(gw*gh);let mx=1;
  const P=scan.pts2;for(let i=0;i<P.length;i+=2){const x=Math.floor((ox+P[i]*k)/cell),y=Math.floor((oy+P[i+1]*k)/cell);if(x<0||y<0||x>=gw||y>=gh)continue;const v=++grid[y*gw+x];if(v>mx)mx=v;}
  const ink=css.getPropertyValue('--ink').trim()||'#17191c';ctx.fillStyle=ink;const lm=Math.log(mx+1);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const v=grid[y*gw+x];if(!v)continue;ctx.globalAlpha=Math.min(1,0.15+Math.log(v+1)/lm);ctx.fillRect(x*cell,y*cell,cell,cell);}
  ctx.globalAlpha=1;
  // escala 1 m
  ctx.fillStyle=css.getPropertyValue('--muted').trim();ctx.fillRect(14,H-18,100*k,3);ctx.font='12px '+css.getPropertyValue('--f-mono');ctx.fillText('1 m',14,H-24);
  const pts=scan.trace.map(p=>({x:ox+p.x*k,y:oy+p.y*k}));
  const acc=css.getPropertyValue('--accent').trim(),dim=css.getPropertyValue('--dim').trim();
  ctx.strokeStyle=acc;ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(scan.closed)ctx.closePath();else if(hover&&pts.length){const h=snapPt(hover);ctx.lineTo(ox+h.x*k,oy+h.y*k);}ctx.stroke();
  ctx.fillStyle=dim;ctx.font='600 13px '+css.getPropertyValue('--f-mono');
  const tr=scan.trace.slice();if(!scan.closed&&hover&&tr.length)tr.push(snapPt(hover));
  for(let i=0;i<tr.length-(scan.closed?0:1);i++){const a=tr[i],b=tr[(i+1)%tr.length];const l=Math.hypot(b.x-a.x,b.y-a.y);if(l<5)continue;ctx.fillText(fmt(l)+' cm',ox+(a.x+b.x)/2*k+6,oy+(a.y+b.y)/2*k-6);}
  pts.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,i?4:6,0,7);ctx.fillStyle=i?acc:dim;ctx.fill();});
  if(kb&&hover){const {k:kk,ox:ox2,oy:oy2}=scanXf();drawCross(ctx,{x:ox2+hover.x*kk,y:oy2+hover.y*kk},12,2);}
}
function canvasPt(cv,e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
function toScan(p){const {k,ox,oy}=scanXf();return {x:(p.x-ox)/k,y:(p.y-oy)/k};}
function snapPt(p){const t=scan.trace;if(!t.length||!$('#scan-ortho').checked)return p;const l=t[t.length-1];const dx=p.x-l.x,dy=p.y-l.y;return Math.abs(dx)>Math.abs(dy)?{x:p.x,y:l.y}:{x:l.x,y:p.y};}
scv.addEventListener('pointermove',e=>{if(scan.pts2&&!scan.closed)drawScan(toScan(canvasPt(scv,e)));});
scv.addEventListener('click',e=>scanClick(canvasPt(scv,e)));
keyboardPointer(scv,{onMove:c=>{if(scan.pts2)drawScan(c&&!scan.closed?toScan(c):null,!!c);},onClick:scanClick});
function scanClick(c){if(!scan.pts2||scan.closed)return;let p=snapPt(toScan(c));const t=scan.trace;const {k}=scanXf();
  if(t.length>=3&&Math.hypot(p.x-t[0].x,p.y-t[0].y)*k<14){scan.closed=true;if($('#scan-ortho').checked){const l=t[t.length-1];if(Math.abs(l.x-t[0].x)<Math.abs(l.y-t[0].y))l.x=t[0].x;else l.y=t[0].y;}}
  else t.push(p);$('#scan-use').disabled=!scan.closed;drawScan();}
$('#scan-undo').addEventListener('click',()=>{if(scan.closed)scan.closed=false;else scan.trace.pop();$('#scan-use').disabled=true;drawScan();});
$('#scan-clear').addEventListener('click',()=>{scan.trace=[];scan.closed=false;$('#scan-use').disabled=true;drawScan();});
$('#scan-auto').addEventListener('click',()=>{if(!scan.pts2)return;const P=scan.pts2,xs=[],ys=[];for(let i=0;i<P.length;i+=2){xs.push(P[i]);ys.push(P[i+1]);}const x0=pct(xs,.01),x1=pct(xs,.99),y0=pct(ys,.01),y1=pct(ys,.99);scan.trace=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];scan.closed=true;$('#scan-use').disabled=false;drawScan();});
$('#scan-use').addEventListener('click',async()=>{const t=scan.trace;if(t.length<3)return;const mx=Math.min(...t.map(p=>p.x)),my=Math.min(...t.map(p=>p.y));
  const pts=t.map(p=>({x:r1(p.x-mx),y:r1(p.y-my)}));
  if(!polySimple(pts)){toast('El contorno se cruza consigo mismo. Corrígelo antes de usarlo.');return;}
  const ok=await applyRoomDraft({pts,open:[],real:{},height:scan.height,openings:null,services:null,name:'',notes:`Planta trazada sobre la nube de puntos ${scan.file||''} (${pts.length} paredes).`});
  if(ok){toast('Planta tomada del escaneo');location.hash='#estancia';}});

/* ---- de escaneo a proyecto ---- */
function defaultWalls(walls){
  const closed=walls.filter(w=>!w.open);if(!closed.length)return [];
  const lg=[...closed].sort((a,b)=>b.len-a.len)[0], n=walls.length, nx=walls[(lg.i+1)%n];
  return nx&&!nx.open&&nx.len>=120?[lg.i,nx.i]:[lg.i];
}
// Carga una estancia (de RoomPlan, de Mkpkr Scan o de la nube de puntos) en un proyecto nuevo
// o, si el usuario lo elige, en el proyecto abierto. Nunca sustituye datos sin preguntar.
async function applyRoomDraft(dr){
  let mode='new';
  if(!S.example){
    mode=await ask('¿Dónde cargo el escaneo?',`El proyecto abierto es «${S.project.name||'Sin nombre'}». Puedes crear un proyecto nuevo con el escaneo o sustituir la estancia del proyecto abierto: se conservan cliente, notas, acabados, precios y los módulos bloqueados que sigan cabiendo; se sustituyen paredes${dr.openings?', huecos e instalaciones':''}.`,
      [{label:'Proyecto nuevo',value:'new',primary:true},{label:'Sustituir la estancia',value:'replace'},{label:'Cancelar',value:null}]);
    if(!mode) return false;
  }
  const put=s=>{s.shape={...s.shape,type:'poly',pts:dr.pts,real:dr.real||{},open:dr.open||[]};if(dr.height>=200&&dr.height<=400)s.height=R(dr.height);if(dr.openings)s.openings=dr.openings;if(dr.services)s.services=dr.services;};
  if(mode==='new'){
    const s=blankState();s.project.name=dr.name||'';s.notes=dr.notes||'';put(s);s.openings=dr.openings||[];s.services=dr.services||[];
    activate(s);geom();S.design.walls=defaultWalls(G.walls);S.modules=[];autoLayout();
  } else {
    touch();put(S);S.notes=(S.notes?S.notes+'\n':'')+(dr.notes||'');
    const before=S.modules.filter(m=>m.lock).length;fixRefs();autoLayout();
    const lost=before-S.modules.filter(m=>m.lock).length;
    if(lost>0) setTimeout(()=>toast(`${lost} módulo${lost>1?'s':''} bloqueado${lost>1?'s':''} ya no cabía${lost>1?'n':''} y se ha${lost>1?'n':''} recolocado.`),400);
  }
  renderAll();
  if(mode==='replace') toast('Estancia sustituida',{label:'Deshacer',run:undo});
  return true;
}
// RoomPlan (Apple) CapturedRoom JSON, con o sin el bloque «mkpkr» de Mkpkr Scan.
function parseRoomPlan(j){
  const room=Array.isArray(j?.walls)?j:(Array.isArray(j?.rooms)&&j.rooms[0])||j?.capturedRoom||j;
  if(!room||!Array.isArray(room.walls)||!room.walls.length) throw new Error('No encuentro paredes en el archivo (se espera el formato de Mkpkr Scan o de RoomPlan).');
  const flat=t=>Array.isArray(t)&&Array.isArray(t[0])?t.flat():t;
  const parse=el=>{const t=flat(el?.transform),d=el?.dimensions;
    if(!Array.isArray(t)||t.length<16||!Array.isArray(d)||d.length<2||![...t.slice(0,16),d[0],d[1]].every(Number.isFinite))return null;
    const l=Math.hypot(t[0],t[2])||1;return {cx:t[12]*100,cy:t[13]*100,cz:t[14]*100,ux:t[0]/l,uz:t[2]/l,w:d[0]*100,h:d[1]*100,cat:el.category&&typeof el.category==='object'?Object.keys(el.category)[0]||'':''};};
  const W=room.walls.map(parse).filter(Boolean);
  if(W.length<2) throw new Error('El escaneo tiene menos de dos paredes válidas.');
  const floorY=Math.min(...W.map(w=>w.cy-w.h/2)), height=R(Math.max(...W.map(w=>w.h)));
  const mk=j.mkpkr&&typeof j.mkpkr==='object'?j.mkpkr:{};
  let pts=null,open=[],real={},contour=null;
  const pl=mk.planta;
  if(pl&&Array.isArray(pl.esquinas)&&pl.esquinas.length>=3&&pl.esquinas.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))){
    const P=pl.esquinas.map(p=>({x:p[0]*100,y:p[1]*100}));
    if(polySimple(P)&&polyArea(P)>1.5e4){pts=P;
      open=(Array.isArray(pl.abiertas)?pl.abiertas:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<P.length);
      if(pl.paredes_reales&&typeof pl.paredes_reales==='object')for(const [k,v] of Object.entries(pl.paredes_reales)){const i=+k;if(Number.isInteger(i)&&i>=0&&i<P.length&&Number.isFinite(+v)&&+v>10)real[i]=r1(+v);}}
  }
  if(!pts){contour=buildContour(W.map(w=>({a:{x:w.cx-w.ux*w.w/2,y:w.cz-w.uz*w.w/2},b:{x:w.cx+w.ux*w.w/2,y:w.cz+w.uz*w.w/2},h:w.h})));pts=contour.pts;open=contour.open;}
  const mx=Math.min(...pts.map(p=>p.x)),my=Math.min(...pts.map(p=>p.y));
  const P=pts.map(p=>({x:r1(p.x-mx),y:r1(p.y-my)}));
  const walls=P.map((a,i)=>{const b=P[(i+1)%P.length],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return {i,a,u:{x:dx/l,y:dy/l},len:l,open:open.includes(i)};});
  const proj=(x,z)=>{const p={x:x-mx,y:z-my};let best=null;for(const w of walls){if(w.open)continue;const t=clamp((p.x-w.a.x)*w.u.x+(p.y-w.a.y)*w.u.y,0,w.len);const d=Math.hypot(w.a.x+w.u.x*t-p.x,w.a.y+w.u.y*t-p.y);if(!best||d<best.d)best={d,wall:w.i,t};}return best;};
  const openings=[],services=[],found=[];
  for(const [key,type] of [['doors','puerta'],['windows','ventana'],['openings','paso']]) for(const el of (Array.isArray(room[key])?room[key]:[])){const e=parse(el);if(!e)continue;const b=proj(e.cx,e.cz);if(!b||b.d>60)continue;
    openings.push({id:uid(),type,wall:b.wall,x:r1(clamp(b.t-e.w/2,0,Math.max(0,walls[b.wall].len-e.w))),w:r1(e.w),h:r1(e.h),sill:Math.max(0,r1(e.cy-e.h/2-floorY))});}
  const inst=(Array.isArray(mk.instalaciones)?mk.instalaciones:[]).filter(f=>f&&SERV_T[f.tipo]&&Number.isFinite(f.x)&&Number.isFinite(f.z));
  for(const f of inst){const b=proj(f.x*100,f.z*100);if(!b||b.d>80)continue;const s={id:uid(),type:f.tipo,wall:b.wall,x:r1(b.t)};if(Number.isFinite(f.altura_cm))s.h=R(clamp(f.altura_cm,0,400));services.push(s);}
  const es={sink:'fregadero',stove:'placa',oven:'horno',refrigerator:'frigorífico',dishwasher:'lavavajillas',washerDryer:'lavadora',storage:'mueble',table:'mesa',chair:'silla'};
  for(const el of (Array.isArray(room.objects)?room.objects:[])){const e=parse(el);if(!e)continue;const b=proj(e.cx,e.cz);if(!b)continue;
    const map={sink:'agua',stove:'humos',oven:'humos'};if(map[e.cat]&&!services.some(s=>s.type===map[e.cat]))services.push({id:uid(),type:map[e.cat],wall:b.wall,x:r1(b.t)});
    found.push(`${es[e.cat]||esc(e.cat)} (${R(e.w)} cm) junto a la pared ${L(b.wall)}`);}
  const med=(Array.isArray(mk.medidas)?mk.medidas:[]).filter(m=>m&&Number.isFinite(m.cm)).map(m=>`- ${str(m.etiqueta,80)||'Medida'}: ${fmt(m.cm,1)} cm`).join('\n');
  const fecha=typeof mk.fecha==='string'&&!isNaN(Date.parse(mk.fecha))?' del '+new Date(mk.fecha).toLocaleDateString('es-ES'):'';
  const extra=[contour?.merged?`${contour.merged} tramo${contour.merged>1?'s':''} de pared unido${contour.merged>1?'s':''}`:'',contour?.dropped?`${contour.dropped} tabique${contour.dropped>1?'s':''} o tramo${contour.dropped>1?'s':''} suelto${contour.dropped>1?'s':''} fuera del contorno`:'',open.length?`${open.length} lado${open.length>1?'s':''} abierto${open.length>1?'s':''} (sin pared)`:''].filter(Boolean).join(', ');
  const notes=`Escaneo ${mk.formato==='mkpkr-scan'?'de Mkpkr Scan':'de RoomPlan'}${fecha}: ${P.length} paredes, ${openings.length} huecos${services.length?`, ${services.length} instalaciones`:''}${extra?' ('+extra+')':''}.`+(found.length?` Detectado: ${found.join(', ')}.`:'')+(med?`\nMedidas con la cinta AR:\n${med}`:'');
  return {pts:P,open,real,height,openings,services,name:str(mk.nombre,120),notes,via:contour?'contorno':'app'};
}
async function importRoomPlan(j){
  const dr=parseRoomPlan(j);
  const ok=await applyRoomDraft(dr);
  if(ok){toast(dr.open.length?'Escaneo importado. Tiene un lado abierto: revísalo en «Estancia».':'Escaneo importado');location.hash='#estancia';}
  return ok;
}

