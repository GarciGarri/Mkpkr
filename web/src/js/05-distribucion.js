/* ================= distribución automática ================= */
const WIDTHS=[90,80,60,50,45,40,30];
function fillWidths(L){
  L=Math.floor(L);
  if(L<30) return L>=3?[{w:L,reg:true}]:[];
  const cost=new Array(L+1).fill(Infinity), pick=new Array(L+1).fill(0); cost[0]=0;
  const c=w=>10+(w===60?0:(w>=80?1:2));
  for(let l=1;l<=L;l++) for(const w of WIDTHS) if(w<=l&&cost[l-w]+c(w)<cost[l]){cost[l]=cost[l-w]+c(w);pick[l]=w;}
  let best=null;
  for(let f=0;f<=Math.min(14,L);f++){const k=L-f;if(cost[k]===Infinity)continue;const t=cost[k]+(f>0?6+f:0);if(!best||t<best.t)best={t,f,k};}
  if(!best) return [{w:L,reg:true}];
  const out=[];let l=best.k;while(l>0){out.push({w:pick[l]});l-=pick[l];}
  out.sort((a,b)=>(a.w===60?0:1)-(b.w===60?0:1)||b.w-a.w);
  if(best.f>=3) out.push({w:best.f,reg:true});
  return out;
}
// Longitudes que se pueden llenar con módulos estándar sin regleta.
const EXACT=(()=>{const a=new Uint8Array(3001);a[0]=1;for(let l=1;l<a.length;l++)for(const w of WIDTHS)if(w<=l&&a[l-w]){a[l]=1;break;}return a;})();
const exactFill=l=>{l=Math.round(l);return l<=0||(l<EXACT.length&&EXACT[l]===1);};
function subtract(seg,blocks){
  let out=[seg];
  for(const [b0,b1] of blocks){const nx=[];for(const [s,e] of out){if(b1<=s||b0>=e){nx.push([s,e]);continue;}if(b0>s)nx.push([s,b0]);if(b1<e)nx.push([b1,e]);}out=nx;}
  return out.filter(([s,e])=>e-s>=3);
}
const DEPTH={low:60,col:60,high:35};
// Franja vertical que ocupa cada nivel (cm desde el suelo). El bajo llega a 92 por encimera y copete.
const LEVEL_Y={low:[0,92],col:[0,215],high:[145,215]};
const depthOf=m=>m.level==='high'?(m.type==='campana'?50:35):60;
const modPoly=m=>rectOf(G.walls[m.wall],m.x,m.x+m.w,0,depthOf(m));
const vOverlap=(a,b)=>a[0]<b[1]&&b[0]<a[1];
// Zonas que deben quedar libres: barrido y paso de puertas, paso de huecos y la franja delante de cada ventana.
function openingZones(){
  const z=[];
  for(const o of S.openings){const w=G.walls[o.wall];if(!w||w.open)continue;
    if(o.type==='ventana') z.push({o,poly:rectOf(w,o.x,o.x+o.w,0,30),y:[o.sill,o.sill+o.h]});
    else z.push({o,poly:rectOf(w,o.x-5,o.x+o.w+5,0,o.type==='puerta'?Math.max(80,o.w+10):80),y:[0,Math.max(o.h,1)]});
  }
  return z;
}
// Intervalo a lo largo de la pared w que ocupa un polígono dentro de la franja de profundidad d.
function bandInterval(w,poly,d){
  let P=poly.map(p=>toWall(w,p));
  const clip=(Q,keep,cut)=>{const out=[];for(let i=0;i<Q.length;i++){const a=Q[i],b=Q[(i+1)%Q.length],ia=keep(a),ib=keep(b);if(ia)out.push(a);if(ia!==ib){const t=cut(a,b);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;};
  P=clip(P,p=>p.y>=0.5,(a,b)=>(0.5-a.y)/(b.y-a.y));
  if(P.length) P=clip(P,p=>p.y<=d,(a,b)=>(d-a.y)/(b.y-a.y));
  if(P.length<3) return null;
  const xs=P.map(p=>p.x),x0=Math.min(...xs),x1=Math.max(...xs);
  return x1-x0>0.5?[x0,x1]:null;
}
function autoLayout(){
  const g=geom(), D=S.design, mods=[];
  // Los módulos bloqueados se respetan mientras sigan cabiendo en su pared.
  for(const m of S.modules){const w=g.walls[m.wall];if(!m.lock||!w||w.open||m.x<-0.5||m.x+m.w>w.len+0.5)continue;mods.push({...m});}
  const sel=[...new Set(D.walls)].filter(i=>i<g.n&&!g.walls[i].open).sort((a,b)=>a-b);
  const isSel=i=>sel.includes(((i%g.n)+g.n)%g.n);
  if(!sel.length){S.modules=mods;return;}
  const zones=openingZones();
  // En una esquina compartida, la pared anterior llega hasta el rincón y la siguiente empieza tras su fondo.
  const startOf=(i,lv)=>(isSel(i-1)&&g.walls[i].convexStart)?DEPTH[lv]:0;
  const blocked=(w,lv)=>{const out=[],Y=LEVEL_Y[lv],d=DEPTH[lv];
    for(const z of zones){if(!vOverlap(z.y,Y))continue;const iv=bandInterval(w,z.poly,d);if(iv)out.push([iv[0]-1,iv[1]+1]);}
    for(const m of mods){if(!vOverlap(LEVEL_Y[m.level],Y))continue;if(m.wall===w.i){out.push([m.x,m.x+m.w]);continue;}const iv=bandInterval(w,modPoly(m),d);if(iv)out.push(iv);}
    return out;};
  const free=lv=>{const out=[];for(const i of sel){const w=g.walls[i];for(const [s,e] of subtract([startOf(i,lv),w.len],blocked(w,lv)))out.push({wall:i,s,e});}return out;};
  const fits=(lv,wall,x0,x1)=>free(lv).some(f=>f.wall===wall&&f.s<=x0+0.01&&f.e>=x1-0.01);
  const place=(type,level,wall,x,w)=>{const m={id:uid(),type,level,wall,x:r1(x),w:r1(w),lock:false};mods.push(m);return m;};
  const unplace=m=>{const k=mods.indexOf(m);if(k>=0)mods.splice(k,1);};
  const P=(wall,x)=>at(g.walls[wall],x,30), dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  const has=t=>mods.find(m=>m.type===t);
  const sW=+D.sinkW, hW=+D.hobW, hobT=D.oven==='col'?'placa_caj':'placa';

  // 1. rinconeros en las esquinas compartidas
  for(const i of sel){const w=g.walls[i];if(isSel(i+1)&&w.convexEnd&&!mods.some(m=>m.wall===i&&m.x+m.w>w.len-100&&m.level!=='high')&&fits('low',i,w.len-100,w.len))place('rincon','low',i,w.len-100,100);}

  // 2. huecos posibles para columnas: en los extremos de cada tramo, nunca en mitad de una esquina en L
  const needCol=(D.fridge&&!has('nevera')?60:0)+(D.oven==='col'&&!has('horno_col')?60:0);
  const colCands=()=>{if(!needCol)return [];const out=[];
    for(const f of free('col')){if(f.e-f.s<needCol)continue;const w=g.walls[f.wall];
      const ownerEnd=f.e>=w.len-0.5&&isSel(f.wall+1)&&w.convexEnd, cornerStart=startOf(f.wall,'col')>0&&f.s<=startOf(f.wall,'col')+0.5;
      if(!cornerStart) out.push({wall:f.wall,x0:f.s,x1:f.s+needCol,dir:1});
      if(!ownerEnd) out.push({wall:f.wall,x0:f.e-needCol,x1:f.e,dir:-1});}
    return out;};

  // 3. objetivo del fregadero: toma de agua, ventana o tramo más largo
  let sinkT=null;
  const water=S.services.find(s=>(s.type==='agua'||s.type==='desague')&&isSel(s.wall));
  if(water) sinkT={wall:water.wall,c:water.x};
  if(!sinkT){const win=S.openings.find(o=>o.type==='ventana'&&isSel(o.wall)&&o.sill>=92);if(win)sinkT={wall:win.wall,c:win.x+win.w/2};}
  if(!sinkT){const f=[...free('low')].sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0];if(f)sinkT={wall:f.wall,c:(f.s+f.e)/2};}

  // 4. placa: la mejor posición dado el fregadero
  const bestHob=sink=>{
    const smoke=S.services.find(s=>s.type==='humos'&&isSel(s.wall)), highs=free('high');let best=null;
    for(const f of free('low')){if(f.e-f.s<hW)continue;
      for(let x=f.s;x<=f.e-hW+0.01;x+=5){
        const c=P(f.wall,x+hW/2);let sc=0;
        if(sink){if(sink.wall===f.wall){const gap=x>sink.x?x-(sink.x+sink.w):sink.x-(x+hW);if(gap<40)continue;}sc-=Math.abs(dist(c,P(sink.wall,sink.x+sink.w/2))-170)*0.6;}
        const l=x-f.s,r=f.e-(x+hW);sc+=(l>=30?40:l*0.5)+(r>=30?40:r*0.5);
        if(exactFill(l)&&exactFill(r))sc+=15;
        if(!highs.some(h=>h.wall===f.wall&&h.s<=x+0.01&&h.e>=x+hW-0.01))sc-=250;  // sin sitio para campana
        if(smoke)sc-=smoke.wall===f.wall?Math.abs(smoke.x-(x+hW/2))*0.35:120;
        if(mods.some(m=>m.level==='col'&&m.wall===f.wall&&(Math.abs(m.x-(x+hW))<1||Math.abs(m.x+m.w-x)<1)))sc-=80;
        if(!best||sc>best.sc)best={wall:f.wall,x,sc};
      }}
    return best;};

  // 5. fregadero y placa juntos: se prueba cada posición del fregadero cerca del objetivo y se elige
  //    la que deja sitio a la placa, a las columnas y al lavavajillas, en ese orden de importancia.
  let sink=has('fregadero'), hob=has('placa')||has('placa_caj');
  if(!sink){
    const cands=[];
    for(const f of free('low')){if(f.e-f.s<sW)continue;
      const xs=new Set();for(let x=f.s;x<=f.e-sW+0.01;x+=5)xs.add(r1(x));
      if(sinkT&&sinkT.wall===f.wall)xs.add(r1(clamp(sinkT.c-sW/2,f.s,f.e-sW)));
      for(const x of xs){const c=x+sW/2;const pen=!sinkT?0:f.wall===sinkT.wall?Math.abs(c-sinkT.c):300+dist(P(f.wall,c),P(sinkT.wall,sinkT.c));cands.push({wall:f.wall,x,pen});}}
    cands.sort((a,b)=>a.pen-b.pen);
    let best=null;
    for(const c of cands.slice(0,40)){
      const sm=place('fregadero','low',c.wall,c.x,sW);
      const hb=hob?{sc:0}:bestHob(sm);let hm=null;
      if(hb&&!hob)hm=place(hobT,'low',hb.wall,hb.x,hW);
      const colOk=!needCol||colCands().length>0;
      const dwOk=!D.dw||has('lavavajillas')||fits('low',sm.wall,sm.x+sm.w,sm.x+sm.w+60)||fits('low',sm.wall,sm.x-60,sm.x);
      const score=(hb?0:1000)+(colOk?0:200)+(dwOk?0:60)+c.pen-(hb?hb.sc*0.05:0);
      if(hm)unplace(hm);unplace(sm);
      if(!best||score<best.score)best={c,hb,score};
      if(score<=c.pen+0.5&&c.pen<1)break;
    }
    if(best){sink=place('fregadero','low',best.c.wall,best.c.x,sW);if(!hob&&best.hb)hob=place(hobT,'low',best.hb.wall,best.hb.x,hW);}
  }
  if(!hob){const hb=bestHob(sink);if(hb)hob=place(hobT,'low',hb.wall,hb.x,hW);}

  // 6. columnas en el extremo más conveniente
  if(needCol){
    let best=null;
    for(const c of colCands()){
      const mid=P(c.wall,(c.x0+c.x1)/2);let sc=0;
      if(sink){const d=dist(mid,P(sink.wall,sink.x+sink.w/2));sc-=Math.abs(d-210);if(d<120)sc-=200;}
      if(hob){const d=dist(mid,P(hob.wall,hob.x+hob.w/2));if(d<120)sc-=150;if(hob.wall===c.wall&&(Math.abs(hob.x-c.x1)<1||Math.abs(hob.x+hob.w-c.x0)<1))sc-=100;}
      if(!best||sc>best.sc)best={...c,sc};
    }
    if(best){let x=best.dir>0?best.x0:best.x1-needCol;
      for(const t of best.dir>0?['nevera','horno_col']:['horno_col','nevera']){if(t==='nevera'&&(!D.fridge||has('nevera')))continue;if(t==='horno_col'&&(D.oven!=='col'||has('horno_col')))continue;place(t,'col',best.wall,x,60);x+=60;}}
  }

  // 7. lavavajillas junto al fregadero
  if(D.dw&&sink&&!has('lavavajillas')){
    const room=x0=>{const f=free('low').find(f=>f.wall===sink.wall&&f.s<=x0+0.01&&f.e>=x0+59.99);return f?f.e-f.s:0;};
    const opts=[sink.x+sink.w,sink.x-60].filter(x=>fits('low',sink.wall,x,x+60)).sort((a,b)=>room(b)-room(a));
    if(opts.length)place('lavavajillas','low',sink.wall,opts[0],60);
  }

  // 8. campana sobre la placa (también sin muebles altos)
  if(hob&&!has('campana')&&fits('high',hob.wall,hob.x,hob.x+hob.w))place('campana','high',hob.wall,hob.x,hob.w);

  // 9. relleno con módulos estándar; la regleta va contra la pared o la columna
  const fillRun=(lv,f,type)=>{const pieces=fillWidths(f.e-f.s);const w=g.walls[f.wall];
    const reg=pieces.find(p=>p.reg), rest=pieces.filter(p=>!p.reg);
    const touches=x=>x<=startOf(f.wall,lv)+0.5||x>=w.len-0.5||mods.some(m=>m.wall===f.wall&&m.level==='col'&&(Math.abs(m.x-x)<1||Math.abs(m.x+m.w-x)<1));
    const order=reg&&!touches(f.e)&&touches(f.s)?[reg,...rest]:[...rest,...(reg?[reg]:[])];
    let x=f.s;for(const p of order){place(p.reg?'regleta':type,lv,f.wall,x,p.w);x+=p.w;}};
  for(const f of free('low'))fillRun('low',f,'base');
  if(hob)for(const m of mods)if(m.level==='low'&&m.wall===hob.wall&&m.type==='base'&&m.w>=40&&!m.lock&&(Math.abs(m.x+m.w-hob.x)<1||Math.abs(m.x-(hob.x+hob.w))<1))m.type='cajonero';
  if(D.uppers)for(const f of free('high'))fillRun('high',f,'alto');

  mods.sort((a,b)=>a.wall-b.wall||lvlOrder(a.level)-lvlOrder(b.level)||a.x-b.x);
  S.modules=mods;
}
const lvlOrder=l=>({low:0,col:1,high:2}[l]);
