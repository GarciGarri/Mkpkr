import SwiftUI
import QuickLook

struct ShareBundle: Identifiable {
    let id = UUID()
    let urls: [URL]
}

struct ScanDetailView: View {
    @EnvironmentObject private var store: ScanStore
    @Environment(\.dismiss) private var dismiss
    let id: UUID

    @State private var measuring = false
    @State private var showing3D = false
    @State private var share: ShareBundle?
    @State private var renaming = false
    @State private var newName = ""
    @State private var confirmDelete = false
    @State private var errorText: String?

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
                FloorPlanView(summary: sum)
                    .frame(height: 320)
                    .padding(.vertical, 8)
            } footer: {
                Text("Cotas en cm. Amarillo: puertas · celeste: ventanas · azul: muebles y electrodomésticos detectados.")
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
                Text("Alturas de tomas, ancho de un pilar, distancia de la ventana… Pon nombre a cada medida.")
            }

            Section {
                Button { showing3D = true } label: {
                    Label("Ver modelo 3D y en realidad aumentada", systemImage: "cube")
                }
                Button { exportScan(s) } label: {
                    Label("Enviar a Mkpkr Cocinas", systemImage: "square.and.arrow.up")
                }
            } footer: {
                Text("Se comparte el JSON del escaneo (ábrelo en Mkpkr Cocinas → Captura → Escaneo LiDAR), el modelo USDZ y la planta en PNG.")
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
                Button("Borrar escaneo", role: .destructive) { confirmDelete = true }
            } label: {
                Image(systemName: "ellipsis.circle")
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
        .sheet(item: $share) { bundle in
            ShareSheet(items: bundle.urls)
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

    @MainActor
    private func exportScan(_ s: ScanRecord) {
        let renderer = ImageRenderer(
            content: FloorPlanView(summary: s.summary)
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
