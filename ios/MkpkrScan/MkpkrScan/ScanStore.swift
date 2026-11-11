import Foundation
import RoomPlan

struct ManualMeasure: Codable, Identifiable, Hashable {
    var id = UUID()
    var label: String
    var centimeters: Double
}

struct ScanRecord: Codable, Identifiable, Hashable {
    var id: UUID
    var name: String
    var date: Date
    var summary: RoomSummary
    var measures: [ManualMeasure]
    var fixtures: [Fixture]
    var frameCount: Int
    var detectionDone: Bool
    /// Medidas tomadas con láser por pared (índice → cm).
    var realLengths: [Int: Float]

    init(id: UUID, name: String, date: Date, summary: RoomSummary, measures: [ManualMeasure] = [], fixtures: [Fixture] = [], frameCount: Int = 0, detectionDone: Bool = false, realLengths: [Int: Float] = [:]) {
        self.id = id
        self.name = name
        self.date = date
        self.summary = summary
        self.measures = measures
        self.fixtures = fixtures
        self.frameCount = frameCount
        self.detectionDone = detectionDone
        self.realLengths = realLengths
    }

    // Los escaneos guardados con versiones anteriores no tienen los campos nuevos.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        date = try c.decode(Date.self, forKey: .date)
        summary = try c.decode(RoomSummary.self, forKey: .summary)
        measures = try c.decodeIfPresent([ManualMeasure].self, forKey: .measures) ?? []
        fixtures = try c.decodeIfPresent([Fixture].self, forKey: .fixtures) ?? []
        frameCount = try c.decodeIfPresent(Int.self, forKey: .frameCount) ?? 0
        detectionDone = try c.decodeIfPresent(Bool.self, forKey: .detectionDone) ?? false
        realLengths = try c.decodeIfPresent([Int: Float].self, forKey: .realLengths) ?? [:]
    }
}

/// Guarda cada escaneo en Documentos/Escaneos/<id>/ (visible en la app Archivos):
/// captured-room.json (CapturedRoom de RoomPlan), modelo.usdz y meta.json.
/// Las fotos para la detección van aparte, en Application Support (no visibles en Archivos,
/// fuera de la copia de seguridad y protegidas mientras el iPhone está bloqueado).
@MainActor
final class ScanStore: ObservableObject {
    @Published private(set) var scans: [ScanRecord] = []
    private let root: URL
    private let privateRoot: URL
    private let fm = FileManager.default

    init() {
        root = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Escaneos", isDirectory: true)
        try? fm.createDirectory(at: root, withIntermediateDirectories: true)
        var priv = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Fotos", isDirectory: true)
        try? fm.createDirectory(at: priv, withIntermediateDirectories: true)
        var rv = URLResourceValues(); rv.isExcludedFromBackup = true; try? priv.setResourceValues(rv)
        privateRoot = priv
        load()
    }

