//
//  LiquidGlass.swift
//  Zihin
//
//  Liquid Glass sarmalayıcıları.
//
//  Doğrulanmış Apple API'leri (developer.apple.com, iOS 26.0):
//    func glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape()) -> some View
//    struct Glass  ·  static var regular / clear  ·  func tint(_:) -> Glass  ·  func interactive(_:) -> Glass
//    struct GlassEffectContainer  ·  init(spacing: CGFloat? = nil, content: () -> Content)
//    func glassEffectID(_ id: (some Hashable & Sendable)?, in namespace: Namespace.ID) -> some View
//    func glassEffectUnion(id: (some Hashable & Sendable)?, namespace: Namespace.ID) -> some View
//    func glassEffectTransition(_ transition: GlassEffectTransition) -> some View
//    static var glass: GlassButtonStyle   (PrimitiveButtonStyle)
//
//  iOS 26 öncesinde aynı hiyerarşi `.ultraThinMaterial` ile boyanır; böylece
//  uygulama eski cihazlarda da doğru görünür.
//

import SwiftUI

/// Cam yüzeyin şekli.
enum GlassShape {
    case rounded(CGFloat)
    case capsule
    case circle
}

/// Bir görünüme Liquid Glass uygular.
///
/// - Parameters:
///   - shape: cam yüzeyin şekli.
///   - tinted: mavi tonlu cam (vurgulu yüzeyler için).
///   - interactive: dokunuşta ölçeklenme/parlama (Apple'ın `.interactive()` karşılığı).
struct LiquidGlassBackground: ViewModifier {
    var shape: GlassShape = .rounded(26)
    var tinted: Bool = false
    var interactive: Bool = false

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(glass, in: anyShape)
        } else {
            content
                .background(fallbackFill, in: anyShape)
                .overlay(anyShape.stroke(strokeColor, lineWidth: 1))
                .shadow(color: .black.opacity(0.28), radius: 18, x: 0, y: 10)
        }
    }

    @available(iOS 26.0, *)
    private var glass: Glass {
        var g: Glass = .regular
        if tinted { g = g.tint(Palette.blue.opacity(0.55)) }
        if interactive { g = g.interactive() }
        return g
    }

    private var anyShape: AnyShape {
        switch shape {
        case .rounded(let r): AnyShape(RoundedRectangle(cornerRadius: r, style: .continuous))
        case .capsule:        AnyShape(Capsule())
        case .circle:         AnyShape(Circle())
        }
    }

    private var fallbackFill: some ShapeStyle {
        tinted ? AnyShapeStyle(Palette.blueFill) : AnyShapeStyle(.ultraThinMaterial)
    }

    private var strokeColor: Color {
        tinted ? Palette.blueStroke : Palette.glassStroke
    }
}

extension View {
    /// Liquid Glass yüzeyi (iOS 26+ gerçek cam, öncesinde materyal yedeği).
    func liquidGlass(_ shape: GlassShape = .rounded(26),
                     tinted: Bool = false,
                     interactive: Bool = false) -> some View {
        modifier(LiquidGlassBackground(shape: shape, tinted: tinted, interactive: interactive))
    }

    /// Cam öğeleri tek bir kapsayıcıda toplar; cam camı örnekleyemediği için
    /// yan yana duran cam yüzeyler mutlaka aynı kapsayıcıda olmalıdır.
    @ViewBuilder
    func inGlassContainer(spacing: CGFloat = 12) -> some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { self }
        } else {
            self
        }
    }
}

/// Cevap/aksiyon düğmeleri için cam düğme stili.
struct GlassActionButtonStyle: ButtonStyle {
    var tinted: Bool = false
    var shape: GlassShape = .rounded(22)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .liquidGlass(shape, tinted: tinted, interactive: true)
            .scaleEffect(configuration.isPressed ? 0.955 : 1)
            .animation(.spring(response: 0.32, dampingFraction: 0.72), value: configuration.isPressed)
    }
}
