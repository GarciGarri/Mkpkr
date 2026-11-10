/* ================= vídeo y fotos ================= */
const frames=[]; let curFrame=-1, mMode=null, mPending=null;
const dropMedia=$('#drop-media');
['dragover','dragenter'].forEach(ev=>dropMedia.addEventListener(ev,e=>{e.preventDefault();dropMedia.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dropMedia.addEventListener(ev,e=>{e.preventDefault();dropMedia.classList.remove('over');}));
dropMedia.addEventListener('drop',e=>loadMedia([...e.dataTransfer.files]));
$('#f-media').addEventListener('change',e=>{loadMedia([...e.target.files]);e.target.value='';});
const video=$('#video');
async function loadMedia(files){
  for(const f of files){
    if(f.type.startsWith('video/')){video.src=URL.createObjectURL(f);$('#video-box').hidden=false;video.onloadedmetadata=()=>{if(!frames.length)autoFrames(6);};}
    else if(f.type.startsWith('image/')){const img=await loadImg(URL.createObjectURL(f));const blob=await scaleToBlob(img,img.naturalWidth,img.naturalHeight);addFrame(blob,f.name.slice(0,16));}
  }
}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
function scaleToBlob(src,w,h){const k=Math.min(1,1280/Math.max(w,h));const c=document.createElement('canvas');c.width=R(w*k);c.height=R(h*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',0.85));}
async function addFrame(blob,label){const url=URL.createObjectURL(blob);const img=await loadImg(url);frames.push({blob,url,img,label,sel:true,meas:[],ref:null});renderThumbs();selectFrame(frames.length-1);}
function seek(t){return new Promise(r=>{video.onseeked=()=>{video.onseeked=null;r();};video.currentTime=t;});}
async function grab(){const b=await scaleToBlob(video,video.videoWidth,video.videoHeight);await addFrame(b,fmtTime(video.currentTime));}
const fmtTime=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
async function autoFrames(n){if(!video.duration)return;$('#v-auto').disabled=true;for(let k=0;k<n;k++){await seek(video.duration*(k+0.5)/n);await grab();}$('#v-auto').disabled=false;}
$('#v-grab').addEventListener('click',grab);
$('#v-auto').addEventListener('click',()=>autoFrames(6));
function renderThumbs(){
  $('#thumbs').innerHTML=frames.map((f,i)=>`<figure data-i="${i}" class="${i===curFrame?'sel':''}"><img src="${f.url}" alt="Fotograma ${i+1}"><figcaption><span>${esc(f.label)}</span><label class="chk" title="Enviar a Claude"><input type="checkbox" data-sel${f.sel?' checked':''} aria-label="Incluir en el análisis"></label></figcaption></figure>`).join('');
  $('#measure-box').hidden=curFrame<0; updateAiBtn();
}
$('#thumbs').addEventListener('click',e=>{const fig=e.target.closest('figure');if(!fig)return;const i=+fig.dataset.i;if(e.target.matches('[data-sel]')){frames[i].sel=e.target.checked;updateAiBtn();return;}selectFrame(i);});
function selectFrame(i){curFrame=i;renderThumbs();const f=frames[i];const cv=$('#m-canvas');cv.width=f.img.naturalWidth;cv.height=f.img.naturalHeight;drawMeasure();renderMeasures();}
const mcv=$('#m-canvas');
function setMode(m){mMode=mMode===m?null:m;mPending=null;$('#m-ref').setAttribute('aria-pressed',mMode==='ref');$('#m-measure').setAttribute('aria-pressed',mMode==='measure');$('#m-ref').classList.toggle('primary',mMode==='ref');$('#m-measure').classList.toggle('primary',mMode==='measure');drawMeasure();}
$('#m-ref').addEventListener('click',()=>setMode('ref'));
$('#m-measure').addEventListener('click',()=>{const f=frames[curFrame];if(!f?.ref){toast('Marca primero una referencia de longitud conocida');setMode('ref');return;}setMode('measure');});
$('#m-clear').addEventListener('click',()=>{const f=frames[curFrame];if(!f)return;f.meas=[];f.ref=null;$('#ref-row').hidden=true;drawMeasure();renderMeasures();});
$('#ref-preset').addEventListener('change',e=>{if(e.target.value){$('#ref-cm').value=e.target.value;applyRef();}});
$('#ref-cm').addEventListener('change',applyRef);
function applyRef(){const f=frames[curFrame];if(!f?.ref)return;f.ref.cm=+$('#ref-cm').value||1;f.meas.forEach(m=>m.cm=pxLen(m)*f.ref.cm/pxLen(f.ref));drawMeasure();renderMeasures();}
const pxLen=s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);
mcv.addEventListener('click',e=>{const f=frames[curFrame];if(!f||!mMode)return;const p=canvasPt(mcv,e);
  if(!mPending){mPending=p;drawMeasure();return;}
  const seg={a:mPending,b:p};mPending=null;
  if(mMode==='ref'){f.ref={...seg,cm:+$('#ref-cm').value||203};$('#ref-row').hidden=false;f.meas.forEach(m=>m.cm=pxLen(m)*f.ref.cm/pxLen(f.ref));setMode('measure');}
  else{f.meas.push({...seg,cm:pxLen(seg)*f.ref.cm/pxLen(f.ref)});}
  drawMeasure();renderMeasures();});
mcv.addEventListener('pointermove',e=>{if(mPending)drawMeasure(canvasPt(mcv,e));});
function drawMeasure(hover){
  const f=frames[curFrame];if(!f)return;const ctx=mcv.getContext('2d');ctx.drawImage(f.img,0,0,mcv.width,mcv.height);
  const lw=Math.max(2,mcv.width/400),fs=Math.max(14,mcv.width/55);
  const seg=(s,col,label)=>{ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);ctx.stroke();for(const p of [s.a,s.b]){ctx.beginPath();ctx.arc(p.x,p.y,lw*2,0,7);ctx.fillStyle=col;ctx.fill();}
    if(label){ctx.font=`600 ${fs}px JetBrains Mono, monospace`;const mx=(s.a.x+s.b.x)/2,my=(s.a.y+s.b.y)/2;const tw=ctx.measureText(label).width;ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(mx+6,my-fs-4,tw+10,fs+8);ctx.fillStyle='#fff';ctx.fillText(label,mx+11,my-4);}};
  if(f.ref) seg(f.ref,'#f2b705',`REF ${fmt(f.ref.cm,1)} cm`);
  f.meas.forEach((m,i)=>seg(m,'#5aa0ff',`${i+1} · ${fmt(m.cm,1)} cm`));
  if(mPending&&hover) seg({a:mPending,b:hover},mMode==='ref'?'#f2b705':'#5aa0ff','');
  else if(mPending){ctx.beginPath();ctx.arc(mPending.x,mPending.y,lw*2.5,0,7);ctx.fillStyle='#f2b705';ctx.fill();}
}
function renderMeasures(){const f=frames[curFrame];const l=$('#m-list');if(!f){l.innerHTML='';return;}
  l.innerHTML=f.meas.map((m,i)=>`<li><span class="pill info">${i+1}</span><span class="row" style="justify-content:space-between"><span class="num">${fmt(m.cm,1)} cm</span><button class="btn sm ghost" data-note="${i}">Pasar a notas</button></span></li>`).join('')||(f.ref?'<li><span class="pill info">Listo</span><span>Pulsa dos puntos para medir.</span></li>':'');}
$('#m-list').addEventListener('click',e=>{const i=e.target.dataset.note;if(i===undefined)return;const f=frames[curFrame];S.notes=(S.notes?S.notes+'\n':'')+`Medida sobre fotograma ${f.label}: ${fmt(f.meas[i].cm,1)} cm (ref. ${fmt(f.ref.cm,1)} cm).`;$('#notes').value=S.notes;save();toast('Añadida a notas de obra');});