    func folder(_ id: UUID) -> URL { root.appendingPathComponent(id.uuidString, isDirectory: true) }
    func capturedURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("captured-room.json") }
    func modelURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("modelo.usdz") }
    private func metaURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("meta.json") }
    private func framesDir(_ id: UUID) -> URL { privateRoot.appendingPathComponent(id.uuidString, isDirectory: true) }
    /// Ubicación de las versiones anteriores (dentro de Documentos).
    private func legacyFramesDir(_ id: UUID) -> URL { folder(id).appendingPathComponent("frames", isDirectory: true) }

    func scan(_ id: UUID) -> ScanRecord? { scans.first { $0.id == id } }

    func load() {
        let dirs = (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        let dec = JSONDecoder()
        scans = dirs.compactMap { dir -> ScanRecord? in
            guard let data = try? Data(contentsOf: dir.appendingPathComponent("meta.json")),
                  var rec = try? dec.decode(ScanRecord.self, from: data) else { return nil }
            // Escaneos de versiones anteriores: recalcula el resumen (altura del suelo y contorno).
            if rec.summary.floorY == nil || (rec.summary.contour == nil && rec.summary.contourNote == nil),
               let raw = try? Data(contentsOf: dir.appendingPathComponent("captured-room.json")),
               let room = try? dec.decode(CapturedRoom.self, from: raw) {
                rec.summary = RoomSummary(room: room)
                try? write(rec)
            }
            return rec
        }
        .sorted { $0.date > $1.date }
    }

    @discardableResult
    func add(room: CapturedRoom, name: String, frames: [(KeyFrameMeta, Data)], marks: [PendingMark]) throws -> ScanRecord {
        let id = UUID()
        try fm.createDirectory(at: folder(id), withIntermediateDirectories: true)
        try JSONEncoder().encode(room).write(to: capturedURL(id))
        try? room.export(to: modelURL(id))

        let summary = RoomSummary(room: room)

        // Fotos para la detección automática: se eligen las que mejor cubren cada pared.
        var metas: [KeyFrameMeta] = []
        let chosen = Self.selectFrames(frames, summary: summary, max: 24)
        if !chosen.isEmpty {
            try? fm.createDirectory(at: framesDir(id), withIntermediateDirectories: true)
            for (i, f) in chosen.enumerated() {
                var m = f.0
                m.file = String(format: "%03d.jpg", i)
                if (try? f.1.write(to: framesDir(id).appendingPathComponent(m.file), options: [.completeFileProtectionUntilFirstUserAuthentication])) != nil { metas.append(m) }
            }
            try? JSONEncoder().encode(metas).write(to: framesDir(id).appendingPathComponent("frames.json"))
        }

        // Instalaciones marcadas con la cruz: se sitúan sobre las paredes definitivas.
        var fixtures: [Fixture] = []
        for m in marks {
            guard let p = summary.intersect(m.ray) ?? m.hit else { continue }
            mergeFixture(Fixture(kind: m.kind, position: p, source: .marcada), into: &fixtures)
        }

        let rec = ScanRecord(id: id, name: name, date: Date(), summary: summary, fixtures: fixtures, frameCount: metas.count)
        try write(rec)
        scans.insert(rec, at: 0)
        return rec
    }

    func loadFrames(_ id: UUID) -> [(KeyFrameMeta, Data)] {
        for dir in [framesDir(id), legacyFramesDir(id)] {
            guard let data = try? Data(contentsOf: dir.appendingPathComponent("frames.json")),
                  let metas = try? JSONDecoder().decode([KeyFrameMeta].self, from: data) else { continue }
            return metas.compactMap { m in
                guard let d = try? Data(contentsOf: dir.appendingPathComponent(m.file)) else { return nil }
                return (m, d)
            }
        }
        return []
    }

    /// Hasta `max` fotos repartidas entre las paredes que se ven en ellas (por turnos), para que
    /// ninguna pared se quede sin fotos aunque el recorrido haya sido desigual.
    static func selectFrames(_ frames: [(KeyFrameMeta, Data)], summary: RoomSummary, max: Int) -> [(KeyFrameMeta, Data)] {
        guard frames.count > max else { return frames }
        var byWall: [Int: [Int]] = [:]
        for (i, f) in frames.enumerated() {
            let wall = summary.intersect(f.0.ray(nx: 0.5, ny: 0.5)).flatMap { summary.locate($0)?.wall } ?? -1
            byWall[wall, default: []].append(i)
        }
        var picked: [Int] = []
        var queues = byWall.keys.sorted().map { byWall[$0]! }
        while picked.count < max && queues.contains(where: { !$0.isEmpty }) {
            for k in queues.indices where !queues[k].isEmpty && picked.count < max {
                // dentro de cada pared, se alternan fotos del principio y del final del recorrido
                let take = picked.count % 2 == 0 ? queues[k].removeFirst() : queues[k].removeLast()
                picked.append(take)
            }
        }
        return picked.sorted().map { frames[$0] }
    }

    func update(_ rec: ScanRecord) {
        try? write(rec)
        if let i = scans.firstIndex(where: { $0.id == rec.id }) { scans[i] = rec }
    }

    func delete(_ id: UUID) {
        try? fm.removeItem(at: folder(id))
        try? fm.removeItem(at: framesDir(id))
        scans.removeAll { $0.id == id }
    }

    private func write(_ rec: ScanRecord) throws {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted]
        try enc.encode(rec).write(to: metaURL(rec.id))
    }

    /// Archivos para enviar: el JSON de RoomPlan (lo abre Mkpkr Cocinas) con las medidas
    /// sueltas y las instalaciones en la clave "mkpkr", el modelo USDZ y el plano en PNG.
    func exportFiles(_ rec: ScanRecord, planPNG: Data?) throws -> [URL] {
        let dir = fm.temporaryDirectory.appendingPathComponent("export-\(rec.id.uuidString)", isDirectory: true)
        try? fm.removeItem(at: dir)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let base = Self.safeName(rec.name)

        let raw = try Data(contentsOf: capturedURL(rec.id))
        var obj = (try JSONSerialization.jsonObject(with: raw)) as? [String: Any] ?? [:]
        let floor = rec.summary.floorLevel
        var mk: [String: Any] = [:]
        // Planta ya resuelta en la app: Mkpkr Cocinas la usa tal cual (mismas letras de pared).
        if rec.summary.contour != nil {
            var planta: [String: Any] = [
                "esquinas": rec.summary.corners.map { [Double($0.x), Double($0.y)] },
                "abiertas": rec.summary.openWalls ?? [],
                "altura_cm": Double((rec.summary.height * 100).rounded()),
            ]
            if !rec.realLengths.isEmpty {
                planta["paredes_reales"] = Dictionary(uniqueKeysWithValues: rec.realLengths.map { (String($0.key), Double($0.value)) })
            }
            mk["planta"] = planta
        }
        obj["mkpkr"] = mk.merging([
            "formato": "mkpkr-scan",
            "version": 2,
            "nombre": rec.name,
            "fecha": ISO8601DateFormatter().string(from: rec.date),
            "medidas": rec.measures.map { ["etiqueta": $0.label, "cm": ($0.centimeters * 10).rounded() / 10] },
            "instalaciones": rec.fixtures.map { f -> [String: Any] in
                [
                    "tipo": f.kind.rawValue,
                    "x": Double(f.position.x),
                    "z": Double(f.position.z),
                    "altura_cm": Double(((f.position.y - floor) * 100).rounded()),
                    "origen": f.source.rawValue,
                ]
            },
        ] as [String: Any]) { _, new in new }
        let json = dir.appendingPathComponent("\(base).json")
        try JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted]).write(to: json)
        var urls = [json]

        if fm.fileExists(atPath: modelURL(rec.id).path) {
            let dst = dir.appendingPathComponent("\(base).usdz")
            try fm.copyItem(at: modelURL(rec.id), to: dst)
            urls.append(dst)
        }
        if let planPNG {
            let png = dir.appendingPathComponent("\(base)-planta.png")
            try planPNG.write(to: png)
            urls.append(png)
        }
        return urls
    }

    static func safeName(_ s: String) -> String {
        let folded = s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es_ES"))
        let cleaned = folded.lowercased().map { $0.isLetter || $0.isNumber ? $0 : "-" }
        let joined = String(cleaned).split(separator: "-").joined(separator: "-")
        return joined.isEmpty ? "cocina" : String(joined.prefix(40))
    }
}
