import Foundation
import RoomPlan
import simd

/// Pared vista en planta (metros, plano X–Z de ARKit).
struct PlanWall: Codable, Hashable {
    var a: SIMD2<Float>
    var b: SIMD2<Float>
    var height: Float

    var length: Float { simd_distance(a, b) }
    var mid: SIMD2<Float> { (a + b) / 2 }
}

struct PlanOpening: Codable, Hashable {
    enum Kind: String, Codable {
        case puerta, ventana, hueco

        var title: String {
            switch self {
            case .puerta: return "Puerta"
            case .ventana: return "Ventana"
            case .hueco: return "Hueco de paso"
            }
        }
    }

    var kind: Kind
    var a: SIMD2<Float>
    var b: SIMD2<Float>
    var height: Float
    var sill: Float

    var width: Float { simd_distance(a, b) }
    var mid: SIMD2<Float> { (a + b) / 2 }
}

struct PlanObject: Codable, Hashable {
    var name: String
    var center: SIMD2<Float>
    /// ancho (x), alto (y), fondo (z)
    var size: SIMD3<Float>
    var angle: Float
}

/// Resumen en planta de un CapturedRoom de RoomPlan.
/// Las paredes se ordenan igual que en Mkpkr Cocinas (por ángulo alrededor del centro),
/// así las letras A, B, C… coinciden en la app y en la web.
struct RoomSummary: Codable, Hashable {
    var walls: [PlanWall]
    var openings: [PlanOpening]
    var objects: [PlanObject]
    var height: Float
    /// Altura del suelo en el sistema del escaneo (metros). Opcional para escaneos antiguos.
    var floorY: Float?
    /// Contorno reconstruido (esquinas en orden). nil en escaneos antiguos o si no se pudo reconstruir.
    var contour: [SIMD2<Float>]?
    /// Lados sin pared (cocina abierta), por índice de pared.
    var openWalls: [Int]?
    /// Aviso cuando la planta no se ha podido reconstruir con seguridad.
    var contourNote: String?
    /// Tramos unidos y tabiques sueltos apartados al reconstruir.
    var mergedSegments: Int?
    var droppedSegments: Int?

    init(room: CapturedRoom) {
        let floorY = room.walls.map { $0.transform.columns.3.y - $0.dimensions.y / 2 }.min() ?? 0

        func ends(_ t: simd_float4x4, _ width: Float) -> (SIMD2<Float>, SIMD2<Float>) {
            let c = SIMD2<Float>(t.columns.3.x, t.columns.3.z)
            var u = SIMD2<Float>(t.columns.0.x, t.columns.0.z)
            let l = simd_length(u)
            u = l > 0 ? u / l : SIMD2<Float>(1, 0)
            return (c - u * (width / 2), c + u * (width / 2))
        }

        let segs: [WallSegment] = room.walls.map { w in
            let e = ends(w.transform, w.dimensions.x)
            return WallSegment(a: e.0, b: e.1, height: w.dimensions.y)
        }
        var ws: [PlanWall]
        var contour: [SIMD2<Float>]? = nil, open: [Int]? = nil, note: String? = nil, merged: Int? = nil, dropped: Int? = nil
        do {
            // Mismo algoritmo que Mkpkr Cocinas: las letras A, B, C… coinciden en la app y en la web.
            let r = try PlanGeometry.buildContour(segs)
            ws = r.walls.map { PlanWall(a: $0.a, b: $0.b, height: $0.height) }
            contour = r.corners; open = r.openIndices; merged = r.merged; dropped = r.dropped
        } catch {
            note = error.localizedDescription
            ws = segs.map { PlanWall(a: $0.a, b: $0.b, height: $0.height) }
            if !ws.isEmpty {
                let c = ws.reduce(SIMD2<Float>(0, 0)) { $0 + $1.mid } / Float(ws.count)
                ws.sort { atan2($0.mid.y - c.y, $0.mid.x - c.x) < atan2($1.mid.y - c.y, $1.mid.x - c.x) }
            }
        }

        var ops: [PlanOpening] = []
        let groups: [([CapturedRoom.Surface], PlanOpening.Kind)] = [(room.doors, .puerta), (room.windows, .ventana), (room.openings, .hueco)]
        for (list, kind) in groups {
            for s in list {
                let e = ends(s.transform, s.dimensions.x)
                let sill = max(0, s.transform.columns.3.y - s.dimensions.y / 2 - floorY)
                ops.append(PlanOpening(kind: kind, a: e.0, b: e.1, height: s.dimensions.y, sill: sill))
            }
        }

        let objs: [PlanObject] = room.objects.map { o in
            PlanObject(
                name: RoomSummary.name(o.category),
                center: SIMD2<Float>(o.transform.columns.3.x, o.transform.columns.3.z),
                size: o.dimensions,
                angle: atan2(o.transform.columns.0.z, o.transform.columns.0.x)
            )
        }

        walls = ws
        openings = ops
        objects = objs
        height = room.walls.map { $0.dimensions.y }.max() ?? 0
        self.floorY = floorY
        self.contour = contour
        self.openWalls = open
        self.contourNote = note
        self.mergedSegments = merged
        self.droppedSegments = dropped
    }

    func isOpen(_ i: Int) -> Bool { openWalls?.contains(i) ?? false }

    /// Esquinas: intersección de cada pared con la anterior.
    var corners: [SIMD2<Float>] {
        if let c = contour, c.count == walls.count { return c }
        let n = walls.count
        guard n >= 3 else { return walls.flatMap { [$0.a, $0.b] } }
        return (0..<n).map { k in
            let p = walls[(k - 1 + n) % n], q = walls[k]
            let du = p.b - p.a, dv = q.b - q.a
            let det = du.x * dv.y - du.y * dv.x
            if abs(det) < 0.15 * simd_length(du) * simd_length(dv) {
                return (p.b + q.a) / 2
            }
            let t = ((q.a.x - p.a.x) * dv.y - (q.a.y - p.a.y) * dv.x) / det
            return p.a + du * t
        }
    }

    var area: Float {
        let c = corners
        guard c.count >= 3 else { return 0 }
        var s: Float = 0
        for i in 0..<c.count {
            let a = c[i], b = c[(i + 1) % c.count]
            s += a.x * b.y - b.x * a.y
        }
        return abs(s) / 2
    }

    var perimeter: Float { walls.enumerated().reduce(0) { $0 + (isOpen($1.offset) ? 0 : $1.element.length) } }

    /// Pared más cercana a un punto de la planta.
    func wallIndex(near p: SIMD2<Float>) -> Int? {
        var best: (Int, Float)?
        for (i, w) in walls.enumerated() where !isOpen(i) {
            let d = w.b - w.a
            let len2 = simd_length_squared(d)
            let t = len2 > 0 ? max(0, min(1, simd_dot(p - w.a, d) / len2)) : 0
            let dist = simd_distance(p, w.a + d * t)
            if best == nil || dist < best!.1 { best = (i, dist) }
        }
        return best?.0
    }

    static func letter(_ i: Int) -> String {
        String(Character(UnicodeScalar(UInt8(65 + min(i, 25)))))
    }

    static func name(_ c: CapturedRoom.Object.Category) -> String {
        switch c {
        case .refrigerator: return "Frigorífico"
        case .stove: return "Placa"
        case .oven: return "Horno"
        case .sink: return "Fregadero"
        case .dishwasher: return "Lavavajillas"
        case .washerDryer: return "Lavadora"
        case .storage: return "Mueble"
        case .table: return "Mesa"
        case .chair: return "Silla"
        default: return "Objeto"
        }
    }
}
