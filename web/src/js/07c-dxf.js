/* ================= DXF ================= */
function dxf(){
  const g=geom(), out=[], mm=v=>(v*10).toFixed(1);
  const line=(layer,a,b)=>out.push('0','LINE','8',layer,'10',mm(a.x),'20',mm(-a.y),'30','0','11',mm(b.x),'21',mm(-b.y),'31','0');
  const text=(layer,p,h,s,rot=0)=>out.push('0','TEXT','8',layer,'10',mm(p.x),'20',mm(-p.y),'30','0','40',mm(h),'1',String(s).normalize('NFD').replace(/[̀-ͯ]/g,''),'50',rot.toFixed(1),'72','1','11',mm(p.x),'21',mm(-p.y),'31','0');
  const poly=(layer,ps)=>{for(let i=0;i<ps.length;i++)line(layer,ps[i],ps[(i+1)%ps.length]);};
  const T=12;
  poly('MUROS',g.pts);
  // contorno exterior
  const offs=g.walls.map(w=>({p:at(w,0,-T),u:w.u}));const outer=offs.map((o,i)=>{const p=offs[(i-1+offs.length)%offs.length];const det=p.u.x*o.u.y-p.u.y*o.u.x;if(Math.abs(det)<1e-6)return o.p;const t=((o.p.x-p.p.x)*o.u.y-(o.p.y-p.p.y)*o.u.x)/det;return {x:p.p.x+p.u.x*t,y:p.p.y+p.u.y*t};});
  poly('MUROS',outer);
  for(const op of S.openings){const w=g.walls[op.wall];if(!w)continue;line('HUECOS',at(w,op.x),at(w,op.x,-T));line('HUECOS',at(w,op.x+op.w),at(w,op.x+op.w,-T));if(op.type==='puerta')line('HUECOS',at(w,op.x),at(w,op.x,op.w));text('HUECOS',at(w,op.x+op.w/2,-T-8),5,`${OPEN_T[op.type]} ${op.w}x${op.h}`,0);}
  for(const m of S.modules){const w=g.walls[m.wall];if(!w)continue;const dep=m.level==='high'?35:60;const layer=m.level==='high'?'MUEBLES_ALTOS':(m.level==='col'?'COLUMNAS':'MUEBLES_BAJOS');
    poly(layer,[at(w,m.x),at(w,m.x+m.w),at(w,m.x+m.w,dep),at(w,m.x,dep)]);
    if(m.level!=='high')text('TEXTOS',at(w,m.x+m.w/2,dep/2),4,`${TYPES[m.type].k} ${m.w}`,-w.ang*180/Math.PI);}
  for(const w of g.walls)text('COTAS',at(w,w.len/2,-T-30),8,`${L(w.i)} ${fmt(w.len)}`,-w.ang*180/Math.PI);
  const layers=['MUROS','HUECOS','MUEBLES_BAJOS','MUEBLES_ALTOS','COLUMNAS','TEXTOS','COTAS'];
  const head=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','TABLES','0','TABLE','2','LAYER','70',String(layers.length)];
  layers.forEach((l,i)=>head.push('0','LAYER','2',l,'70','0','62',String([7,4,3,5,6,2,1][i]),'6','CONTINUOUS'));
  head.push('0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES');
  return [...head,...out,'0','ENDSEC','0','EOF'].join('\r\n');
}

