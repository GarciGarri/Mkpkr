/* ================= eventos: diseño ================= */
$('#wallpick').addEventListener('change',()=>{S.design.walls=$$('#wallpick input:checked').map(i=>+i.value);S.manual=false;changed({relayout:true});});
$('#layout-presets').addEventListener('click',e=>{const p=e.target.dataset.preset;if(!p)return;geom();
  const longest=[...G.walls].sort((a,b)=>b.len-a.len)[0].i, n=G.n;
  const nx=k=>(longest+k)%n;
  S.design.walls=p==='lineal'?[longest]:p==='L'?[longest,nx(1)]:p==='U'?[nx(-1+n),longest,nx(1)]:[longest,(longest+Math.floor(n/2))%n];
  S.manual=false;changed({relayout:true});});
for(const [id,k,num] of [['#d-sinkW','sinkW',1],['#d-hobW','hobW',1],['#d-oven','oven',0],['#d-gama','gama',0]]) $(id).addEventListener('change',e=>{S.design[k]=num?+e.target.value:e.target.value;if(k!=='gama')S.manual=false;changed({relayout:k!=='gama'});});
for(const [id,k] of [['#d-fridge','fridge'],['#d-dw','dw'],['#d-uppers','uppers']]) $(id).addEventListener('change',e=>{S.design[k]=e.target.checked;S.manual=false;changed({relayout:true});});
$('#d-auto').addEventListener('click',()=>{S.manual=false;autoLayout();renderAll();toast('Distribución recalculada');});
$('#mod-table').addEventListener('change',e=>{const tr=e.target.closest('tr[data-id]');const m=S.modules.find(x=>x.id===tr?.dataset.id);if(!m)return;const k=e.target.dataset.k;m[k]=k==='type'?e.target.value:Math.max(0,+e.target.value);S.manual=true;renderAll();});
$('#mod-table').addEventListener('click',e=>{if(!e.target.matches('[data-del]'))return;const tr=e.target.closest('tr[data-id]');S.modules=S.modules.filter(m=>m.id!==tr.dataset.id);S.manual=true;renderAll();});

