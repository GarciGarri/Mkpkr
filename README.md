# Mkpkr Poker Lab

Analizador de probabilidades para Texas Hold'em (cash y torneos), pensado para partidas presenciales caseras, estudio y práctica.

`index.html` es una página autocontenida (se publica como artefacto de claude.ai):

- **Analizar mano**: equity por Monte Carlo contra 1–8 rivales con rango estimado (matriz 13×13), pot odds, equity necesaria, EV de pagar, SPR, M de Harrington, outs con probabilidad de ligar, distribución de la mano final e ICM (Malmuth-Harville) para all-ins de torneo.
- **Recomendación**: heurística basada en equity, precio y profundidad de stacks (apertura preflop, push/fold en torneo, valor, semi-farol, odds implícitas).
- **Coach IA**: explicación en lenguaje natural con Claude a partir de los números y de tus notas.
- **Práctica**: situaciones aleatorias en las que decides y después ves la jugada recomendada y tu marcador.
- **Niveles de ayuda**: Solo números · Recomendación · Coach IA.

No está pensado para usarse en salas online ni en casinos que prohíban dispositivos en la mesa.
