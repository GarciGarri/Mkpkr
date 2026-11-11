// Pruebas de PlanGeometry con los casos compartidos con la web (shared/fixtures/rooms.json).
// Se compilan aparte, sin RoomPlan:  swiftc MkpkrScan/PlanGeometry.swift Tests/main.swift -o geomtest && ./geomtest ../../shared/fixtures/rooms.json
import Foundation
import simd

struct Fixture: Decodable {
    struct Expect: Decodable { let area: Float; let walls: Int; let open: Int }
    let name: String
    let poly: [[Float]]
    let rot: Float?
    let split: [Int]?
    let drop: [Int]?
    let extra: [[Float]]?
    let shrink: Float?
    let expect: Expect?
    let reject: Bool?
}
struct File: Decodable { let cases: [Fixture] }

// Misma generación que web/tests/02-import.test.cjs
func segments(_ c: Fixture) -> [WallSegment] {
    var segs: [[Float]] = []
    let P = c.poly, n = P.count
    if n >= 2 {
        for i in 0..<n {
            if (c.drop ?? []).contains(i) { continue }
            let a = P[i], b = P[(i + 1) % n]
            if (c.split ?? []).contains(i) {
                let m = [a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4]
                segs.append([a[0], a[1], m[0], m[1]]); segs.append([m[0], m[1], b[0], b[1]])
            } else { segs.append([a[0], a[1], b[0], b[1]]) }
        }
    }
    for e in c.extra ?? [] { segs.append(e) }
    let sh = c.shrink ?? 0, rot = c.rot ?? 0, cs = cos(rot), sn = sin(rot)
    let out: [[Float]] = segs.map { s in
        let l = hypot(s[2] - s[0], s[3] - s[1]), ux = (s[2] - s[0]) / l, uz = (s[3] - s[1]) / l
        let p = [s[0] + ux * sh, s[1] + uz * sh, s[2] - ux * sh, s[3] - uz * sh]
        func R(_ x: Float, _ z: Float) -> [Float] { [x * cs - z * sn + 1.7, x * sn + z * cs - 0.9] }
        return R(p[0], p[1]) + R(p[2], p[3])
    }
    let shuffled = out.enumerated().map { ((($0.offset * 7 + 3) % out.count), $0.element) }.sorted { $0.0 < $1.0 }.map { $0.1 }
    return shuffled.map { WallSegment(a: SIMD2($0[0], $0[1]), b: SIMD2($0[2], $0[3]), height: 2.5) }
}

let path = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "../../shared/fixtures/rooms.json"
let data = try Data(contentsOf: URL(fileURLWithPath: path))
let file = try JSONDecoder().decode(File.self, from: data)
var failures = 0
for c in file.cases {
    do {
        let r = try PlanGeometry.buildContour(segments(c))
        let area = PlanGeometry.area(r.corners), open = r.openIndices.count
        if c.reject == true { failures += 1; print("✗ debería rechazar: \(c.name) (área \(area))"); continue }
        guard let e = c.expect else { continue }
        let ok = abs(area - e.area) / e.area < 0.01 && r.walls.count == e.walls && open == e.open && PlanGeometry.isSimple(r.corners)
        if !ok { failures += 1 }
        print("\(ok ? "✓" : "✗") \(c.name): área \(String(format: "%.2f", area)) m² (esperada \(e.area)), \(r.walls.count) paredes, \(open) abiertas")
    } catch {
        if c.reject == true { print("✓ rechaza: \(c.name)") } else { failures += 1; print("✗ \(c.name): \(error.localizedDescription)") }
    }
}
print(failures == 0 ? "Todas las pruebas de geometría correctas (\(file.cases.count))." : "\(failures) pruebas fallidas.")
exit(failures == 0 ? 0 : 1)
