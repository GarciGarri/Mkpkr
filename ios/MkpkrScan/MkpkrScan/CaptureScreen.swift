import SwiftUI
import RoomPlan
import ARKit
import CoreImage

/// Envuelve RoomCaptureView: Apple dibuja en directo paredes, huecos y muebles
/// detectados y guía al usuario mientras escanea. Además guarda fotogramas para
/// detectar instalaciones y permite marcarlas con la cruz central.
final class CaptureController: NSObject, ObservableObject, RoomCaptureViewDelegate {
    let view: RoomCaptureView
    @Published var result: CapturedRoom?
    @Published var processing = false
    @Published var errorText: String?
    @Published private(set) var marks: [PendingMark] = []
    @Published var markMessage: String?
    @Published private(set) var frameCount = 0

    private(set) var frames: [(KeyFrameMeta, Data)] = []
    private var running = false
    private var timer: Timer?
    private var lastPose: simd_float4x4?
    private let ciContext = CIContext()
    private let encodeQueue = DispatchQueue(label: "mkpkr.keyframes")
    private static let maxFrames = 45

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
        marks = []
        frames = []
        frameCount = 0
        lastPose = nil
        view.captureSession.run(configuration: RoomCaptureSession.Configuration())
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.8, repeats: true) { [weak self] _ in self?.grabKeyFrame() }
    }

    func finish() {
        guard running else { return }
        timer?.invalidate()
        processing = true
        running = false
        view.captureSession.stop()
    }

    func cancel() {
        timer?.invalidate()
        if running { view.captureSession.stop() }
        running = false
    }

    // MARK: Instalaciones marcadas con la cruz

    func mark(_ kind: FixtureKind) {
        let session = view.captureSession.arSession
        guard running, let frame = session.currentFrame, case .normal = frame.camera.trackingState else {
            markMessage = "Espera a que la cámara se estabilice y vuelve a marcar."
            return
        }
        let t = frame.camera.transform
        let origin = SIMD3<Float>(t.columns.3.x, t.columns.3.y, t.columns.3.z)
        let forward = -SIMD3<Float>(t.columns.2.x, t.columns.2.y, t.columns.2.z)
        var hit: SIMD3<Float>?
        let query = frame.raycastQuery(from: CGPoint(x: 0.5, y: 0.5), allowing: .estimatedPlane, alignment: .any)
        if let r = session.raycast(query).first {
            let p = r.worldTransform.columns.3
            hit = SIMD3<Float>(p.x, p.y, p.z)
        }
        marks.append(PendingMark(kind: kind, ray: CameraRay(origin: origin, direction: simd_normalize(forward)), hit: hit))
        markMessage = "\(kind.title) marcada"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    // MARK: Fotogramas para la detección automática

    private func grabKeyFrame() {
        guard running, frames.count < Self.maxFrames,
              let frame = view.captureSession.arSession.currentFrame,
              case .normal = frame.camera.trackingState else { return }
        let t = frame.camera.transform
        if let last = lastPose {
            let moved = simd_distance(SIMD3<Float>(t.columns.3.x, t.columns.3.y, t.columns.3.z), SIMD3<Float>(last.columns.3.x, last.columns.3.y, last.columns.3.z))
            let f1 = SIMD3<Float>(t.columns.2.x, t.columns.2.y, t.columns.2.z)
            let f0 = SIMD3<Float>(last.columns.2.x, last.columns.2.y, last.columns.2.z)
            let turned = acos(max(-1, min(1, simd_dot(simd_normalize(f0), simd_normalize(f1)))))
            if moved < 0.35 && turned < 0.35 { return }
        }
        lastPose = t
        let k = frame.camera.intrinsics
        let res = frame.camera.imageResolution
        let buffer = frame.capturedImage
        let flat = KeyFrameMeta.flatten(t)
        encodeQueue.async { [weak self] in
            guard let self else { return }
            let s = Float(1024) / Float(res.width)
            let image = CIImage(cvPixelBuffer: buffer).transformed(by: CGAffineTransform(scaleX: CGFloat(s), y: CGFloat(s)))
            let options = [CIImageRepresentationOption(rawValue: kCGImageDestinationLossyCompressionQuality as String): 0.7]
            guard let jpeg = self.ciContext.jpegRepresentation(of: image, colorSpace: CGColorSpaceCreateDeviceRGB(), options: options) else { return }
            let meta = KeyFrameMeta(
                file: "",
                width: Int((Float(res.width) * s).rounded()),
                height: Int((Float(res.height) * s).rounded()),
                fx: k[0][0] * s, fy: k[1][1] * s, cx: k[2][0] * s, cy: k[2][1] * s,
                transform: flat
            )
            DispatchQueue.main.async {
                guard self.frames.count < Self.maxFrames else { return }
                self.frames.append((meta, jpeg))
                self.frameCount = self.frames.count
            }
        }
    }

    // MARK: RoomCaptureViewDelegate

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

            if ctl.result == nil && !ctl.processing {
                // Cruz para marcar instalaciones
                ZStack {
                    Circle().stroke(Theme.accent, lineWidth: 2).frame(width: 30, height: 30)
                    Circle().fill(Theme.accent).frame(width: 5, height: 5)
                }
                .allowsHitTesting(false)
            }

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
                    if let msg = ctl.markMessage {
                        Text(msg)
                            .font(.subheadline)
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(.black.opacity(0.6), in: Capsule())
                            .foregroundStyle(.white)
                    }
                    HStack(spacing: 12) {
                        Menu {
                            ForEach(FixtureKind.allCases) { k in
                                Button { ctl.mark(k) } label: { Label(k.title, systemImage: k.symbol) }
                            }
                        } label: {
                            Label(ctl.marks.isEmpty ? "Marcar toma" : "Marcar toma (\(ctl.marks.count))", systemImage: "scope")
                                .font(.headline)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.bordered)
                        .tint(.white)
                        .disabled(ctl.processing)

                        Button {
                            ctl.finish()
                        } label: {
                            Label(ctl.processing ? "Procesando…" : "Terminar", systemImage: ctl.processing ? "hourglass" : "checkmark")
                                .font(.headline)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.borderedProminent)
                        .foregroundStyle(.black)
                        .disabled(ctl.processing)
                    }
                    Text("Apunta la cruz a un enchufe, toma o desagüe y pulsa «Marcar toma».")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.85))
                        .padding(.bottom, 24)
                }
            }
            .padding(.horizontal)
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
            Text("\(ctl.marks.count) tomas marcadas · \(ctl.frameCount) fotos para detectar instalaciones")
                .font(.footnote)
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
                        let rec = try store.add(
                            room: room,
                            name: n.isEmpty ? "Cocina \(Date().formatted(date: .numeric, time: .shortened))" : n,
                            frames: ctl.frames,
                            marks: ctl.marks
                        )
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
        .padding(.bottom)
    }
}
