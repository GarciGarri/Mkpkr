# Roadmap de mejoras — Mkpkr Cocinas y Mkpkr Scan

Plan de ejecución derivado de `AUDITORIA_INTEGRAL.md` (9 de noviembre de 2026). Los identificadores **E-xx** remiten al registro de errores de la auditoría.
**Nada de este plan está implementado.** Queda pendiente de tu aprobación del diagnóstico y de las prioridades.

Supuestos de estimación: un desarrollador sénior a jornada completa; «d» son días de trabajo; las horquillas incluyen pruebas. Con dedicación parcial, multiplicar los plazos en proporción.

---

## 0. Decisiones que necesito antes de empezar

| # | Decisión | Por qué importa | Recomendación |
|---|---|---|---|
| D1 | ¿Uso propio o producto para terceros en los próximos seis meses? | Determina si hace falta servidor, cuentas y distribución por TestFlight | Decidirlo al final de H2, con datos de campo; hasta entonces, uso propio |
| D2 | ¿Puedes escanear 10 cocinas reales y medirlas con láser? | Es la única forma de conocer la precisión y de validar la app | Sí; es la actividad de mayor valor del plan |
| D3 | ¿El repositorio debe seguir siendo público? | El código y el .ipa son descargables por cualquiera | Hacerlo privado salvo que haya motivo para lo contrario |
| D4 | ¿Programa de desarrolladores de Apple (99 €/año)? | Sin él, la app caduca cada 7 días y no se puede repartir | Contratarlo antes del piloto (H3) |
| D5 | Clave de API de Claude para la detección | Sin ella, la detección automática no se puede probar | Crear una con límite de gasto mensual |
| D6 | ¿Qué programa de diseño usan las tiendas objetivo? | Define el formato de exportación que merece la pena | Preguntarlo a 3–5 tiendas durante la calibración |

---

## 1. Criterios de priorización

Cada actuación se ha valorado de 1 (bajo) a 5 (alto) en impacto para el usuario (U), impacto comercial (C) y riesgo de no hacerla (R), frente a su esfuerzo. El orden final respeta además las dependencias: nada que dependa de la medición o de la distribución se aborda antes de que estas sean fiables.

---

## 2. Horizonte 1 — Correcciones urgentes (semanas 1–6)

Objetivo: que nada falle en silencio, que no se pierdan datos y que exista una red de pruebas. **Sin funcionalidades nuevas.**

| ID | Actuación | App | U | C | R | Esf. | Depende de | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|
| H1-1 | Llevar las baterías de la auditoría al repositorio y ejecutarlas en cada cambio (E-32) | Ambas | 3 | 3 | 5 | 2–3 d | — | CI en rojo si falla una batería; informe de cobertura de casos |
| H1-2 | Reconstrucción robusta de la planta y rechazo explícito cuando no cierra (E-01, E-22) | Ambas | 5 | 5 | 5 | 4–5 d | H1-1 | Las 9 geometrías de prueba: área con error < 1 % o rechazo con mensaje; nunca éxito con dato falso |
| H1-3 | Validación, versionado y migración de archivos; escapado de atributos (E-05, E-04) | Web | 4 | 3 | 5 | 2–3 d | H1-1 | Los 13 archivos defectuosos o maliciosos se sanean o se rechazan; 0 excepciones; 0 código ejecutado |
| H1-4 | Confirmación de acciones destructivas (incluido el descarte de ediciones manuales al cambiar opciones), instantánea previa y «Deshacer»; quitar la marca de ejemplo al editar (E-03) | Web | 5 | 4 | 5 | 3 d | H1-3 | Importar sobre un proyecto pide confirmación y se puede deshacer al estado exacto |
| H1-5 | Distribución, fase correctiva: puertas y ventanas de paredes contiguas, prioridad de fregadero y placa, esquinas, comprobaciones estrictas (E-02) | Web | 5 | 5 | 4 | 5–7 d | H1-1 | Batería de 600 casos: 0 solapes, 0 puertas invadidas, 0 cocinas viables sin fregadero o placa |
| H1-6 | Presupuesto de cliente sin margen visible y memoria con cifras coherentes (E-11) | Web | 4 | 5 | 4 | 1–2 d | — | La palabra «margen» no aparece en ningún documento de cliente; las partidas suman la base |
| H1-7 | App: errores de sesión y permiso de cámara; detección con confirmación, sin borrar resultados ni marcarse como hecha si falla (E-06, E-07) | iOS | 4 | 3 | 4 | 2–3 d | D5 | Pruebas unitarias con cliente simulado; prueba manual sin permiso de cámara |
| H1-8 | Publicación trazable: rama `main` protegida, versión y número de compilación visibles en la app, publicar solo desde `main`, registro completo, acciones fijadas (E-18, E-19) | Infra | 2 | 2 | 3 | 1 d | D3 | Etiqueta y binario coinciden; la app muestra su versión |
| H1-9 | **Calibración en campo**: 10 cocinas escaneadas y medidas con láser; registro de errores por pared, puerta e instalación; revisión de fallos de la app (E-29) | Campo | 5 | 5 | 5 | 2 d de campo + 3 d de arreglos | H1-2, H1-7, D2 | Tabla de errores reales; lista de fallos de dispositivo cerrada o planificada |
| H1-10 | Arreglos menores de la web: vídeo no compatible, respuesta de Claude inesperada, huecos sin validar, céntimos, fuga de texturas (E-09, E-10, E-12, E-14, E-17) | Web | 3 | 2 | 2 | 3 d | H1-3 | Cada caso de la batería correspondiente en verde |

