/* ================= comprobaciones ================= */
// Devuelve [nivel, texto] ordenado por gravedad: bad (problema), warn (revisar), info (nota), good (bien).
function checks(){
  const g=G, out=[], M=S.modules, by=t=>M.find(m=>m.type===t);
  const ctr=m=>at(g.walls[m.wall],m.x+m.w/2,30), d2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const name=m=>`${TYPES[m.type].n.toLowerCase()} de la pared ${L(m.wall)}`;
  const sink=by('fregadero'), hob=M.find(m=>m.type==='placa'||m.type==='placa_caj'), fr=by('nevera');
  const sel=S.design.walls.filter(i=>g.walls[i]&&!g.walls[i].open);

  // Estancia y huecos (se muestran también en «Estancia»)
  const est=c=>out.push([...c,'estancia']);
  for(const w of g.walls) if(w.residual&&Math.abs(w.residual)>=1) est(['warn',`La medida real de la pared ${L(w.i)} no cuadra con las demás: para cerrar la planta ha quedado en ${fmt(w.len,1)} cm (${w.residual>0?'+':''}${fmt(w.residual,1)} cm). Revisa las medidas con láser.`]);
  for(const o of S.openings){const w=g.walls[o.wall];if(!w)continue;
    if(o.x<-0.5||o.x+o.w>w.len+0.5) est(['bad',`${OPEN_T[o.type]} de la pared ${L(o.wall)} se sale de la pared (${fmt(o.x)}–${fmt(o.x+o.w)} cm en una pared de ${fmt(w.len)} cm).`]);
    if(o.sill+o.h>S.height+0.5) est(['warn',`${OPEN_T[o.type]} de la pared ${L(o.wall)} es más alta que el techo.`]);}
  for(let i=0;i<S.openings.length;i++)for(let j=i+1;j<S.openings.length;j++){const a=S.openings[i],b=S.openings[j];
    if(a.wall===b.wall&&a.x<b.x+b.w-0.5&&b.x<a.x+a.w-0.5&&a.sill<b.sill+b.h&&b.sill<a.sill+a.h) est(['bad',`${OPEN_T[a.type]} y ${OPEN_T[b.type].toLowerCase()} de la pared ${L(a.wall)} se solapan.`]);}
  for(const s of S.services){const w=g.walls[s.wall];if(w&&(s.x<0||s.x>w.len))est(['warn',`${SERV_T[s.type].n} de la pared ${L(s.wall)} está fuera de la pared.`]);}

  if(!sel.length){out.push(['bad','No hay paredes con muebles. Elige al menos una en «Paredes con muebles».']);return sortChecks(out);}
  if(!sink) out.push(['bad','No hay fregadero en el diseño: no ha cabido o se ha quitado. Libera espacio o añade más paredes.']);
  if(!hob) out.push(['bad','No hay placa en el diseño: no ha cabido o se ha quitado. Libera espacio o añade más paredes.']);

  // Geometría de los muebles
  for(const m of M){const w=g.walls[m.wall];if(!w)continue;
    if(w.open) out.push(['bad',`El ${name(m)} está en un lado abierto, sin pared.`]);
    if(m.x<-0.5||m.x+m.w>w.len+0.5) out.push(['bad',`El ${name(m)} se sale de la pared (${fmt(m.x)}–${fmt(m.x+m.w)} cm en una pared de ${fmt(w.len)} cm).`]);}
  const polys=M.map(m=>({m,p:modPoly(m)}));
  for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++){const a=polys[i],b=polys[j];
    if(!vOverlap(LEVEL_Y[a.m.level],LEVEL_Y[b.m.level]))continue;
    const pen=overlapPen(a.p,b.p);if(pen>1)out.push(['bad',`El ${name(a.m)} y el ${name(b.m)} se solapan ${fmt(pen)} cm.`]);}
  for(const z of openingZones()){
    for(const {m,p} of polys){if(!vOverlap(LEVEL_Y[m.level],z.y))continue;const pen=overlapPen(z.poly,p);if(pen<=2)continue;
      if(z.o.type==='ventana') out.push([m.level==='low'?'warn':'bad',`El ${name(m)} tapa ${fmt(pen)} cm de la ventana de la pared ${L(z.o.wall)}.`]);
      else out.push(['bad',`El ${name(m)} invade ${fmt(pen)} cm el paso de la ${OPEN_T[z.o.type].toLowerCase()} de la pared ${L(z.o.wall)}.`]);}}

  // Ergonomía
  if(sink&&hob&&fr){
    const a=d2(ctr(sink),ctr(hob)), b=d2(ctr(hob),ctr(fr)), c=d2(ctr(fr),ctr(sink)), sum=a+b+c, okLegs=[a,b,c].every(d=>d>=120&&d<=270);
    out.push([okLegs&&sum<=790?'good':(sum<=790?'warn':'bad'),`Triángulo de trabajo: fregadero–placa ${R(a)}, placa–frigorífico ${R(b)}, frigorífico–fregadero ${R(c)} cm. Suma ${R(sum)} cm (recomendado cada lado 120–270 y suma ≤ 790).`]);
  } else if(sink||hob) out.push(['info','Triángulo de trabajo: falta '+[!sink&&'fregadero',!hob&&'placa',!fr&&'frigorífico'].filter(Boolean).join(', ')+' en el diseño.']);
  if(hob){
    const lows=M.filter(m=>m.wall===hob.wall&&m.level==='low'&&m.type!=='hueco');
    const side=dir=>{let s=0,x=dir<0?hob.x:hob.x+hob.w;for(let k=0;k<20;k++){const n=lows.find(m=>dir<0?Math.abs(m.x+m.w-x)<1:Math.abs(m.x-x)<1);if(!n)break;s+=n.w;x=dir<0?n.x:n.x+n.w;if(s>=60)break;}return s;};
    const l=side(-1), r=side(1);
    out.push([l>=30&&r>=30?'good':'warn',`Encimera junto a la placa: ${R(l)} cm a un lado y ${R(r)} cm al otro (mínimo 30 cm a cada lado).`]);
    const hood=by('campana'), smoke=S.services.find(s=>s.type==='humos');
    if(!hood) out.push(['warn','No hay campana sobre la placa (puede que una ventana lo impida).']);
    if(hood&&smoke){if(smoke.wall!==hood.wall)out.push(['warn',`La salida de humos está en la pared ${L(smoke.wall)} y la campana en la ${L(hood.wall)}: habrá que llevar el tubo por encima de los altos.`]);else{const d=Math.abs(smoke.x-(hood.x+hood.w/2));out.push([d<=60?'good':'warn',`Campana a ${R(d)} cm de la salida de humos.`]);}}
    else if(hood) out.push(['info','Sin salida de humos marcada: se supone campana de recirculación.']);
  }
  if(sink&&hob&&sink.wall===hob.wall){const gap=sink.x>hob.x?sink.x-(hob.x+hob.w):hob.x-(sink.x+sink.w);out.push([gap>=40?'good':'bad',`Separación fregadero–placa: ${R(gap)} cm (mínimo 40).`]);}
  const dw=by('lavavajillas');
  if(S.design.dw){if(!dw)out.push(['warn','No ha cabido el lavavajillas.']);else if(sink){const adj=dw.wall===sink.wall&&(Math.abs(dw.x-(sink.x+sink.w))<1||Math.abs(dw.x+dw.w-sink.x)<1);out.push([adj?'good':'warn',adj?'Lavavajillas junto al fregadero.':'El lavavajillas no está junto al fregadero.']);}}
  if(S.design.fridge&&!fr) out.push(['warn','No hay sitio para la columna del frigorífico en un extremo libre.']);
  const water=S.services.find(s=>s.type==='agua');
  if(!water) out.push(['info','No hay toma de agua marcada: el fregadero se ha colocado bajo la ventana o en el tramo más largo.']);
  else if(sink){if(water.wall!==sink.wall)out.push(['warn',`El fregadero está en la pared ${L(sink.wall)} y el agua en la ${L(water.wall)}: hay que mover tomas.`]);else{const d=Math.abs(water.x-(sink.x+sink.w/2));out.push([d<=50?'good':'warn',`Fregadero a ${R(d)} cm de la toma de agua${d>50?': hay que prolongar tuberías':''}.`]);}}
  // pasos entre frentes enfrentados
  for(let a=0;a<sel.length;a++)for(let b=a+1;b<sel.length;b++){const w1=g.walls[sel[a]],w2=g.walls[sel[b]];
    if(w1.n.x*w2.n.x+w1.n.y*w2.n.y<-0.98){const d=Math.abs((w2.a.x-w1.a.x)*w1.n.x+(w2.a.y-w1.a.y)*w1.n.y);const free=d-120;out.push([free>=100?'good':(free>=90?'warn':'bad'),`Paso entre las paredes ${L(sel[a])} y ${L(sel[b])}: ${R(free)} cm libres (recomendado 100–120).`]);}}
  return sortChecks(out);
}
function sortChecks(out){const o={bad:0,warn:1,info:2,good:3};const seen=new Set();return out.filter(c=>!seen.has(c[1])&&seen.add(c[1])).sort((a,b)=>o[a[0]]-o[b[0]]);}
