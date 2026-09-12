//
//  Typography.swift
//  Zihin
//
//  Apple HIG "Typography":
//   • Sistem yazı tipi (SF Pro) kullanılır, gömülü yazı tipi yoktur.
//   • Bütün metinler Dynamic Type metin stilleriyle tanımlanır; böylece
//     kullanıcı metin boyutunu büyüttüğünde hiyerarşi korunarak ölçeklenir.
//   • Ultralight/Thin/Light ağırlıklardan kaçınılır (okunabilirlik).
//   • Sayılar tabular (tnum) ve yuvarlak (SF Pro Rounded) varyantla gösterilir;
//     yuvarlak varyant yumuşak/oval arayüz öğeleriyle uyum içindir.
//

import SwiftUI

extension Font {
    /// Büyük sayı ekranı — yuvarlak, kalın, tabular.
    static func display(_ size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .rounded)
    }

    /// Dynamic Type'a bağlı yuvarlak stil.
    static func rounded(_ style: Font.TextStyle, weight: Font.Weight = .semibold) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

extension View {
    /// Rakamların zıplamasını önler (Apple'ın tabular figür önerisi).
    func tabularNumbers() -> some View {
        monospacedDigit()
    }
}

/// Ölçeklenen ama sınırlanan başlık: çok büyük erişilebilirlik boylarında
/// ekrandan taşmasın diye üst sınır konur (HIG: hiyerarşi korunmalı).
struct ScaledDisplay: ViewModifier {
    @Environment(\.dynamicTypeSize) private var typeSize
    let base: CGFloat

    func body(content: Content) -> some View {
        content
            .font(.display(typeSize >= .accessibility1 ? base * 0.78 : base))
            .minimumScaleFactor(0.5)
            .lineLimit(2)
    }
}

extension View {
    func displaySize(_ base: CGFloat) -> some View { modifier(ScaledDisplay(base: base)) }
}
