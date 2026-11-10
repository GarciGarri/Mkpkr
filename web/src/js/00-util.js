/* ================= utilidades ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const R=Math.round;
const fmt=(n,d=0)=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const eur=n=>Number(n).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const L=i=>String.fromCharCode(65+i);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let toastT=0;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200);}

