/* ================= vídeo y fotos ================= */
const frames=[]; let curFrame=-1, mMode=null, mPending=null;
const dropMedia=$('#drop-media');
['dragover','dragenter'].forEach(ev=>dropMedia.addEventListener(ev,e=>{e.preventDefault();dropMedia.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dropMedia.addEventListener(ev,e=>{e.preventDefault();dropMedia.classList.remove('over');}));
dropMedia.addEventListener('drop',e=>loadMedia([...e.dataTransfer.files]));
$('#f-media').addEventListener('change',e=>{loadMedia([...e.target.files]);e.target.value='';});
const video=$('#video');

/* ---- fotos guardadas con el proyecto (IndexedDB de este navegador) ---- */
const media={
  db:null, warned:false, t:0,
  open(){
    if(this.db) return Promise.resolve(this.db);
    return new Promise(res=>{try{const r=indexedDB.open('mkpkr-cocinas',1);r.onupgradeneeded=()=>r.result.createObjectStore('fotos');r.onsuccess=()=>{this.db=r.result;res(this.db);};r.onerror=()=>res(null);}catch(e){res(null);}});
  },
  async load(){
    for(const f of frames) URL.revokeObjectURL(f.url);
    frames.length=0;curFrame=-1;
    const db=await this.open();
    if(db){const id=S.id;const list=await new Promise(res=>{try{const q=db.transaction('fotos').objectStore('fotos').get(id);q.onsuccess=()=>res(Array.isArray(q.result)?q.result:[]);q.onerror=()=>res([]);}catch(e){res([]);}});
      if(id!==S.id) return;
      for(const r of list){if(!(r&&r.blob instanceof Blob))continue;try{const url=URL.createObjectURL(r.blob);const img=await loadImg(url);frames.push({id:r.id||uid(),blob:r.blob,url,img,label:str(r.label,40),sel:r.sel!==false,meas:Array.isArray(r.meas)?r.meas:[],ref:r.ref||null});}catch(e){}}
    }
    if(frames.length)curFrame=0;
    renderThumbs();if(curFrame>=0)selectFrame(0);
  },
  persist(){
    clearTimeout(this.t);
    this.t=setTimeout(async()=>{const db=await this.open();
      if(!db){if(!this.warned&&frames.length){this.warned=true;toast('Este navegador no permite guardar las fotos: se perderán al cerrar la página.');}return;}
      const rows=frames.map(f=>({id:f.id,label:f.label,blob:f.blob,sel:f.sel,meas:f.meas,ref:f.ref}));
      try{const tx=db.transaction('fotos','readwrite');tx.objectStore('fotos').put(rows,S.id);tx.onerror=()=>toast('No se han podido guardar las fotos: el almacenamiento del navegador está lleno.');}catch(e){}
    },300);
  },
  async drop(id){const db=await this.open();if(!db)return;try{db.transaction('fotos','readwrite').objectStore('fotos').delete(id);}catch(e){}}
};

async function loadMedia(files){
  for(const f of files){
    if(f.type.startsWith('video/')){
      if(video.src)URL.revokeObjectURL(video.src);
      video.src=URL.createObjectURL(f);$('#video-box').hidden=false;
      video.onloadedmetadata=()=>{if(!frames.length)autoFrames(6);};
      video.onerror=()=>{$('#video-box').hidden=true;
        ask('No se puede reproducir el vídeo',`Este navegador no puede leer «${f.name}». Los vídeos del iPhone en formato HEVC no se reproducen en todos los navegadores. Prueba en Safari, graba en «Más compatible» (Ajustes › Cámara › Formatos) o sube fotos.`,[{label:'Entendido',value:1,primary:true}]);};
    }
    else if(f.type.startsWith('image/')){try{const url=URL.createObjectURL(f);const img=await loadImg(url);URL.revokeObjectURL(url);const blob=await scaleToBlob(img,img.naturalWidth,img.naturalHeight);await addFrame(blob,f.name.slice(0,16));}catch(e){toast(`No se ha podido leer la imagen «${f.name}».`);}}
    else toast(`«${f.name}» no es un vídeo ni una imagen.`);
  }
}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
function scaleToBlob(src,w,h){const k=Math.min(1,1280/Math.max(w,h));const c=document.createElement('canvas');c.width=R(w*k);c.height=R(h*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',0.85));}
async function addFrame(blob,label){if(!blob)return;const url=URL.createObjectURL(blob);const img=await loadImg(url);frames.push({id:uid(),blob,url,img,label,sel:true,meas:[],ref:null});noExample();renderThumbs();selectFrame(frames.length-1);media.persist();}
function seek(t){return new Promise(r=>{const done=()=>{video.removeEventListener('seeked',done);r();};video.addEventListener('seeked',done);video.currentTime=t;setTimeout(done,4000);});}
async function grab(){
  if(video.error||video.readyState<2||!video.videoWidth){toast('El vídeo aún no está listo para capturar.');return;}
  await addFrame(await scaleToBlob(video,video.videoWidth,video.videoHeight),fmtTime(video.currentTime));
}
const fmtTime=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
async function autoFrames(n){if(!video.duration||video.error)return;$('#v-auto').disabled=true;try{for(let k=0;k<n;k++){await seek(video.duration*(k+0.5)/n);await grab();}}finally{$('#v-auto').disabled=false;}}
$('#v-grab').addEventListener('click',grab);
$('#v-auto').addEventListener('click',()=>autoFrames(6));
function renderThumbs(){
  $('#thumbs').innerHTML=frames.map((f,i)=>`<figure data-i="${i}" class="${i===curFrame?'sel':''}"><img src="${f.url}" alt="Foto ${i+1}" tabindex="0"><figcaption><span>${esc(f.label)}</span><label class="chk" title="Enviar a Claude"><input type="checkbox" data-sel${f.sel?' checked':''} aria-label="Incluir la foto ${i+1} en el análisis"></label></figcaption></figure>`).join('');
  $('#measure-box').hidden=curFrame<0; updateAiBtn();
}
$('#thumbs').addEventListener('click',e=>{const fig=e.target.closest('figure');if(!fig)return;const i=+fig.dataset.i;if(e.target.matches('[data-sel]')){frames[i].sel=e.target.checked;updateAiBtn();media.persist();return;}selectFrame(i);});
$('#thumbs').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const fig=e.target.closest('figure');if(fig)selectFrame(+fig.dataset.i);});
function selectFrame(i){curFrame=i;renderThumbs();const f=frames[i];if(!f)return;const cv=$('#m-canvas');cv.width=f.img.naturalWidth;cv.height=f.img.naturalHeight;$('#ref-row').hidden=!f.ref;if(f.ref)$('#ref-cm').value=f.ref.cm;drawMeasure();renderMeasures();}
const mcv=$('#m-canvas');
function setMode(m){mMode=mMode===m?null:m;mPending=null;$('#m-ref').setAttribute('aria-pressed',mMode==='ref');$('#m-measure').setAttribute('aria-pressed',mMode==='measure');$('#m-ref').classList.toggle('primary',mMode==='ref');$('#m-measure').classList.toggle('primary',mMode==='measure');drawMeasure();}
$('#m-ref').addEventListener('click',()=>setMode('ref'));
$('#m-measure').addEventListener('click',()=>{const f=frames[curFrame];if(!f?.ref){toast('Marca primero una referencia de longitud conocida');setMode('ref');return;}setMode('measure');});
$('#m-clear').addEventListener('click',()=>{const f=frames[curFrame];if(!f)return;f.meas=[];f.ref=null;$('#ref-row').hidden=true;drawMeasure();renderMeasures();media.persist();});
$('#m-del').addEventListener('click',async()=>{const f=frames[curFrame];if(!f)return;
  if(!await ask('¿Quitar esta foto?','Se quitará del proyecto con sus medidas.',[{label:'Quitar',value:1,danger:true},{label:'Cancelar',value:null,primary:true}]))return;
  URL.revokeObjectURL(f.url);frames.splice(curFrame,1);curFrame=frames.length?Math.min(curFrame,frames.length-1):-1;renderThumbs();if(curFrame>=0)selectFrame(curFrame);media.persist();});
$('#ref-preset').addEventListener('change',e=>{if(e.target.value){$('#ref-cm').value=e.target.value;applyRef();}});
$('#ref-cm').addEventListener('change',applyRef);
function applyRef(){const f=frames[curFrame];if(!f?.ref)return;f.ref.cm=num($('#ref-cm').value,1,0.1,10000);f.meas.forEach(m=>m.cm=pxLen(m)*f.ref.cm/pxLen(f.ref));drawMeasure();renderMeasures();media.persist();}
const pxLen=s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)||1;
function measureClick(p){const f=frames[curFrame];if(!f)return;if(!mMode){toast('Elige «Marcar referencia» o «Medir» antes de marcar puntos.');return;}
  if(!mPending){mPending=p;drawMeasure();return;}
  const seg={a:mPending,b:p};mPending=null;
  if(mMode==='ref'){f.ref={...seg,cm:num($('#ref-cm').value,203,0.1,10000)};$('#ref-row').hidden=false;f.meas.forEach(m=>m.cm=pxLen(m)*f.ref.cm/pxLen(f.ref));setMode('measure');}
  else{f.meas.push({...seg,cm:pxLen(seg)*f.ref.cm/pxLen(f.ref)});}
  drawMeasure();renderMeasures();media.persist();}
mcv.addEventListener('click',e=>measureClick(canvasPt(mcv,e)));
mcv.addEventListener('pointermove',e=>{if(mPending)drawMeasure(canvasPt(mcv,e));});
const mKey=keyboardPointer(mcv,{onMove:p=>drawMeasure(p,true),onClick:measureClick});
function drawMeasure(hover,kb){
  const f=frames[curFrame];if(!f)return;const ctx=mcv.getContext('2d');ctx.drawImage(f.img,0,0,mcv.width,mcv.height);
  const lw=Math.max(2,mcv.width/400),fs=Math.max(14,mcv.width/55);
  const seg=(s,col,label)=>{ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);ctx.stroke();for(const p of [s.a,s.b]){ctx.beginPath();ctx.arc(p.x,p.y,lw*2,0,7);ctx.fillStyle=col;ctx.fill();}
    if(label){ctx.font=`600 ${fs}px JetBrains Mono, monospace`;const mx=(s.a.x+s.b.x)/2,my=(s.a.y+s.b.y)/2;const tw=ctx.measureText(label).width;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(mx+6,my-fs-4,tw+10,fs+8);ctx.fillStyle='#fff';ctx.fillText(label,mx+11,my-4);}};
  if(f.ref) seg(f.ref,'#f2b705',`REF ${fmt(f.ref.cm,1)} cm`);
  f.meas.forEach((m,i)=>seg(m,'#5aa0ff',`${i+1} · ${fmt(m.cm,1)} cm`));
  if(mPending&&hover) seg({a:mPending,b:hover},mMode==='ref'?'#f2b705':'#5aa0ff','');
  else if(mPending){ctx.beginPath();ctx.arc(mPending.x,mPending.y,lw*2.5,0,7);ctx.fillStyle='#f2b705';ctx.fill();}
  if(kb&&hover) drawCross(ctx,hover,lw*6,lw);
}
function renderMeasures(){const f=frames[curFrame];const l=$('#m-list');if(!f){l.innerHTML='';return;}
  l.innerHTML=f.meas.map((m,i)=>`<li><span class="pill info">${i+1}</span><span class="row" style="justify-content:space-between"><span class="num">${fmt(m.cm,1)} cm</span><button class="btn sm ghost" data-note="${i}">Pasar a notas</button></span></li>`).join('')||(f.ref?'<li><span class="pill info">Listo</span><span>Pulsa dos puntos para medir.</span></li>':'');}
