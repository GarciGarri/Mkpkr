/* ================= eventos: proyecto ================= */
$('#pname').addEventListener('input',e=>{S.project.name=e.target.value;save();});
$('#notes').addEventListener('input',e=>{S.notes=e.target.value;save();});
$('#btn-new').addEventListener('click',()=>{$('#btn-confirm-new').hidden=false;setTimeout(()=>$('#btn-confirm-new').hidden=true,5000);});
$('#btn-confirm-new').addEventListener('click',()=>{S=blankState();autoLayout();$('#btn-confirm-new').hidden=true;frames.length=0;renderThumbs();location.hash='#captura';renderAll();toast('Proyecto nuevo creado');});
$('#f-project').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  let s;try{s=JSON.parse(await f.text());}catch(err){toast('No se puede leer el archivo: no es un JSON válido.');return;}
  if(s&&s.v===1&&s.shape){S=s;renderAll();toast('Proyecto abierto');return;}
  if(s&&(s.walls||s.rooms||s.capturedRoom||s.mkpkr)){try{importRoomPlan(s);}catch(err){toast('No se ha podido importar el escaneo: '+(err.message||err));}return;}
  toast('Ese archivo no es ni un proyecto ni un escaneo de Mkpkr Scan.');});

