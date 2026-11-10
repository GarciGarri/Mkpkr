/* ================= eventos: estancia ================= */
$('#shape-type').addEventListener('change',e=>{S.shape.type=e.target.value;fixRefs();changed({relayout:true});});
$('#room-h').addEventListener('change',e=>{S.height=clamp(+e.target.value||250,200,400);changed();});
for(const [id,k] of [['#r-w','w'],['#r-d','d'],['#l-W','W'],['#l-D','D'],['#l-w2','w2'],['#l-d2','d2']]) $(id).addEventListener('change',e=>{S.shape[k]=Math.max(30,+e.target.value||0);if(S.shape.type==='L'){S.shape.w2=Math.min(S.shape.w2,S.shape.W-60);S.shape.d2=Math.min(S.shape.d2,S.shape.D-60);}changed({relayout:true});});
function fixRefs(){geom();const n=G.n;S.openings.forEach(o=>{if(o.wall>=n)o.wall=0;});S.services.forEach(o=>{if(o.wall>=n)o.wall=0;});S.design.walls=S.design.walls.filter(i=>i<n);if(!S.design.walls.length)S.design.walls=[0];}
function bindRowTable(sel,list){
  $(sel).addEventListener('change',e=>{const tr=e.target.closest('tr[data-id]');if(!tr)return;const it=S[list].find(x=>x.id===tr.dataset.id);const k=e.target.dataset.k;if(!it||!k)return;it[k]=(k==='type')?e.target.value:(e.target.value===''?undefined:+e.target.value);changed({relayout:true});});
  $(sel).addEventListener('click',e=>{if(!e.target.matches('[data-del]'))return;const tr=e.target.closest('tr[data-id]');S[list]=S[list].filter(x=>x.id!==tr.dataset.id);changed({relayout:true});});
}
bindRowTable('#open-table','openings');bindRowTable('#serv-table','services');
$('#add-open').addEventListener('click',()=>{S.openings.push({id:uid(),type:'ventana',wall:0,x:50,w:100,h:120,sill:100});changed({relayout:true});});
$('#add-serv').addEventListener('click',()=>{S.services.push({id:uid(),type:'agua',wall:S.design.walls[0]??0,x:100});changed({relayout:true});});

