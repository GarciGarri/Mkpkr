import SwiftUI
import simd

/// Instalaciones que importan para diseñar la cocina.
enum FixtureKind: String, Codable, CaseIterable, Identifiable {
    case agua, desague, enchufe, humos, gas

    var id: String { rawValue }

    var title: String {
        switch self {
        case .agua: return "Toma de agua"
        case .desague: return "Desagüe"
        case .enchufe: return "Enchufe"
        case .humos: return "Salida de humos"
        case .gas: return "Gas"
        }
    }

    var letter: String {
        switch self {
        case .agua: return "A"
        case .desague: return "D"
        case .enchufe: return "E"
        case .humos: return "H"
        case .gas: return "G"
        }
    }

    var color: Color {
        switch self {
        case .agua: return .blue
        case .desague: return .teal
        case .enchufe: return .purple
        case .humos: return .gray
        case .gas: return .orange
        }
    }

    var symbol: String {
        switch self {
        case .agua: return "drop.fill"
        case .desague: return "arrow.down.circle.fill"
        case .enchufe: return "powerplug.fill"
        case .humos: return "wind"
        case .gas: return "flame.fill"
        }
    }

    /// Altura habitual sobre el suelo, en metros, para las tomas añadidas a mano.
    var defaultHeight: Float {
        switch self {
        case .agua: return 0.5
        case .desague: return 0.4
        case .enchufe: return 1.1
        case .humos: return 2.2
        case .gas: return 0.6
        }
    }
}

struct Fixture: Codable, Identifiable, Hashable {
    enum Source: String, Codable {
        case manual, marcada, auto

        var title: String {
            switch self {
            case .manual: return "manual"
            case .marcada: return "marcada al escanear"
            case .auto: return "detectada"
            }
        }
    }

    var id = UUID()
    var kind: FixtureKind
    /// Posición en el sistema de coordenadas del escaneo (metros).
    var position: SIMD3<Float>
    var source: Source
    var confidence: Float?
}

struct CameraRay: Codable {
    var origin: SIMD3<Float>
    var direction: SIMD3<Float>
}

/// Instalación marcada con la cruz durante el escaneo. Se sitúa sobre las paredes
/// definitivas cuando RoomPlan termina de procesar.
struct PendingMark: Codable {
    var kind: FixtureKind
    var ray: CameraRay
    var hit: SIMD3<Float>?
}

/// Fotograma guardado durante el escaneo, con la cámara que lo tomó,
/// para poder buscar instalaciones después y situarlas en la pared.
struct KeyFrameMeta: Codable {
    var file: String
    var width: Int
    var height: Int
    var fx: Float
    var fy: Float
    var cx: Float
    var cy: Float
    /// Transformación de la cámara al mundo, 16 valores por columnas.
    var transform: [Float]
    /// 90 si la foto guardada está girada 90° en sentido horario respecto al sensor (para verla derecha con el móvil en vertical).
    var rotation: Int?

    var matrix: simd_float4x4 {
        guard transform.count == 16 else { return matrix_identity_float4x4 }
        let t = transform
        return simd_float4x4(
            SIMD4<Float>(t[0], t[1], t[2], t[3]),
            SIMD4<Float>(t[4], t[5], t[6], t[7]),
            SIMD4<Float>(t[8], t[9], t[10], t[11]),
            SIMD4<Float>(t[12], t[13], t[14], t[15])
        )
    }

    /// Rayo que sale de la cámara por un punto de la imagen (coordenadas 0–1, origen arriba a la izquierda).
    func ray(nx: Float, ny: Float) -> CameraRay {
        // Coordenadas de la foto girada → coordenadas del sensor: (x', y') = (1 − y, x) ⇒ (x, y) = (y', 1 − x').
        var sx = nx, sy = ny
        if rotation == 90 { sx = ny; sy = 1 - nx }
        let u = sx * Float(width), v = sy * Float(height)
        // Espacio de cámara de ARKit: x a la derecha, y arriba, mira hacia -z.
        let dc = simd_normalize(SIMD3<Float>((u - cx) / fx, -(v - cy) / fy, -1))
        let m = matrix
        let d = m * SIMD4<Float>(dc.x, dc.y, dc.z, 0)
        let o = m.columns.3
        return CameraRay(origin: SIMD3<Float>(o.x, o.y, o.z), direction: simd_normalize(SIMD3<Float>(d.x, d.y, d.z)))
    }

