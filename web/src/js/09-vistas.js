/* ================= render de vistas ================= */
// Todo valor que acaba en HTML pasa por esc() o por nv() (números): nada del proyecto se inserta sin escapar.
const nv=v=>String(+v===+v?r1(+v):0);
let CHECKS=[];
let BV=(()=>{try{return localStorage.getItem('mkpkr-cocinas-bv')==='internal'?'internal':'client';}catch(e){return 'client';}})();
function renderSummary(){
  const g=G, b=budget();
  $('#s-area').textContent=fmt(g.area/1e4,2)+' m²';
  $('#s-perim').textContent=fmt(g.perim/100,2)+' m';
  $('#s-h').textContent=fmt(S.height)+' cm';
  $('#s-counter').textContent=fmt(b.lowML,2)+' ml';
  $('#s-mods').textContent=S.modules.filter(m=>!NO_MUEBLE.has(m.type)).length;
  $('#s-total').textContent=eur(b.total);
  $('#exflag').hidden=!S.example;
  $('#btn-undo').disabled=!UNDO.length;
  for(const [k,scope] of [['diseno','diseno'],['estancia','estancia']]){
    const bad=CHECKS.filter(c=>c[0]==='bad'&&(scope==='diseno'||c[2]==='estancia')).length, warn=CHECKS.filter(c=>c[0]==='warn'&&(scope==='diseno'||c[2]==='estancia')).length;
    const el=$(`[data-badge="${k}"]`);el.hidden=!(bad||warn);el.textContent=bad||warn;el.classList.toggle('warn',!bad);
    el.setAttribute('aria-label',bad?`${bad} problema${bad>1?'s':''}`:`${warn} aviso${warn>1?'s':''}`);
  }
}
const checkLi=([k,t])=>`<li><span class="pill ${k}">${{good:'Bien',warn:'Revisar',bad:'Problema',info:'Nota'}[k]}</span><span>${esc(t)}</span></li>`;
function wallOpts(sel,skipOpen){return G.walls.filter(w=>!skipOpen||!w.open).map(w=>`<option value="${w.i}"${w.i===sel?' selected':''}>${L(w.i)}</option>`).join('');}
function openingIssues(o){
  const w=G.walls[o.wall],bad=new Set();if(!w)return bad;
  if(o.x<-0.5)bad.add('x');if(o.x+o.w>w.len+0.5){bad.add('x');bad.add('w');}
  if(o.sill+o.h>S.height+0.5){bad.add('h');bad.add('sill');}
  for(const p of S.openings)if(p!==o&&p.wall===o.wall&&o.x<p.x+p.w-0.5&&p.x<o.x+o.w-0.5&&o.sill<p.sill+p.h&&p.sill<o.sill+o.h){bad.add('x');bad.add('w');}
  return bad;
}
function renderEstancia(){
  const s=S.shape, poly=s.type==='poly';
  $('#shape-type').value=s.type; $('#opt-poly').disabled=!s.pts;
  $('#shape-rect').hidden=s.type!=='rect'; $('#shape-L').hidden=s.type!=='L'; $('#laser-hint').hidden=!poly;
  $$('#v-estancia [data-poly]').forEach(e=>e.hidden=!poly);
  $('#room-h').value=S.height; $('#r-w').value=s.w; $('#r-d').value=s.d; $('#l-W').value=s.W; $('#l-D').value=s.D; $('#l-w2').value=s.w2; $('#l-d2').value=s.d2;
  $('#wall-table').innerHTML=G.walls.map(w=>{
    const items=[...S.openings.filter(o=>o.wall===w.i).map(o=>OPEN_T[o.type].toLowerCase()),...S.services.filter(x=>x.wall===w.i).map(x=>SERV_T[x.type].n.toLowerCase())];
    const real=s.real?.[w.i];
    const cells=poly?`<td class="r"><input type="number" step="0.5" min="10" data-real="${w.i}" value="${real>0?nv(real):''}" placeholder="—" aria-label="Medida láser de la pared ${L(w.i)} en cm"${w.residual&&Math.abs(w.residual)>=1?' aria-invalid="true"':''}></td><td><input type="checkbox" data-open="${w.i}"${w.open?' checked':''} aria-label="La pared ${L(w.i)} es un lado abierto"></td>`:'';
    return `<tr><td class="num"><b>${L(w.i)}</b> ${poly&&real>0?'<span class="tag">láser</span>':''}</td><td class="r num">${w.open?'<span class="tag muted">abierto</span> ':''}${fmt(w.len,Math.abs(w.len-R(w.len))>=0.05?1:0)} cm</td>${cells}<td class="muted">${esc(items.join(', ')||'—')}</td></tr>`;}).join('');
  const lab=(what,o)=>`${what} de ${OPEN_T[o.type].toLowerCase()} en la pared ${L(o.wall)}`;
  $('#open-table').innerHTML=S.openings.map(o=>{const bad=openingIssues(o),inv=k=>bad.has(k)?' aria-invalid="true"':'';
    return `<tr data-id="${esc(o.id)}"><td><select data-k="type" aria-label="Tipo de hueco">${Object.entries(OPEN_T).map(([k,v])=>`<option value="${k}"${k===o.type?' selected':''}>${v}</option>`).join('')}</select></td><td><select data-k="wall" aria-label="Pared del hueco">${wallOpts(o.wall)}</select></td><td class="r"><input type="number" step="0.5" data-k="x" value="${nv(o.x)}" aria-label="${lab('Distancia desde el inicio',o)}"${inv('x')}></td><td class="r"><input type="number" step="0.5" data-k="w" value="${nv(o.w)}" aria-label="${lab('Ancho',o)}"${inv('w')}></td><td class="r"><input type="number" step="0.5" data-k="h" value="${nv(o.h)}" aria-label="${lab('Alto',o)}"${inv('h')}></td><td class="r"><input type="number" step="0.5" data-k="sill" value="${nv(o.sill)}" aria-label="${lab('Antepecho',o)}"${inv('sill')}></td><td><button class="btn sm ghost danger" data-del aria-label="Quitar ${lab('hueco',o)}">Quitar</button></td></tr>`;}).join('')||`<tr><td colspan="7" class="muted">Sin huecos. Añade la puerta de entrada y las ventanas.</td></tr>`;
  $('#open-issues').innerHTML=CHECKS.filter(c=>c[2]==='estancia').map(checkLi).join('');
  $('#serv-table').innerHTML=S.services.map(o=>`<tr data-id="${esc(o.id)}"><td><select data-k="type" aria-label="Tipo de toma">${Object.entries(SERV_T).map(([k,v])=>`<option value="${k}"${k===o.type?' selected':''}>${v.n}</option>`).join('')}</select></td><td><select data-k="wall" aria-label="Pared de la toma">${wallOpts(o.wall,true)}</select></td><td class="r"><input type="number" step="0.5" data-k="x" value="${nv(o.x)}" aria-label="Distancia de la toma desde el inicio de la pared"></td><td class="r"><input type="number" step="1" data-k="h" value="${Number.isFinite(o.h)?nv(o.h):''}" placeholder="—" aria-label="Altura de la toma desde el suelo en cm"></td><td><button class="btn sm ghost danger" data-del aria-label="Quitar ${esc(SERV_T[o.type].n.toLowerCase())}">Quitar</button></td></tr>`).join('')||`<tr><td colspan="5" class="muted">Sin tomas marcadas.</td></tr>`;
  $('#room-svg').innerHTML=planSVG({mods:false});
  $('#legend').innerHTML=Object.values(SERV_T).map(v=>`<span><i style="background:var(${v.c})"></i>${v.k} · ${v.n}</span>`).join('');
}
function typeOptions(level,sel){return Object.entries(TYPES).filter(([k,v])=>v.lvl===level||v.lvl==='any').map(([k,v])=>`<option value="${k}"${k===sel?' selected':''}>${v.n}</option>`).join('');}
function renderDiseno(){
  const D=S.design;
  $('#wallpick').innerHTML=G.walls.map(w=>`<label${w.open?' class="muted"':''}><input type="checkbox" value="${w.i}"${D.walls.includes(w.i)?' checked':''}${w.open?' disabled':''}> ${L(w.i)} · ${fmt(w.len)}${w.open?' (abierto)':''}</label>`).join('');
  $('#d-sinkW').value=D.sinkW;$('#d-hobW').value=D.hobW;$('#d-oven').value=D.oven;$('#d-gama').value=D.gama;
  $('#d-fridge').checked=D.fridge;$('#d-dw').checked=D.dw;$('#d-uppers').checked=D.uppers;
  const all=$('#chk-all').checked, list=all?CHECKS:CHECKS.filter(c=>c[0]!=='good');
  $('#checks').innerHTML=list.map(checkLi).join('')||'<li><span class="pill good">Bien</span><span>Sin problemas ni avisos.</span></li>';
  $('#mod-table').innerHTML=S.modules.map(m=>`<tr data-id="${esc(m.id)}"><td class="num"><b>${L(m.wall)}</b></td><td class="muted">${LVL_T[m.level]}</td><td><select data-k="type" aria-label="Tipo de módulo">${typeOptions(m.level,m.type)}</select></td><td class="r"><input type="number" step="0.5" data-k="x" value="${nv(m.x)}" aria-label="Distancia del módulo desde el inicio de la pared ${L(m.wall)}"></td><td class="r"><input type="number" step="0.5" data-k="w" value="${nv(m.w)}" aria-label="Ancho del módulo"></td><td><button class="lockbtn" data-lock aria-pressed="${m.lock}" aria-label="${m.lock?'Desbloquear':'Bloquear'} módulo">${m.lock?'🔒':'🔓'}</button></td><td><button class="btn sm ghost danger" data-del aria-label="Quitar módulo">Quitar</button></td></tr>`).join('')||`<tr><td colspan="7" class="muted">Sin módulos. Elige paredes y pulsa «Recalcular distribución».</td></tr>`;
  const nl=S.modules.filter(m=>m.lock).length;
  $('#mod-count').textContent=`${S.modules.length} piezas`+(nl?` · ${nl} bloqueada${nl>1?'s':''}`:'');
  $('#lock-note').textContent=nl?`Recalcular respeta ${nl} módulo${nl>1?'s':''} bloqueado${nl>1?'s':''}.`:'';
  $('#d-unlock').hidden=!nl;
  const aw=$('#am-wall'),cur=aw.value;aw.innerHTML=wallOpts(+cur||D.walls[0]||0,true);
  if(!$('#am-type').options.length)$('#am-type').innerHTML=typeOptions($('#am-level').value,'base');
  $('#design-svg').innerHTML=planSVG({mods:true,chain:true});
}
function renderPlanos(){
  $('#plan-svg').innerHTML=planSVG({mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta de montaje · cotas en cm'});
  const ws=[...new Set([...S.design.walls,...S.modules.map(m=>m.wall)])].filter(i=>i<G.n&&!G.walls[i].open).sort((a,b)=>a-b);
  $('#elevs').innerHTML=ws.map(i=>`<div class="svgbox">${elevSVG(i)}</div>`).join('')||'<p class="muted">Añade muebles en «Diseño» para ver los alzados.</p>';
}
function renderPresupuesto(){
  const b=budget(), internal=BV==='internal';
  $('#bv-client').setAttribute('aria-pressed',!internal);$('#bv-internal').setAttribute('aria-pressed',internal);
  $('#bud-hint').textContent=internal
    ?'Vista interna: precios de coste (tarifa orientativa de mercado en España, 2026, gama media) que puedes cambiar. El precio al cliente (PVP) lleva tu margen. Esta vista no se entrega al cliente.'
    :'Vista del cliente: así aparece en el PDF y en el CSV del cliente, con el margen incluido en cada precio.';
  $('#extra-row').hidden=!internal;
  $('#bud-head').innerHTML=internal?'<tr><th><span class="sr">Incluir</span></th><th>Partida</th><th class="r">Cant.</th><th>Ud.</th><th class="r">Coste</th><th class="r">PVP</th><th class="r">Importe</th></tr>':'<tr><th>Partida</th><th class="r">Cant.</th><th>Ud.</th><th class="r">Precio</th><th class="r">Importe</th></tr>';
  let cap='', rows='';
  for(const l of b.lines){ if(!internal&&!l.on)continue;
    if(l.cap!==cap){cap=l.cap;rows+=`<tr class="cap"><td colspan="${internal?7:5}">${esc(cap)}</td></tr>`;}
    const q=fmt(l.q,l.unit==='ud'||l.unit==='partida'?(l.q%1?2:0):2);
    if(!internal){rows+=`<tr><td>${esc(l.label)}</td><td class="r num">${q}</td><td class="muted">${esc(l.unit)}</td><td class="r num">${eur(l.cp)}</td><td class="r num">${eur(l.amount)}</td></tr>`;continue;}
    if(l.extra){rows+=`<tr data-x="${esc(l.id)}"><td><button class="btn sm ghost danger" data-xdel aria-label="Quitar partida">✕</button></td><td><input type="text" data-f="label" value="${esc(l.label)}" maxlength="160" aria-label="Concepto"></td><td class="r"><input type="number" step="0.01" data-f="q" value="${nv(l.q)}" aria-label="Cantidad"></td><td><input type="text" data-f="unit" value="${esc(l.unit)}" maxlength="12" style="width:56px" aria-label="Unidad"></td><td class="r"><input type="number" step="0.01" data-f="price" value="${nv(l.price)}" aria-label="Coste unitario"></td><td class="r num">${eur(l.cp)}</td><td class="r num">${eur(l.amount)}</td></tr>`;continue;}
    rows+=`<tr data-k="${esc(l.k)}" class="${l.on?'':'off'}"><td><input type="checkbox" data-on${l.on?' checked':''} aria-label="Incluir ${esc(l.label)}"></td><td>${esc(l.label)}${l.manual?` <button class="btn sm ghost" data-reset title="Volver al precio de tarifa (${eur(l.def)})">precio propio · restablecer</button>`:''}</td><td class="r num">${q}</td><td class="muted">${esc(l.unit)}</td><td class="r"><input type="number" data-price value="${nv(l.price)}" step="0.01" min="0" aria-label="Coste de ${esc(l.label)}"></td><td class="r num">${eur(l.cp)}</td><td class="r num">${eur(l.amount)}</td></tr>`;
  }
  $('#bud-table').innerHTML=rows;
  const fr=(t,v,strong)=>internal?`<tr><td></td><td colspan="5">${strong?'<b>'+t+'</b>':t}</td><td class="r num">${strong?'<b>'+v+'</b>':v}</td></tr>`:`<tr><td colspan="4">${strong?'<b>'+t+'</b>':t}</td><td class="r num">${strong?'<b>'+v+'</b>':v}</td></tr>`;
  $('#bud-foot').innerHTML=(internal?fr('Coste total',eur(b.cost)):'')+fr('Suma de partidas',eur(b.sub))+(b.discount?fr(`Descuento ${fmt(S.discount,S.discount%1?1:0)} %`,'−'+eur(b.discount)):'')+fr('Base imponible',eur(b.base))
    +(internal?fr(`Beneficio bruto (${b.base?fmt(b.profit/b.base*100,1):'0'} % de la base)`,eur(b.profit)):'')+fr(`IVA ${fmt(S.iva,S.iva%1?1:0)} %`,eur(b.iva))+fr('Total',eur(b.total),true);
  $('#b-margin').value=S.margin;$('#b-disc').value=S.discount;$('#b-iva').value=S.iva;
  $('#b-counter').innerHTML=Object.entries(COUNTERS).map(([k,v])=>`<option value="${k}"${k===S.finish.counter?' selected':''}>${v.n}</option>`).join('');
  for(const el of $$('[data-client]')) if(document.activeElement!==el) el.value=S.client[el.dataset.client]||'';
  if(document.activeElement!==$('#q-number'))$('#q-number').value=S.quote.number;
  $('#q-date').value=S.quote.date;$('#q-valid').value=S.quote.validDays;
  const c=company(); for(const el of $$('[data-emp]')) if(document.activeElement!==el) el.value=c[el.dataset.emp]||'';
  if(document.activeElement!==$('#memo')) $('#memo').value=S.memo||'';
}
function renderProjects(){
  const q=($('#p-search').value||'').toLowerCase();
  const list=listProjects().filter(p=>!q||(p.name+' '+p.client).toLowerCase().includes(q));
  $('#p-table').innerHTML=list.map(p=>`<tr data-p="${esc(p.id)}"${p.id===S.id?' class="current"':''}><td><span class="plist-name">${esc(p.name)}</span>${p.example?' <span class="tag muted">ejemplo</span>':''}${p.id===S.id?' <span class="tag">abierto</span>':''}</td><td>${esc(p.client||'—')}</td><td class="num">${p.updated?new Date(p.updated).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):''}</td><td class="r num">${Number.isFinite(p.total)?eur(p.total):'—'}</td><td><div class="plist-actions"><button class="btn sm" data-act="open">Abrir</button><button class="btn sm ghost" data-act="dup">Duplicar</button><button class="btn sm ghost danger" data-act="del">Borrar</button></div></td></tr>`).join('')
    ||`<tr><td colspan="5" class="muted">${q?'Ningún proyecto coincide con la búsqueda.':'Aún no hay proyectos guardados.'}</td></tr>`;
}
function renderSwatches(){
  const mk=(id,cat,key)=>{$(id).innerHTML=Object.entries(cat).map(([k,v])=>`<button data-k="${k}" aria-pressed="${S.finish[key]===k}"><i style="background:${v.c}"></i>${v.n}</button>`).join('');};
  mk('#sw-front',FRONTS,'front');mk('#sw-counter',COUNTERS,'counter');mk('#sw-floor',FLOORS,'floor');mk('#sw-wall',WALLS,'wall');
  $('#render-prompt').textContent=renderPrompt();
  $('#video-prompts').innerHTML=videoPrompts().map((v,i)=>`<div><h3>${esc(v.t)}</h3><div class="ai-out" id="vp-${i}">${esc(v.d)}</div><div class="row"><button class="btn sm" data-vp="${i}">Copiar</button></div></div>`).join('');
}
function videoPrompts(){
  const f=S.finish,sel=S.design.walls,shape={1:'lineal',2:'en L',3:'en U'}[sel.length]||'a medida';
  const fr=frontTxt(f.front),co=COUNTERS[f.counter].n.toLowerCase(),fl=FLOORS[f.floor].n.toLowerCase(),wa=WALLS[f.wall].n.toLowerCase();
  const k=`una cocina ${shape} con frentes lisos en ${fr}, encimera de ${co}, suelo de ${fl} y paredes en ${wa}`;
  const base='Vídeo vertical 9:16, realista, sin texto generado en pantalla.';
  return [
    {t:'Antes y después',d:`${base} Una cocina antigua de madera oscura, azulejos anticuados y luz fluorescente fría se transforma con una transición lateral suave en ${k}, con luz cálida bajo los muebles altos. Cámara fija a la altura de la encimera, sin personas.`},
    {t:'Recorrido de la cocina terminada',d:`${base} Travelling lento de izquierda a derecha por ${k}. Luz natural de mañana, ambiente limpio y ordenado, estilo revista de interiorismo, sin personas.`},
    {t:'Del plano a la cocina',d:`${base} Vista cenital: las líneas de las paredes de una cocina ${shape} de ${fmt(G.area/1e4,1)} m² se dibujan con trazo fino sobre fondo blanco, los muebles aparecen en 3D y la cámara baja en picado hasta mostrar ${k}. Animación fluida, sin personas.`},
    {t:'Detalle de la encimera',d:`${base} Primer plano de una encimera de ${co}; una gota de agua resbala por la superficie y la cámara la sigue despacio hasta el fregadero. Luz de estudio suave, fondo desenfocado, sin personas.`},
    {t:'Detalle de los frentes',d:`${base} Una mano abre y cierra con suavidad un cajón con frente liso en ${fr} y tirador fino de acero, con cierre amortiguado. Plano medio con luz lateral de ventana.`},
    {t:'Medición con láser y escaneo',d:`${base} Un profesional con ropa de trabajo apunta con un móvil a la pared de una cocina vacía; aparecen líneas de medida flotantes sobre las paredes. Travelling lento, luz natural de día, persona genérica sin rostro reconocible.`},
    {t:'Llamada a la acción',d:`${base} Fondo con la textura de ${co} y un degradado suave en ${fr}. Animación lenta de 6 segundos con iconos minimalistas de regla, plano y llave, y espacio libre en el centro para añadir el texto de la oferta en el editor.`}
  ];
}
function renderPrompt(){
  const g=G,M=S.modules,f=S.finish;const sel=S.design.walls;const shape={1:'lineal',2:'en L',3:'en U'}[sel.length]||'a medida';
  const app=[M.some(m=>m.type==='nevera')&&'frigorífico integrado en columna',M.some(m=>m.type==='horno_col')&&'horno en columna',M.some(m=>m.type==='placa')&&'horno bajo la placa',M.some(m=>m.type==='lavavajillas')&&'lavavajillas integrado'].filter(Boolean).join(', ');
  const hasWin=S.openings.some(o=>o.type==='ventana'&&sel.includes(o.wall));
  return `Fotografía de interiorismo de una cocina ${shape} en un piso español de ${fmt(g.area/1e4,1)} m² y ${S.height} cm de altura. Muebles con frentes lisos en ${frontTxt(f.front)} y tiradores finos de acero, encimera de ${COUNTERS[f.counter].n.toLowerCase()} de 3 cm, ${S.design.uppers?'muebles altos hasta 215 cm':'sin muebles altos, con estantes abiertos'}, placa de inducción de ${S.design.hobW} cm con campana decorativa, fregadero de ${S.design.sinkW} cm${hasWin?' bajo la ventana':''}${app?', '+app:''}. Suelo de ${FLOORS[f.floor].n.toLowerCase()} y paredes en ${WALLS[f.wall].n.toLowerCase()}. Luz natural suave${hasWin?' entrando por la ventana':''}, tira LED bajo los altos, cámara a 1,5 m de altura con objetivo de 24 mm, encuadre como en la imagen de referencia, realista, sin personas.`;
}
function renderAll(){
  geom(); CHECKS=checks(); renderSummary();
  if(document.activeElement!==$('#pname'))$('#pname').value=S.project.name||''; if(document.activeElement!==$('#notes')) $('#notes').value=S.notes||'';
  const v=currentView();
  if(v==='estancia') renderEstancia(); if(v==='diseno') renderDiseno(); if(v==='planos') renderPlanos(); if(v==='presupuesto') renderPresupuesto();
  if(v==='proyectos') renderProjects();
  if(v==='render'){renderSwatches();three.rebuild();}
  if(v==='captura') renderFindings();
  save();
}
function changed({relayout=false}={}){ if(relayout) autoLayout(); renderAll(); }
