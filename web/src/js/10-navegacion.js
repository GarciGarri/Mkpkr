/* ================= navegación ================= */
const VIEWS=['proyectos','captura','estancia','diseno','planos','presupuesto','render'];
function currentView(){const h=location.hash.slice(1);return VIEWS.includes(h)?h:'diseno';}
function route(){
  const v=currentView();
  $$('[data-view]').forEach(s=>s.hidden=s.id!=='v-'+v);
  $$('nav.tabs a').forEach(a=>{if(a.getAttribute('href')==='#'+v){a.setAttribute('aria-current','page');try{a.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){}}else a.removeAttribute('aria-current');});
  $('#btn-projects').setAttribute('aria-current',v==='proyectos'?'page':'false');
  renderAll();
  if(v==='render')three.init();
}
window.addEventListener('hashchange',route);
