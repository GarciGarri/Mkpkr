import SwiftUI
import simd

/// Conversión entre metros de la planta y puntos de la vista.
struct PlanMapping {
    let mn: SIMD2<Float>
    let k: Float
    let ox: Float
    let oy: Float

    init?(summary: RoomSummary, size: CGSize, pad: Float) {
        let pts = summary.corners + summary.walls.flatMap { [$0.a, $0.b] }
        guard let first = pts.first, size.width > 0, size.height > 0 else { return nil }
        var mn = first, mx = first
        for p in pts { mn = simd_min(mn, p); mx = simd_max(mx, p) }
        let w = mx.x - mn.x + 2 * pad, h = mx.y - mn.y + 2 * pad
        k = min(Float(size.width) / max(w, 0.01), Float(size.height) / max(h, 0.01))
        ox = (Float(size.width) - (mx.x - mn.x) * k) / 2
        oy = (Float(size.height) - (mx.y - mn.y) * k) / 2
        self.mn = mn
    }

    func point(_ p: SIMD2<Float>) -> CGPoint {
        CGPoint(x: CGFloat(ox + (p.x - mn.x) * k), y: CGFloat(oy + (p.y - mn.y) * k))
    }

    func plan(_ c: CGPoint) -> SIMD2<Float> {
        SIMD2<Float>((Float(c.x) - ox) / k + mn.x, (Float(c.y) - oy) / k + mn.y)
    }
}

/// Planta acotada dibujada a partir del resumen de RoomPlan.
struct FloorPlanView: View {
    let summary: RoomSummary
    var fixtures: [Fixture] = []
    var showLabels = true
    /// Toque sobre la planta, en metros del escaneo.
    var onTap: ((SIMD2<Float>) -> Void)?

    private var pad: Float { showLabels ? 0.6 : 0.15 }

    var body: some View {
        GeometryReader { geo in
            Canvas { ctx, size in draw(ctx, size) }
                .contentShape(Rectangle())
                .onTapGesture(coordinateSpace: .local) { location in
                    guard let onTap, let map = PlanMapping(summary: summary, size: geo.size, pad: pad) else { return }
                    onTap(map.plan(location))
                }
        }
    }

    private func draw(_ ctx: GraphicsContext, _ size: CGSize) {
        guard let map = PlanMapping(summary: summary, size: size, pad: pad) else { return }
        let P = map.point
        let corners = summary.corners

        // Suelo
        if corners.count >= 3 {
            var floor = Path()
            floor.move(to: P(corners[0]))
            for c in corners.dropFirst() { floor.addLine(to: P(c)) }
            floor.closeSubpath()
            ctx.fill(floor, with: .color(Color.secondary.opacity(0.12)))
        }

        // Objetos detectados
        for o in summary.objects {
            let hw = o.size.x / 2, hd = o.size.z / 2
            let c = cos(o.angle), s = sin(o.angle)
            let local: [SIMD2<Float>] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]
            let wp = local.map { SIMD2<Float>(o.center.x + $0.x * c - $0.y * s, o.center.y + $0.x * s + $0.y * c) }
            var r = Path()
            r.move(to: P(wp[0]))
            for q in wp.dropFirst() { r.addLine(to: P(q)) }
            r.closeSubpath()
            ctx.fill(r, with: .color(Theme.dim.opacity(0.14)))
            ctx.stroke(r, with: .color(Theme.dim), lineWidth: 1)
            if showLabels {
                ctx.draw(Text(o.name).font(.system(size: 9, weight: .medium)).foregroundColor(Theme.dim), at: P(o.center))
            }
        }

        // Paredes
        let wallWidth = max(showLabels ? 3 : 1.5, CGFloat(0.1 * map.k))
        for (i, wall) in summary.walls.enumerated() {
            var p = Path()
            p.move(to: P(wall.a))
            p.addLine(to: P(wall.b))
            if summary.isOpen(i) {
                ctx.stroke(p, with: .color(.secondary), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            } else {
                ctx.stroke(p, with: .color(.primary), style: StrokeStyle(lineWidth: wallWidth, lineCap: .square))
            }
        }

        // Puertas y ventanas
        for o in summary.openings {
            var p = Path()
            p.move(to: P(o.a))
            p.addLine(to: P(o.b))
            let col: Color = o.kind == .ventana ? .cyan : (o.kind == .puerta ? Theme.accent : .orange)
            ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: wallWidth + 1, lineCap: .butt))
        }

        // Instalaciones
        let r: CGFloat = showLabels ? 9 : 3
        for f in fixtures {
            let c = P(SIMD2<Float>(f.position.x, f.position.z))
            let circle = Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r))
            ctx.fill(circle, with: .color(f.kind.color))
            if f.source == .auto {
                ctx.stroke(circle, with: .color(.white), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
            }
            if showLabels {
                ctx.draw(Text(f.kind.letter).font(.system(size: 10, weight: .bold)).foregroundColor(.white), at: c)
            }
        }

        // Cotas de cada pared, fuera de la planta
        if showLabels {
            let centre = corners.isEmpty ? map.mn : corners.reduce(SIMD2<Float>(0, 0), +) / Float(corners.count)
            for (i, wall) in summary.walls.enumerated() {
                var dir = wall.mid - centre
                let l = simd_length(dir)
                dir = l > 0 ? dir / l : .zero
                let label = "\(RoomSummary.letter(i)) · \(Int((wall.length * 100).rounded()))"
                ctx.draw(
                    Text(label).font(.system(size: 11, weight: .semibold, design: .monospaced)).foregroundColor(Theme.dim),
                    at: P(wall.mid + dir * 0.32)
                )
            }
        }
    }
}
