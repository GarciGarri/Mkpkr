import SwiftUI
import simd

/// Planta acotada dibujada a partir del resumen de RoomPlan.
struct FloorPlanView: View {
    let summary: RoomSummary
    var showLabels = true

    var body: some View {
        Canvas { ctx, size in
            let corners = summary.corners
            let pts = corners + summary.walls.flatMap { [$0.a, $0.b] }
            guard let first = pts.first else { return }
            var mn = first, mx = first
            for p in pts { mn = simd_min(mn, p); mx = simd_max(mx, p) }

            let pad: Float = showLabels ? 0.6 : 0.15
            let w = mx.x - mn.x + 2 * pad, h = mx.y - mn.y + 2 * pad
            let k = min(Float(size.width) / max(w, 0.01), Float(size.height) / max(h, 0.01))
            let ox = (Float(size.width) - (mx.x - mn.x) * k) / 2
            let oy = (Float(size.height) - (mx.y - mn.y) * k) / 2
            func P(_ p: SIMD2<Float>) -> CGPoint {
                CGPoint(x: CGFloat(ox + (p.x - mn.x) * k), y: CGFloat(oy + (p.y - mn.y) * k))
            }

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
            let wallWidth = max(showLabels ? 3 : 1.5, CGFloat(0.1 * k))
            for wall in summary.walls {
                var p = Path()
                p.move(to: P(wall.a))
                p.addLine(to: P(wall.b))
                ctx.stroke(p, with: .color(.primary), style: StrokeStyle(lineWidth: wallWidth, lineCap: .square))
            }

            // Puertas y ventanas
            for o in summary.openings {
                var p = Path()
                p.move(to: P(o.a))
                p.addLine(to: P(o.b))
                let col: Color = o.kind == .ventana ? .cyan : (o.kind == .puerta ? Theme.accent : .orange)
                ctx.stroke(p, with: .color(col), style: StrokeStyle(lineWidth: wallWidth + 1, lineCap: .butt))
            }

            // Cotas de cada pared, fuera de la planta
            if showLabels {
                let centre = corners.isEmpty ? (mn + mx) / 2 : corners.reduce(SIMD2<Float>(0, 0), +) / Float(corners.count)
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
}
