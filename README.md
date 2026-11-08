# Mkpkr

## Mkpkr Cocinas (`cocinas.html`)

Toma de datos, plano, presupuesto y render de cocinas a partir del escaneo LiDAR y del vídeo de la visita:

1. **Captura**: importa la nube de puntos o malla del iPhone/iPad Pro (PLY binario o ASCII, OBJ, XYZ de Polycam, 3D Scanner App, Scaniverse) o el JSON `CapturedRoom` de Apple RoomPlan (paredes, puertas, ventanas y objetos ya medidos). De la nube saca la altura suelo–techo, endereza la planta y muestra un corte horizontal para marcar las esquinas (o ajuste rectangular automático). Del vídeo extrae fotogramas, permite medir sobre ellos con una referencia conocida y Claude (con visión) identifica tomas, huecos, caldera, estado y lo que hay que comprobar en obra.
2. **Estancia**: planta rectangular, en L o la del escaneo; puertas, ventanas y tomas (agua, desagüe, gas, humos, enchufes).
3. **Diseño**: distribución lineal, en L, en U o paralela con colocación automática (fregadero en la toma de agua, lavavajillas al lado, placa con encimera a ambos lados, columnas en los extremos, rinconeros, relleno con módulos estándar y regletas) y comprobaciones: triángulo de trabajo, separaciones, pasos libres, campana y tomas.
4. **Planos**: planta de montaje acotada (cadena de módulos y huecos) y alzados por pared. Exporta SVG y DXF.
5. **Presupuesto**: partidas calculadas del diseño con precios orientativos editables, margen, IVA, CSV y memoria para el cliente redactada por Claude.
6. **Render**: visor 3D (three.js) con acabados de frentes, encimera, suelo y paredes; captura PNG y descripción para un generador de imágenes fotorrealistas.

El botón «Exportar paquete .zip» reúne planta (SVG y DXF), alzados, presupuesto, proyecto JSON, memoria, notas, render y fotogramas.

## Mkpkr Scan (`ios/MkpkrScan`)

App nativa de iPhone/iPad Pro para medir la cocina con el LiDAR (RoomPlan de Apple): escaneo guiado con paredes, huecos y electrodomésticos detectados en directo, plano con cotas, modelo 3D, cinta métrica AR y envío del escaneo a Mkpkr Cocinas. Instrucciones en [`ios/MkpkrScan/README.md`](ios/MkpkrScan/README.md).
