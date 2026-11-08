import SwiftUI

@main
struct MkpkrScanApp: App {
    @StateObject private var store = ScanStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(store)
                .tint(Theme.accent)
        }
    }
}

enum Theme {
    /// Amarillo de cinta métrica, el mismo acento que Mkpkr Cocinas.
    static let accent = Color(red: 0.95, green: 0.72, blue: 0.02)
    /// Azul de cotas.
    static let dim = Color(red: 0.14, green: 0.35, blue: 0.77)
}

func cm(_ meters: Float) -> String { "\(Int((meters * 100).rounded())) cm" }

func m2(_ value: Float) -> String {
    String(format: "%.2f m²", value).replacingOccurrences(of: ".", with: ",")
}

func meters(_ value: Float) -> String {
    String(format: "%.2f m", value).replacingOccurrences(of: ".", with: ",")
}
