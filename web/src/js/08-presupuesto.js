/* ================= presupuesto ================= */
// Los precios de la tarifa son de coste. El precio al cliente lleva el margen repartido en cada línea,
// redondeado a céntimos, y los totales se calculan sumando importes ya redondeados: lo que ve el cliente siempre cuadra.
function budget(){
  const M=S.modules, g=G, gf=GAMA[S.design.gama].f;
  const isMueble=m=>!NO_MUEBLE.has(m.type);
  const sum=f=>M.filter(f).reduce((s,m)=>s+m.w,0)/100;
  const cnt=t=>M.filter(m=>m.type===t).length;
  const lowML=sum(m=>m.level==='low'&&isMueble(m)), highML=sum(m=>m.level==='high'&&m.type!=='campana'&&isMueble(m));
  const counterML=sum(m=>m.level==='low'&&m.type!=='hueco');
  const hob=M.find(m=>m.type==='placa'||m.type==='placa_caj'), hood=M.find(m=>m.type==='campana');
  const openArea=S.openings.reduce((s,o)=>s+o.w*o.h,0)/1e4;
  const qty={
    bajo:lowML, alto:highML, col_nevera:cnt('nevera'), col_horno:cnt('horno_col'), cajonero:cnt('cajonero')+cnt('placa_caj'), rincon:cnt('rincon'), regleta:cnt('regleta')+2,
    encimera:counterML, huecos:(cnt('fregadero')?1:0)+(hob?1:0), frontal:counterML*(S.design.uppers?0.55:0.6),
    placa60:hob&&hob.w<90?1:0, placa90:hob&&hob.w>=90?1:0, horno:(cnt('placa')+cnt('horno_col'))?1:0,
    campana60:hood&&hood.w<90?1:0, campana90:hood&&hood.w>=90?1:0, lavavajillas:cnt('lavavajillas'), frigo:cnt('nevera'), fregadero:cnt('fregadero')?1:0,
    montaje:M.filter(isMueble).length, fontaneria:1, electricidad:1, desmontaje:1,
    pintura:Math.max(0,g.perim/100*S.height/100-openArea-counterML*0.6), suelo:g.area/1e4
  };
  const mf=1+S.margin/100;
  const lines=PRICE_DEFS.map(([k,cap,label,unit,def,byG])=>{
    let key=k, price=byG?R(def*gf):def;
    if(k==='encimera'){label=`Encimera de ${COUNTERS[S.finish.counter].n.toLowerCase()}`;key='encimera_'+S.finish.counter;price=COUNTERS[S.finish.counter].p;}
    const manual=S.prices[key]!==undefined; if(manual) price=S.prices[key];
    return {k,cap,label,unit,price,manual,def:k==='encimera'?COUNTERS[S.finish.counter].p:(byG?R(def*gf):def),q:r2(qty[k]||0),on:!S.off[k]};
  }).filter(l=>l.q>0||['fontaneria','electricidad','desmontaje'].includes(l.k));
  for(const e of S.extra) lines.push({k:'x-'+e.id,id:e.id,cap:'Otros trabajos',label:e.label||'Partida sin nombre',unit:e.unit||'ud',price:e.price,manual:true,q:r2(e.q),on:true,extra:true});
  let sub=0,cost=0;
  for(const l of lines){l.cp=r2(l.price*mf);l.amount=l.on?r2(l.q*l.cp):0;l.cost=l.on?r2(l.q*l.price):0;sub+=l.amount;cost+=l.cost;}
  sub=r2(sub);cost=r2(cost);
  const discount=r2(sub*S.discount/100), base=r2(sub-discount), iva=r2(base*S.iva/100), total=r2(base+iva);
  return {lines,sub,discount,base,iva,total,cost,profit:r2(base-cost),lowML:counterML};
}
function quoteMeta(){
  const q=S.quote, d=q.date?new Date(q.date+'T12:00:00'):new Date();
  const until=new Date(d.getTime()+q.validDays*864e5);
  const f=x=>x.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
  return {number:q.number||'(sin número)',date:f(d),until:f(until)};
}
// Numeración correlativa por año, guardada en este navegador.
function nextQuoteNumber(){
  const y=new Date().getFullYear(), k='mkpkr-cocinas-num-'+y;
  let n=1;try{n=(+localStorage.getItem(k)||0)+1;localStorage.setItem(k,String(n));}catch(e){}
  return `P-${y}-${String(n).padStart(3,'0')}`;
}