    static func flatten(_ m: simd_float4x4) -> [Float] {
        [m.columns.0, m.columns.1, m.columns.2, m.columns.3].flatMap { [$0.x, $0.y, $0.z, $0.w] }
    }
}

extension RoomSummary {
    var floorLevel: Float { floorY ?? 0 }

    /// Tramo de la pared i entre sus dos esquinas (mismo sentido que en Mkpkr Cocinas).
    func wallSegment(_ i: Int) -> (SIMD2<Float>, SIMD2<Float>) {
        let c = corners
        if walls.count >= 3, c.count == walls.count {
            return (c[i], c[(i + 1) % c.count])
        }
        return (walls[i].a, walls[i].b)
    }

    /// Esquina donde empieza la pared i, nombrada por las dos paredes que se juntan.
    func startCornerName(_ i: Int) -> String {
        let n = walls.count
        guard n >= 3 else { return "inicio" }
        return "\(RoomSummary.letter((i - 1 + n) % n))/\(RoomSummary.letter(i))"
    }

    /// Primera pared que corta el rayo.
    func intersect(_ r: CameraRay) -> SIMD3<Float>? {
        var best: (Float, SIMD3<Float>)?
        let o2 = SIMD2<Float>(r.origin.x, r.origin.z)
        let d2 = SIMD2<Float>(r.direction.x, r.direction.z)
        for (i, w) in walls.enumerated() where !isOpen(i) {
            let ab = w.b - w.a
            let len = simd_length(ab)
            guard len > 0.05 else { continue }
            let n = SIMD2<Float>(-ab.y, ab.x) / len
            let den = simd_dot(d2, n)
            if abs(den) < 1e-4 { continue }
            let t = -simd_dot(o2 - w.a, n) / den
            guard t > 0.15, t < 12 else { continue }
            let h = r.origin + r.direction * t
            let s = simd_dot(SIMD2<Float>(h.x, h.z) - w.a, ab) / (len * len)
            guard s > -0.03, s < 1.03, h.y > floorLevel - 0.1, h.y < floorLevel + w.height + 0.1 else { continue }
            if best == nil || t < best!.0 { best = (t, h) }
        }
        return best?.1
    }

    /// Pared, distancia desde su esquina inicial y altura sobre el suelo.
    func locate(_ p: SIMD3<Float>) -> (wall: Int, along: Float, height: Float)? {
        let q = SIMD2<Float>(p.x, p.z)
        var best: (Int, Float, Float)?
        for i in walls.indices where !isOpen(i) {
            let (s0, s1) = wallSegment(i)
            let ab = s1 - s0
            let len = simd_length(ab)
            guard len > 0.01 else { continue }
            let t = max(0, min(len, simd_dot(q - s0, ab / len)))
            let dist = simd_distance(q, s0 + ab / len * t)
            if best == nil || dist < best!.2 { best = (i, t, dist) }
        }
        guard let b = best else { return nil }
        return (b.0, b.1, p.y - floorLevel)
    }

    func point(wall i: Int, along: Float, height: Float) -> SIMD3<Float> {
        let (s0, s1) = wallSegment(i)
        let len = simd_length(s1 - s0)
        let d = len > 0 ? (s1 - s0) / len : SIMD2<Float>(1, 0)
        let p = s0 + d * max(0, min(len, along))
        return SIMD3<Float>(p.x, floorLevel + height, p.y)
    }

    func describe(_ f: Fixture) -> String {
        guard let l = locate(f.position) else { return "" }
        return "Pared \(RoomSummary.letter(l.wall)) · a \(cm(l.along)) de la esquina \(startCornerName(l.wall)) · altura \(cm(l.height))"
    }
}

/// Añade una instalación salvo que ya haya otra del mismo tipo a menos de 25 cm.
func mergeFixture(_ f: Fixture, into list: inout [Fixture]) {
    if let i = list.firstIndex(where: { $0.kind == f.kind && simd_distance($0.position, f.position) < 0.25 }) {
        if list[i].source == .auto && f.source == .auto {
            list[i].position = (list[i].position + f.position) / 2
            list[i].confidence = max(list[i].confidence ?? 0, f.confidence ?? 0)
        }
        return
    }
    list.append(f)
}
