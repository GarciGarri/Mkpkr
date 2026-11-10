/* ================= comprobaciones ================= */
function checks(){
  const g=G, out=[], M=S.modules, by=t=>M.find(m=>m.type===t);
  const ctr=m=>at(g.walls[m.wall],m.x+m.w/2,30);
  const sink=by('fregadero'), hob=M.find(m=>m.type==='placa'||m.type==='placa_caj'), fr=by('nevera');
  if(!S.design.walls.length) out.push(['bad','No hay paredes con muebles. Elige al menos una en «Paredes con muebles».']);
  if(sink&&hob&&fr){
    const d1=Math.hypot(ctr(sink).x-ctr(hob).x,ctr(sink).y-ctr(hob).y), d2=Math.hypot(ctr(hob).x-ctr(fr).x,ctr(hob).y-ctr(fr).y), d3=Math.hypot(ctr(fr).x-ctr(sink).x,ctr(fr).y-ctr(sink).y);
    const legs=[d1,d2,d3], sum=d1+d2+d3, okLegs=legs.every(d=>d>=120&&d<=270);
    out.push([okLegs&&sum<=790?'good':(sum<=790?'warn':'bad'),`Triángulo de trabajo: fregadero–placa ${R(d1)}, placa–frigorífico ${R(d2)}, frigorífico–fregadero ${R(d3)} cm. Suma ${R(sum)} cm (recomendado cada lado 120–270 y suma ≤ 790).`]);
  } else out.push(['info','Triángulo de trabajo: falta '+[!sink&&'fregadero',!hob&&'placa',!fr&&'frigorífico'].filter(Boolean).join(', ')+' en el diseño.']);
  if(hob){
    const lows=M.filter(m=>m.wall===hob.wall&&m.level==='low').sort((a,b)=>a.x-b.x);
    const side=dir=>{let s=0,x=dir<0?hob.x:hob.x+hob.w;for(;;){const n=lows.find(m=>dir<0?Math.abs(m.x+m.w-x)<1:Math.abs(m.x-x)<1);if(!n||n.type==='lavavajillas'&&false)break;s+=n.w;x=dir<0?n.x:n.x+n.w;if(s>=60)break;}return s;};
    const l=side(-1), r=side(1);
    out.push([l>=30&&r>=30?'good':'warn',`Encimera junto a la placa: ${R(l)} cm a la izquierda y ${R(r)} cm a la derecha (mínimo 30 cm a cada lado).`]);
    const hood=M.find(m=>m.type==='campana');
    if(!hood) out.push(['warn','No hay campana sobre la placa.']);
    const smoke=S.services.find(s=>s.type==='humos');
    if(hood&&smoke){ if(smoke.wall!==hood.wall) out.push(['warn',`La salida de humos está en la pared ${L(smoke.wall)} y la campana en la ${L(hood.wall)}: habrá que llevar el tubo por encima de los altos.`]); else{const d=Math.abs(smoke.x-(hood.x+hood.w/2)); out.push([d<=60?'good':'warn',`Campana a ${R(d)} cm de la salida de humos.`]);} }
    else if(hood) out.push(['info','Sin salida de humos marcada: se supone campana de recirculación.']);
  }
  if(sink&&hob&&sink.wall===hob.wall){const gap=sink.x>hob.x?sink.x-(hob.x+hob.w):hob.x-(sink.x+sink.w);out.push([gap>=40?'good':'bad',`Separación fregadero–placa: ${R(gap)} cm (mínimo 40).`]);}
  const dw=by('lavavajillas');
  if(S.design.dw){ if(!dw) out.push(['warn','No ha cabido el lavavajillas junto al fregadero.']); else if(sink) out.push([dw.wall===sink.wall&&(Math.abs(dw.x-(sink.x+sink.w))<1||Math.abs(dw.x+dw.w-sink.x)<1)?'good':'warn','Lavavajillas '+(dw.wall===sink.wall?'junto al fregadero.':'separado del fregadero.')]); }
  if(S.design.fridge&&!fr) out.push(['warn','No hay sitio para la columna del frigorífico en un extremo libre.']);
  const water=S.services.find(s=>s.type==='agua');
  if(!water) out.push(['info','No hay toma de agua marcada: el fregadero se ha colocado bajo la ventana o en el tramo más largo.']);
  else if(sink){ if(water.wall!==sink.wall) out.push(['warn',`El fregadero está en la pared ${L(sink.wall)} y el agua en la ${L(water.wall)}: hay que mover tomas.`]); else{const d=Math.abs(water.x-(sink.x+sink.w/2)); out.push([d<=50?'good':'warn',`Fregadero a ${R(d)} cm de la toma de agua${d>50?': hay que prolongar tuberías':''}.`]);} }
  // pasillos en paralela
  const sel=S.design.walls;
  for(let a=0;a<sel.length;a++)for(let b=a+1;b<sel.length;b++){const w1=g.walls[sel[a]],w2=g.walls[sel[b]];if(!w1||!w2)continue;if(w1.n.x*w2.n.x+w1.n.y*w2.n.y<-0.98){const d=Math.abs((w2.a.x-w1.a.x)*w1.n.x+(w2.a.y-w1.a.y)*w1.n.y);const free=d-120;out.push([free>=100?'good':(free>=90?'warn':'bad'),`Paso entre las paredes ${L(sel[a])} y ${L(sel[b])}: ${R(free)} cm libres (recomendado 100–120).`]);}}
  // solapes
  const ov=[];for(const lvl of ['low','high'])for(const w of g.walls){const ms=M.filter(m=>m.wall===w.i&&(m.level===lvl||m.level==='col')).sort((a,b)=>a.x-b.x);for(let i=1;i<ms.length;i++)if(ms[i].x<ms[i-1].x+ms[i-1].w-0.5)ov.push(`${L(w.i)}: ${TYPES[ms[i-1].type].n} y ${TYPES[ms[i].type].n}`);for(const m of ms)if(m.x<-0.5||m.x+m.w>w.len+0.5)ov.push(`${L(w.i)}: ${TYPES[m.type].n} se sale de la pared`);}
  if(ov.length) out.push(['bad','Módulos que se solapan: '+[...new Set(ov)].join('; ')+'.']);
  return out;
}

