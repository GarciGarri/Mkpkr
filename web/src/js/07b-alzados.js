/* ================= SVG: alzados ================= */
function elevSVG(wi,exp=false){
  const g=G, w=g.walls[wi], P=pal(exp), H=S.height, padL=46,padR=16,padT=22,padB=44;
  const font=exp?'font-family="Arial, Helvetica, sans-serif"':'font-family="var(--f-mono)"';
  const X=(x,wd=0)=>w.flip?w.len-x-wd:x, Y=y=>H-y;
  const o=[];
  o.push(`<rect x="${-padL}" y="${-padT}" width="${w.len+padL+padR}" height="${H+padT+padB}" fill="${P.bg}"/>`);
  o.push(`<rect x="0" y="0" width="${w.len}" height="${H}" fill="${P.floor}" stroke="${P.wall}" stroke-width="1.6"/>`);
  for(const op of S.openings.filter(o=>o.wall===wi)){const x=X(op.x,op.w);
    o.push(`<rect x="${x}" y="${Y(op.sill+op.h)}" width="${op.w}" height="${op.h}" fill="${op.type==='ventana'?P.glass:P.bg}" stroke="${P.wall}" stroke-width="1"/>`);
    if(op.type==='ventana') o.push(`<line x1="${x+op.w/2}" y1="${Y(op.sill+op.h)}" x2="${x+op.w/2}" y2="${Y(op.sill)}" stroke="${P.wall}" stroke-width=".6"/>`);
    else o.push(`<polyline points="${x},${Y(0)} ${x+op.w},${Y(op.h/2)} ${x},${Y(op.h)}" fill="none" stroke="${P.muted}" stroke-width=".6" stroke-dasharray="4 3"/>`);}
  for(const s of S.services.filter(s=>s.wall===wi)){const h=Math.min(H-6,isFinite(s.h)?s.h:{agua:50,desague:40,gas:60,humos:H-25,enchufe:110}[s.type]);const col=P[SERV_T[s.type].c.replace('--','')];const x=X(s.x);o.push(`<circle cx="${x}" cy="${Y(h)}" r="5" fill="${P.bg}" stroke="${col}" stroke-width="1.4"/>`+txt(x,Y(h),SERV_T[s.type].k,0,6,col,font+' font-weight="700"'));}
  const ms=S.modules.filter(m=>m.wall===wi);
  const box=(x,y0,y1,wd,fill=P.cab,sw=.9)=>`<rect x="${x}" y="${Y(y1)}" width="${wd}" height="${y1-y0}" fill="${fill}" stroke="${P.line}" stroke-width="${sw}"/>`;
  const doors=(x,y0,y1,wd)=>{const n=wd>60?2:1;let s='';for(let k=0;k<n;k++){const dx=x+k*wd/n;s+=box(dx+.6,y0+.6,y1-.6,wd/n-1.2,P.cab,.6);const hx=n===2?(k===0?dx+wd/n-5:dx+5):dx+wd-5;const hy=y0>=140?[y0+6,y0+20]:[y1-6,y1-20];s+=`<line x1="${hx}" y1="${Y(hy[0])}" x2="${hx}" y2="${Y(hy[1])}" stroke="${P.ink}" stroke-width="1.4"/>`;}return s;};
  const drawers=(x,y0,y1,wd,hs)=>{let s='',y=y1;for(const h of hs){s+=box(x+.6,y-h+.6,y-.6,wd-1.2,P.cab,.6)+`<line x1="${x+wd/2-10}" y1="${Y(y-5)}" x2="${x+wd/2+10}" y2="${Y(y-5)}" stroke="${P.ink}" stroke-width="1.4"/>`;y-=h;}return s;};
  for(const m of ms){const x=X(m.x,m.w),wd=m.w;
    if(m.level==='low'){
      o.push(box(x+2,0,10,wd-4,P.cab2,.5));
      if(m.type==='regleta'){o.push(box(x,10,86,wd));continue;}
      if(m.type==='cajonero'||m.type==='placa_caj') o.push(drawers(x,10,86,wd,[16,30,30]));
      else if(m.type==='placa') o.push(drawers(x,72,86,wd,[14])+box(x+.6,14,71.4,wd-1.2,P.ink,.6)+box(x+6,24,62,wd-12,P.line,.3));
      else if(m.type==='lavavajillas') o.push(box(x+.6,10.6,85.4,wd-1.2,P.cab,.6)+`<line x1="${x+wd/2-12}" y1="${Y(80)}" x2="${x+wd/2+12}" y2="${Y(80)}" stroke="${P.ink}" stroke-width="1.4"/>`+txt(x+wd/2,Y(45),'LV',0,7,P.muted,font));
      else o.push(doors(x,10,86,wd));
    } else if(m.level==='col'){
      o.push(box(x+2,0,10,wd-4,P.cab2,.5));
      if(m.type==='nevera') o.push(box(x+.6,10.6,139.4,wd-1.2,P.cab,.6)+box(x+.6,140.6,214.4,wd-1.2,P.cab,.6)+`<line x1="${x+wd-5}" y1="${Y(150)}" x2="${x+wd-5}" y2="${Y(120)}" stroke="${P.ink}" stroke-width="1.4"/><line x1="${x+wd-5}" y1="${Y(148)}" x2="${x+wd-5}" y2="${Y(170)}" stroke="${P.ink}" stroke-width="1.4"/>`);
      else o.push(drawers(x,10,50,wd,[40])+box(x+.6,50.6,109.4,wd-1.2,P.ink,.6)+box(x+.6,110.6,214.4,wd-1.2,P.cab,.6));
    } else {
      if(m.type==='campana'){o.push(`<polygon points="${x},${Y(155)} ${x+wd},${Y(155)} ${x+wd-8},${Y(168)} ${x+8},${Y(168)}" fill="${P.cab2}" stroke="${P.line}" stroke-width=".9"/>`+box(x+wd/2-13,168,H,26,P.cab2,.8));continue;}
      if(m.type==='regleta'){o.push(box(x,145,215,wd));continue;}
      o.push(doors(x,145,215,wd));
    }
  }
  // encimera
  const lows=ms.filter(m=>m.level==='low').sort((a,b)=>a.x-b.x);let runs=[],r=null;for(const m of lows){if(r&&Math.abs(r.e-m.x)<1)r.e=m.x+m.w;else{r={s:m.x,e:m.x+m.w};runs.push(r);}}
  for(const r of runs){const x=w.flip?w.len-r.e:r.s;o.push(`<rect x="${x}" y="${Y(90)}" width="${r.e-r.s}" height="4" fill="${P.ink}"/>`);}
  // cotas
  const bset=new Set([0,R(w.len)]);for(const m of ms.filter(m=>m.level!=='high')){bset.add(R(X(m.x,m.w)));bset.add(R(X(m.x,m.w)+m.w));}
  const bs=[...bset].sort((a,b)=>a-b);const yb=H+18;
  o.push(`<line x1="0" y1="${yb}" x2="${w.len}" y2="${yb}" stroke="${P.dim}" stroke-width=".7"/>`);
  for(let k=0;k<bs.length;k++){o.push(`<line x1="${bs[k]-3}" y1="${yb+3}" x2="${bs[k]+3}" y2="${yb-3}" stroke="${P.dim}" stroke-width="1.1"/>`);if(k&&bs[k]-bs[k-1]>=10)o.push(txt((bs[k]+bs[k-1])/2,yb-7,fmt(bs[k]-bs[k-1]),0,bs[k]-bs[k-1]<30?5.5:7,P.dim,font));}
  o.push(txt(w.len/2,H+34,`Pared ${L(wi)} · ${fmt(w.len)} cm`,0,9,P.ink,font+' font-weight="600"'));
  const hs=[0,90,145,215,H].filter((v,i,a)=>a.indexOf(v)===i&&v<=H);const xl=-14;
  o.push(`<line x1="${xl}" y1="${Y(0)}" x2="${xl}" y2="${Y(H)}" stroke="${P.dim}" stroke-width=".7"/>`);
  for(const h of hs){o.push(`<line x1="${xl-3}" y1="${Y(h)+3}" x2="${xl+3}" y2="${Y(h)-3}" stroke="${P.dim}" stroke-width="1.1"/>`+`<text x="${xl-5}" y="${Y(h)}" font-size="6.5" fill="${P.dim}" text-anchor="end" dominant-baseline="central" ${font}>${h}</text>`);}
  const vb=`${-padL} ${-padT} ${w.len+padL+padR} ${H+padT+padB}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${exp?` width="${R((w.len+padL+padR)*3)}" height="${R((H+padT+padB)*3)}"`:''} role="img" aria-label="Alzado de la pared ${L(wi)}">${o.join('')}</svg>`;
}

