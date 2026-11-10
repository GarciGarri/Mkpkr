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
    if(name.endsWith('.json')){const j=JSON.parse(await f.text());importRoomPlan(j);$('#scan-tools').hidden=true;return;}
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
function drawScan(hover){
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
}
function canvasPt(cv,e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)*cv.width/r.width,y:(e.clientY-r.top)*cv.height/r.height};}
function toScan(p){const {k,ox,oy}=scanXf();return {x:(p.x-ox)/k,y:(p.y-oy)/k};}
function snapPt(p){const t=scan.trace;if(!t.length||!$('#scan-ortho').checked)return p;const l=t[t.length-1];const dx=p.x-l.x,dy=p.y-l.y;return Math.abs(dx)>Math.abs(dy)?{x:p.x,y:l.y}:{x:l.x,y:p.y};}
scv.addEventListener('pointermove',e=>{if(scan.pts2&&!scan.closed)drawScan(toScan(canvasPt(scv,e)));});
scv.addEventListener('click',e=>{if(!scan.pts2||scan.closed)return;let p=snapPt(toScan(canvasPt(scv,e)));const t=scan.trace;const {k}=scanXf();
  if(t.length>=3&&Math.hypot(p.x-t[0].x,p.y-t[0].y)*k<14){scan.closed=true;if($('#scan-ortho').checked){const l=t[t.length-1];if(Math.abs(l.x-t[0].x)<Math.abs(l.y-t[0].y))l.x=t[0].x;else l.y=t[0].y;}}
  else t.push(p);$('#scan-use').disabled=!scan.closed;drawScan();});
$('#scan-undo').addEventListener('click',()=>{if(scan.closed)scan.closed=false;else scan.trace.pop();$('#scan-use').disabled=true;drawScan();});
$('#scan-clear').addEventListener('click',()=>{scan.trace=[];scan.closed=false;$('#scan-use').disabled=true;drawScan();});
$('#scan-auto').addEventListener('click',()=>{if(!scan.pts2)return;const P=scan.pts2,xs=[],ys=[];for(let i=0;i<P.length;i+=2){xs.push(P[i]);ys.push(P[i+1]);}const x0=pct(xs,.01),x1=pct(xs,.99),y0=pct(ys,.01),y1=pct(ys,.99);scan.trace=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];scan.closed=true;$('#scan-use').disabled=false;drawScan();});
$('#scan-use').addEventListener('click',()=>{const t=scan.trace;if(t.length<3)return;const mx=Math.min(...t.map(p=>p.x)),my=Math.min(...t.map(p=>p.y));
  const pts=t.map(p=>({x:R(p.x-mx),y:R(p.y-my)}));setPolyRoom(pts,scan.height);toast('Planta tomada del escaneo');location.hash='#estancia';});