**Total H1:** 28–35 días (unas 6 semanas).
**Puerta de salida:** todas las baterías en verde y tabla de calibración completada. Si el error medio de pared supera los 3 cm o la detección acierta menos de dos de cada tres instalaciones, replantear H2 (más peso a la rectificación manual, menos a la detección).

---

## 3. Horizonte 2 — Mejoras rápidas de alto impacto (semanas 7–11)

Objetivo: que el resultado se pueda entregar a un cliente y usar a diario.

| ID | Actuación | App | U | C | R | Esf. | Depende de | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|
| H2-1 | Lista de proyectos con cliente, estado, duplicar y archivar (almacenamiento local) | Web | 5 | 4 | 3 | 3 d | H1-3 | 20 proyectos sin degradación; ninguno se pierde al crear otro |
| H2-2 | PDF de presupuesto y dosier: datos del cliente y de la empresa, número, fecha, validez, partidas libres, descuento, planta, alzados y render | Web | 5 | 5 | 3 | 4–5 d | H1-6 | Un PDF listo para enviar en un clic desde un proyecto completo |
| H2-3 | Corrección de paredes con láser: medida real por pared, reajuste de la planta y marca de «verificada» | Ambas | 5 | 5 | 4 | 3–4 d | H1-2 | Corregir una pared reajusta planta, tomas y módulos sin romper el cierre |
| H2-4 | Paquete completo: render en alta resolución siempre incluido, indicador de progreso (E-13) | Web | 3 | 3 | 1 | 1 d | — | `render.png` ≥ 2.000 px en todos los paquetes |
| H2-5 | Edición manual: añadir y bloquear módulos, reajuste asistido al cambiar la estancia, precios manuales señalados (E-15) | Web | 4 | 3 | 2 | 2–3 d | H1-5 | Recalcular respeta los módulos bloqueados |
| H2-6 | Móvil y tablet: cabecera compacta, pestañas fijas con estado, zum en planos, tablas adaptadas (E-21) | Web | 4 | 3 | 2 | 3–4 d | — | A 390 px el contenido empieza en la primera pantalla y el total se lee completo |
| H2-7 | Accesibilidad: etiquetas, idioma, regiones, teclado en los lienzos (E-20) | Web | 2 | 2 | 2 | 1–2 d | — | axe-core sin incidencias críticas ni graves |
| H2-8 | App: cobertura de fotos por pared, fotos enderezadas, estimación de coste y selección antes de detectar (E-08, E-27, E-30) | iOS | 4 | 3 | 3 | 3 d | H1-9 | Todas las paredes con ≥ 3 fotos; coste mostrado antes de enviar |
| H2-9 | Persistencia de fotos y medidas sobre foto (E-16) | Web | 3 | 2 | 2 | 1–2 d | H2-1 | Recargar conserva fotos y medidas |
| H2-10 | Aviso y consentimiento de tratamiento de datos; opción de no guardar fotos (E-31) | Ambas | 2 | 4 | 4 | 2 d + asesoría | D1 | Texto revisado por un asesor |

**Total H2:** 23–29 días (unas 5 semanas).
**Puerta de salida y decisión D1:** con el flujo completo usable, decidir si se abre a terceros. Si no, H3 se reduce al editor y al motor de distribución.

