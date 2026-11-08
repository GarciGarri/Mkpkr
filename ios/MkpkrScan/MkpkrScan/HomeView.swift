import SwiftUI
import RoomPlan

struct HomeView: View {
    @EnvironmentObject private var store: ScanStore
    @State private var path: [UUID] = []
    @State private var capturing = false
    @State private var noLidar = false
    @State private var showingSettings = false

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if store.scans.isEmpty {
                    emptyState
                } else {
                    List {
                        ForEach(store.scans) { s in
                            NavigationLink(value: s.id) { row(s) }
                        }
                        .onDelete { idx in idx.map { store.scans[$0].id }.forEach(store.delete) }
                    }
                }
            }
            .navigationTitle("Mkpkr Scan")
            .navigationDestination(for: UUID.self) { id in ScanDetailView(id: id) }
            .toolbar {
                Button { showingSettings = true } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("Ajustes")
            }
            .sheet(isPresented: $showingSettings) { SettingsView() }
            .safeAreaInset(edge: .bottom) {
                Button(action: startScan) {
                    Label("Escanear cocina", systemImage: "viewfinder")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(.black)
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .fullScreenCover(isPresented: $capturing) {
                CaptureScreen { rec in
                    capturing = false
                    if let rec { path = [rec.id] }
                }
                .environmentObject(store)
            }
            .alert("Este dispositivo no tiene LiDAR", isPresented: $noLidar) {
                Button("Entendido", role: .cancel) {}
            } message: {
                Text("El escaneo de habitaciones necesita un iPhone Pro (12 Pro o posterior) o un iPad Pro con sensor LiDAR.")
            }
        }
    }

    private func startScan() {
        if RoomCaptureSession.isSupported { capturing = true } else { noLidar = true }
    }

    private func row(_ s: ScanRecord) -> some View {
        HStack(spacing: 12) {
            FloorPlanView(summary: s.summary, showLabels: false)
                .frame(width: 56, height: 56)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(s.name).font(.headline)
                Text("\(m2(s.summary.area)) · \(s.summary.walls.count) paredes · \(s.summary.openings.count) huecos")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Text(s.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            Image(systemName: "ruler")
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(Theme.accent)
            Text("Mide la cocina con el LiDAR")
                .font(.title2.bold())
            VStack(alignment: .leading, spacing: 8) {
                Text("1. Ponte en una esquina y pulsa «Escanear cocina».")
                Text("2. Recorre la estancia despacio apuntando a paredes, suelo, puertas, ventanas, muebles y a cada enchufe, toma de agua, desagüe o salida de humos. Puedes marcarlas con la cruz.")
                Text("3. Pulsa «Terminar»: tendrás el plano con cotas, el modelo 3D, huecos, electrodomésticos e instalaciones (detectadas con Claude si pones tu clave en Ajustes).")
                Text("4. Añade medidas sueltas con la cinta métrica y envía el escaneo a Mkpkr Cocinas.")
            }
            .foregroundStyle(.secondary)
            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
