import SwiftUI
import RoomPlan

/// Envuelve RoomCaptureView: Apple dibuja en directo paredes, huecos y muebles
/// detectados y guía al usuario mientras escanea.
final class CaptureController: NSObject, ObservableObject, RoomCaptureViewDelegate {
    let view: RoomCaptureView
    @Published var result: CapturedRoom?
    @Published var processing = false
    @Published var errorText: String?
    private var running = false

    override init() {
        view = RoomCaptureView(frame: .zero)
        super.init()
        view.delegate = self
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) no se usa") }
    func encode(with coder: NSCoder) {}

    func start() {
        guard !running else { return }
        running = true
        result = nil
        errorText = nil
        view.captureSession.run(configuration: RoomCaptureSession.Configuration())
    }

    func finish() {
        guard running else { return }
        processing = true
        running = false
        view.captureSession.stop()
    }

    func cancel() {
        if running { view.captureSession.stop() }
        running = false
    }

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        true
    }

    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        processing = false
        if let error {
            errorText = "No se ha podido procesar el escaneo: \(error.localizedDescription)"
        }
        result = processedResult
    }
}

struct RoomCaptureContainer: UIViewRepresentable {
    let view: RoomCaptureView
    func makeUIView(context: Context) -> RoomCaptureView { view }
    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}

struct CaptureScreen: View {
    @EnvironmentObject private var store: ScanStore
    @StateObject private var ctl = CaptureController()
    @State private var name = ""
    @State private var saveError: String?
    var onClose: (ScanRecord?) -> Void

    var body: some View {
        ZStack {
            RoomCaptureContainer(view: ctl.view).ignoresSafeArea()

            VStack {
                HStack {
                    Button("Cancelar") {
                        ctl.cancel()
                        onClose(nil)
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                    Spacer()
                }
                .padding()

                Spacer()

                if let room = ctl.result {
                    savePanel(room)
                } else {
                    Button {
                        ctl.finish()
                    } label: {
                        Label(ctl.processing ? "Procesando…" : "Terminar", systemImage: ctl.processing ? "hourglass" : "checkmark")
                            .font(.headline)
                            .frame(maxWidth: 260)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .foregroundStyle(.black)
                    .disabled(ctl.processing)
                    .padding(.bottom, 30)
                }
            }
        }
        .onAppear { ctl.start() }
        .onDisappear { ctl.cancel() }
    }

    private func savePanel(_ room: CapturedRoom) -> some View {
        let summary = RoomSummary(room: room)
        return VStack(alignment: .leading, spacing: 12) {
            Text("\(m2(summary.area)) · altura \(cm(summary.height)) · \(summary.walls.count) paredes")
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
            if let e = ctl.errorText ?? saveError {
                Text(e).font(.footnote).foregroundStyle(.red)
            }
            TextField("Nombre: dirección o cliente", text: $name)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Repetir") { ctl.start() }
                    .buttonStyle(.bordered)
                Spacer()
                Button("Guardar escaneo") {
                    let n = name.trimmingCharacters(in: .whitespaces)
                    do {
                        let rec = try store.add(room: room, name: n.isEmpty ? "Cocina \(Date().formatted(date: .numeric, time: .shortened))" : n)
                        onClose(rec)
                    } catch {
                        saveError = "No se ha podido guardar: \(error.localizedDescription)"
                    }
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(.black)
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding()
    }
}
