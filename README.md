# Mkpkr

Herramientas para medir, diseñar y presupuestar cocinas a partir de la visita a casa del cliente.

| Parte | Qué es | Dónde |
|---|---|---|
| **Mkpkr Scan** | App de iPhone/iPad Pro: escaneo LiDAR, instalaciones, medidas | [`ios/MkpkrScan`](ios/MkpkrScan/README.md) |
| **Mkpkr Cocinas** | Página web: planta, distribución, planos, presupuesto, PDF y render | fuentes en [`web/src`](web/src), compilada en `cocinas.html` |
| Casos de prueba compartidos | Plantas con medidas conocidas que comprueban las dos partes | [`shared/fixtures/rooms.json`](shared/fixtures/rooms.json) |
| Auditoría y plan | Diagnóstico y hoja de ruta | [`AUDITORIA_INTEGRAL.md`](AUDITORIA_INTEGRAL.md), [`ROADMAP_MEJORAS.md`](ROADMAP_MEJORAS.md) |

## Mkpkr Cocinas

1. **Proyectos**: varios proyectos guardados en el navegador, con duplicar, borrar (con confirmación) y «Deshacer» en todos los cambios. Nada se sustituye sin preguntar.
2. **Captura**: importa el escaneo de Mkpkr Scan (usa la planta ya resuelta en la app), el JSON de RoomPlan (reconstruye el contorno: cocinas abiertas, en U, en L, paredes partidas, tabiques sueltos; si no cierra, no importa y lo explica) o una nube de puntos PLY/OBJ/XYZ. Fotos y vídeo con medición sobre foto y análisis con Claude; las fotos se guardan con el proyecto.
3. **Estancia**: forma, medida láser por pared (la planta se reajusta), lados abiertos, huecos e instalaciones con su altura, con avisos de valores imposibles.
4. **Diseño**: distribución automática que deja libre el paso de puertas y ventanas de cualquier pared, coloca primero fregadero y placa y respeta los módulos bloqueados. Añadir, bloquear y quitar módulos, y moverlos arrastrando en la planta o en el 3D (también instalaciones). Comprobaciones ordenadas por gravedad.
5. **Planos**: planta de montaje y alzados (SVG) y DXF por capas con arcos de puerta.
6. **Presupuesto**: vista interna (coste, PVP, beneficio) y vista de cliente (margen incluido en cada precio, céntimos, descuento, partidas libres). PDF para el cliente con datos de empresa y cliente, numeración, condiciones, memoria, planos y render.
7. **Render**: visor 3D con acabados e imagen de 2400 px.

«Exportar paquete» reúne PDF, planos, DXF, CSV de cliente e interno, proyecto, memoria, notas, render y fotos.

### Desarrollo

```sh
cd web
npm install            # dependencias de prueba (Playwright, three, jsPDF…)
npm run build          # web/src → cocinas.html
npm test               # comprueba la compilación y pasa las 9 baterías (120 comprobaciones)
```

No edites `cocinas.html` a mano: se genera desde `web/src`. GitHub Actions compila y prueba en cada cambio (`.github/workflows/web.yml`).
