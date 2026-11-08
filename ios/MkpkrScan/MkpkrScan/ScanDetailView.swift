import SwiftUI
import QuickLook
import simd

struct ShareBundle: Identifiable {
    let id = UUID()
    let urls: [URL]
}

/// Borrador de una instalación para el editor manual.
struct FixtureDraft: Identifiable {
    let id = UUID()
    var fixtureID: UUID?
    var kind: FixtureKind
    var wall: Int
    var alongCm: Double
    var heightCm: Double
}

struct ScanDetailView: View {
    @EnvironmentObject private var store: ScanStore
    @Environment(\.dismiss) private var dismiss
    let id: UUID

    @StateObject private var detector = FixtureDetector()
    @State private var measuring = false
    @State private var showing3D = false
    @State private var showingSettings = false
    @State private var share: ShareBundle?
    @State private var draft: FixtureDraft?
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmDelete = false
    @State private var errorText: String?
    @State private var hasKey = APIKeyStore.read() != nil

    var body: some View {
        if let s = store.scan(id) {
            content(s)
        } else {
            Text("Este escaneo ya no existe.").foregroundStyle(.secondary)
        }
    }

    private func content(_ s: ScanRecord) -> some View {
        let sum = s.summary
        return List {
            Section {
                FloorPlanView(summary: sum, fixtures: s.fixtures) { p in
                    newFixture(at: p, in: s)
                }
                .frame(height: 320)
                .padding(.vertical, 8)
            } footer: {
                Text("Toca el plano donde haya un enchufe, una toma o un desagüe para añadirlo. Cotas en cm. Amarillo: puertas · celeste: ventanas · azul: muebles y electrodomésticos.")
            }

            Section {
                if s.fixtures.isEmpty {
                    Text("Sin instalaciones todavía.").foregroundStyle(.secondary)
                }
                ForEach(s.fixtures) { f in
                    Button { edit(f, in: s) } label: { fixtureRow(f, sum) }
                        .foregroundStyle(.primary)
                }
                .onDelete { idx in
                    guard var r = store.scan(id) else { return }
                    r.fixtures.remove(atOffsets: idx)
                    store.update(r)
                }

                if detector.running {
                    HStack {
                        ProgressView()
                        Text(detector.status ?? "Analizando…").font(.subheadline)
                    }
                } else if hasKey {
                    Button {
                        Task { await detector.run(store: store, id: id) }
                    } label: {
                        Label(s.detectionDone ? "Volver a detectar automáticamente" : "Detectar automáticamente", systemImage: "sparkles")
                    }
                    .disabled(s.frameCount == 0)
                } else {
                    Button { showingSettings = true } label: {
                        Label("Activar la detección automática", systemImage: "sparkles")
                    }
                }
                if let st = detector.status, !detector.running {
                    Text(st).font(.footnote).foregroundStyle(.secondary)
                }
                if let e = detector.errorText {
                    Text(e).font(.footnote).foregroundStyle(.red)
                }
                Button {
                    draft = FixtureDraft(kind: .enchufe, wall: 0, alongCm: 50, heightCm: Double(FixtureKind.enchufe.defaultHeight * 100))
                } label: {
                    Label("Añadir a mano", systemImage: "plus.circle")
                }
                .disabled(sum.walls.isEmpty)
            } header: {
                Text("Instalaciones")
            } footer: {
                Text(s.frameCount > 0
                     ? "La detección busca enchufes, agua, desagües, gas y salidas de humos en las \(s.frameCount) fotos del escaneo. Las detectadas llevan borde discontinuo: revísalas."
                     : "Este escaneo no tiene fotos guardadas: añade las instalaciones a mano o vuelve a escanear.")
            }

            Section("Resumen") {
                LabeledContent("Superficie", value: m2(sum.area))
                LabeledContent("Perímetro", value: meters(sum.perimeter))
                LabeledContent("Altura libre", value: cm(sum.height))
            }

            Section("Paredes") {
                ForEach(Array(sum.walls.enumerated()), id: \.offset) { i, w in
                    LabeledContent("Pared \(RoomSummary.letter(i))", value: cm(w.length))
                        .monospacedDigit()
                }
            }

            if !sum.openings.isEmpty {
                Section("Puertas y ventanas") {
                    ForEach(Array(sum.openings.enumerated()), id: \.offset) { _, o in
                        let wall = sum.wallIndex(near: o.mid).map { " · pared \(RoomSummary.letter($0))" } ?? ""
                        VStack(alignment: .leading, spacing: 2) {
                            Text(o.kind.title + wall)
                            Text("\(cm(o.width)) × \(cm(o.height))" + (o.kind == .ventana ? " · antepecho \(cm(o.sill))" : ""))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if !sum.objects.isEmpty {
                Section("Detectado en la cocina") {
                    ForEach(Array(sum.objects.enumerated()), id: \.offset) { _, o in
                        LabeledContent(o.name, value: "\(Int((o.size.x * 100).rounded())) × \(Int((o.size.z * 100).rounded())) × \(Int((o.size.y * 100).rounded())) cm")
                            .monospacedDigit()
                    }
                }
            }

            Section {
                ForEach(s.measures) { m in
                    HStack {
                        TextField("Qué has medido", text: Binding(
                            get: { m.label },
                            set: { v in
                                guard var r = store.scan(id), let i = r.measures.firstIndex(where: { $0.id == m.id }) else { return }
                                r.measures[i].label = v
                                store.update(r)
                            }
                        ))
                        Spacer()
                        Text(String(format: "%.1f cm", m.centimeters).replacingOccurrences(of: ".", with: ","))
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete { idx in
                    guard var r = store.scan(id) else { return }
                    r.measures.remove(atOffsets: idx)
                    store.update(r)
                }
                Button { measuring = true } label: {
                    Label("Medir con la cámara", systemImage: "ruler")
                }
            } header: {
                Text("Medidas sueltas")
            } footer: {
                Text("Ancho de un pilar, distancia de la ventana… Pon nombre a cada medida.")
            }

            Section {
                Button { showing3D = true } label: {
                    Label("Ver modelo 3D y en realidad aumentada", systemImage: "cube")
                }
                Button { exportScan(s) } label: {
                    Label("Enviar a Mkpkr Cocinas", systemImage: "square.and.arrow.up")
                }
            } footer: {
                Text("Se comparte el JSON del escaneo con las instalaciones y medidas (ábrelo en Mkpkr Cocinas con «Abrir proyecto o escaneo»), el modelo USDZ y la planta en PNG.")
            }

            if let errorText {
                Text(errorText).foregroundStyle(.red)
            }
        }
        .navigationTitle(s.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Menu {
                Button("Renombrar") { newName = s.name; renaming = true }
                Button("Clave de Claude") { showingSettings = true }
                Button("Borrar escaneo", role: .destructive) { confirmDelete = true }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
        .task {
            // Detección automática la primera vez que se abre un escaneo nuevo.
            if hasKey, !s.detectionDone, s.frameCount > 0, !detector.running {
                await detector.run(store: store, id: id)
            }
        }
        .fullScreenCover(isPresented: $measuring) {
            MeasureScreen { results in
                measuring = false
                guard !results.isEmpty, var r = store.scan(id) else { return }
                let start = r.measures.count
                for (i, v) in results.enumerated() {
                    r.measures.append(ManualMeasure(label: "Medida \(start + i + 1)", centimeters: Double(v * 100)))
                }
                store.update(r)
            }
        }
        .sheet(isPresented: $showing3D) {
            USDZPreview(url: store.modelURL(id)).ignoresSafeArea()
        }
        .sheet(isPresented: $showingSettings, onDismiss: { hasKey = APIKeyStore.read() != nil }) {
            SettingsView()
        }
        .sheet(item: $share) { bundle in
            ShareSheet(items: bundle.urls)
        }
        .sheet(item: $draft) { d in
            FixtureEditor(draft: d, summary: sum, onSave: { saveDraft($0) }, onDelete: { fid in
                guard var r = store.scan(id) else { return }
                r.fixtures.removeAll { $0.id == fid }
                store.update(r)
            })
        }
        .alert("Renombrar", isPresented: $renaming) {
            TextField("Nombre", text: $newName)
            Button("Guardar") {
                guard var r = store.scan(id) else { return }
                let n = newName.trimmingCharacters(in: .whitespaces)
                if !n.isEmpty { r.name = n; store.update(r) }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .confirmationDialog("¿Borrar este escaneo?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Borrar", role: .destructive) {
                store.delete(id)
                dismiss()
            }
        }
    }

    private func fixtureRow(_ f: Fixture, _ sum: RoomSummary) -> some View {
        HStack(spacing: 12) {
            Image(systemName: f.kind.symbol)
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(f.kind.color, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(f.kind.title)
                Text(sum.describe(f))
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(f.source.title)
                .font(.caption2)
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(f.source == .auto ? Theme.accent.opacity(0.25) : Color.secondary.opacity(0.15), in: Capsule())
        }
    }

    private func newFixture(at p: SIMD2<Float>, in s: ScanRecord) {
        guard let l = s.summary.locate(SIMD3<Float>(p.x, s.summary.floorLevel, p.y)) else { return }
        draft = FixtureDraft(kind: .enchufe, wall: l.wall, alongCm: Double((l.along * 100).rounded()), heightCm: Double(FixtureKind.enchufe.defaultHeight * 100))
    }

    private func edit(_ f: Fixture, in s: ScanRecord) {
        guard let l = s.summary.locate(f.position) else { return }
        draft = FixtureDraft(fixtureID: f.id, kind: f.kind, wall: l.wall, alongCm: Double((l.along * 100).rounded()), heightCm: Double((l.height * 100).rounded()))
    }

    private func saveDraft(_ d: FixtureDraft) {
        guard var r = store.scan(id) else { return }
        let p = r.summary.point(wall: d.wall, along: Float(d.alongCm / 100), height: Float(d.heightCm / 100))
        if let fid = d.fixtureID, let i = r.fixtures.firstIndex(where: { $0.id == fid }) {
            r.fixtures[i].kind = d.kind
            r.fixtures[i].position = p
            r.fixtures[i].source = .manual
        } else {
            r.fixtures.append(Fixture(kind: d.kind, position: p, source: .manual))
        }
        store.update(r)
    }

    @MainActor
    private func exportScan(_ s: ScanRecord) {
        let renderer = ImageRenderer(
            content: FloorPlanView(summary: s.summary, fixtures: s.fixtures)
                .frame(width: 1000, height: 1000)
                .background(Color.white)
                .environment(\.colorScheme, .light)
        )
        renderer.scale = 2
        let png = renderer.uiImage?.pngData()
        do {
            share = ShareBundle(urls: try store.exportFiles(s, planPNG: png))
            errorText = nil
        } catch {
            errorText = "No se ha podido preparar el envío: \(error.localizedDescription)"
        }
    }
}

/// Editor de una instalación: tipo, pared, distancia a la esquina y altura.
struct FixtureEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State var draft: FixtureDraft
    let summary: RoomSummary
    var onSave: (FixtureDraft) -> Void
    var onDelete: (UUID) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Picker("Tipo", selection: $draft.kind) {
                    ForEach(FixtureKind.allCases) { k in
                        Label(k.title, systemImage: k.symbol).tag(k)
                    }
                }
                .onChange(of: draft.kind) { k in
                    if draft.fixtureID == nil { draft.heightCm = Double(k.defaultHeight * 100) }
                }

                Picker("Pared", selection: $draft.wall) {
                    ForEach(summary.walls.indices, id: \.self) { i in
                        Text("\(RoomSummary.letter(i)) · \(cm(summary.walls[i].length))").tag(i)
                    }
                }

                Section {
                    LabeledContent("Desde la esquina \(summary.startCornerName(draft.wall))") {
                        TextField("cm", value: $draft.alongCm, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 90)
                        Text("cm").foregroundStyle(.secondary)
                    }
                    LabeledContent("Altura desde el suelo") {
                        TextField("cm", value: $draft.heightCm, format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 90)
                        Text("cm").foregroundStyle(.secondary)
                    }
                } footer: {
                    Text("Mide al centro de la toma. La pared \(RoomSummary.letter(draft.wall)) mide \(cm(summary.walls.indices.contains(draft.wall) ? summary.walls[draft.wall].length : 0)).")
                }

                if let fid = draft.fixtureID {
                    Section {
                        Button("Borrar instalación", role: .destructive) {
                            onDelete(fid)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(draft.fixtureID == nil ? "Nueva instalación" : "Instalación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { onSave(draft); dismiss() }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

/// Vista previa del USDZ con Quick Look (incluye el modo AR de Apple).
struct USDZPreview: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> QLPreviewController {
        let c = QLPreviewController()
        c.dataSource = context.coordinator
        return c
    }

    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(url: url) }

    final class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL
        init(url: URL) { self.url = url }
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as NSURL
        }
    }
}