---

## 4. Horizonte 3 — Evolución funcional (semanas 12–21)

Objetivo: completar el producto y reducir la deuda estructural.

| ID | Actuación | App | U | C | R | Esf. | Depende de | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|
| H3-1 | Formato de intercambio `mkpkr-room` v2 con esquema publicado y archivos de contrato; la web deja de recalcular la planta | Ambas | 4 | 4 | 4 | 4–5 d | H1-2, H2-3 | Los mismos archivos de ejemplo pasan en Swift y en JavaScript |
| H3-2 | Web en módulos con tipos, compilada a un único archivo; capa de plataforma (artefacto o sitio propio) (E-25, E-26) | Web | 2 | 4 | 4 | 5–7 d | H1-1 | Mismas baterías en verde; el mismo código funciona fuera de claude.ai con descarga nativa |
| H3-3 | Editor directo sobre la planta: arrastrar, ajustar, ampliar, menú por módulo | Web | 5 | 4 | 2 | 8–10 d | H3-2 | Mover un módulo en menos de 3 segundos, con comprobaciones en vivo |
| H3-4 | Motor de distribución con restricciones y tres alternativas puntuadas | Web | 5 | 5 | 3 | 10–15 d | H1-5, H1-1 | Batería ampliada a 2.000 casos sin violaciones; el usuario elige entre tres propuestas |
| H3-5 | Tarifas propias: plantillas por tienda e importación desde Excel (con ayuda de Claude para PDF) | Web | 5 | 5 | 2 | 5–6 d | H2-1 | Una tarifa real cargada y aplicada a un presupuesto |
| H3-6 | Más tipologías: isla y península, despensero, microondas en columna, alturas de altos | Web | 4 | 4 | 2 | 5–7 d | H3-4 | Cada tipología con sus casos en la batería |
| H3-7 | Fotos de la visita en la web, situadas en la planta; un único análisis del estado de la estancia | Ambas | 3 | 3 | 2 | 4–5 d | H3-1 | Pulsar una pared muestra sus fotos |
| H3-8 | Partidas de obra calculadas a partir del desplazamiento de instalaciones | Web | 4 | 4 | 2 | 3–4 d | H1-9, H3-1 | Mover el fregadero cambia la partida de fontanería |
| H3-9 | Distribución por TestFlight, icono, textos de privacidad, pruebas de la app | iOS | 3 | 4 | 3 | 3–4 d | D4 | Instalación por invitación sin cable |
| H3-10 | Exportación para el programa de diseño de la tienda (DXF completo y listado de módulos) | Web | 3 | 4 | 2 | 3–5 d | D6 | Importación comprobada en el programa destino |

**Total H3:** 50–68 días (10–13 semanas). Si el tiempo aprieta, H3-6, H3-7 y H3-10 pasan a H4.
**Puerta de salida:** piloto con 3–5 usuarios externos durante dos semanas (si D1 es afirmativa).

---

## 5. Horizonte 4 — Evolución estratégica (a partir de la semana 22)

Condicionado al resultado del piloto. No comprometer antes.

| ID | Actuación | App | Esf. | Condición para iniciarla |
|---|---|---|---|---|
| H4-1 | Servidor gestionado: cuentas, equipo, proyectos sincronizados, intermediario de Claude con control de gasto | Ambas | 15–20 d | D1 afirmativa y piloto con uso recurrente |
| H4-2 | Traspaso directo app → web (código QR o proyecto compartido) | Ambas | 4–5 d | H4-1 |
| H4-3 | Enlace para el cliente con aceptación del presupuesto | Web | 5–7 d | H4-1 |
| H4-4 | El diseño en AR sobre la cocina real | iOS | 8–10 d | H3-1 de ida y vuelta |
| H4-5 | «Antes y después» fotorrealista con un proveedor de imagen | Web + servidor | 8–12 d | H4-1; prueba de calidad con 10 cocinas |
| H4-6 | Asistente de diseño conversacional | Web | 6–8 d | H3-4 estable |
| H4-7 | Panel de actividad comercial | Web | 4–5 d | Al menos 50 presupuestos emitidos |
| H4-8 | Detección de instalaciones en el dispositivo | iOS | > 20 d | Conjunto de fotos etiquetadas propio (sale de H1-9 en adelante) |
| H4-9 | Lectura directa de medidor láser por Bluetooth | iOS | 5–7 d | Demanda confirmada y modelo compatible identificado |

