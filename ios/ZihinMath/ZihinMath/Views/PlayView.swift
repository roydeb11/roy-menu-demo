//
//  PlayView.swift
//  Zihin
//
//  Oyun ekranı: üstte HUD, ortada soru kartı, altta dört cam cevap düğmesi.
//  Yan yana duran cam yüzeyler tek bir GlassEffectContainer içinde toplanır —
//  cam camı örnekleyemediği için Apple bunu şart koşar.
//

import SwiftUI

struct PlayView: View {
    @Environment(GameStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @Namespace private var glassNamespace
    @State private var flareOpacity: Double = 0

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            AuroraBackground()

            VStack(spacing: 14) {
                header
                levelTrack
                questionCard
                answerGrid
                feedbackLine
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 10)

            // seri parlaması — üç ton içinde kalır
            RadialGradient(colors: [Palette.blueGlow, .clear], center: .center, startRadius: 0, endRadius: 420)
                .ignoresSafeArea()
                .opacity(flareOpacity)
                .allowsHitTesting(false)
        }
        .navigationBarBackButtonHidden()
        .onReceive(ticker) { _ in store.tickSecond() }
        .onChange(of: store.flareToken) { _, _ in flare() }
        .onDisappear { store.quit() }
        // Yalnızca 60 saniye modu biter; sonsuz mod hiçbir zaman bu ekrana düşmez.
        .fullScreenCover(isPresented: Binding(
            get: { store.mode == .timed && !store.isRunning && store.question != nil },
            set: { _ in }
        )) {
            SummaryView(
                onRestart: { store.start(.timed) },
                onHome: { store.quit(); dismiss() }
            )
        }
    }

    // MARK: - HUD

    private var header: some View {
        HStack(spacing: 8) {
            Button {
                store.quit()
                dismiss()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 52)
                    .foregroundStyle(Palette.ink2)
            }
            .buttonStyle(GlassActionButtonStyle(shape: .rounded(18)))
            .accessibilityLabel("Geri")

            hudItem(value: "\(store.score)", label: "PUAN")
            hudItem(value: "\(store.streak)", label: "SERİ")
            hudItem(value: "\(store.engine.level)", label: "SEVİYE")

            if store.mode == .timed {
                hudItem(value: "\(max(0, store.secondsLeft))", label: "SÜRE", tinted: true)
            }
        }
        .inGlassContainer(spacing: 8)
    }

    private func hudItem(value: String, label: String, tinted: Bool = false) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.rounded(.title3, weight: .bold))
                .monospacedDigit()
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: value)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.4)
                .foregroundStyle(Palette.ink3)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .liquidGlass(.rounded(18), tinted: tinted)
    }

    private var levelTrack: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Palette.ink.opacity(0.14))
                Capsule()
                    .fill(Palette.blue)
                    .frame(width: geo.size.width * CGFloat(store.engine.level) / 10)
                    .shadow(color: Palette.blueGlow, radius: 8)
            }
        }
        .frame(height: 4)
        .animation(.spring(response: 0.6, dampingFraction: 0.85), value: store.engine.level)
    }

    // MARK: - Soru kartı

    private var questionCard: some View {
        VStack(spacing: 14) {
            if let q = store.question {
                Text(q.category.title.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .kerning(0.5)
                    .foregroundStyle(Palette.ink3)

                if let expression = q.expression {
                    Text(expression)
                        .displaySize(52)
                        .monospacedDigit()
                }

                if let text = q.text {
                    Text(text)
                        .font(text.count > 92 ? .headline : .title3)
                        .fontWeight(.medium)
                        .multilineTextAlignment(.center)
                        .lineSpacing(3)
                        .frame(maxWidth: 340)
                }

                if let visual = q.visual {
                    VisualFigureView(spec: visual)
                        .frame(maxWidth: 340)
                        .padding(.top, 2)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 20)
        .padding(.vertical, 24)
        .liquidGlass(.rounded(28))
        .id(store.question?.id)                       // her soruda taze geçiş
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .offset(y: 22)).combined(with: .scale(scale: 0.97)),
            removal: .opacity.combined(with: .scale(scale: 0.98))))
        .animation(reduceMotion ? .none : .spring(response: 0.45, dampingFraction: 0.85), value: store.question?.id)
    }

    // MARK: - Cevaplar

    private var answerGrid: some View {
        Group {
            if let q = store.question {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 11), GridItem(.flexible(), spacing: 11)], spacing: 11) {
                    ForEach(Array(q.options.enumerated()), id: \.offset) { index, option in
                        AnswerButton(
                            value: option,
                            unit: q.unit,
                            state: state(for: option),
                            index: index,
                            namespace: glassNamespace
                        ) {
                            store.submit(option)
                        }
                    }
                }
                .inGlassContainer(spacing: 11)
                .disabled(store.outcome != .none)
            }
        }
    }

    private func state(for option: Double) -> AnswerButton.State {
        switch store.outcome {
        case .none:
            return .idle
        case .correct(let picked):
            return option == picked ? .correct : .dimmed
        case .wrong(let picked, let correct):
            if option == picked { return .wrong }
            if option == correct { return .correct }
            return .dimmed
        }
    }

    // MARK: - Geri bildirim satırı

    private var feedbackLine: some View {
        Text(store.feedback)
            .font(.subheadline)
            .foregroundStyle(Palette.ink2)
            .multilineTextAlignment(.center)
            .frame(minHeight: 44)
            .frame(maxWidth: .infinity)
            .opacity(store.feedback.isEmpty ? 0 : 1)
            .animation(.easeOut(duration: 0.25), value: store.feedback)
            .accessibilityLiveRegion()
    }

    private func flare() {
        guard !reduceMotion else { return }
        withAnimation(.easeOut(duration: 0.18)) { flareOpacity = 0.85 }
        withAnimation(.easeIn(duration: 0.6).delay(0.18)) { flareOpacity = 0 }
    }
}