function clearExample(){if(!S.example)return;S.example=false;S.notes='';S.project.name='';S.memo='';S.findings=[];S.openings=[];S.services=[];}
function setPolyRoom(pts,h){
  clearExample();
  const isRect=pts.length===4&&pts.every((p,i)=>{const q=pts[(i+1)%4];return Math.abs(p.x-q.x)<1||Math.abs(p.y-q.y)<1;});
  S.example=false;S.shape.pts=pts;
  if(isRect){const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);S.shape.w=Math.max(...xs)-Math.min(...xs);S.shape.d=Math.max(...ys)-Math.min(...ys);}
  S.shape.type='poly';if(h&&h>180&&h<450)S.height=h;
  fixRefs();S.manual=false;autoLayout();renderAll();
}
// RoomPlan (Apple) CapturedRoom JSON
function importRoomPlan(j){
  clearExample();
  const room=j.walls?j:(j.rooms&&j.rooms[0])||j.capturedRoom||j;
  if(!room.walls||!room.walls.length) throw new Error('No encuentro paredes en el JSON (se espera el formato CapturedRoom de RoomPlan).');
  const flat=t=>Array.isArray(t[0])?t.flat():t;
  const parse=el=>{const t=flat(el.transform),d=el.dimensions;return {cx:t[12]*100,cy:t[13]*100,cz:t[14]*100,ux:t[0],uz:t[2],w:d[0]*100,h:d[1]*100,cat:el.category?Object.keys(el.category)[0]:''};};
  const W=room.walls.map(parse);
  const C={x:W.reduce((s,w)=>s+w.cx,0)/W.length,y:W.reduce((s,w)=>s+w.cz,0)/W.length};
  W.forEach(w=>{w.ang=Math.atan2(w.cz-C.y,w.cx-C.x);const l=Math.hypot(w.ux,w.uz)||1;w.ux/=l;w.uz/=l;});
  W.sort((a,b)=>a.ang-b.ang);
  const inter=(p,q)=>{const det=p.ux*q.uz-p.uz*q.ux;if(Math.abs(det)<0.15)return {x:(p.cx+p.ux*p.w/2*(Math.sign((q.cx-p.cx)*p.ux+(q.cz-p.cz)*p.uz)||1)),y:(p.cz+p.uz*p.w/2*(Math.sign((q.cx-p.cx)*p.ux+(q.cz-p.cz)*p.uz)||1))};const t=((q.cx-p.cx)*q.uz-(q.cz-p.cz)*q.ux)/det;return {x:p.cx+p.ux*t,y:p.cz+p.uz*t};};
  let pts=W.map((w,i)=>inter(W[(i-1+W.length)%W.length],w));
  const mx=Math.min(...pts.map(p=>p.x)),my=Math.min(...pts.map(p=>p.y));pts=pts.map(p=>({x:R(p.x-mx),y:R(p.y-my)}));
  const floorY=Math.min(...W.map(w=>w.cy-w.h/2));const H=R(Math.max(...W.map(w=>w.h)));
  S.openings=[];S.services=[];
  S.shape.pts=pts;S.shape.type='poly';S.height=H;S.example=false;geom();
  const proj=(e)=>{const p={x:e.cx-mx,y:e.cz-my};let best=null;for(const w of G.walls){const t=clamp((p.x-w.a.x)*w.u.x+(p.y-w.a.y)*w.u.y,0,w.len);const q=at(w,t);const d=Math.hypot(q.x-p.x,q.y-p.y);if(!best||d<best.d)best={d,wall:w.i,t};}return best;};
  for(const [key,type] of [['doors','puerta'],['windows','ventana'],['openings','paso']]) for(const el of (room[key]||[])){const e=parse(el);const b=proj(e);if(!b)continue;S.openings.push({id:uid(),type,wall:b.wall,x:R(b.t-e.w/2),w:R(e.w),h:R(e.h),sill:Math.max(0,R(e.cy-e.h/2-floorY))});}
  const mk=j.mkpkr||{};
  const inst=(mk.instalaciones||[]).filter(f=>SERV_T[f.tipo]&&isFinite(f.x)&&isFinite(f.z));
  for(const f of inst){const b=proj({cx:f.x*100,cz:f.z*100});if(!b)continue;S.services.push({id:uid(),type:f.tipo,wall:b.wall,x:R(b.t),h:isFinite(f.altura_cm)?R(f.altura_cm):undefined});}
  const found=[];
  for(const el of (room.objects||[])){const e=parse(el);const b=proj(e);if(!b)continue;const map={sink:'agua',stove:'humos',oven:'humos'};if(map[e.cat]&&!S.services.some(s=>s.type===map[e.cat]))S.services.push({id:uid(),type:map[e.cat],wall:b.wall,x:R(b.t)});const es={sink:'fregadero',stove:'placa',oven:'horno',refrigerator:'frigorífico',dishwasher:'lavavajillas',washerDryer:'lavadora',storage:'mueble',table:'mesa',chair:'silla'};found.push(`${es[e.cat]||e.cat} (${R(e.w)} cm) junto a la pared ${L(b.wall)}`);}
  if(mk.nombre&&(!S.project.name||/^Ejemplo/.test(S.project.name)))S.project.name=mk.nombre;
  const med=(mk.medidas||[]).map(m=>`- ${m.etiqueta}: ${fmt(m.cm,1)} cm`).join('\n');
  S.notes=(S.notes?S.notes+'\n':'')+`Escaneo ${mk.formato==='mkpkr-scan'?'de Mkpkr Scan':'de RoomPlan'}${mk.fecha?' del '+new Date(mk.fecha).toLocaleDateString('es-ES'):''}: ${W.length} paredes, ${S.openings.length} huecos${inst.length?`, ${inst.length} instalaciones`:''}.`+(found.length?` Detectado: ${found.join(', ')}.`:'')+(med?`\nMedidas con la cinta AR:\n${med}`:'');
  fixRefs();S.manual=false;autoLayout();renderAll();toast('Habitación importada de RoomPlan');location.hash='#estancia';
}