---

## 6. Las 10 actuaciones con mejor relación impacto/esfuerzo

| # | Actuación | ID | Esf. | Motivo |
|---|---|---|---|---|
| 1 | Planta robusta y rechazo explícito | H1-2 | 4–5 d | Elimina el dato falso silencioso en el núcleo |
| 2 | Validación y versionado de archivos | H1-3 | 2–3 d | Cierra roturas y la inyección de código de una vez |
| 3 | Confirmar y deshacer | H1-4 | 3 d | Elimina las pérdidas de datos comprobadas |
| 4 | Presupuesto de cliente sin margen | H1-6 | 1–2 d | Muy barato y evita un error comercial grave |
| 5 | Pruebas en el repositorio y CI | H1-1 | 2–3 d | Las baterías ya existen; protegen todo lo demás |
| 6 | Distribución, fase correctiva | H1-5 | 5–7 d | Pasa de 1 de cada 4 diseños no construibles a 0 |
| 7 | Calibración en campo | H1-9 | 5 d | Sustituye suposiciones por datos y orienta la inversión |
| 8 | Lista de proyectos | H2-1 | 3 d | Condición para el uso diario |
| 9 | PDF de presupuesto y dosier | H2-2 | 4–5 d | Es lo que se entrega y se cobra |
| 10 | Corrección con láser | H2-3 | 3–4 d | Extiende la utilidad hasta el pedido y acota la responsabilidad |

---

## 7. Calendario de seis meses

| Semanas | Foco | Entregables |
|---|---|---|
| 1 | Red de seguridad | H1-1, H1-8; decisiones D2, D3, D5 |
| 2–3 | Datos fiables | H1-2, H1-3, H1-4 |
| 4–5 | Distribución fiable | H1-5, H1-6, H1-7 |
| 6 | Campo | H1-9 (10 cocinas), H1-10; **revisión de H1** |
| 7–8 | Entregables | H2-1, H2-2, H2-4 |
| 9–10 | Medición y edición | H2-3, H2-5, H2-8 |
| 11 | Uso en visita | H2-6, H2-7, H2-9, H2-10; **decisión D1** |
| 12–14 | Base técnica | H3-1, H3-2 |
| 15–18 | Diseño | H3-3, H3-4 |
| 19–21 | Negocio | H3-5, H3-8, H3-9; H3-6, H3-7 y H3-10 si hay margen |
| 22–23 | Piloto con 3–5 usuarios externos | Informe de uso, incidencias y disposición a pagar |
| 24–26 | Según el piloto | Inicio de H4-1 o consolidación |

---

## 8. Qué no hacer todavía

- **Servidor, cuentas y suscripciones** antes de haber validado medición y distribución en campo.
- **Render fotorrealista o asistente conversacional** mientras la distribución base no sea construible.
- **Versión Android, multiestancia o catálogos de fabricante**: coste alto y demanda sin demostrar.
- **Reescribir la web** con otro marco: la lógica actual es reutilizable; basta con modularizarla y tiparla.
- **Entrenar un modelo propio de detección** antes de tener fotos etiquetadas de cocinas reales.

---

## 9. Indicadores para seguir el avance

| Indicador | Hoy | Objetivo H1 | Objetivo H3 |
|---|---|---|---|
| Geometrías de prueba importadas correctamente o rechazadas con mensaje | 5 de 9 (4 erróneas en silencio) | 9 de 9 | 9 de 9 más escaneos reales |
| Cocinas aleatorias con violación geométrica | 39,5 % (237 de 600) | 0 % | 0 % en 2.000 casos |
| Cocinas viables sin fregadero o placa | 16,7 % (100 de 600) | 0 % | 0 % |
| Pruebas automáticas en el repositorio | 0 | 9 baterías | > 150 casos más pruebas de la app |
| Incidencias críticas o graves de accesibilidad | 4 reglas, 86 nodos | — | 0 |
| Error medio de pared frente a láser | Desconocido | Medido en 10 cocinas | ≤ 2 cm o corregido con láser |
| Pasos para pasar un escaneo a la web | 5 | 5 | 1–2 |
| Acciones que sustituyen o descartan trabajo sin confirmación | 4 tipos (importar escaneo, abrir proyecto, usar planta del corte, cambiar opciones de distribución) | 0 | 0 |
