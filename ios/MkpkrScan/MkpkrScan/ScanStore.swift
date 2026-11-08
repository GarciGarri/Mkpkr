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
}

/// Guarda cada escaneo en Documentos/Escaneos/<id>/ (visible en la app Archivos):
/// captured-room.json (CapturedRoom de RoomPlan), modelo.usdz y meta.json.
@MainActor
final class ScanStore: ObservableObject {
    @Published private(set) var scans: [ScanRecord] = []
    private let root: URL
    private let fm = FileManager.default

    init() {
        root = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Escaneos", isDirectory: true)
        try? fm.createDirectory(at: root, withIntermediateDirectories: true)
        load()
    }

    func folder(_ id: UUID) -> URL { root.appendingPathComponent(id.uuidString, isDirectory: true) }
    func capturedURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("captured-room.json") }
    func modelURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("modelo.usdz") }
    private func metaURL(_ id: UUID) -> URL { folder(id).appendingPathComponent("meta.json") }

    func scan(_ id: UUID) -> ScanRecord? { scans.first { $0.id == id } }

    func load() {
        let dirs = (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        let dec = JSONDecoder()
        scans = dirs.compactMap { dir in
            guard let data = try? Data(contentsOf: dir.appendingPathComponent("meta.json")) else { return nil }
            return try? dec.decode(ScanRecord.self, from: data)
        }
        .sorted { $0.date > $1.date }
    }

    @discardableResult
    func add(room: CapturedRoom, name: String) throws -> ScanRecord {
        let id = UUID()
        try fm.createDirectory(at: folder(id), withIntermediateDirectories: true)
        try JSONEncoder().encode(room).write(to: capturedURL(id))
        try? room.export(to: modelURL(id))
        let rec = ScanRecord(id: id, name: name, date: Date(), summary: RoomSummary(room: room), measures: [])
        try write(rec)
        scans.insert(rec, at: 0)
        return rec
    }

    func update(_ rec: ScanRecord) {
        try? write(rec)
        if let i = scans.firstIndex(where: { $0.id == rec.id }) { scans[i] = rec }
    }

    func delete(_ id: UUID) {
        try? fm.removeItem(at: folder(id))
        scans.removeAll { $0.id == id }
    }

    private func write(_ rec: ScanRecord) throws {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted]
        try enc.encode(rec).write(to: metaURL(rec.id))
    }

    /// Archivos para enviar: el JSON de RoomPlan (lo abre Mkpkr Cocinas) con las medidas
    /// manuales añadidas en la clave "mkpkr", el modelo USDZ y el plano en PNG.
    func exportFiles(_ rec: ScanRecord, planPNG: Data?) throws -> [URL] {
        let dir = fm.temporaryDirectory.appendingPathComponent("export-\(rec.id.uuidString)", isDirectory: true)
        try? fm.removeItem(at: dir)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let base = Self.safeName(rec.name)

        let raw = try Data(contentsOf: capturedURL(rec.id))
        var obj = (try JSONSerialization.jsonObject(with: raw)) as? [String: Any] ?? [:]
        obj["mkpkr"] = [
            "formato": "mkpkr-scan",
            "version": 1,
            "nombre": rec.name,
            "fecha": ISO8601DateFormatter().string(from: rec.date),
            "medidas": rec.measures.map { ["etiqueta": $0.label, "cm": ($0.centimeters * 10).rounded() / 10] },
        ] as [String: Any]
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
