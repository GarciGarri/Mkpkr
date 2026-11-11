# Mkpkr Scan (iPhone / iPad)

App nativa para medir cocinas con el LiDAR, al estilo del modo habitación de Polycam. Usa **RoomPlan** de Apple.

- **Escaneo guiado**: mientras recorres la cocina, la app dibuja en directo paredes, puertas, ventanas, muebles y electrodomésticos (fregadero, placa, horno, frigorífico, lavavajillas…).
- **Plano con cotas**: la planta se reconstruye uniendo las paredes por sus extremos (cocinas abiertas, en U o en L, paredes partidas, tabiques sueltos), con el mismo algoritmo y las mismas letras A, B, C… que Mkpkr Cocinas. Si no cierra con seguridad, la app lo avisa.
- **Medida láser por pared**: escribe la medida real y viaja con el escaneo para que la web reajuste la planta.
- **Modelo 3D** en Quick Look, con vista en realidad aumentada.
- **Instalaciones** (toma de agua, desagüe, enchufes, salida de humos, gas), de tres formas:
  - *Automática*: durante el escaneo se guardan hasta 24 fotos repartidas entre las paredes, con la posición de la cámara. Al pulsar «Detectar» la app enseña cuántas fotos se envían y el coste aproximado, y solo entonces Claude localiza las instalaciones; la app las proyecta sobre la pared con su altura. Necesita una clave de API de Anthropic (Ajustes ⚙︎), guardada solo en el llavero del iPhone. Las fotos se guardan fuera de la copia de seguridad y se puede desactivar guardarlas.
  - *Marcada al escanear*: apunta la cruz central y pulsa «Marcar toma».
  - *Manual*: toca el plano donde está y ajusta tipo, pared, distancia a la esquina y altura. También sirve para corregir las detectadas.
- **Cinta métrica AR** para medidas sueltas (altura de una toma, ancho de un pilar…), con nombre para cada una.
- **Enviar a Mkpkr Cocinas**: comparte el JSON del escaneo (CapturedRoom de RoomPlan más la clave `mkpkr` con la planta resuelta, medidas láser, medidas sueltas e instalaciones), el USDZ y la planta en PNG. En Mkpkr Cocinas: «Abrir archivo».

Los escaneos se guardan en *Archivos → En mi iPhone → Mkpkr Scan → Escaneos*.

## Requisitos

- iPhone 12 Pro o posterior (modelos Pro) o iPad Pro con LiDAR, iOS 16 o posterior.
- Para instalarla: un Mac con Xcode 16 y [XcodeGen](https://github.com/yonaskolb/XcodeGen).
  - Con tu Apple ID gratuito puedes instalarla en tu propio iPhone (la firma caduca a los 7 días).
  - Para repartirla con TestFlight o publicarla en el App Store hace falta el Apple Developer Program (99 €/año).

## Compilar

```sh
brew install xcodegen
cd ios/MkpkrScan
xcodegen generate
open MkpkrScan.xcodeproj
```

En Xcode: *Signing & Capabilities → Team* (tu Apple ID), conecta el iPhone y pulsa *Run*. Si el identificador `com.mkpkr.scan` ya está cogido, cámbialo en `project.yml`.

GitHub Actions (`.github/workflows/ios.yml`) compila la app sin firmar en cada cambio dentro de `ios/`.

## Pruebas

La reconstrucción de la planta (`PlanGeometry.swift`) no depende de RoomPlan y se prueba en cada compilación con los mismos casos que la web:

```sh
swiftc MkpkrScan/PlanGeometry.swift Tests/main.swift -o geomtest && ./geomtest ../../shared/fixtures/rooms.json
```
