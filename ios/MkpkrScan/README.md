# Mkpkr Scan (iPhone / iPad)

App nativa para medir cocinas con el LiDAR, al estilo del modo habitación de Polycam. Usa **RoomPlan** de Apple.

- **Escaneo guiado**: mientras recorres la cocina, la app dibuja en directo paredes, puertas, ventanas, muebles y electrodomésticos (fregadero, placa, horno, frigorífico, lavavajillas…).
- **Plano con cotas** de cada pared (letras A, B, C… iguales que en Mkpkr Cocinas), superficie, perímetro y altura libre, más la lista de huecos con su antepecho.
- **Modelo 3D** en Quick Look, con vista en realidad aumentada.
- **Cinta métrica AR** para medidas sueltas (altura de una toma, ancho de un pilar…), con nombre para cada una.
- **Enviar a Mkpkr Cocinas**: comparte el JSON del escaneo (CapturedRoom de RoomPlan con las medidas sueltas en la clave `mkpkr`), el USDZ y la planta en PNG. En Mkpkr Cocinas: *Captura → Escaneo LiDAR → Elegir archivo*.

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
