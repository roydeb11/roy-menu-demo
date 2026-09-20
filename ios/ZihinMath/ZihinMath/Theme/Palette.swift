//
//  Palette.swift
//  Zihin
//
//  Palet KESİNLİKLE üç tondan ibarettir:
//    • Apple Black  #000000
//    • Apple White  #FFFFFF
//    • Apple Blue   systemBlue — #007AFF (açık) / #0A84FF (koyu)
//  Diğer bütün yüzeyler bu üç rengin opaklık varyasyonudur; dördüncü bir
//  renk (yeşil "doğru", kırmızı "yanlış" dâhil) hiçbir yerde kullanılmaz.
//

import SwiftUI

enum Palette {

    // MARK: Üç ton

    static let black = Color.black
    static let white = Color.white
    /// systemBlue — görünüme göre otomatik uyarlanır.
    static let blue = Color(uiColor: .systemBlue)

    // MARK: Türetilmiş roller (yalnızca opaklık değişir)

    /// Ana metin rengi.
    static let ink = Color.primary
    /// İkincil metin.
    static let ink2 = Color.primary.opacity(0.62)
    /// Üçüncül metin / etiketler.
    static let ink3 = Color.primary.opacity(0.38)

    /// Cam yüzeyin altına giren ince dolgu (Liquid Glass yoksa yedek).
    static let glassFill = Color.primary.opacity(0.075)
    static let glassStroke = Color.primary.opacity(0.16)

    static let blueFill = blue.opacity(0.22)
    static let blueStroke = blue.opacity(0.55)
    static let blueGlow = blue.opacity(0.40)

    /// Uygulamanın zemini — OLED'de gerçek siyah, açık görünümde saf beyaz.
    static let background = Color(uiColor: .systemBackground)
}

// MARK: - Arka plan ışığı

/// Cama anlam veren hareketli ışık. Yalnızca mavi ve beyaz parlamalardan oluşur;
/// Liquid Glass'ın kırılma ve doygunluk etkisi ancak altında içerik varken görünür.
struct AuroraBackground: View {
    @State private var phase = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { geo in
            let s = min(geo.size.width, geo.size.height)
            ZStack {
                Palette.background.ignoresSafeArea()

                orb(color: Palette.blueGlow, size: s * 1.15)
                    .offset(x: -s * 0.35, y: phase ? -s * 0.30 : -s * 0.10)

                orb(color: Palette.white.opacity(0.16), size: s * 0.95)
                    .offset(x: s * 0.40, y: phase ? s * 0.05 : s * 0.28)

                orb(color: Palette.blueGlow, size: s * 1.30)
                    .offset(x: s * 0.10, y: phase ? s * 0.62 : s * 0.80)
            }
            .ignoresSafeArea()
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 14).repeatForever(autoreverses: true)) {
                    phase = true
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private func orb(color: Color, size: CGFloat) -> some View {
        Circle()
            .fill(
                RadialGradient(colors: [color, color.opacity(0)],
                               center: .center, startRadius: 0, endRadius: size / 2)
            )
            .frame(width: size, height: size)
            .blur(radius: size * 0.10)
    }
}
