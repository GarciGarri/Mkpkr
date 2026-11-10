/* ================= eventos: acabados ================= */
for(const [id,key] of [['#sw-front','front'],['#sw-counter','counter'],['#sw-floor','floor'],['#sw-wall','wall']]) $(id).addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;S.finish[key]=b.dataset.k;renderAll();});
$('#copy-prompt').addEventListener('click',()=>{const t=renderPrompt();navigator.clipboard?.writeText(t).then(()=>toast('Descripción copiada'),()=>{selectText($('#render-prompt'));toast('Selecciona el texto y cópialo');});});
function selectText(el){const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);}

