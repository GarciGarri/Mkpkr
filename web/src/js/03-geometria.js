/* ================= geometría ================= */
function roomPts(){
  const s=S.shape;
  if(s.type==='L'){const {W,D,w2,d2}=s;return [{x:0,y:0},{x:W,y:0},{x:W,y:D-d2},{x:W-w2,y:D-d2},{x:W-w2,y:D},{x:0,y:D}];}
  if(s.type==='poly'&&s.pts&&s.pts.length>=3) return s.pts.map(p=>({x:p.x,y:p.y}));
  return [{x:0,y:0},{x:s.w,y:0},{x:s.w,y:s.d},{x:0,y:s.d}];
}
function pip(p,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))c=!c;}return c;}
function polyArea(pts){let s=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];s+=a.x*b.y-b.x*a.y;}return Math.abs(s)/2;}
let G=null;
function geom(){
  const pts=roomPts(), n=pts.length;
  const walls=pts.map((a,i)=>{
    const b=pts[(i+1)%n], dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1, u={x:dx/len,y:dy/len};
    const left={x:-u.y,y:u.x}; const m={x:a.x+dx/2+left.x*2,y:a.y+dy/2+left.y*2};
    const inL=pip(m,pts); const nn=inL?left:{x:u.y,y:-u.x};
    return {i,a,b,len,u,n:nn,flip:!inL,ang:Math.atan2(u.y,u.x)};
  });
  walls.forEach((w,i)=>{const p=walls[(i-1+n)%n];const cr=p.u.x*w.u.y-p.u.y*w.u.x;w.convexStart=(w.flip?-cr:cr)>0.2;});
  walls.forEach((w,i)=>{w.convexEnd=walls[(i+1)%n].convexStart;});
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  G={pts,walls,n,minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys),area:polyArea(pts),perim:walls.reduce((s,w)=>s+w.len,0)};
  return G;
}
const at=(w,x,d=0)=>({x:w.a.x+w.u.x*x+w.n.x*d,y:w.a.y+w.u.y*x+w.n.y*d});

