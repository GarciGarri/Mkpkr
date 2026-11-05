# Mkpkr Poker Lab

Analizador de probabilidades para Texas Hold'em (cash y torneos), pensado para partidas presenciales caseras, estudio y práctica.

`index.html` es una página autocontenida (se publica como artefacto de claude.ai):

- **Analizar mano**: equity por Monte Carlo contra 1–8 rivales con rango estimado (matriz 13×13), pot odds, equity necesaria, EV de pagar, SPR, M de Harrington, outs con probabilidad de ligar, distribución de la mano final e ICM (Malmuth-Harville) para all-ins de torneo.
- **Recomendación**: heurística basada en equity, precio y profundidad de stacks (apertura preflop, push/fold en torneo, valor, semi-farol, odds implícitas).
- **Coach IA**: explicación en lenguaje natural con Claude a partir de los números y de tus notas.
- **Práctica**: situaciones aleatorias en las que decides y después ves la jugada recomendada y tu marcador.
- **Niveles de ayuda**: Solo números · Recomendación · Coach IA.

No está pensado para usarse en salas online ni en casinos que prohíban dispositivos en la mesa.

## Mkpkr Mesa en Directo (`directo.html`)

Herramienta para narrar retransmisiones de poker (con cartas tapadas emitidas en diferido):

- **Operador** (`#operador`): consola de comandos de teclado (`4 r 1600`, `c`, `f Kh7h2c`, `3 AhKh`, `n`, `u`…) con motor de reglas completo: ciegas, antes, orden de acción, botes paralelos, devolución de apuestas no pagadas, showdown automático, deshacer. Puede montar la mesa a partir de una captura de la señal (Claude con visión).
- **Narrador** (`#narrador`): mesa, equity de cada jugador (exacta tras el flop), gráfica de equity por calle, momentos clave automáticos y frases sugeridas por Claude.
- Sincronización entre equipos con la base de datos del artefacto, y entre pestañas del mismo navegador con BroadcastChannel.
- **Overlay OBS** (`#overlay`): rótulos a 1920×1080 (probabilidad de ganar por jugador, mesa y bote, momento clave) sobre fondo sólido magenta, verde o azul para recortarlo con el filtro Chroma Key de OBS. `H` oculta la barra de ajustes.

## Mkpkr Cocinas (`cocinas.html`)

Toma de datos, plano, presupuesto y render de cocinas a partir del escaneo LiDAR y del vídeo de la visita:

1. **Captura**: importa la nube de puntos o malla del iPhone/iPad Pro (PLY binario o ASCII, OBJ, XYZ de Polycam, 3D Scanner App, Scaniverse) o el JSON `CapturedRoom` de Apple RoomPlan (paredes, puertas, ventanas y objetos ya medidos). De la nube saca la altura suelo–techo, endereza la planta y muestra un corte horizontal para marcar las esquinas (o ajuste rectangular automático). Del vídeo extrae fotogramas, permite medir sobre ellos con una referencia conocida y Claude (con visión) identifica tomas, huecos, caldera, estado y lo que hay que comprobar en obra.
2. **Estancia**: planta rectangular, en L o la del escaneo; puertas, ventanas y tomas (agua, desagüe, gas, humos, enchufes).
3. **Diseño**: distribución lineal, en L, en U o paralela con colocación automática (fregadero en la toma de agua, lavavajillas al lado, placa con encimera a ambos lados, columnas en los extremos, rinconeros, relleno con módulos estándar y regletas) y comprobaciones: triángulo de trabajo, separaciones, pasos libres, campana y tomas.
4. **Planos**: planta de montaje acotada (cadena de módulos y huecos) y alzados por pared. Exporta SVG y DXF.
5. **Presupuesto**: partidas calculadas del diseño con precios orientativos editables, margen, IVA, CSV y memoria para el cliente redactada por Claude.
6. **Render**: visor 3D (three.js) con acabados de frentes, encimera, suelo y paredes; captura PNG y descripción para un generador de imágenes fotorrealistas.

El botón «Exportar paquete .zip» reúne planta (SVG y DXF), alzados, presupuesto, proyecto JSON, memoria, notas, render y fotogramas.
