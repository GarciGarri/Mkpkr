/* ================= arranque ================= */
document.documentElement.lang='es';
geom(); fixRefs(); if(!S.modules.length) autoLayout();
if(!location.hash) history.replaceState(null,'',S.example?'#diseno':'#estancia');
route();
media.load();
window.addEventListener('pagehide',flushSave);
