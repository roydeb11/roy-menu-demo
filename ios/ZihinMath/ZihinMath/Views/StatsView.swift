//
//  StatsView.swift
//  Zihin
//

import SwiftUI

struct StatsView: View {
    @Environment(GameStore.self) private var store
    @State private var confirmReset = false

    var body: some View {
        ZStack {
            AuroraBackground()

            ScrollView {
                VStack(spacing: 14) {
                    summaryCard
                    perCategoryCard
                    Button("İstatistikleri sıfırla") { confirmReset = true }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .foregroundStyle(Palette.ink2)
                        .buttonStyle(GlassActionButtonStyle())
                        .padding(.top, 6)
                        .padding(.bottom, 20)
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("İstatistikler")
        .navigationBarTitleDisplayMode(.large)
        .confirmationDialog("Tüm istatistikler sıfırlansın mı?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Sıfırla", role: .destructive) { store.resetStatistics() }
            Button("Vazgeç", role: .cancel) { }
        }
    }

    private var summaryCard: some View {
        HStack {
            metric("\(store.progress.asked)", "SORU")
            metric("\(Int((store.progress.accuracy * 100).rounded()))%", "DOĞRULUK")
            metric("\(store.progress.bestStreak)", "EN UZUN SERİ")
            metric("\(store.progress.level)", "SEVİYE")
        }
        .padding(18)
        .liquidGlass(.rounded(26))
    }

    private var perCategoryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Konu başarısı").font(.headline)

            ForEach(Category.allCases) { category in
                let stat = store.progress.perCategory[category.rawValue] ?? .init()
                HStack(spacing: 12) {
                    Label(category.title, systemImage: category.symbol)
                        .font(.subheadline)
                        .foregroundStyle(Palette.ink2)
                        .labelStyle(.titleAndIcon)
                        .frame(width: 132, alignment: .leading)
                        .lineLimit(1)

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Palette.ink.opacity(0.12))
                            Capsule()
                                .fill(Palette.blue)
                                .frame(width: geo.size.width * stat.accuracy)
                        }
                    }
                    .frame(height: 7)

                    Text(stat.asked == 0 ? "—" : "\(Int((stat.accuracy * 100).rounded()))%")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .frame(width: 48, alignment: .trailing)
                }
                .padding(.vertical, 4)
            }
        }
        .padding(18)
        .liquidGlass(.rounded(26))
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.rounded(.title3, weight: .bold)).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(Palette.ink3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}
