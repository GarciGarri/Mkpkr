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
