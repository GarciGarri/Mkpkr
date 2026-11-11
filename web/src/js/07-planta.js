/* ================= SVG: planta ================= */
function pal(exp){
  if(!exp) return {wall:'var(--wall)',floor:'var(--floor)',cab:'var(--cab)',cab2:'var(--cab-2)',line:'var(--cab-line)',dim:'var(--dim)',ink:'var(--ink)',muted:'var(--muted)',bg:'var(--surface)',water:'var(--water)',gas:'var(--gas)',smoke:'var(--smoke)',power:'var(--power)',accent:'var(--accent)',glass:'var(--dim-soft)'};
  return {wall:'#2a2e33',floor:'#ffffff',cab:'#e4e7ea',cab2:'#cbd2d8',line:'#4a525b',dim:'#2459c4',ink:'#17191c',muted:'#5b636d',bg:'#ffffff',water:'#1f6fd1',gas:'#c75b00',smoke:'#6b6f76',power:'#a3218f',accent:'#f2b705',glass:'#e3ebfa'};
}
const pstr=ps=>ps.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
function upright(deg){while(deg>90)deg-=180;while(deg<=-90)deg+=180;return deg;}
function txt(x,y,s,deg,size,fill,extra=''){return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" transform="rotate(${upright(deg).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" ${extra}>${esc(s)}</text>`;}
function planSVG({exp=false,mods=true,chain=true,title=''}={}){
  const g=geom(), P=pal(exp), T=12, pad=chain?(mods?120:80):50;
  const vb=[g.minx-pad,g.miny-pad,(g.maxx-g.minx)+2*pad,(g.maxy-g.miny)+2*pad+(title?20:0)];
  const font=exp?'font-family="Arial, Helvetica, sans-serif"':'font-family="var(--f-mono)"';
  const o=[];
  const d='M'+g.pts.map(p=>`${p.x} ${p.y}`).join(' L')+' Z';
  o.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${P.bg}"/>`);
  o.push(`<path d="${d}" fill="none" stroke="${P.wall}" stroke-width="${2*T}" stroke-linejoin="miter"/>`);
  o.push(`<path d="${d}" fill="${P.floor}"/>`);
  for(const w of g.walls) if(w.open){o.push(`<polygon points="${pstr([at(w,-T-1,0.4),at(w,w.len+T+1,0.4),at(w,w.len+T+1,-T-2),at(w,-T-1,-T-2)])}" fill="${P.bg}"/>`);o.push(`<line x1="${w.a.x}" y1="${w.a.y}" x2="${w.b.x}" y2="${w.b.y}" stroke="${P.muted}" stroke-width="1.2" stroke-dasharray="8 5"/>`);}
  // huecos
  for(const op of S.openings){const w=g.walls[op.wall];if(!w)continue;
    const p0=at(w,op.x),p1=at(w,op.x+op.w),q1=at(w,op.x+op.w,-T-1),q0=at(w,op.x,-T-1);
    o.push(`<polygon points="${pstr([at(w,op.x,1),at(w,op.x+op.w,1),q1,q0])}" fill="${P.bg}"/>`);
    o.push(`<line x1="${p0.x}" y1="${p0.y}" x2="${q0.x}" y2="${q0.y}" stroke="${P.wall}" stroke-width="1.2"/><line x1="${p1.x}" y1="${p1.y}" x2="${q1.x}" y2="${q1.y}" stroke="${P.wall}" stroke-width="1.2"/>`);
    if(op.type==='ventana'){for(const k of [-.35,-.65]){const a=at(w,op.x,T*k),b=at(w,op.x+op.w,T*k);o.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${P.dim}" stroke-width="1"/>`);}
      const a=at(w,op.x,0),b=at(w,op.x+op.w,0);o.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${P.wall}" stroke-width=".8"/>`);}
    else if(op.type==='puerta'){const leaf=at(w,op.x,op.w);const cr=w.n.x*w.u.y-w.n.y*w.u.x;
      o.push(`<line x1="${p0.x}" y1="${p0.y}" x2="${leaf.x}" y2="${leaf.y}" stroke="${P.ink}" stroke-width="1.6"/>`);
      o.push(`<path d="M${leaf.x} ${leaf.y} A${op.w} ${op.w} 0 0 ${cr>0?1:0} ${p1.x} ${p1.y}" fill="none" stroke="${P.muted}" stroke-width=".8" stroke-dasharray="4 3"/>`);}
  }
  // módulos
  if(mods){
    const lows=S.modules.filter(m=>m.level!=='high'&&m.type!=='hueco'), highs=S.modules.filter(m=>m.level==='high'&&m.type!=='hueco');
    // encimera
    for(const w of g.walls){const ms=lows.filter(m=>m.wall===w.i&&m.level==='low').sort((a,b)=>a.x-b.x);let run=null;const runs=[];for(const m of ms){if(run&&Math.abs(run.e-m.x)<1)run.e=m.x+m.w;else{run={s:m.x,e:m.x+m.w};runs.push(run);}}
      for(const r of runs)o.push(`<polygon points="${pstr([at(w,r.s),at(w,r.e),at(w,r.e,62),at(w,r.s,62)])}" fill="${P.cab}" stroke="${P.line}" stroke-width="1.2"/>`);}
    for(const m of lows){const w=g.walls[m.wall];if(!w)continue;const dep=m.level==='col'?60:60;
      const poly=[at(w,m.x),at(w,m.x+m.w),at(w,m.x+m.w,dep),at(w,m.x,dep)];
      o.push(`<polygon points="${pstr(poly)}" fill="${m.level==='col'?P.cab2:'none'}" stroke="${P.line}" stroke-width=".7"${exp?'':dragAttr('m:'+m.id,`${TYPES[m.type].n} ${fmt(m.w)} cm, pared ${L(m.wall)}, a ${fmt(m.x)} cm`)}/>`);
      const c=at(w,m.x+m.w/2,dep/2), deg=w.ang*180/Math.PI;
      if(m.type==='placa'||m.type==='placa_caj'){const r=m.w>=90?9:8;const xs=m.w>=90?[.2,.5,.8]:[.3,.7];for(const fx of xs)for(const fd of [.3,.7]){if(m.w>=90&&fx===.5&&fd===.7)continue;const q=at(w,m.x+m.w*fx,dep*fd);o.push(`<circle cx="${q.x}" cy="${q.y}" r="${fx===.5?r+3:r}" fill="none" stroke="${P.ink}" stroke-width="1"/>`);}}
      else if(m.type==='fregadero'){const k=m.w>=90?2:1;for(let j=0;j<k;j++){const x0=m.x+6+j*(m.w-12)/k,x1=m.x+6+(j+1)*(m.w-12)/k-(k>1?3:0);o.push(`<polygon points="${pstr([at(w,x0,12),at(w,x1,12),at(w,x1,52),at(w,x0,52)])}" fill="none" stroke="${P.ink}" stroke-width="1" stroke-linejoin="round"/>`);}const t=at(w,m.x+m.w/2,6);o.push(`<circle cx="${t.x}" cy="${t.y}" r="2.5" fill="${P.ink}"/>`);}
      else if(m.level==='col'){const a=at(w,m.x),b=at(w,m.x+m.w,dep),a2=at(w,m.x+m.w),b2=at(w,m.x,dep);o.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${P.line}" stroke-width=".6"/><line x1="${a2.x}" y1="${a2.y}" x2="${b2.x}" y2="${b2.y}" stroke="${P.line}" stroke-width=".6"/>`);}
      if(m.type!=='regleta'){const lc=at(w,m.x+m.w/2,m.type==='fregadero'?32:(m.type.startsWith('placa')?dep/2:47));o.push(txt(lc.x,lc.y,TYPES[m.type].k+(m.type==='placa'||m.type==='placa_caj'||m.type==='fregadero'?'':' '+m.w),deg,m.w<40?6:8,P.ink,font+' font-weight="600"'));}
    }
    for(const m of highs){const w=g.walls[m.wall];if(!w)continue;const dep=m.type==='campana'?50:35;
      o.push(`<polygon points="${pstr([at(w,m.x),at(w,m.x+m.w),at(w,m.x+m.w,dep),at(w,m.x,dep)])}" fill="none" stroke="${m.type==='campana'?P.ink:P.dim}" stroke-width=".9" stroke-dasharray="5 3"${exp?'':dragAttr('m:'+m.id,`${TYPES[m.type].n} alto ${fmt(m.w)} cm, pared ${L(m.wall)}, a ${fmt(m.x)} cm`,'stroke')}/>`);}
  }
  // tomas
  for(const s of S.services){const w=g.walls[s.wall];if(!w)continue;const c=at(w,s.x,9);const col=P[SERV_T[s.type].c.replace('--','')];
    o.push(`<g${exp?'':dragAttr('s:'+s.id,`${SERV_T[s.type].n}, pared ${L(s.wall)}, a ${fmt(s.x)} cm`)}><circle cx="${c.x}" cy="${c.y}" r="6" fill="${P.bg}" stroke="${col}" stroke-width="1.6"/>`+txt(c.x,c.y,SERV_T[s.type].k,0,7,col,font+' font-weight="700"')+'</g>');}
  // cotas
  if(chain){
    for(const w of g.walls){const deg=w.ang*180/Math.PI;
      const off=-(T+26);const a=at(w,0,off),b=at(w,w.len,off);
      const e0=at(w,0,-T-3),e1=at(w,w.len,-T-3),e0b=at(w,0,off-5),e1b=at(w,w.len,off-5);
      o.push(`<g stroke="${P.dim}" stroke-width=".8"><line x1="${e0.x}" y1="${e0.y}" x2="${e0b.x}" y2="${e0b.y}"/><line x1="${e1.x}" y1="${e1.y}" x2="${e1b.x}" y2="${e1b.y}"/><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/></g>`);
      o.push(tick(a,w,P.dim)+tick(b,w,P.dim));
      const tm=at(w,w.len/2,off-8);o.push(txt(tm.x,tm.y,`${L(w.i)} · ${fmt(w.len,Math.abs(w.len-Math.round(w.len))>=0.05?1:0)}${w.open?' · abierto':''}${S.shape.type==='poly'&&S.shape.real?.[w.i]>0?' · láser':''}`,deg,10,P.dim,font+' font-weight="600"'));
      if(mods){const ms=S.modules.filter(m=>m.wall===w.i&&m.level!=='high');const hs=S.modules.filter(m=>m.wall===w.i);if(!hs.length&&!S.openings.some(o=>o.wall===w.i))continue;
        const bset=new Set([0,R(w.len)]);for(const m of ms){bset.add(R(m.x));bset.add(R(m.x+m.w));}for(const op of S.openings.filter(o=>o.wall===w.i)){bset.add(R(op.x));bset.add(R(op.x+op.w));}
        const bs=[...bset].filter(v=>v>=0&&v<=R(w.len)).sort((x,y)=>x-y);const off2=-(T+58);
        const A=at(w,0,off2),B=at(w,w.len,off2);o.push(`<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${P.muted}" stroke-width=".6"/>`);
        for(let k=0;k<bs.length;k++){const p=at(w,bs[k],off2);o.push(tick(p,w,P.muted));if(k){const seg=bs[k]-bs[k-1];if(seg>=8){const q=at(w,(bs[k]+bs[k-1])/2,off2-6);o.push(txt(q.x,q.y,fmt(seg),deg,seg<30?5.5:7,P.muted,font));}}}
      }
    }
    // escala
    const sx=g.minx, sy=g.maxy+pad-24;
    o.push(`<g ${font}><rect x="${sx}" y="${sy}" width="50" height="4" fill="${P.ink}"/><rect x="${sx+50}" y="${sy}" width="50" height="4" fill="none" stroke="${P.ink}" stroke-width=".8"/><text x="${sx}" y="${sy+13}" font-size="7" fill="${P.muted}">0</text><text x="${sx+100}" y="${sy+13}" font-size="7" fill="${P.muted}" text-anchor="end">1 m</text></g>`);
  }
  if(title) o.push(`<text x="${g.minx}" y="${vb[1]+vb[3]-6}" font-size="9" fill="${P.ink}" ${font}>${esc(title)}</text>`);
  const vbs=vb.map(v=>v.toFixed(1)).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbs}"${exp?` width="${R(vb[2]*3)}" height="${R(vb[3]*3)}"`:''} role="${exp?'img':'group'}" aria-label="Planta de la cocina">${o.join('')}</svg>`;
}
function tick(p,w,col){const k=4,dx=(w.u.x+w.n.x)*k*.7,dy=(w.u.y+w.n.y)*k*.7;return `<line x1="${(p.x-dx).toFixed(1)}" y1="${(p.y-dy).toFixed(1)}" x2="${(p.x+dx).toFixed(1)}" y2="${(p.y+dy).toFixed(1)}" stroke="${col}" stroke-width="1.1"/>`;}

