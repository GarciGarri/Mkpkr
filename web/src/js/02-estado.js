/* ================= estado ================= */
const KEY='mkpkr-cocinas-v1';
function exampleState(){
  return {
    v:1, example:true,
    project:{name:'Ejemplo · Cocina en C/ Mayor 12, 3.º B'},
    notes:'Ejemplo. Paredes en buen estado. Caldera mural en pared C, junto a la puerta: no se toca.\nToma de agua y desagüe bajo la ventana.',
    shape:{type:'rect',w:380,d:290,W:420,D:360,w2:150,d2:140,pts:null},
    height:255,
    openings:[{id:uid(),type:'ventana',wall:0,x:140,w:110,h:120,sill:100},{id:uid(),type:'puerta',wall:2,x:40,w:82,h:210,sill:0}],
    services:[{id:uid(),type:'agua',wall:0,x:190},{id:uid(),type:'desague',wall:0,x:205},{id:uid(),type:'humos',wall:1,x:150},{id:uid(),type:'enchufe',wall:1,x:60}],
    design:{walls:[0,1],sinkW:80,hobW:60,oven:'bajo',fridge:true,dw:true,uppers:true,gama:'media'},
    finish:{front:'salvia',counter:'cuarzo',floor:'roble',wall:'blanco'},
    modules:[], manual:false,
    prices:{}, off:{suelo:true}, margin:15, iva:21,
    memo:'', measures:[], findings:[]
  };
}
function blankState(){
  const s=exampleState();
  Object.assign(s,{example:false,project:{name:''},notes:'',openings:[],services:[],memo:'',findings:[],measures:[]});
  s.shape={type:'rect',w:300,d:250,W:420,D:360,w2:150,d2:140,pts:null};
  s.design.walls=[0];
  return s;
}
let S;
try{const raw=localStorage.getItem(KEY); if(raw) S=JSON.parse(raw);}catch(e){}
if(!S||S.v!==1) S=exampleState();
let saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}},300);}

