//
//  SummaryView.swift
//  Zihin
//
//  Yalnızca 60 saniye modunun sonunda görünür. Sonsuz mod hiç bitmediği
//  için bu ekran orada asla açılmaz.
//

import SwiftUI

struct SummaryView: View {
    @Environment(GameStore.self) private var store
    let onRestart: () -> Void
    let onHome: () -> Void

    @State private var appeared = false

    var body: some View {
        ZStack {
            AuroraBackground()

            VStack(spacing: 14) {
                Spacer(minLength: 12)

                VStack(spacing: 4) {
                    Text("Süre doldu").font(.subheadline).foregroundStyle(Palette.ink2)
                    Text("\(store.score)")
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Palette.blue)
                        .contentTransition(.numericText())
                    Text("puan · rekor \(store.progress.best(for: store.mode))")
                        .font(.footnote)
                        .foregroundStyle(Palette.ink3)
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 26)
                .liquidGlass(.rounded(28), tinted: true)

                HStack {
                    metric("\(store.correct)/\(store.asked)", "DOĞRU")
                    metric("\(store.bestStreak)", "EN UZUN SERİ")
                    metric("\(store.engine.level)", "SEVİYE")
                }
                .padding(18)
                .liquidGlass(.rounded(26))

                Spacer()

                Button(action: onRestart) {
                    Label("Bir tur daha", systemImage: "arrow.counterclockwise")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(Palette.white)
                }
                .background(Palette.blue, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .buttonStyle(GlassActionButtonStyle())

                Button(action: onHome) {
                    Text("Ana ekran")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .foregroundStyle(Palette.ink)
                }
                .buttonStyle(GlassActionButtonStyle())
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 16)
            .inGlassContainer()
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .onAppear { withAnimation(.spring(response: 0.55, dampingFraction: 0.85)) { appeared = true } }
        }
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.rounded(.title3, weight: .bold)).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(Palette.ink3)
        }
        .frame(maxWidth: .infinity)
    }
}
