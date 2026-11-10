/* ================= geometría ================= */
// Ajusta un polígono escaneado a las medidas tomadas con láser.
// Mantiene la dirección de cada pared y busca las longitudes que cierran el contorno
// cambiando lo menos posible: las paredes verificadas pesan mil veces más que las escaneadas.
// Devuelve {pts, residual:{i:cm}} donde residual es lo que no se ha podido respetar de cada medida real.
function adjustPoly(pts,real){
  const n=pts.length, keys=Object.keys(real||{}).map(Number).filter(i=>i<n&&real[i]>0);
  if(!keys.length) return {pts,residual:{}};
  const u=[],t=[],w=[];
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;u.push({x:dx/l,y:dy/l});const v=real[i]>0;t.push(v?real[i]:l);w.push(v?1000:1);}
  // minimizar Σ w_i (x_i − t_i)²  con  Σ x_i·u_i = 0  →  x_i = t_i − (u_i·λ)/w_i ,  M·λ = Σ t_i·u_i
  let a=0,b=0,c=0,bx=0,by=0;
  for(let i=0;i<n;i++){a+=u[i].x*u[i].x/w[i];b+=u[i].x*u[i].y/w[i];c+=u[i].y*u[i].y/w[i];bx+=t[i]*u[i].x;by+=t[i]*u[i].y;}
  const det=a*c-b*b; if(Math.abs(det)<1e-12) return {pts,residual:{}};
  const lx=(c*bx-b*by)/det, ly=(a*by-b*bx)/det;
  const out=[{x:pts[0].x,y:pts[0].y}], residual={};
  for(let i=0;i<n;i++){const x=Math.max(5,t[i]-(u[i].x*lx+u[i].y*ly)/w[i]);if(real[i]>0&&Math.abs(x-real[i])>0.5)residual[i]=x-real[i];if(i<n-1){const p=out[i];out.push({x:p.x+u[i].x*x,y:p.y+u[i].y*x});}}
  return {pts:out,residual};
}
let ROOM_RESIDUAL={};
function roomPts(){
  const s=S.shape; ROOM_RESIDUAL={};
  if(s.type==='L'){const {W,D,w2,d2}=s;return [{x:0,y:0},{x:W,y:0},{x:W,y:D-d2},{x:W-w2,y:D-d2},{x:W-w2,y:D},{x:0,y:D}];}
  if(s.type==='poly'&&s.pts&&s.pts.length>=3){const r=adjustPoly(s.pts.map(p=>({x:p.x,y:p.y})),s.real);ROOM_RESIDUAL=r.residual;return r.pts;}
  return [{x:0,y:0},{x:s.w,y:0},{x:s.w,y:s.d},{x:0,y:s.d}];
}
function pip(p,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))c=!c;}return c;}
function polyArea(pts){let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
function polySimple(p){
  const o=(a,b,c)=>Math.sign((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)), n=p.length;
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;const a=p[i],b=p[(i+1)%n],c=p[j],d=p[(j+1)%n];if(o(a,b,c)!==o(a,b,d)&&o(c,d,a)!==o(c,d,b))return false;}
  return true;
}
let G=null;
function geom(){
  const pts=roomPts(), n=pts.length, s=S.shape;
  const walls=pts.map((a,i)=>{
    const b=pts[(i+1)%n], dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1, u={x:dx/len,y:dy/len};
    const left={x:-u.y,y:u.x}; const m={x:a.x+dx/2+left.x*2,y:a.y+dy/2+left.y*2};
    const inL=pip(m,pts); const nn=inL?left:{x:u.y,y:-u.x};
    return {i,a,b,len,u,n:nn,flip:!inL,ang:Math.atan2(u.y,u.x),open:s.type==='poly'&&(s.open||[]).includes(i),real:s.type!=='poly'||s.real?.[i]>0,residual:ROOM_RESIDUAL[i]||0};
  });
  walls.forEach((w,i)=>{const p=walls[(i-1+n)%n];const cr=p.u.x*w.u.y-p.u.y*w.u.x;w.convexStart=(w.flip?-cr:cr)>0.2;});
  walls.forEach((w,i)=>{w.convexEnd=walls[(i+1)%n].convexStart;});
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  G={pts,walls,n,minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys),area:polyArea(pts),perim:walls.reduce((s,w)=>s+(w.open?0:w.len),0)};
  return G;
}
const at=(w,x,d=0)=>({x:w.a.x+w.u.x*x+w.n.x*d,y:w.a.y+w.u.y*x+w.n.y*d});
// Rectángulo apoyado en una pared: de x0 a x1 a lo largo y de d0 a d1 hacia dentro.
const rectOf=(w,x0,x1,d0,d1)=>[at(w,x0,d0),at(w,x1,d0),at(w,x1,d1),at(w,x0,d1)];
// Punto del plano en coordenadas de una pared (x a lo largo, y hacia dentro).
const toWall=(w,p)=>{const dx=p.x-w.a.x,dy=p.y-w.a.y;return {x:dx*w.u.x+dy*w.u.y,y:dx*w.n.x+dy*w.n.y};};
// Penetración mínima (cm) entre dos polígonos convexos; 0 si no se tocan.
function overlapPen(p,q){
  let min=Infinity;
  for(const poly of [p,q]) for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],l=Math.hypot(b.x-a.x,b.y-a.y)||1,ax={x:-(b.y-a.y)/l,y:(b.x-a.x)/l};
    let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;
    for(const v of p){const d=v.x*ax.x+v.y*ax.y;a0=Math.min(a0,d);a1=Math.max(a1,d);}
    for(const v of q){const d=v.x*ax.x+v.y*ax.y;b0=Math.min(b0,d);b1=Math.max(b1,d);}
    const pen=Math.min(a1,b1)-Math.max(a0,b0);if(pen<=0)return 0;min=Math.min(min,pen);
  }
  return min;
}
function fixRefs(){
  geom();const n=G.n;
  S.openings.forEach(o=>{if(o.wall>=n)o.wall=0;});S.services.forEach(o=>{if(o.wall>=n)o.wall=0;});
  S.modules=S.modules.filter(m=>m.wall<n);
  S.design.walls=S.design.walls.filter(i=>i<n&&!G.walls[i].open);
  if(!S.design.walls.length){const first=G.walls.find(w=>!w.open);S.design.walls=first?[first.i]:[];}
}
