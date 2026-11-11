import Foundation
import simd

/// Tramo de pared visto en planta (metros, plano X–Z del escaneo).
struct WallSegment {
    var a: SIMD2<Float>
    var b: SIMD2<Float>
    var height: Float
}

struct ContourWall {
    var a: SIMD2<Float>
    var b: SIMD2<Float>
    var height: Float
    /// Lado sin pared (cocina abierta): cierra el contorno pero no lleva muebles.
    var open: Bool
    /// Longitud del tramo escaneado del que sale (0 en los lados abiertos).
    var scanned: Float
}

struct ContourResult {
    var walls: [ContourWall]
    var merged: Int
    var dropped: Int
    var corners: [SIMD2<Float>] { walls.map(\.a) }
    var openIndices: [Int] { walls.indices.filter { walls[$0].open } }
}

enum ContourError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(m) = self { return m }; return nil }
}

/// Reconstrucción del contorno de la estancia a partir de las paredes sueltas del escaneo.
/// Es el mismo algoritmo que web/src/js/04-contorno.js (Mkpkr Cocinas), en metros en lugar de centímetros.
/// Los casos de prueba compartidos están en shared/fixtures/rooms.json.
enum PlanGeometry {
    static func buildContour(_ input: [WallSegment]) throws -> ContourResult {
        var segs = input.filter { $0.a.x.isFinite && $0.a.y.isFinite && $0.b.x.isFinite && $0.b.y.isFinite && simd_distance($0.a, $0.b) >= 0.05 }
        guard segs.count >= 2 else { throw ContourError.message("El escaneo tiene menos de dos paredes: no se puede reconstruir la planta.") }
        func dir(_ s: WallSegment) -> (u: SIMD2<Float>, l: Float) {
            let d = s.b - s.a, l = simd_length(d)
            return (l > 0 ? d / l : SIMD2<Float>(1, 0), max(l, 1e-6))
        }

        // 1. fusión de tramos colineales contiguos
        var merged = 0
        var again = true
        while again {
            again = false
            outer: for i in 0..<segs.count {
                for j in (i + 1)..<segs.count {
                    let p = segs[i], q = segs[j]
                    let (u, ul) = dir(p), (v, _) = dir(q)
                    if abs(u.x * v.y - u.y * v.x) > 0.09 { continue }
                    let perp: (SIMD2<Float>) -> Float = { s in abs((s.x - p.a.x) * u.y - (s.y - p.a.y) * u.x) }
                    if perp(q.a) > 0.08 || perp(q.b) > 0.08 { continue }
                    let t: (SIMD2<Float>) -> Float = { s in simd_dot(s - p.a, u) }
                    let q0 = min(t(q.a), t(q.b)), q1 = max(t(q.a), t(q.b))
                    if max(q0 - ul, -q1) > 0.15 { continue }
                    let lo = min(0, q0), hi = max(ul, q1)
                    segs[i] = WallSegment(a: p.a + u * lo, b: p.a + u * hi, height: max(p.height, q.height))
                    segs.remove(at: j)
                    merged += 1
                    again = true
                    break outer
                }
            }
        }

        // 2. emparejar extremos (extremo e = 2·i + k; k = 0 → a, k = 1 → b)
        func end(_ e: Int) -> SIMD2<Float> { e % 2 == 1 ? segs[e / 2].b : segs[e / 2].a }
        struct Cand { var e1: Int; var e2: Int; var c: SIMD2<Float>; var cost: Float; var order: Int }
        var cands: [Cand] = []
        for i in 0..<segs.count {
            for j in (i + 1)..<segs.count {
                let p = segs[i], q = segs[j]
                let (u, ul) = dir(p), (v, vl) = dir(q)
                let cr = u.x * v.y - u.y * v.x
                let tol = min(max(0.4 * min(ul, vl), 0.15), 0.6)
                for ki in 0..<2 {
                    for kj in 0..<2 {
                        let ei = end(2 * i + ki), ej = end(2 * j + kj)
                        let c: SIMD2<Float>
                        if abs(cr) > 0.15 {
                            let t = ((q.a.x - p.a.x) * v.y - (q.a.y - p.a.y) * v.x) / cr
                            c = p.a + u * t
                        } else {
                            c = (ei + ej) / 2
                        }
                        let di = simd_distance(c, ei), dj = simd_distance(c, ej)
                        if di <= tol && dj <= tol { cands.append(Cand(e1: 2 * i + ki, e2: 2 * j + kj, c: c, cost: di + dj, order: cands.count)) }
                    }
                }
            }
        }
        cands.sort { $0.cost != $1.cost ? $0.cost < $1.cost : $0.order < $1.order }
        var partner: [Int: Int] = [:], cornerAt: [Int: SIMD2<Float>] = [:]
        for k in cands where partner[k.e1] == nil && partner[k.e2] == nil {
            partner[k.e1] = k.e2; partner[k.e2] = k.e1
            cornerAt[k.e1] = k.c; cornerAt[k.e2] = k.c
        }

        // 3. componentes: ciclos (estancia cerrada) y cadenas (estancia abierta)
        struct Comp { var list: [(Int, Int)]; var cycle: Bool; var len: Float }
        var seen = Set<Int>(), comps: [Comp] = []
        for s0 in 0..<segs.count where !seen.contains(s0) {
            var start = s0, entry = 0, closed = false
            for _ in 0...segs.count {
                guard let pe = partner[2 * start + entry] else { break }
                let ps = pe / 2
                if ps == s0 { closed = true; break }
                start = ps; entry = 1 - (pe % 2)
            }
            if closed { start = s0; entry = 0 }
            var list: [(Int, Int)] = []
            var s = start, e = entry
            for _ in 0...segs.count {
                if seen.contains(s) { break }
                seen.insert(s); list.append((s, e))
                guard let pe = partner[2 * s + (1 - e)] else { break }
                s = pe / 2; e = pe % 2
            }
            var isCycle = false
            if closed, list.count >= 3, let last = list.last, let pe = partner[2 * last.0 + (1 - last.1)] {
                isCycle = pe == 2 * list[0].0 + list[0].1
            }
            comps.append(Comp(list: list, cycle: isCycle, len: list.reduce(0) { $0 + simd_distance(segs[$1.0].a, segs[$1.0].b) }))
        }
        let ordered = comps.enumerated().sorted { l, r in
            if l.element.cycle != r.element.cycle { return l.element.cycle }
            if l.element.len != r.element.len { return l.element.len > r.element.len }
            return l.offset < r.offset
        }.map(\.element)
        guard let main = ordered.first(where: { $0.cycle && $0.list.count >= 3 }) ?? ordered.first(where: { !$0.cycle && $0.list.count >= 2 }) else {
            throw ContourError.message("Las paredes del escaneo no se unen entre sí: no se puede reconstruir la planta.")
        }

        // 4. vértices y paredes del contorno
        var V: [SIMD2<Float>] = [], W: [(open: Bool, h: Float, scan: Float)] = []
        let L = main.list, m = L.count
        let segLen: (Int) -> Float = { simd_distance(segs[$0].a, segs[$0].b) }
        if main.cycle {
            for k in 0..<m {
                let (s, e) = L[k]
                guard let c = cornerAt[2 * s + e] else { throw ContourError.message("Esquina sin unir en el escaneo.") }
                V.append(c); W.append((false, segs[s].height, segLen(s)))
            }
        } else {
            let (s0, e0) = L[0]
            V.append(e0 == 1 ? segs[s0].b : segs[s0].a)
            for k in 0..<m {
                let (s, e) = L[k]
                W.append((false, segs[s].height, segLen(s)))
                if k < m - 1 {
                    guard let c = cornerAt[2 * s + (1 - e)] else { throw ContourError.message("Esquina sin unir en el escaneo.") }
                    V.append(c)
                }
            }
            let (sl, el) = L[m - 1]
            V.append(el == 1 ? segs[sl].a : segs[sl].b)
            W.append((true, W[0].h, 0))
        }
        let n = V.count
        var E: [ContourWall] = (0..<n).map { k in ContourWall(a: V[k], b: V[(k + 1) % n], height: W[k].h, open: W[k].open, scanned: W[k].scan) }
        var area2: Float = 0
        for e in E { area2 += e.a.x * e.b.y - e.b.x * e.a.y }
        if area2 < 0 { E = E.reversed().map { ContourWall(a: $0.b, b: $0.a, height: $0.height, open: $0.open, scanned: $0.scanned) } }
        let cx = E.reduce(Float(0)) { $0 + $1.a.x } / Float(n), cy = E.reduce(Float(0)) { $0 + $1.a.y } / Float(n)
        var first = 0, best = Float.infinity
        for (k, e) in E.enumerated() {
            let a = atan2((e.a.y + e.b.y) / 2 - cy, (e.a.x + e.b.x) / 2 - cx)
            if a < best - 1e-6 { best = a; first = k }
        }
        E = Array(E[first...] + E[..<first])

        // 5. validación
        var problems: [String] = []
        let pts = E.map(\.a)
        if !isSimple(pts) { problems.append("las paredes se cruzan entre sí") }
        let ar = area(pts)
        if ar < 1.5 { problems.append(String(format: "la superficie resultante es de solo %.2f m²", ar).replacingOccurrences(of: ".", with: ",")) }
        for (k, e) in E.enumerated() where !e.open {
            let l = simd_distance(e.a, e.b)
            if abs(l - e.scanned) > max(0.4, 0.25 * e.scanned) {
                problems.append("la pared \(letter(k)) mide \(Int((l * 100).rounded())) cm en el contorno y \(Int((e.scanned * 100).rounded())) cm en el escaneo")
            }
        }
        if !problems.isEmpty {
            throw ContourError.message("No se ha podido reconstruir la planta con seguridad: " + problems.joined(separator: "; ") + ".")
        }
        let dropped = ordered.filter { $0.list.first?.0 != main.list.first?.0 }.reduce(0) { $0 + $1.list.count }
        return ContourResult(walls: E, merged: merged, dropped: dropped)
    }

    static func letter(_ i: Int) -> String { String(Character(UnicodeScalar(UInt8(65 + min(max(i, 0), 25))))) }

    static func area(_ p: [SIMD2<Float>]) -> Float {
        guard p.count >= 3 else { return 0 }
        var s: Float = 0
        for i in 0..<p.count { let a = p[i], b = p[(i + 1) % p.count]; s += a.x * b.y - b.x * a.y }
        return abs(s) / 2
    }

    static func isSimple(_ p: [SIMD2<Float>]) -> Bool {
        let n = p.count
        func o(_ a: SIMD2<Float>, _ b: SIMD2<Float>, _ c: SIMD2<Float>) -> Float {
            let v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
            return v > 0 ? 1 : (v < 0 ? -1 : 0)
        }
        for i in 0..<n {
            for j in (i + 2)..<max(i + 2, n) {
                if i == 0 && j == n - 1 { continue }
                let a = p[i], b = p[(i + 1) % n], c = p[j], d = p[(j + 1) % n]
                if o(a, b, c) != o(a, b, d) && o(c, d, a) != o(c, d, b) { return false }
            }
        }
        return true
    }
}
