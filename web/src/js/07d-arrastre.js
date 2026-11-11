/* ================= mover módulos e instalaciones a mano (planta y 3D) ================= */
const SERV_H={agua:50,desague:40,gas:60,humos:200,enchufe:110};
const DRAG={on:null,raf:0};
function dragItem(key){
  const [k,id]=String(key).split(':');
  if(k==='m'){const m=S.modules.find(x=>x.id===id);return m&&m.type!=='hueco'?{kind:'m',o:m,w:m.w}:null;}
  if(k==='s'){const s=S.services.find(x=>x.id===id);return s?{kind:'s',o:s,w:0}:null;}
  return null;
}
// Atributos que hacen arrastrable un elemento del plano.
function dragAttr(key,label,pe='all'){return ` data-drag="${esc(key)}" tabindex="0" role="button" aria-label="${esc(label)}. Arrastra o usa las flechas para moverlo" pointer-events="${pe}"`;}
// Coloca el elemento en la pared más cercana al punto p (cm de la planta). Devuelve true si ha cambiado.
function placeAt(it,p,grab){
  let best=null;
  for(const w of G.walls){if(w.open)continue;const q=toWall(w,p);
    const x=clamp(q.x-grab,0,Math.max(0,w.len-it.w));
    const along=q.x<0?-q.x:q.x>w.len?q.x-w.len:0;
    const d=Math.abs(q.y-(it.kind==='m'?30:9))+along*2+(q.y<-15?60:0);
    if(!best||d<best.d)best={d,w,x};}
  if(!best)return false;
  let x=best.x;const len=best.w.len;
  if(it.kind==='m'){ // imán: se pega a los bordes de la pared y de los módulos vecinos
    const edges=[0,len-it.w];
    for(const m of S.modules)if(m!==it.o&&m.wall===best.w.i&&m.type!=='hueco')edges.push(m.x+m.w,m.x-it.w,m.x,m.x+m.w-it.w);
    let bd=4;for(const e of edges)if(e>=-0.01&&e<=len-it.w+0.01&&Math.abs(e-x)<bd){bd=Math.abs(e-x);x=e;}
  }
  x=r1(clamp(x,0,Math.max(0,len-it.w)));
  const ch=it.o.wall!==best.w.i||Math.abs(it.o.x-x)>=0.05;
  it.o.wall=best.w.i;it.o.x=x;return ch;
}
function dragGrab(it,p){const w=G.walls[it.o.wall];return w?clamp(toWall(w,p).x-it.o.x,0,it.w):0;}
function svgPt(svg,e){const m=svg.getScreenCTM();if(!m)return null;const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return {x:q.x,y:q.y};}
function dragFrame(){if(DRAG.raf)return;DRAG.raf=requestAnimationFrame(()=>{DRAG.raf=0;renderAll();});}
function dragMove(p){const d=DRAG.on;if(!d||!p)return;if(!d.moved){touch();d.moved=true;document.body.classList.add('dragging');}if(placeAt(d.it,p,d.grab))dragFrame();}
function dragDone(it,how){
  if(it.kind==='m'){it.o.lock=true;autoLayout();}
  renderAll();
  toast(it.kind==='m'?`${TYPES[it.o.type].n} fijado en la pared ${L(it.o.wall)} a ${fmt(it.o.x)} cm; el resto se ha recolocado.`:`${SERV_T[it.o.type].n} en la pared ${L(it.o.wall)} a ${fmt(it.o.x)} cm.`,how==='key'?undefined:{label:'Deshacer',run:undo});
}
function dragEnd(){
  const d=DRAG.on;DRAG.on=null;document.body.classList.remove('dragging');
  if(three.ctl)three.ctl.enabled=true;
  if(DRAG.raf){cancelAnimationFrame(DRAG.raf);DRAG.raf=0;}
  if(d&&d.moved)dragDone(d.it,'drag');
}
// Planta (Diseño, Estancia)
document.addEventListener('pointerdown',e=>{
  const el=e.target.closest?.('.svgbox [data-drag]');if(!el||e.button>0)return;
  const svg=el.ownerSVGElement,it=dragItem(el.dataset.drag);if(!svg||!it)return;
  geom();const p=svgPt(svg,e);if(!p)return;e.preventDefault();
  DRAG.on={src:'plan',it,grab:dragGrab(it,p),box:svg.parentElement.id,moved:false,x0:e.clientX,y0:e.clientY};
});
document.addEventListener('pointermove',e=>{
  const d=DRAG.on;if(!d)return;
  if(!d.moved&&Math.hypot(e.clientX-d.x0,e.clientY-d.y0)<4)return;
  if(d.src==='plan'){const svg=document.querySelector('#'+d.box+' svg');svg&&dragMove(svgPt(svg,e));}
  else dragMove(three.floorPt(e,d.plane));
});
document.addEventListener('pointerup',()=>DRAG.on&&dragEnd());
document.addEventListener('pointercancel',()=>DRAG.on&&dragEnd());
// Teclado: flechas a lo largo de la pared (Mayús = 10 cm), Re Pág / Av Pág cambia de pared.
document.addEventListener('keydown',e=>{
  const el=e.target.closest?.('.svgbox [data-drag]');if(!el)return;
  const key=el.dataset.drag,box=el.closest('.svgbox').id,it=dragItem(key);if(!it)return;geom();
  const w=G.walls[it.o.wall];if(!w)return;const st=e.shiftKey?10:1;let x=it.o.x,wall=it.o.wall;
  if(e.key==='ArrowRight'||e.key==='ArrowUp')x+=st;
  else if(e.key==='ArrowLeft'||e.key==='ArrowDown')x-=st;
  else if(e.key==='PageUp'||e.key==='PageDown'){const ws=G.walls.filter(v=>!v.open).map(v=>v.i);if(ws.length<2)return;const k=ws.indexOf(wall);wall=ws[(k+(e.key==='PageDown'?1:ws.length-1))%ws.length];}
  else return;
  e.preventDefault();
  const nw=G.walls[wall];x=r1(clamp(x,0,Math.max(0,nw.len-it.w)));
  if(x===it.o.x&&wall===it.o.wall)return;
  touch();it.o.x=x;it.o.wall=wall;dragDone(it,'key');
  document.querySelector(`#${box} [data-drag="${CSS.escape(key)}"]`)?.focus();
});
