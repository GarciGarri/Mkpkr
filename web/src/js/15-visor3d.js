/* ================= 3D ================= */
const three={ready:false,
  init(){
    if(this.ready){this.resize();return true;}
    if(!window.THREE){$('#three-msg').textContent='No se ha podido cargar el visor 3D. Recarga la página.';return false;}
    const wrap=$('#three-wrap');$('#three-msg').hidden=true;
    const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setPixelRatio(Math.min(2,devicePixelRatio));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;
    wrap.appendChild(r.domElement);this.r=r;
    this.scene=new THREE.Scene();this.cam=new THREE.PerspectiveCamera(50,1.6,0.05,100);
    this.ctl=THREE.OrbitControls?new THREE.OrbitControls(this.cam,r.domElement):null;if(this.ctl){this.ctl.enableDamping=true;this.ctl.maxPolarAngle=Math.PI*0.49;}
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8a8070,0.75));
    const sun=new THREE.DirectionalLight(0xfff4e6,0.65);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;sun.shadow.bias=-0.0008;this.sun=sun;this.scene.add(sun);this.scene.add(sun.target);
    this.group=new THREE.Group();this.scene.add(this.group);
    this.ready=true;this.r.setSize(1200,750,false);this.cam.aspect=1.6;this.cam.updateProjectionMatrix();
    new ResizeObserver(()=>this.resize()).observe(wrap);this.resize();this.rebuild();this.view('iso');
    const loop=()=>{requestAnimationFrame(loop);if($('#v-render').hidden)return;this.ctl&&this.ctl.update();this.hideWalls();r.render(this.scene,this.cam);};loop();
    return true;
  },
  resize(){if(!this.ready)return;const w=$('#three-wrap').clientWidth,h=$('#three-wrap').clientHeight;if(!w||!h)return;this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();},
  bg(){const css=getComputedStyle(document.documentElement);return new THREE.Color(css.getPropertyValue('--surface-2').trim()||'#f4f6f7');},
  view(kind){if(!this.ready)return;const g=G,cx=(g.minx+g.maxx)/200,cz=(g.miny+g.maxy)/200,sz=Math.max(g.maxx-g.minx,g.maxy-g.miny)/100;
    const target=new THREE.Vector3(cx,0.9,cz);
    if(kind==='front'){const w=g.walls[S.design.walls[0]??0];const c=at(w,w.len/2,Math.min(330,(Math.max(g.maxx-g.minx,g.maxy-g.miny))*0.95));const tc=at(w,w.len/2,0);this.cam.position.set(c.x/100,1.5,c.y/100);target.set(tc.x/100,1.2,tc.y/100);}
    else{let v={x:0,y:0};for(const i of S.design.walls){v.x-=g.walls[i].n.x;v.y-=g.walls[i].n.y;}if(Math.hypot(v.x,v.y)<0.1)v={x:-0.7,y:-0.7};const l=Math.hypot(v.x,v.y);this.cam.position.set(cx-v.x/l*sz*0.95,sz*0.8+1.4,cz-v.y/l*sz*0.95);}
    this.ctl?(this.ctl.target.copy(target),this.ctl.update()):this.cam.lookAt(target);},
  hideWalls(){const c=this.cam.position;for(const w of this.walls||[]){const vis=((c.x*100-w.mx)*w.nx+(c.z*100-w.my)*w.ny)>0;w.objs.forEach(o=>o.visible=vis);}},
  rebuild(){
    if(!this.ready)return;const g=geom();this.scene.background=this.bg();
    const grp=this.group;while(grp.children.length){const c=grp.children.pop();c.geometry&&c.geometry.dispose();}
    for(const m of this.mats||[]){m.map&&m.map.dispose();m.dispose();}this.mats=[];
    const track=m=>{this.mats.push(m);return m;};
    const H=S.height,T=12;
    const mat=(c,o={})=>track(new THREE.MeshStandardMaterial({color:new THREE.Color(c),roughness:o.r??0.6,metalness:o.m??0,transparent:!!o.op,opacity:o.op??1}));
    const fin=S.finish;
    const M={front:mat(FRONTS[fin.front].c,{r:FRONTS[fin.front].g?.18:.55}),carc:mat('#d9d6cf'),plinth:mat('#3b3d40',{r:.8}),counter:mat(COUNTERS[fin.counter].c,{r:.35}),wall:mat(WALLS[fin.wall].c,{r:.9}),black:mat('#141518',{r:.3}),steel:mat('#b9bcc0',{r:.25,m:.8}),glass:mat('#bcd6e8',{op:.32,r:.1}),door:mat('#a77b52',{r:.6}),sink:mat('#8c9096',{r:.3,m:.6})};
    // caja orientada a una pared: x0..x1 a lo largo, d0..d1 hacia dentro, y0..y1 altura (cm)
    const box=(w,x0,x1,d0,d1,y0,y1,m,shadow=true)=>{const geo=new THREE.BoxGeometry((x1-x0)/100,(y1-y0)/100,Math.abs(d1-d0)/100);const mesh=new THREE.Mesh(geo,m);const c=at(w,(x0+x1)/2,(d0+d1)/2);mesh.position.set(c.x/100,(y0+y1)/200,c.y/100);mesh.rotation.y=Math.atan2(-w.u.y,w.u.x);mesh.castShadow=shadow;mesh.receiveShadow=true;grp.add(mesh);return mesh;};
    // suelo
    const shape=new THREE.Shape(g.pts.map(p=>new THREE.Vector2(p.x/100,p.y/100)));
    const fg=new THREE.ShapeGeometry(shape);fg.rotateX(Math.PI/2);
    const fm=track(new THREE.MeshStandardMaterial({map:floorTex(fin.floor),roughness:.75,side:THREE.DoubleSide}));const floor=new THREE.Mesh(fg,fm);floor.receiveShadow=true;grp.add(floor);
    // paredes
    this.walls=[];
    for(const w of g.walls){const objs=[];if(w.open){this.walls.push({objs,mx:0,my:0,nx:0,ny:0});continue;}const ops=S.openings.filter(o=>o.wall===w.i).sort((a,b)=>a.x-b.x);
      const e0=w.convexStart?-T:0,e1=w.len+(w.convexEnd?T:0);let x=e0;
      for(const o of ops){const a=clamp(o.x,0,w.len),b=clamp(o.x+o.w,0,w.len);if(a>x)objs.push(box(w,x,a,-T,0,0,H,M.wall));if(o.sill>0)objs.push(box(w,a,b,-T,0,0,o.sill,M.wall));if(o.sill+o.h<H)objs.push(box(w,a,b,-T,0,o.sill+o.h,H,M.wall));
        if(o.type==='ventana'){objs.push(box(w,a,b,-T/2-1,-T/2+1,o.sill,o.sill+o.h,M.glass,false));objs.push(box(w,a,b,-2,3,o.sill-2,o.sill,M.carc));}
        else if(o.type==='puerta'){objs.push(box(w,a+2,b-2,-T+3,-T+7,0,o.h,M.door));}
        x=Math.max(x,b);}
      if(x<e1)objs.push(box(w,x,e1,-T,0,0,H,M.wall));
      const mid=at(w,w.len/2);this.walls.push({objs,mx:mid.x,my:mid.y,nx:w.n.x,ny:w.n.y});}
    // muebles
    const gap=0.4;
    const fronts=(w,x0,x1,y0,y1,dep,parts,m=M.front)=>{ // parts: array de alturas (cajones) o null => puertas
      const out=[];
      if(parts){let y=y1;for(const h of parts){out.push(box(w,x0+gap,x1-gap,dep,dep+1.8,y-h+gap,y-gap,m));out.push(box(w,(x0+x1)/2-10,(x0+x1)/2+10,dep+1.8,dep+3,y-5.5,y-4.5,M.steel,false));y-=h;}}
      else{const n=(x1-x0)>60?2:1;for(let k=0;k<n;k++){const a=x0+(x1-x0)*k/n,b=x0+(x1-x0)*(k+1)/n;out.push(box(w,a+gap,b-gap,dep,dep+1.8,y0+gap,y1-gap,m));const hx=n===2?(k===0?b-4:a+4):b-4;const hy=y1>140?[y0+4,y0+22]:[y1-22,y1-4];out.push(box(w,hx-.5,hx+.5,dep+1.8,dep+3,hy[0],hy[1],M.steel,false));}}
      return out;};
    for(const mo of S.modules){const w=g.walls[mo.wall];if(!w||w.open||mo.type==='hueco')continue;const x0=mo.x,x1=mo.x+mo.w;
      if(mo.type==='electro'){box(w,x0+1,x1-1,1,58,1,85,M.carc);continue;}
      const highObjs=[];
      if(mo.level==='low'){box(w,x0+.5,x1-.5,0,52,0,10,M.plinth);box(w,x0,x1,0,58,10,86,M.carc);
        if(mo.type==='regleta'){box(w,x0+gap,x1-gap,58,59.8,10,86,M.front);continue;}
        if(mo.type==='cajonero'||mo.type==='placa_caj')fronts(w,x0,x1,10,86,58,[16,30,30]);
        else if(mo.type==='placa'){fronts(w,x0,x1,72,86,58,[14]);box(w,x0+gap,x1-gap,58,59.8,10.4,71.6,M.black);box(w,x0+8,x1-8,59.8,60.6,64,66,M.steel,false);}
        else if(mo.type==='lavavajillas')fronts(w,x0,x1,10,86,58,[76]);
        else fronts(w,x0,x1,10,86,58,null);
        if(mo.type==='placa'||mo.type==='placa_caj')box(w,x0+2,x1-2,6,56,90,90.6,M.black);
        if(mo.type==='fregadero'){box(w,x0+6,x1-6,10,52,89.2,90.3,M.sink);const f1=box(w,(x0+x1)/2-1.2,(x0+x1)/2+1.2,4,6.4,90,121,M.steel);const f2=box(w,(x0+x1)/2-1.2,(x0+x1)/2+1.2,6,24,118.6,121,M.steel);}
      } else if(mo.level==='col'){box(w,x0+.5,x1-.5,0,52,0,10,M.plinth);box(w,x0,x1,0,58,10,215,M.carc);
        if(mo.type==='nevera'){box(w,x0+gap,x1-gap,58,59.8,10.4,139.6,M.front);box(w,x0+gap,x1-gap,58,59.8,140.4,214.6,M.front);box(w,x1-4.5,x1-3.5,59.8,61,115,139,M.steel,false);box(w,x1-4.5,x1-3.5,59.8,61,141,165,M.steel,false);}
        else{fronts(w,x0,x1,10,50,58,[40]);box(w,x0+gap,x1-gap,58,59.8,50.4,109.6,M.black);box(w,x0+gap,x1-gap,58,59.8,110.4,214.6,M.front);}
      } else {
        if(mo.type==='campana'){highObjs.push(box(w,x0,x1,0,50,155,166,M.steel));highObjs.push(box(w,(x0+x1)/2-13,(x0+x1)/2+13,0,25,166,H,M.steel));}
        else if(mo.type==='regleta'){highObjs.push(box(w,x0,x1,0,35,145,215,M.front));}
        else{highObjs.push(box(w,x0,x1,0,33,145,215,M.carc));highObjs.push(...fronts(w,x0,x1,145,215,33,null));}
        const wr=this.walls[w.i];wr&&wr.objs.push(...highObjs);
      }
    }
    // encimeras continuas
    for(const w of g.walls){const ms=S.modules.filter(m=>m.wall===w.i&&m.level==='low'&&m.type!=='hueco').sort((a,b)=>a.x-b.x);let r=null;const runs=[];for(const m of ms){if(r&&Math.abs(r.e-m.x)<1)r.e=m.x+m.w;else{r={s:m.x,e:m.x+m.w};runs.push(r);}}
      for(const q of runs){box(w,q.s,q.e,0,62,86,90,M.counter);if(S.design.uppers)box(w,q.s,q.e,0,1,90,145,M.counter,false);}}
    const cx=(g.minx+g.maxx)/200,cz=(g.miny+g.maxy)/200;this.sun.position.set(cx+2.5,5,cz+1.5);this.sun.target.position.set(cx,0,cz);
  },
  // Imagen de 2400 px de ancho, independiente del tamaño de la ventana.
  async png(width=2400){
    if(!this.ready&&!this.init())return null;
    if($('#v-render').hidden){this.rebuild();}
    const r=this.r,size=new THREE.Vector2();r.getSize(size);const pr=r.getPixelRatio(),asp=this.cam.aspect;
    const w=width,h=Math.round(width/1.6);
    r.setPixelRatio(1);r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();this.hideWalls();r.render(this.scene,this.cam);
    const blob=await new Promise(res=>r.domElement.toBlob(res,'image/png'));
    r.setPixelRatio(pr);r.setSize(size.x||1200,size.y||750,false);this.cam.aspect=asp;this.cam.updateProjectionMatrix();
    return blob;
  }
};
function floorTex(kind){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');const col=FLOORS[kind].c;
  x.fillStyle=col;x.fillRect(0,0,512,512);
  if(kind==='roble'){for(let i=0;i<512;i+=64){x.fillStyle=i%128?'rgba(0,0,0,.05)':'rgba(255,255,255,.05)';x.fillRect(0,i,512,64);x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,i,512,1.5);const o=(i*37)%512;x.fillRect(o,i,1.5,64);}}
  else if(kind==='gris'){x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=2;for(let i=0;i<=512;i+=512/1.66){x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(512,i);x.stroke();}}
  else if(kind==='damero'){const n=4;for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=(i+j)%2?'#2b2c2e':'#ecebe6';x.fillRect(i*512/n,j*512/n,512/n,512/n);}}
  else{for(let i=0;i<3000;i++){x.fillStyle=`rgba(0,0,0,${Math.random()*0.04})`;x.fillRect(Math.random()*512,Math.random()*512,3,3);}}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='damero'?1.5:1,kind==='damero'?1.5:1);return t;
}
$('#r-reset').addEventListener('click',()=>three.view('iso'));
$('#r-front').addEventListener('click',()=>three.view('front'));
$('#r-png').addEventListener('click',async()=>{const b=await three.png();if(b)saveFile(slug()+'-render.png',b);});

