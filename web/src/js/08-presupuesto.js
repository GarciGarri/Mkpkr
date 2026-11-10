/* ================= presupuesto ================= */
function budget(){
  const M=S.modules, g=G, gf=GAMA[S.design.gama].f;
  const sum=(f)=>M.filter(f).reduce((s,m)=>s+m.w,0)/100;
  const lowML=sum(m=>m.level==='low'), highML=sum(m=>m.level==='high'&&m.type!=='campana');
  const cnt=t=>M.filter(m=>m.type===t).length;
  const hob=M.find(m=>m.type==='placa'||m.type==='placa_caj'), hood=M.find(m=>m.type==='campana');
  const openArea=S.openings.reduce((s,o)=>s+o.w*o.h,0)/1e4;
  const qty={
    bajo:lowML, alto:highML, col_nevera:cnt('nevera'), col_horno:cnt('horno_col'), cajonero:cnt('cajonero')+cnt('placa_caj'), rincon:cnt('rincon'), regleta:cnt('regleta')+2,
    encimera:lowML, huecos:(cnt('fregadero')?1:0)+(hob?1:0), frontal:lowML*0.6,
    placa60:hob&&hob.w<90?1:0, placa90:hob&&hob.w>=90?1:0, horno:(cnt('placa')+cnt('horno_col'))?1:0,
    campana60:hood&&hood.w<90?1:0, campana90:hood&&hood.w>=90?1:0, lavavajillas:cnt('lavavajillas'), frigo:cnt('nevera'), fregadero:cnt('fregadero')?1:0,
    montaje:M.filter(m=>m.type!=='regleta').length, fontaneria:1, electricidad:1, desmontaje:1,
    pintura:Math.max(0,g.perim/100*S.height/100-openArea-lowML*0.6), suelo:g.area/1e4
  };
  const lines=PRICE_DEFS.map(([k,cap,label,unit,def,byG])=>{
    let price=S.prices[k]??(byG?R(def*gf):def);
    if(k==='encimera'){label=`Encimera de ${COUNTERS[S.finish.counter].n.toLowerCase()}`;price=S.prices['encimera_'+S.finish.counter]??COUNTERS[S.finish.counter].p;}
    const q=qty[k]||0; const on=!S.off[k];
    return {k,cap,label,unit,price,q,on,amount:on?q*price:0,byG};
  }).filter(l=>l.q>0||['fontaneria','electricidad','desmontaje'].includes(l.k));
  const sub=lines.reduce((s,l)=>s+l.amount,0), margin=sub*S.margin/100, base=sub+margin, iva=base*S.iva/100;
  return {lines,sub,margin,base,iva,total:base+iva,lowML};
}

