/* ================= Claude ================= */
let sampleP=null;
(async()=>{try{if(window.claude&&claude.use){sampleP=await claude.use('sample');}}catch(e){sampleP=null;}
  updateAiBtn(); $('#ai-memo').disabled=!sampleP; if(!sampleP){$('#ai-memo-msg').textContent='Claude no está disponible en esta vista.';}})();
let imgLimits=null;
async function updateAiBtn(){
  const b=$('#ai-frames'), m=$('#ai-frames-msg');
  if(!sampleP){b.disabled=true;m.textContent=frames.length?'Claude no está disponible en esta vista.':'';return;}
  if(!imgLimits){try{imgLimits=(await sampleP.limits()).images||false;}catch(e){imgLimits=false;}}
  const n=frames.filter(f=>f.sel).length;
  if(!imgLimits){b.disabled=true;m.textContent='Esta vista no puede enviar imágenes a Claude.';return;}
  b.disabled=!n; m.textContent=n?`${Math.min(n,imgLimits.maxCount)} fotograma${n>1?'s':''} seleccionado${n>1?'s':''}`:'Sube un vídeo o fotos para analizarlos.';
}
$('#ai-frames').addEventListener('click',async()=>{
  const sel=frames.filter(f=>f.sel).slice(0,imgLimits?.maxCount||4);if(!sel.length)return;
  const b=$('#ai-frames'),m=$('#ai-frames-msg');b.disabled=true;m.textContent='Analizando…';
  const ctx=`Estancia: ${G.walls.map(w=>`pared ${L(w.i)} ${R(w.len)} cm`).join(', ')}; altura ${S.height} cm. Medidas tomadas sobre las fotos: ${frames.flatMap(f=>f.meas.map(x=>R(x.cm)+' cm')).join(', ')||'ninguna'}.`;
  const prompt=`Eres un técnico de reformas de cocinas en España. Analiza estos fotogramas de la visita a una cocina antes de la reforma. ${ctx}
Identifica lo que importa para diseñar y presupuestar la cocina nueva: tomas de agua y desagüe, gas, salida de humos, enchufes y cuadro, radiadores, caldera, pilares, bajantes, ventanas y puertas (con su posición aproximada), estado de paredes, suelo y techo, y cualquier cosa que deba comprobarse en obra. No inventes medidas: si estimas alguna, dilo y da un rango.
Responde SOLO con JSON con esta forma:
{"resumen":"2-3 frases","elementos":[{"tipo":"toma_agua|desague|gas|salida_humos|enchufe|ventana|puerta|radiador|caldera|pilar|bajante|otro","descripcion":"dónde está y cómo es","medida":"estimación con rango o vacío","confianza":"alta|media|baja"}],"estado":"estado general de la estancia","recomendaciones":["..."],"comprobar":["qué medir o revisar en la visita"]}`;
  try{
    const r=await sampleP.json(prompt,{images:sel.map(f=>f.blob),modelTier:'default'});
    S.findings=[r,...(S.findings||[])].slice(0,5);save();renderFindings();m.textContent='Análisis listo.';
  }catch(e){m.textContent=e?.code==='not_granted'?'Sin permiso para usar Claude.':e?.code==='rate_limited'?'Demasiadas peticiones; prueba en un minuto.':'No se ha podido analizar: '+(e?.message||e);}
  b.disabled=false;
});
function renderFindings(){
  const r=(S.findings||[])[0];const el=$('#findings');if(!r){el.innerHTML='';return;}
  const T={toma_agua:'Agua',desague:'Desagüe',gas:'Gas',salida_humos:'Humos',enchufe:'Enchufe',ventana:'Ventana',puerta:'Puerta',radiador:'Radiador',caldera:'Caldera',pilar:'Pilar',bajante:'Bajante',otro:'Otro'};
  el.innerHTML=`<h3>Lo que ve Claude</h3><p class="small">${esc(r.resumen||'')}</p>`+(r.elementos||[]).map(x=>`<div class="finding"><b>${esc(T[x.tipo]||x.tipo)}</b><span>${esc(x.descripcion)}${x.medida?` <span class="num muted">· ${esc(x.medida)}</span>`:''} <span class="pill ${x.confianza==='alta'?'good':x.confianza==='media'?'warn':'bad'}">${esc(x.confianza||'')}</span></span></div>`).join('')
   +(r.estado?`<p class="small"><b>Estado:</b> ${esc(r.estado)}</p>`:'')
   +((r.comprobar||[]).length?`<p class="small"><b>Comprobar en obra:</b> ${esc(r.comprobar.join(' · '))}</p>`:'')
   +`<div class="row"><button class="btn sm" id="find-notes">Pasar a notas de obra</button></div>`;
  $('#find-notes').onclick=()=>{S.notes=(S.notes?S.notes+'\n\n':'')+'Análisis de la visita (Claude): '+(r.resumen||'')+'\n'+(r.elementos||[]).map(x=>`- ${T[x.tipo]||x.tipo}: ${x.descripcion}${x.medida?' ('+x.medida+')':''}`).join('\n')+((r.comprobar||[]).length?'\nComprobar: '+r.comprobar.join('; '):'');$('#notes').value=S.notes;save();toast('Añadido a notas de obra');};
}
$('#ai-memo').addEventListener('click',async()=>{
  if(!sampleP)return;const b=budget();const btn=$('#ai-memo'),msg=$('#ai-memo-msg');btn.disabled=true;msg.textContent='Redactando…';
  const mods=S.modules.filter(m=>m.type!=='regleta').map(m=>`pared ${L(m.wall)}: ${TYPES[m.type].n} ${m.w} cm`).join('; ');
  const prompt=`Redacta en español de España la memoria de una propuesta de reforma de cocina para el cliente final, en texto plano (sin markdown, sin asteriscos), 250-350 palabras, tono profesional y cercano. Secciones con título en mayúsculas: LA PROPUESTA, DISTRIBUCIÓN, MATERIALES Y ELECTRODOMÉSTICOS, TRABAJOS INCLUIDOS, PRESUPUESTO, CONDICIONES. No inventes datos que no estén aquí; en condiciones indica que las medidas se confirman en obra antes de fabricar y que el presupuesto es válido 30 días.
Proyecto: ${S.project.name||'sin nombre'}.
Estancia: ${fmt(G.area/1e4,2)} m², altura ${S.height} cm, paredes ${G.walls.map(w=>L(w.i)+' '+R(w.len)+' cm').join(', ')}.
Distribución en paredes ${S.design.walls.map(L).join(', ')}; módulos: ${mods}.
Acabados: frentes ${FRONTS[S.finish.front].n}, encimera ${COUNTERS[S.finish.counter].n}, gama ${GAMA[S.design.gama].n}.
Notas de obra: ${(S.notes||'').slice(0,1500)}
Partidas incluidas: ${b.lines.filter(l=>l.on).map(l=>`${l.label} ${fmt(l.q,2)} ${l.unit} = ${R(l.amount)} €`).join('; ')}.
Base imponible ${R(b.base)} €, IVA ${S.iva}% ${R(b.iva)} €, total ${R(b.total)} €.`;
  try{const r=await sampleP(prompt,{onText:({text})=>{$('#memo').value=text;},modelTier:'default'});S.memo=r.text;$('#memo').value=r.text;save();msg.textContent='Memoria lista. Puedes editarla.';}
  catch(e){msg.textContent=e?.code==='not_granted'?'Sin permiso para usar Claude.':'No se ha podido redactar: '+(e?.message||e);}
  btn.disabled=false;
});

