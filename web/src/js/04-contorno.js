/* ================= reconstrucción del contorno ================= */
// Convierte las paredes sueltas de un escaneo (tramos con dos extremos) en el contorno de la estancia.
// Mismo algoritmo que PlanGeometry.swift en Mkpkr Scan; los casos de prueba compartidos están en shared/fixtures/rooms.json.
//  1. fusiona tramos colineales contiguos (una pared que el escáner partió en dos);
//  2. empareja extremos de paredes distintas por cercanía a su esquina común;
//  3. recorre las uniones: un ciclo es una estancia cerrada; una cadena abierta se cierra con un lado «abierto»
//     (cocina abierta al salón); los tramos que no forman parte del contorno (tabiques, penínsulas) se apartan;
//  4. orienta el contorno en sentido antihorario (x a la derecha, y = z del escaneo) y empieza por la pared
//     cuyo punto medio tiene el menor ángulo respecto al centro, igual que la app;
//  5. valida el resultado: si no es un polígono simple o las paredes no cuadran con lo escaneado, lanza un error.
// Unidades: cm. Entrada: [{a:{x,y}, b:{x,y}, h}]
function buildContour(input){
  const segs=input.filter(s=>s&&Number.isFinite(s.a?.x)&&Number.isFinite(s.b?.y)&&Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)>=5).map(s=>({a:{x:s.a.x,y:s.a.y},b:{x:s.b.x,y:s.b.y},h:s.h||250}));
  if(segs.length<2) throw new Error('El escaneo tiene menos de dos paredes: no se puede reconstruir la planta.');
  const dir=s=>{const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,l=Math.hypot(dx,dy)||1;return {x:dx/l,y:dy/l,l};};
  const segLen=s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);
  // 1. fusión de colineales
  let merged=0;
  for(let again=true;again;){
    again=false;
    outer: for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
      const p=segs[i],q=segs[j],u=dir(p),v=dir(q);
      if(Math.abs(u.x*v.y-u.y*v.x)>0.09) continue;
      const perp=s=>Math.abs((s.x-p.a.x)*u.y-(s.y-p.a.y)*u.x);
      if(perp(q.a)>8||perp(q.b)>8) continue;
      const t=s=>(s.x-p.a.x)*u.x+(s.y-p.a.y)*u.y;
      const q0=Math.min(t(q.a),t(q.b)), q1=Math.max(t(q.a),t(q.b));
      if(Math.max(q0-u.l,-q1)>15) continue;
      const lo=Math.min(0,q0),hi=Math.max(u.l,q1);
      segs[i]={a:{x:p.a.x+u.x*lo,y:p.a.y+u.y*lo},b:{x:p.a.x+u.x*hi,y:p.a.y+u.y*hi},h:Math.max(p.h,q.h)};
      segs.splice(j,1);merged++;again=true;break outer;
    }
  }
  // 2. emparejar extremos: extremo e = 2·i + k (k=0 → a, k=1 → b)
  const end=e=>e%2?segs[e>>1].b:segs[e>>1].a;
  const cands=[];
  for(let i=0;i<segs.length;i++) for(let j=i+1;j<segs.length;j++){
    const p=segs[i],q=segs[j],u=dir(p),v=dir(q),cr=u.x*v.y-u.y*v.x;
    const tol=clamp(0.4*Math.min(u.l,v.l),15,60);
    for(let ki=0;ki<2;ki++) for(let kj=0;kj<2;kj++){
      const ei=end(2*i+ki), ej=end(2*j+kj);
      let c;
      if(Math.abs(cr)>0.15){const t=((q.a.x-p.a.x)*v.y-(q.a.y-p.a.y)*v.x)/cr;c={x:p.a.x+u.x*t,y:p.a.y+u.y*t};}
      else c={x:(ei.x+ej.x)/2,y:(ei.y+ej.y)/2};
      const di=Math.hypot(c.x-ei.x,c.y-ei.y), dj=Math.hypot(c.x-ej.x,c.y-ej.y);
      if(di<=tol&&dj<=tol) cands.push({e1:2*i+ki,e2:2*j+kj,c,cost:di+dj});
    }
  }
  cands.sort((a,b)=>a.cost-b.cost);
  const partner=new Map(), cornerAt=new Map();
  for(const k of cands){ if(partner.has(k.e1)||partner.has(k.e2)) continue; partner.set(k.e1,k.e2);partner.set(k.e2,k.e1);cornerAt.set(k.e1,k.c);cornerAt.set(k.e2,k.c); }
  // 3. componentes: lista ordenada de [segmento, extremo de entrada]
  const seen=new Set(), comps=[];
  for(let s0=0;s0<segs.length;s0++){
    if(seen.has(s0)) continue;
    // ir hacia atrás desde el extremo a (entrada) hasta un extremo libre o volver al inicio
    let start=s0,entry=0,closed=false;
    for(let guard=0;guard<segs.length+1;guard++){const pe=partner.get(2*start+entry);if(pe===undefined)break;const ps=pe>>1;if(ps===s0){closed=true;break;}start=ps;entry=1-(pe%2);}
    if(closed){start=s0;entry=0;}
    const list=[];let s=start,e=entry;
    for(let guard=0;guard<segs.length+1;guard++){
      if(seen.has(s)) break; seen.add(s); list.push([s,e]);
      const pe=partner.get(2*s+(1-e)); if(pe===undefined) break;
      s=pe>>1; e=pe%2;
    }
    const isCycle=closed&&list.length>=3&&partner.get(2*list[list.length-1][0]+(1-list[list.length-1][1]))===2*list[0][0]+list[0][1];
    comps.push({list,cycle:isCycle,len:list.reduce((t,[i])=>t+segLen(segs[i]),0)});
  }
  comps.sort((a,b)=>(b.cycle-a.cycle)||(b.len-a.len));
  const main=comps.find(c=>c.cycle&&c.list.length>=3)||comps.find(c=>!c.cycle&&c.list.length>=2);
  if(!main) throw new Error('Las paredes del escaneo no se unen entre sí: no se puede reconstruir la planta.');
  // 4. vértices y paredes del contorno
  const V=[], W=[];
  const L2=main.list, m=L2.length;
  if(main.cycle){
    for(let k=0;k<m;k++){const [s,e]=L2[k];V.push(cornerAt.get(2*s+e));W.push({open:false,h:segs[s].h,scan:segLen(segs[s])});}
  } else {
    const [s0,e0]=L2[0];V.push(e0?segs[s0].b:segs[s0].a);
    for(let k=0;k<m;k++){const [s,e]=L2[k];W.push({open:false,h:segs[s].h,scan:segLen(segs[s])});if(k<m-1)V.push(cornerAt.get(2*s+(1-e)));}
    const [sl,el]=L2[m-1];V.push(el?segs[sl].a:segs[sl].b);
    W.push({open:true,h:W[0].h,scan:0});
  }
  let E=V.map((p,k)=>({p,q:V[(k+1)%V.length],meta:W[k]}));
  let area2=0;for(const e of E) area2+=e.p.x*e.q.y-e.q.x*e.p.y;
  if(area2<0) E=E.reverse().map(e=>({p:e.q,q:e.p,meta:e.meta}));
  const cx=E.reduce((t,e)=>t+e.p.x,0)/E.length, cy=E.reduce((t,e)=>t+e.p.y,0)/E.length;
  let first=0,best=Infinity;
  E.forEach((e,k)=>{const a=Math.atan2((e.p.y+e.q.y)/2-cy,(e.p.x+e.q.x)/2-cx);if(a<best-1e-9){best=a;first=k;}});
  E=[...E.slice(first),...E.slice(0,first)];
  const pts=E.map(e=>({x:e.p.x,y:e.p.y}));
  // 5. validación
  const problems=[];
  if(!polySimple(pts)) problems.push('las paredes se cruzan entre sí');
  const area=polyArea(pts)/1e4;
  if(area<1.5) problems.push(`la superficie resultante es de solo ${fmt(area,2)} m²`);
  E.forEach((e,k)=>{if(e.meta.open)return;const l=Math.hypot(e.q.x-e.p.x,e.q.y-e.p.y);if(Math.abs(l-e.meta.scan)>Math.max(40,0.25*e.meta.scan))problems.push(`la pared ${L(k)} mide ${R(l)} cm en el contorno y ${R(e.meta.scan)} cm en el escaneo`);});
  if(problems.length) throw new Error('No se ha podido reconstruir la planta del escaneo con seguridad: '+problems.join('; ')+'. No se ha importado nada.');
  const dropped=comps.filter(c=>c!==main).reduce((t,c)=>t+c.list.length,0);
  return {pts,walls:E.map(e=>e.meta),merged,dropped,open:E.map((e,k)=>e.meta.open?k:-1).filter(k=>k>=0)};
}
