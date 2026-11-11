import Foundation
import Security
import SwiftUI

/// Clave de API de Anthropic guardada en el llavero del iPhone.
enum APIKeyStore {
    private static let service = "com.mkpkr.scan.anthropic"

    static func read() -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        let s = String(data: d, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (s?.isEmpty ?? true) ? nil : s
    }

    static func save(_ key: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service]
        SecItemDelete(base as CFDictionary)
        let k = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !k.isEmpty else { return }
        var add = base
        add[kSecValueData as String] = Data(k.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

struct Detection: Decodable {
    let imagen: Int
    let tipo: String
    let x: Double
    let y: Double
    let confianza: Double
    let nota: String
}

enum DetectorError: LocalizedError {
    case http(Int, String)
    case refused
    case badResponse

    var errorDescription: String? {
        switch self {
        case .http(401, _): return "La clave de API no es válida. Revísala en Ajustes."
        case .http(429, _): return "Demasiadas peticiones a Claude. Prueba en un minuto."
        case let .http(code, msg): return "Claude respondió con un error \(code): \(msg)"
        case .refused: return "Claude no ha querido analizar estas imágenes."
        case .badResponse: return "La respuesta de Claude no tiene el formato esperado."
        }
    }
}

/// Llama a la API de Claude (Messages) con varios fotogramas y devuelve las instalaciones vistas.
struct ClaudeClient {
    let apiKey: String
    static let model = "claude-opus-5-5"

    private static let prompt = """
    Eres técnico de reformas de cocinas. Las imágenes son fotogramas del escaneo de una cocina con un iPhone; pueden aparecer giradas 90 grados.
    Localiza en cada imagen las instalaciones que se vean con claridad:
    - enchufe: bases de enchufe en pared o en regleta empotrada (no interruptores ni puntos de luz).
    - agua: llaves de paso, tomas de agua del fregadero, lavadora o lavavajillas, grifos empotrados.
    - desague: tubos de desagüe que salen de la pared o del suelo, sifones, manguetones.
    - humos: salida de humos o de extracción (rejilla, tubo, hueco en pared o techo, campana existente: marca su salida).
    - gas: llaves o tomas de gas.
    Para cada una da el centro con x e y entre 0 y 1 sobre la imagen tal como la recibes (0,0 es la esquina superior izquierda), el número de imagen indicado antes de cada una, una confianza entre 0 y 1 y una nota breve.
    Si la misma toma aparece en varias imágenes, indícala en cada una. No inventes: si no hay ninguna, devuelve la lista vacía.
    """

    private static let schema: [String: Any] = [
        "type": "object",
        "properties": [
            "detecciones": [
                "type": "array",
                "items": [
                    "type": "object",
                    "properties": [
                        "imagen": ["type": "integer"],
                        "tipo": ["type": "string", "enum": FixtureKind.allCases.map(\.rawValue)],
                        "x": ["type": "number"],
                        "y": ["type": "number"],
                        "confianza": ["type": "number"],
                        "nota": ["type": "string"],
                    ],
                    "required": ["imagen", "tipo", "x", "y", "confianza", "nota"],
                    "additionalProperties": false,
                ],
            ],
        ],
        "required": ["detecciones"],
        "additionalProperties": false,
    ]

    func detect(images: [Data]) async throws -> [Detection] {
        var content: [[String: Any]] = []
        for (i, d) in images.enumerated() {
            content.append(["type": "text", "text": "Imagen \(i)"])
            content.append(["type": "image", "source": ["type": "base64", "media_type": "image/jpeg", "data": d.base64EncodedString()]])
        }
        content.append(["type": "text", "text": Self.prompt])

        let body: [String: Any] = [
            "model": Self.model,
            "max_tokens": 16000,
            "output_config": [
                "effort": "medium",
                "format": ["type": "json_schema", "schema": Self.schema],
            ],
            "fallbacks": "default",
            "messages": [["role": "user", "content": content]],
        ]

        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = 240
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2026-10-21", forHTTPHeaderField: "anthropic-version")
        req.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard code == 200 else {
            let msg = ((json?["error"] as? [String: Any])?["message"] as? String) ?? String(data: data, encoding: .utf8) ?? ""
            throw DetectorError.http(code, String(msg.prefix(200)))
        }
        if (json?["stop_reason"] as? String) == "refusal" { throw DetectorError.refused }
        let blocks = json?["content"] as? [[String: Any]] ?? []
        guard let text = blocks.first(where: { ($0["type"] as? String) == "text" })?["text"] as? String,
              let parsed = try? JSONDecoder().decode([String: [Detection]].self, from: Data(text.utf8)),
              let list = parsed["detecciones"]
        else { throw DetectorError.badResponse }
        return list
    }
}

/// Busca instalaciones en los fotogramas de un escaneo y las sitúa en las paredes.
@MainActor
final class FixtureDetector: ObservableObject {
    @Published var running = false
    @Published var status: String?
    @Published var errorText: String?

    func run(store: ScanStore, id: UUID) async {
        guard !running, let key = APIKeyStore.read(), var rec = store.scan(id) else { return }
        let frames = store.loadFrames(id)
        guard !frames.isEmpty else {
            errorText = "Este escaneo no tiene fotogramas guardados. Vuelve a escanear con esta versión de la app."
            return
        }
        running = true
        errorText = nil
        defer { running = false }

        let client = ClaudeClient(apiKey: key)
        let batchSize = 5
        let batches = stride(from: 0, to: frames.count, by: batchSize).map { Array(frames[$0..<min($0 + batchSize, frames.count)]) }
        var found: [Fixture] = []
        var failures = 0
        batchLoop: for (b, batch) in batches.enumerated() {
            status = "Analizando fotos \(b * batchSize + 1)–\(b * batchSize + batch.count) de \(frames.count)…"
            do {
                let dets = try await client.detect(images: batch.map(\.1))
                for d in dets where d.confianza >= 0.5 {
                    guard d.imagen >= 0, d.imagen < batch.count, let kind = FixtureKind(rawValue: d.tipo) else { continue }
                    let meta = batch[d.imagen].0
                    let ray = meta.ray(nx: Float(min(max(d.x, 0), 1)), ny: Float(min(max(d.y, 0), 1)))
                    guard let p = rec.summary.intersect(ray) else { continue }
                    mergeFixture(Fixture(kind: kind, position: p, source: .auto, confidence: Float(d.confianza)), into: &found)
                }
            } catch {
                failures += 1
                errorText = error.localizedDescription
                if case DetectorError.http(401, _) = error { break batchLoop }
            }
        }

        guard let latest = store.scan(id) else { return }
        rec = latest
        if failures == 0 {
            // Todo analizado: las detecciones nuevas sustituyen a las anteriores (las manuales y marcadas se conservan).
            rec.fixtures.removeAll { $0.source == .auto }
            rec.detectionDone = true
        }
        // Si algún lote ha fallado, se añaden las nuevas sin borrar nada y se puede volver a intentar.
        for f in found { mergeFixture(f, into: &rec.fixtures) }
        store.update(rec)
        if failures == batches.count {
            status = nil
        } else if failures > 0 {
            status = "Analizadas \(batches.count - failures) de \(batches.count) tandas de fotos: \(found.count) instalaciones nuevas. Vuelve a intentarlo para completar."
        } else {
            status = found.isEmpty
                ? "No se ha detectado ninguna instalación. Añádelas a mano tocando el plano."
                : "Detectadas \(found.count) instalaciones. Revísalas y corrige lo que haga falta."
        }
    }

    /// Coste aproximado en dólares de analizar `images` fotos de 1024 px con Claude Opus 5.5
    /// (unos 1.150 tókenes de entrada por foto y unos 1.500 de salida por tanda de 5 fotos; 4 $ y 20 $ por millón).
    static func estimatedCost(images: Int) -> Double {
        let batches = (images + 4) / 5
        let input = Double(images * 1150 + batches * 700), output = Double(batches * 1500)
        return input * 4e-6 + output * 20e-6
    }
}

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var key = APIKeyStore.read() ?? ""
    @AppStorage("saveFrames") private var saveFrames = true
    private var version: String {
        let i = Bundle.main.infoDictionary
        return "\(i?["CFBundleShortVersionString"] as? String ?? "?") (\(i?["CFBundleVersion"] as? String ?? "?"))"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("sk-ant-…", text: $key)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Clave de API de Claude")
                } footer: {
                    Text("Sirve para detectar automáticamente enchufes, tomas de agua, desagües, gas y salidas de humos en las fotos del escaneo. Créala en console.anthropic.com → API Keys. Cada análisis cuesta del orden de 0,10–0,40 $ según el número de fotos y se cobra en esa cuenta; la app te enseña la estimación antes de enviar. La clave se guarda solo en el llavero de este iPhone.")
                }
                if APIKeyStore.read() != nil {
                    Section {
                        Button("Borrar la clave", role: .destructive) { key = ""; APIKeyStore.save("") }
                    }
                }
                Section {
                    Toggle("Guardar fotos para detectar instalaciones", isOn: $saveFrames)
                } header: {
                    Text("Privacidad")
                } footer: {
                    Text("Durante el escaneo la app guarda hasta 24 fotos de la cocina para buscar instalaciones. Se guardan solo en este iPhone, fuera de la copia de seguridad, y solo se envían a Anthropic (Claude) cuando pulsas «Detectar» y lo confirmas. Si lo desactivas, las instalaciones se marcan con la cruz o a mano.")
                }
                Section {
                    LabeledContent("Versión", value: version)
                }
            }
            .navigationTitle("Ajustes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { APIKeyStore.save(key); dismiss() }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
}
