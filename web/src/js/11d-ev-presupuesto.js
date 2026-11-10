/* ================= eventos: presupuesto ================= */
$('#bud-table').addEventListener('change',e=>{const tr=e.target.closest('tr[data-k]');if(!tr)return;const k=tr.dataset.k;
  if(e.target.matches('[data-on]')){if(e.target.checked)delete S.off[k];else S.off[k]=true;}
  if(e.target.matches('[data-price]')){const key=k==='encimera'?'encimera_'+S.finish.counter:k;S.prices[key]=Math.max(0,+e.target.value);}
  renderAll();});
$('#b-margin').addEventListener('change',e=>{S.margin=Math.max(0,+e.target.value);renderAll();});
$('#b-iva').addEventListener('change',e=>{S.iva=Math.max(0,+e.target.value);renderAll();});
$('#b-counter').addEventListener('change',e=>{S.finish.counter=e.target.value;renderAll();});
$('#memo').addEventListener('input',e=>{S.memo=e.target.value;save();});

