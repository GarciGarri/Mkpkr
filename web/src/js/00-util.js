/* ================= utilidades ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const R=Math.round;
const r1=v=>Math.round(v*10)/10, r2=v=>Math.round((v+Number.EPSILON)*100)/100;
const fmt=(n,d=0)=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
// Importes siempre con céntimos y separador de miles, sin depender del navegador.
function eur(n){const v=r2(Number(n)||0);const [i,d]=Math.abs(v).toFixed(2).split('.');return (v<0?'−':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+d+' €';}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const L=i=>String.fromCharCode(65+i);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Conversión segura de datos externos
const num=(v,def=0,min=-Infinity,max=Infinity)=>{const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?Number(v):NaN);return Number.isFinite(n)?clamp(n,min,max):def;};
const str=(v,max=200)=>typeof v==='string'?v.slice(0,max):'';
const okId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,24}$/.test(v)?v:uid();

let toastT=0;
function toast(msg,action){
  const t=$('#toast');t.textContent=msg;
  if(action){const b=document.createElement('button');b.className='toast-btn';b.textContent=action.label;b.addEventListener('click',()=>{t.hidden=true;action.run();});t.append(' ',b);}
  t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,action?7000:3200);
}
// Diálogo propio (confirm() y prompt() no funcionan dentro del visor de artefactos).
function ask(title,text,buttons){
  return new Promise(res=>{
    const d=$('#dlg');$('#dlg-title').textContent=title;$('#dlg-text').textContent=text;
    const box=$('#dlg-btns');box.innerHTML='';
    const close=v=>{d.hidden=true;document.removeEventListener('keydown',onKey);res(v);};
    const onKey=e=>{if(e.key==='Escape')close(null);};
    for(const b of buttons){const el=document.createElement('button');el.className='btn'+(b.primary?' primary':'')+(b.danger?' danger':'');el.textContent=b.label;el.addEventListener('click',()=>close(b.value));box.append(el);}
    d.hidden=false;document.addEventListener('keydown',onKey);box.querySelector('button')?.focus();
  });
}
function busy(btn,on,label){if(!btn)return;if(on){btn.dataset.label=btn.textContent;btn.textContent=label||'Generando…';btn.disabled=true;}else{btn.textContent=btn.dataset.label||btn.textContent;btn.disabled=false;}}
