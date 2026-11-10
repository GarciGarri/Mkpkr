/* ================= render de vistas ================= */
function renderSummary(){
  const g=G, b=budget();
  $('#s-area').textContent=fmt(g.area/1e4,2)+' m²';
  $('#s-perim').textContent=fmt(g.perim/100,2)+' m';
  $('#s-h').textContent=fmt(S.height)+' cm';
  $('#s-counter').textContent=fmt(b.lowML,2)+' ml';
  $('#s-mods').textContent=S.modules.filter(m=>m.type!=='regleta').length;
  $('#s-total').textContent=eur(b.total);
  $('#exflag').hidden=!S.example;
}
function wallOpts(sel){return G.walls.map(w=>`<option value="${w.i}"${w.i===sel?' selected':''}>${L(w.i)}</option>`).join('');}
function renderEstancia(){
  const s=S.shape;
  $('#shape-type').value=s.type; $('#opt-poly').disabled=!s.pts;
  $('#shape-rect').hidden=s.type!=='rect'; $('#shape-L').hidden=s.type!=='L';
  $('#room-h').value=S.height; $('#r-w').value=s.w; $('#r-d').value=s.d; $('#l-W').value=s.W; $('#l-D').value=s.D; $('#l-w2').value=s.w2; $('#l-d2').value=s.d2;
  $('#wall-table').innerHTML=G.walls.map(w=>{const items=[...S.openings.filter(o=>o.wall===w.i).map(o=>OPEN_T[o.type].toLowerCase()),...S.services.filter(x=>x.wall===w.i).map(x=>SERV_T[x.type].n.toLowerCase())];return `<tr><td class="num"><b>${L(w.i)}</b></td><td class="r num">${fmt(w.len)} cm</td><td class="muted">${items.join(', ')||'—'}</td></tr>`;}).join('');
  $('#open-table').innerHTML=S.openings.map(o=>`<tr data-id="${o.id}"><td><select data-k="type">${Object.entries(OPEN_T).map(([k,v])=>`<option value="${k}"${k===o.type?' selected':''}>${v}</option>`).join('')}</select></td><td><select data-k="wall">${wallOpts(o.wall)}</select></td><td class="r"><input type="number" data-k="x" value="${o.x}"></td><td class="r"><input type="number" data-k="w" value="${o.w}"></td><td class="r"><input type="number" data-k="h" value="${o.h}"></td><td class="r"><input type="number" data-k="sill" value="${o.sill}"></td><td><button class="btn sm ghost danger" data-del aria-label="Quitar">Quitar</button></td></tr>`).join('')||`<tr><td colspan="7" class="muted">Sin huecos. Añade la puerta de entrada y las ventanas.</td></tr>`;
  $('#serv-table').innerHTML=S.services.map(o=>`<tr data-id="${o.id}"><td><select data-k="type">${Object.entries(SERV_T).map(([k,v])=>`<option value="${k}"${k===o.type?' selected':''}>${v.n}</option>`).join('')}</select></td><td><select data-k="wall">${wallOpts(o.wall)}</select></td><td class="r"><input type="number" data-k="x" value="${o.x}"></td><td class="r"><input type="number" data-k="h" value="${isFinite(o.h)?o.h:''}" placeholder="—" aria-label="Altura desde el suelo en cm"></td><td><button class="btn sm ghost danger" data-del>Quitar</button></td></tr>`).join('')||`<tr><td colspan="5" class="muted">Sin tomas marcadas.</td></tr>`;
  $('#room-svg').innerHTML=planSVG({mods:false});
  $('#legend').innerHTML=Object.values(SERV_T).map(v=>`<span><i style="background:var(${v.c})"></i>${v.k} · ${v.n}</span>`).join('');
}
function renderDiseno(){
  const D=S.design;
  $('#wallpick').innerHTML=G.walls.map(w=>`<label><input type="checkbox" value="${w.i}"${D.walls.includes(w.i)?' checked':''}> ${L(w.i)} · ${fmt(w.len)}</label>`).join('');
  $('#d-sinkW').value=D.sinkW;$('#d-hobW').value=D.hobW;$('#d-oven').value=D.oven;$('#d-gama').value=D.gama;
  $('#d-fridge').checked=D.fridge;$('#d-dw').checked=D.dw;$('#d-uppers').checked=D.uppers;
  $('#checks').innerHTML=checks().map(([k,t])=>`<li><span class="pill ${k}">${{good:'Bien',warn:'Revisar',bad:'Problema',info:'Nota'}[k]}</span><span>${esc(t)}</span></li>`).join('');
  const typeOpts=(m)=>Object.entries(TYPES).filter(([k,v])=>v.lvl===m.level||v.lvl==='any').map(([k,v])=>`<option value="${k}"${k===m.type?' selected':''}>${v.n}</option>`).join('');
  $('#mod-table').innerHTML=S.modules.map(m=>`<tr data-id="${m.id}"><td class="num"><b>${L(m.wall)}</b></td><td class="muted">${{low:'Bajo',high:'Alto',col:'Columna'}[m.level]}</td><td><select data-k="type">${typeOpts(m)}</select></td><td class="r"><input type="number" data-k="x" value="${m.x}"></td><td class="r"><input type="number" data-k="w" value="${m.w}"></td><td><button class="btn sm ghost danger" data-del>Quitar</button></td></tr>`).join('')||`<tr><td colspan="6" class="muted">Sin módulos. Elige paredes y pulsa «Recalcular distribución».</td></tr>`;
  $('#mod-count').textContent=`${S.modules.length} piezas`+(S.manual?' · editado a mano':'');
  $('#design-svg').innerHTML=planSVG({mods:true,chain:true});
}
function renderPlanos(){
  $('#plan-svg').innerHTML=planSVG({mods:true,chain:true,title:(S.project.name||'Cocina')+' · Planta de montaje · cotas en cm'});
  const ws=[...new Set([...S.design.walls,...S.modules.map(m=>m.wall)])].filter(i=>i<G.n).sort((a,b)=>a-b);
  $('#elevs').innerHTML=ws.map(i=>`<div class="svgbox">${elevSVG(i)}</div>`).join('')||'<p class="muted">Añade muebles en «Diseño» para ver los alzados.</p>';
}
function renderPresupuesto(){
  const b=budget(); let cap='', rows='';
  for(const l of b.lines){ if(l.cap!==cap){cap=l.cap;rows+=`<tr class="cap"><td colspan="6">${esc(cap)}</td></tr>`;}
    rows+=`<tr data-k="${l.k}" class="${l.on?'':'off'}"><td><input type="checkbox" data-on${l.on?' checked':''} aria-label="Incluir ${esc(l.label)}"></td><td>${esc(l.label)}</td><td class="r num">${fmt(l.q,l.unit==='ud'||l.unit==='partida'?0:2)}</td><td class="muted">${l.unit}</td><td class="r"><input type="number" data-price value="${R(l.price)}" step="1" aria-label="Precio de ${esc(l.label)}"></td><td class="r num">${eur(l.amount)}</td></tr>`;}
  $('#bud-table').innerHTML=rows;
  $('#bud-foot').innerHTML=`<tr><td></td><td colspan="4">Suma de partidas</td><td class="r num">${eur(b.sub)}</td></tr><tr><td></td><td colspan="4">Margen ${S.margin} %</td><td class="r num">${eur(b.margin)}</td></tr><tr><td></td><td colspan="4">Base imponible</td><td class="r num">${eur(b.base)}</td></tr><tr><td></td><td colspan="4">IVA ${S.iva} %</td><td class="r num">${eur(b.iva)}</td></tr><tr><td></td><td colspan="4"><b>Total</b></td><td class="r num"><b>${eur(b.total)}</b></td></tr>`;
  $('#b-margin').value=S.margin;$('#b-iva').value=S.iva;
  $('#b-counter').innerHTML=Object.entries(COUNTERS).map(([k,v])=>`<option value="${k}"${k===S.finish.counter?' selected':''}>${v.n}</option>`).join('');
  if(document.activeElement!==$('#memo')) $('#memo').value=S.memo||'';
}
function renderSwatches(){
  const mk=(id,cat,key)=>{$(id).innerHTML=Object.entries(cat).map(([k,v])=>`<button data-k="${k}" aria-pressed="${S.finish[key]===k}"><i style="background:${v.c}"></i>${v.n}</button>`).join('');};
  mk('#sw-front',FRONTS,'front');mk('#sw-counter',COUNTERS,'counter');mk('#sw-floor',FLOORS,'floor');mk('#sw-wall',WALLS,'wall');
  $('#render-prompt').textContent=renderPrompt();
}
function renderPrompt(){
  const g=G,M=S.modules,f=S.finish;const sel=S.design.walls;const shape={1:'lineal',2:'en L',3:'en U'}[sel.length]||'a medida';
  const app=[M.some(m=>m.type==='nevera')&&'frigorífico integrado en columna',M.some(m=>m.type==='horno_col')&&'horno en columna',M.some(m=>m.type==='placa')&&'horno bajo la placa',M.some(m=>m.type==='lavavajillas')&&'lavavajillas integrado'].filter(Boolean).join(', ');
  const hasWin=S.openings.some(o=>o.type==='ventana'&&sel.includes(o.wall));
  return `Fotografía de interiorismo de una cocina ${shape} en un piso español de ${fmt(g.area/1e4,1)} m² y ${S.height} cm de altura. Muebles con frentes lisos en ${FRONTS[f.front].n.toLowerCase()} y tiradores finos de acero, encimera de ${COUNTERS[f.counter].n.toLowerCase()} de 3 cm, ${S.design.uppers?'muebles altos hasta 215 cm':'sin muebles altos, con estantes abiertos'}, placa de inducción de ${S.design.hobW} cm con campana decorativa, fregadero de ${S.design.sinkW} cm${hasWin?' bajo la ventana':''}${app?', '+app:''}. Suelo de ${FLOORS[f.floor].n.toLowerCase()} y paredes en ${WALLS[f.wall].n.toLowerCase()}. Luz natural suave${hasWin?' entrando por la ventana':''}, tira LED bajo los altos, cámara a 1,5 m de altura con objetivo de 24 mm, encuadre como en la imagen de referencia, realista, sin personas.`;
}
function renderAll(){
  geom(); renderSummary();
  $('#pname').value=S.project.name||''; if(document.activeElement!==$('#notes')) $('#notes').value=S.notes||'';
  const v=currentView();
  if(v==='estancia') renderEstancia(); if(v==='diseno') renderDiseno(); if(v==='planos') renderPlanos(); if(v==='presupuesto') renderPresupuesto();
  if(v==='render'){renderSwatches();three.rebuild();}
  if(v==='captura') renderFindings();
  save();
}
function changed({relayout=false}={}){ if(relayout&&!S.manual) autoLayout(); renderAll(); }