$('#m-list').addEventListener('click',e=>{const i=e.target.dataset.note;if(i===undefined)return;const f=frames[curFrame];noExample();S.notes=(S.notes?S.notes+'\n':'')+`Medida sobre la foto ${f.label}: ${fmt(f.meas[i].cm,1)} cm (ref. ${fmt(f.ref.cm,1)} cm).`;$('#notes').value=S.notes;save();toast('Añadida a notas de obra');});

/* ---- puntero de teclado para lienzos (accesibilidad) ---- */
function drawCross(ctx,p,r,lw){ctx.save();ctx.strokeStyle='#f2b705';ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x+r,p.y);ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);ctx.stroke();ctx.restore();}
function keyboardPointer(cv,{onMove,onClick}){
  let cur=null;const step=()=>cv.width/120;
  cv.addEventListener('focus',()=>{if(!cur)cur={x:cv.width/2,y:cv.height/2};onMove(cur);});
  cv.addEventListener('blur',()=>onMove(null));
  cv.addEventListener('keydown',e=>{const k=e.key,s=step()*(e.shiftKey?6:1);
    if(k.startsWith('Arrow')){e.preventDefault();cur=cur||{x:cv.width/2,y:cv.height/2};
      if(k==='ArrowLeft')cur.x-=s;if(k==='ArrowRight')cur.x+=s;if(k==='ArrowUp')cur.y-=s;if(k==='ArrowDown')cur.y+=s;
      cur.x=clamp(cur.x,0,cv.width);cur.y=clamp(cur.y,0,cv.height);onMove(cur);}
    else if(k==='Enter'||k===' '){e.preventDefault();if(cur){onClick({...cur});onMove(cur);}}});
  return ()=>cur;
}
