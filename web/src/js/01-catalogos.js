/* ================= catálogos ================= */
const TYPES={
  base:{n:'Bajo de puertas',lvl:'low',k:'B'}, cajonero:{n:'Cajonero',lvl:'low',k:'C'}, fregadero:{n:'Bajo fregadero',lvl:'low',k:'FR'},
  lavavajillas:{n:'Lavavajillas',lvl:'low',k:'LV'}, placa:{n:'Placa y horno',lvl:'low',k:'PL'}, placa_caj:{n:'Placa y cajones',lvl:'low',k:'PL'},
  rincon:{n:'Rinconero',lvl:'low',k:'R'}, regleta:{n:'Regleta',lvl:'any',k:'·'},
  nevera:{n:'Columna frigorífico',lvl:'col',k:'FG'}, horno_col:{n:'Columna horno',lvl:'col',k:'HC'},
  alto:{n:'Alto de puertas',lvl:'high',k:'A'}, campana:{n:'Campana',lvl:'high',k:'CA'},
  electro:{n:'Hueco de electrodoméstico',lvl:'low',k:'EL'}, hueco:{n:'Hueco libre',lvl:'any',k:''}
};
// Tipos que no son mueble: no cuentan como módulo ni se presupuestan como mobiliario.
const NO_MUEBLE=new Set(['hueco','electro','regleta']);
const LVL_T={low:'Bajo',high:'Alto',col:'Columna'};
const OPEN_T={ventana:'Ventana',puerta:'Puerta',paso:'Hueco de paso'};
const SERV_T={agua:{n:'Agua',c:'--water',k:'A'},desague:{n:'Desagüe',c:'--water',k:'D'},gas:{n:'Gas',c:'--gas',k:'G'},humos:{n:'Salida de humos',c:'--smoke',k:'H'},enchufe:{n:'Enchufe',c:'--power',k:'E'}};
const FRONTS={blanco:{n:'Blanco mate',c:'#f1f0ec'},antracita:{n:'Gris antracita',c:'#3a3d41'},salvia:{n:'Verde salvia',c:'#8ea38b'},noche:{n:'Azul noche',c:'#24344b'},roble:{n:'Roble natural',c:'#b78a5b'},arena:{n:'Arena',c:'#d8cbb4'}};
const COUNTERS={laminado:{n:'Laminado roble',c:'#b88a5a',p:110},compacto:{n:'Compacto negro',c:'#222326',p:260},cuarzo:{n:'Cuarzo blanco',c:'#ecebe6',p:380},porcelanico:{n:'Porcelánico efecto mármol',c:'#e4e2dd',p:460},madera:{n:'Madera maciza',c:'#9b6a3f',p:240}};
const FLOORS={roble:{n:'Tarima roble',c:'#b0855a'},gris:{n:'Porcelánico gris',c:'#a9aaa6'},micro:{n:'Microcemento',c:'#c9c4bb'},damero:{n:'Damero',c:'#e8e6e1'}};
const WALLS={blanco:{n:'Blanco roto',c:'#f2f0eb'},gris:{n:'Gris perla',c:'#d9dadb'},verde:{n:'Verde pálido',c:'#dfe5da'},rosa:{n:'Rosa arcilla',c:'#ead8cf'}};
const GAMA={basica:{n:'básica',f:.75},media:{n:'media',f:1},alta:{n:'alta',f:1.6}};

const PRICE_DEFS=[
  // key, capítulo, concepto, unidad, precio por defecto, afectado por gama
  ['bajo','Mobiliario','Muebles bajos','ml',260,1],
  ['alto','Mobiliario','Muebles altos','ml',190,1],
  ['col_nevera','Mobiliario','Columna para frigorífico integrable','ud',520,1],
  ['col_horno','Mobiliario','Columna de horno','ud',480,1],
  ['cajonero','Mobiliario','Suplemento cajones con freno','ud',120,1],
  ['rincon','Mobiliario','Herraje extraíble de rincón','ud',180,1],
  ['regleta','Mobiliario','Regletas, remates y zócalo','ud',35,1],
  ['encimera','Encimera','Encimera','ml',380,0],
  ['huecos','Encimera','Huecos de fregadero y placa','ud',60,0],
  ['frontal','Encimera','Frontal entre muebles','m²',95,0],
  ['placa60','Electrodomésticos','Placa de inducción 60 cm','ud',420,0],
  ['placa90','Electrodomésticos','Placa de inducción 90 cm','ud',780,0],
  ['horno','Electrodomésticos','Horno multifunción','ud',380,0],
  ['campana60','Electrodomésticos','Campana decorativa 60 cm','ud',320,0],
  ['campana90','Electrodomésticos','Campana decorativa 90 cm','ud',450,0],
  ['lavavajillas','Electrodomésticos','Lavavajillas integrable','ud',520,0],
  ['frigo','Electrodomésticos','Frigorífico combi integrable','ud',890,0],
  ['fregadero','Electrodomésticos','Fregadero y grifo','ud',260,0],
  ['montaje','Instalación','Montaje de mobiliario','ud',55,0],
  ['fontaneria','Instalación','Fontanería: agua y desagüe','partida',380,0],
  ['electricidad','Instalación','Electricidad: línea de placa y tomas','partida',450,0],
  ['desmontaje','Obra','Desmontaje y retirada de cocina existente','partida',350,0],
  ['pintura','Obra','Pintura de paredes','m²',14,0],
  ['suelo','Obra','Suelo nuevo colocado','m²',48,0],
];