private extension View {
    /// Ekran okuyucunun geri bildirimi anında okuması için.
    func accessibilityLiveRegion() -> some View {
        accessibilityAddTraits(.updatesFrequently)
    }
}

// MARK: - Cevap düğmesi

struct AnswerButton: View {
    enum State { case idle, correct, wrong, dimmed }

    let value: Double
    let unit: String?
    let state: State
    let index: Int
    let namespace: Namespace.ID
    let action: () -> Void

    @State private var shake: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Text(label)
                    .font(.rounded(.title3, weight: .bold))
                    .monospacedDigit()
                    .minimumScaleFactor(0.55)
                    .lineLimit(1)
                if let unit, unit != "%" {
                    Text(unit)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(state == .correct ? Palette.white.opacity(0.75) : Palette.ink3)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 66)
            .foregroundStyle(state == .correct ? Palette.white : Palette.ink)
        }
        .buttonStyle(GlassActionButtonStyle(tinted: state == .correct))
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(state == .correct ? Palette.blue : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(state == .wrong ? Palette.ink.opacity(0.55) : Color.clear, lineWidth: 2)
        )
        .shadow(color: state == .correct ? Palette.blueGlow : .clear, radius: 18, y: 6)
        .opacity(state == .dimmed ? 0.32 : 1)
        .scaleEffect(state == .correct ? 1.03 : 1)
        .offset(x: shake)
        .animation(.spring(response: 0.35, dampingFraction: 0.6), value: state)
        .onChange(of: state) { _, newValue in
            guard newValue == .wrong, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.07).repeatCount(5, autoreverses: true)) { shake = 7 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { shake = 0 }
        }
        .accessibilityLabel(unit == nil ? label : "\(label) \(unit ?? "")")
    }

    private var label: String {
        unit == "%" ? "%\(Fmt.num(value))" : Fmt.num(value)
    }
}
