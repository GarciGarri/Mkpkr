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
function subtract(seg,blocks){
  let out=[seg];
  for(const [b0,b1] of blocks){const nx=[];for(const [s,e] of out){if(b1<=s||b0>=e){nx.push([s,e]);continue;}if(b0>s)nx.push([s,b0]);if(b1<e)nx.push([b1,e]);}out=nx;}
  return out.filter(([s,e])=>e-s>=3);
}
function blocksFor(w,level){
  const r=[];
  for(const o of S.openings){ if(o.wall!==w.i) continue;
    if(o.type!=='ventana'){r.push([o.x-5,o.x+o.w+5]);continue;}
    if(level==='low'&&o.sill<92) r.push([o.x-3,o.x+o.w+3]);
    if(level==='high'&&o.sill+o.h>145&&o.sill<215) r.push([o.x-5,o.x+o.w+5]);
    if(level==='col') r.push([o.x-5,o.x+o.w+5]);
  }
  return r;
}
function autoLayout(){
  const g=geom(), D=S.design, sel=D.walls.filter(i=>i<g.n).sort((a,b)=>a-b);
  const isSel=i=>sel.includes(((i%g.n)+g.n)%g.n);
  const mods=[];
  // tramos libres por pared
  const free={low:[],high:[]};
  for(const i of sel){const w=g.walls[i];
    const s0=(isSel(i-1)&&w.convexStart)?60:0, s1=(isSel(i-1)&&w.convexStart)?35:0;
    for(const [s,e] of subtract([s0,w.len],blocksFor(w,'low'))) free.low.push({wall:i,s,e});
    for(const [s,e] of subtract([s1,w.len],blocksFor(w,'high'))) free.high.push({wall:i,s,e});
  }
  const take=(list,wall,x0,x1)=>{const k=list.findIndex(f=>f.wall===wall&&f.s<=x0+0.01&&f.e>=x1-0.01);if(k<0)return false;const f=list[k];const parts=[];if(x0-f.s>=3)parts.push({wall,s:f.s,e:x0});if(f.e-x1>=3)parts.push({wall,s:x1,e:f.e});list.splice(k,1,...parts);return true;};
  const place=(type,level,wall,x,w)=>{mods.push({id:uid(),type,level,wall,x:R(x),w:R(w)});};
  const fits=(list,wall,x0,x1)=>list.some(f=>f.wall===wall&&f.s<=x0+0.01&&f.e>=x1-0.01);
  const P=(wall,x)=>at(g.walls[wall],x,30);
  const dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
  if(!sel.length){S.modules=[];return;}

  // 1. rinconeros en esquinas compartidas
  for(const i of sel){const w=g.walls[i]; if(isSel(i+1)&&w.convexEnd){ if(fits(free.low,i,w.len-100,w.len)){take(free.low,i,w.len-100,w.len);place('rincon','low',i,w.len-100,100);} } }

  // 2. objetivo del fregadero
  let sinkT=null; const sW=+D.sinkW;
  const water=S.services.find(s=>(s.type==='agua'||s.type==='desague')&&isSel(s.wall));
  if(water) sinkT={wall:water.wall,c:water.x};
  if(!sinkT){const win=S.openings.find(o=>o.type==='ventana'&&isSel(o.wall)&&o.sill>=92);if(win)sinkT={wall:win.wall,c:win.x+win.w/2};}
  if(!sinkT){const f=[...free.low].sort((a,b)=>(b.e-b.s)-(a.e-a.s))[0];if(f)sinkT={wall:f.wall,c:(f.s+f.e)/2};}

  // 3. columnas en los extremos del conjunto
  const colBlocks={};
  if(D.fridge||D.oven==='col'){
    const need=(D.fridge?60:0)+(D.oven==='col'?60:0);
    const cands=[];
    for(const f of free.low){const w=g.walls[f.wall];
      const startEdge=f.s<=((isSel(f.wall-1)&&w.convexStart)?60.5:0.5)||S.openings.some(o=>o.wall===f.wall&&o.type!=='ventana'&&Math.abs(o.x+o.w+5-f.s)<2);
      const endEdge=f.e>=w.len-0.5||S.openings.some(o=>o.wall===f.wall&&o.type!=='ventana'&&Math.abs(o.x-5-f.e)<2);
      if(startEdge) cands.push({wall:f.wall,x0:f.s,x1:f.s+need,dir:1});
      if(endEdge&&!(isSel(f.wall+1)&&w.convexEnd)) cands.push({wall:f.wall,x0:f.e-need,x1:f.e,dir:-1});
    }
    let best=null;
    for(const c of cands){
      if(!fits(free.low,c.wall,c.x0,c.x1)) continue;
      const w=g.walls[c.wall]; if(subtract([c.x0,c.x1],blocksFor(w,'col')).reduce((s,[a,b])=>s+b-a,0)<c.x1-c.x0-0.5) continue;
      const d=sinkT?dist(P(c.wall,(c.x0+c.x1)/2),P(sinkT.wall,sinkT.c)):150;
      const sc=-Math.abs(d-210)-(d<120?200:0);
      if(!best||sc>best.sc) best={...c,sc};
    }
    if(best){take(free.low,best.wall,best.x0,best.x1);
      let x=best.dir>0?best.x0:best.x1-need; const order=best.dir>0?['nevera','horno_col']:['horno_col','nevera'];
      for(const t of order){ if(t==='nevera'&&!D.fridge) continue; if(t==='horno_col'&&D.oven!=='col') continue; place(t,'col',best.wall,x,60);(colBlocks[best.wall]=colBlocks[best.wall]||[]).push([x,x+60]);x+=60;}
    }
  }

  // 4. fregadero
  let sink=null;
  if(sinkT){
    const cand=free.low.filter(f=>f.e-f.s>=sW).map(f=>{const x=clamp(sinkT.c-sW/2,f.s,f.e-sW);return {wall:f.wall,x,d:f.wall===sinkT.wall?Math.abs(x+sW/2-sinkT.c):1000+dist(P(f.wall,x),P(sinkT.wall,sinkT.c))};}).sort((a,b)=>a.d-b.d)[0];
    if(cand){take(free.low,cand.wall,cand.x,cand.x+sW);place('fregadero','low',cand.wall,cand.x,sW);sink={wall:cand.wall,x:cand.x,w:sW};}
  }
  // 5. lavavajillas junto al fregadero
  if(D.dw&&sink){
    const opts=[[sink.x+sink.w,sink.x+sink.w+60],[sink.x-60,sink.x]].filter(([a,b])=>fits(free.low,sink.wall,a,b));
    if(opts.length){const [a,b]=opts.sort((p,q)=>roomAround(free.low,sink.wall,q)-roomAround(free.low,sink.wall,p))[0];take(free.low,sink.wall,a,b);place('lavavajillas','low',sink.wall,a,60);}
  }
  // 6. placa
  const hW=+D.hobW; let hob=null;
  {
    const smoke=S.services.find(s=>s.type==='humos'&&isSel(s.wall));
    let best=null;
    for(const f of free.low){ if(f.e-f.s<hW) continue;
      for(let x=f.s;x<=f.e-hW+0.01;x+=5){
        const c=P(f.wall,x+hW/2); let sc=0;
        if(sink){const d=dist(c,P(sink.wall,sink.x+sink.w/2)); sc-=Math.abs(d-170)*0.6; if(sink.wall===f.wall){const gap=x>sink.x?x-(sink.x+sink.w):sink.x-(x+hW); if(gap<40) sc-=300;}}
        const l=x-f.s, r=f.e-(x+hW); sc+=(l>=30?40:l*0.5)+(r>=30?40:r*0.5);
        const w=g.walls[f.wall];
        if(subtract([x,x+hW],blocksFor(w,'high')).reduce((s,[a,b])=>s+b-a,0)<hW-1) sc-=250;
        if((colBlocks[f.wall]||[]).some(([a,b])=>Math.abs(a-(x+hW))<1||Math.abs(b-x)<1)) sc-=60;
        if(smoke) sc-=(smoke.wall===f.wall?Math.abs(smoke.x-(x+hW/2))*0.35:120);
        const frg=mods.find(m=>m.type==='nevera');if(frg){const d=dist(c,P(frg.wall,frg.x+30));if(d<120)sc-=(120-d)*2.5;}
        if(exactFill(l)&&exactFill(r)) sc+=25;
        if(!best||sc>best.sc) best={wall:f.wall,x,sc};
      }
    }
    if(best){take(free.low,best.wall,best.x,best.x+hW);place(D.oven==='col'?'placa_caj':'placa','low',best.wall,best.x,hW);hob={wall:best.wall,x:best.x,w:hW};}
  }
  // 7. relleno de bajos
  for(const f of free.low){let x=f.s; for(const p of fillWidths(f.e-f.s)){place(p.reg?'regleta':'base','low',f.wall,x,p.w);x+=p.w;}}
  if(hob){ const adj=mods.filter(m=>m.level==='low'&&m.wall===hob.wall&&m.type==='base'&&m.w>=40&&(Math.abs(m.x+m.w-hob.x)<1||Math.abs(m.x-(hob.x+hob.w))<1)); adj.forEach(m=>m.type='cajonero'); }
  // 8. altos
  if(D.uppers){
    let high=free.high.slice();
    for(const [wall,bl] of Object.entries(colBlocks)){const nw=[];for(const f of high){if(f.wall!=+wall){nw.push(f);continue;}for(const [s,e] of subtract([f.s,f.e],bl.map(([a,b])=>[a,b])))nw.push({wall:f.wall,s,e});}high=nw;}
    if(hob){const hx=hob.x+hob.w/2-hW/2;const nw=[];for(const f of high){if(f.wall!==hob.wall){nw.push(f);continue;}for(const [s,e] of subtract([f.s,f.e],[[hx,hx+hW]]))nw.push({wall:f.wall,s,e});}high=nw;place('campana','high',hob.wall,hx,hW);}
    for(const f of high){let x=f.s;for(const p of fillWidths(f.e-f.s)){place(p.reg?'regleta':'alto','high',f.wall,x,p.w);x+=p.w;}}
  } else if(hob){ place('campana','high',hob.wall,hob.x,hW); }
  mods.sort((a,b)=>a.wall-b.wall||lvlOrder(a.level)-lvlOrder(b.level)||a.x-b.x);
  S.modules=mods;
}
function exactFill(l){l=Math.round(l);if(l===0)return true;if(l<30)return false;const ok=new Uint8Array(l+1);ok[0]=1;for(let i=1;i<=l;i++)for(const w of WIDTHS)if(w<=i&&ok[i-w]){ok[i]=1;break;}return !!ok[l];}
function roomAround(list,wall,[a,b]){const f=list.find(f=>f.wall===wall&&f.s<=a+0.01&&f.e>=b-0.01);return f?f.e-f.s:0;}
const lvlOrder=l=>({low:0,col:1,high:2}[l]);

