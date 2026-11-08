import SwiftUI
import RealityKit
import ARKit
import Combine

/// Cinta métrica AR: apunta con la cruz y pulsa para marcar el inicio y el final.
/// Con LiDAR el punto se ancla a la malla real de la habitación.
final class MeasureController: ObservableObject {
    let arView: ARView
    @Published var live: Float?
    @Published var hasTarget = false
    @Published var results: [Float] = []

    private var pending: SIMD3<Float>?
    private var pendingDot: Entity?
    private var drawn: [[Entity]] = []
    private let anchor = AnchorEntity(world: .zero)
    private var sub: Cancellable?

    init() {
        arView = ARView(frame: .zero)
        let cfg = ARWorldTrackingConfiguration()
        cfg.planeDetection = [.horizontal, .vertical]
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            cfg.sceneReconstruction = .mesh
        }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            cfg.frameSemantics.insert(.sceneDepth)
        }
        arView.session.run(cfg)
        arView.scene.addAnchor(anchor)
        sub = arView.scene.subscribe(to: SceneEvents.Update.self) { [weak self] _ in self?.tick() }
    }

    func stop() {
        sub?.cancel()
        arView.session.pause()
    }

    private func target() -> SIMD3<Float>? {
        let c = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        guard let hit = arView.raycast(from: c, allowing: .estimatedPlane, alignment: .any).first else { return nil }
        let t = hit.worldTransform.columns.3
        return SIMD3<Float>(t.x, t.y, t.z)
    }

    private func tick() {
        let t = target()
        if hasTarget != (t != nil) { hasTarget = t != nil }
        if let t, let p = pending {
            let d = simd_distance(t, p)
            if abs((live ?? -1) - d) > 0.002 { live = d }
        } else if live != nil {
            live = nil
        }
    }

    func addPoint() {
        guard let t = target() else { return }
        let dot = Self.dot(at: t)
        anchor.addChild(dot)
        if let p = pending, let first = pendingDot {
            let line = Self.line(p, t)
            anchor.addChild(line)
            drawn.append([first, dot, line])
            results.append(simd_distance(p, t))
            pending = nil
            pendingDot = nil
            live = nil
        } else {
            pending = t
            pendingDot = dot
        }
    }

    func undo() {
        if let d = pendingDot {
            d.removeFromParent()
            pending = nil
            pendingDot = nil
            live = nil
        } else if let last = drawn.popLast() {
            last.forEach { $0.removeFromParent() }
            results.removeLast()
        }
    }

    private static func dot(at p: SIMD3<Float>) -> Entity {
        let e = ModelEntity(mesh: .generateSphere(radius: 0.006), materials: [UnlitMaterial(color: .systemYellow)])
        e.position = p
        return e
    }

    private static func line(_ a: SIMD3<Float>, _ b: SIMD3<Float>) -> Entity {
        let d = simd_distance(a, b)
        let e = ModelEntity(mesh: .generateBox(size: SIMD3<Float>(0.003, 0.003, d)), materials: [UnlitMaterial(color: .systemYellow)])
        let dir = d > 0 ? (b - a) / d : SIMD3<Float>(0, 0, 1)
        let up: SIMD3<Float> = abs(dir.y) > 0.9 ? SIMD3<Float>(1, 0, 0) : SIMD3<Float>(0, 1, 0)
        e.look(at: b, from: (a + b) / 2, upVector: up, relativeTo: nil)
        return e
    }
}

struct ARViewContainer: UIViewRepresentable {
    let arView: ARView
    func makeUIView(context: Context) -> ARView { arView }
    func updateUIView(_ uiView: ARView, context: Context) {}
}

struct MeasureScreen: View {
    @StateObject private var ctl = MeasureController()
    var onDone: ([Float]) -> Void

    var body: some View {
        ZStack {
            ARViewContainer(arView: ctl.arView).ignoresSafeArea()

            // Cruz de puntería
            ZStack {
                Circle().stroke(ctl.hasTarget ? Theme.accent : .white.opacity(0.6), lineWidth: 2).frame(width: 34, height: 34)
                Circle().fill(ctl.hasTarget ? Theme.accent : .white.opacity(0.6)).frame(width: 6, height: 6)
            }
            .allowsHitTesting(false)

            VStack(spacing: 12) {
                HStack {
                    Button("Cancelar") { ctl.stop(); onDone([]) }
                        .buttonStyle(.bordered).tint(.white)
                    Spacer()
                    Button("Hecho") { ctl.stop(); onDone(ctl.results) }
                        .buttonStyle(.borderedProminent).foregroundStyle(.black)
                }
                .padding()

                if let live = ctl.live {
                    Text(String(format: "%.1f cm", live * 100).replacingOccurrences(of: ".", with: ","))
                        .font(.system(size: 34, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 14).padding(.vertical, 6)
                        .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
                        .foregroundStyle(.white)
                } else {
                    Text(ctl.hasTarget ? "Apunta al inicio y pulsa +" : "Mueve el móvil para detectar superficies")
                        .font(.subheadline)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(.black.opacity(0.5), in: Capsule())
                        .foregroundStyle(.white)
                }

                Spacer()

                if !ctl.results.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(Array(ctl.results.enumerated()), id: \.offset) { i, r in
                                Text("\(i + 1) · \(String(format: "%.1f", r * 100).replacingOccurrences(of: ".", with: ",")) cm")
                                    .font(.footnote.monospacedDigit())
                                    .padding(.horizontal, 10).padding(.vertical, 5)
                                    .background(.black.opacity(0.6), in: Capsule())
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(.horizontal)
                    }
                }

                HStack(spacing: 40) {
                    Button { ctl.undo() } label: {
                        Image(systemName: "arrow.uturn.backward").font(.title2).frame(width: 56, height: 56)
                    }
                    .background(.black.opacity(0.5), in: Circle())
                    .foregroundStyle(.white)
                    .accessibilityLabel("Deshacer")

                    Button { ctl.addPoint() } label: {
                        Image(systemName: "plus").font(.largeTitle.bold()).frame(width: 76, height: 76)
                    }
                    .background(Theme.accent, in: Circle())
                    .foregroundStyle(.black)
                    .disabled(!ctl.hasTarget)
                    .accessibilityLabel("Marcar punto")

                    Color.clear.frame(width: 56, height: 56)
                }
                .padding(.bottom, 30)
            }
        }
    }
}
