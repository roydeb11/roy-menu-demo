//
//  HomeView.swift
//  Zihin
//

import SwiftUI

struct HomeView: View {
    @Environment(GameStore.self) private var store
    @State private var route: GameMode?
    @State private var showStats = false
    @State private var logoFloat = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        NavigationStack {
            ZStack {
                AuroraBackground()

                ScrollView {
                    VStack(spacing: 14) {
                        hero
                        modeButtons
                        topicsCard
                        progressCard
                        hapticToggle
                        Text("Zihinden matematik · toplama, çıkarma, çarpma, bölme, yüzde ve günlük hayat problemleri")
                            .font(.caption)
                            .foregroundStyle(Palette.ink3)
                            .multilineTextAlignment(.center)
                            .padding(.top, 4)
                            .padding(.bottom, 16)
                    }
                    .padding(.horizontal, 18)
                }
                .scrollIndicators(.hidden)
            }
            .navigationDestination(item: $route) { mode in
                PlayView().onAppear { store.start(mode) }
            }
            .navigationDestination(isPresented: $showStats) { StatsView() }
        }
        .tint(Palette.blue)
    }

    // MARK: - Başlık

    private var hero: some View {
        VStack(spacing: 6) {
            Text("Z")
                .font(.system(size: 44, weight: .bold, design: .rounded))
                .foregroundStyle(Palette.blue)
                .frame(width: 92, height: 92)
                .liquidGlass(.rounded(24), tinted: true)
                .offset(y: logoFloat ? -6 : 0)
                .rotationEffect(.degrees(logoFloat ? -2 : 0))
                .onAppear {
                    guard !reduceMotion else { return }
                    withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) { logoFloat = true }
                }

            Text("Zihin")
                .font(.system(.largeTitle, design: .rounded, weight: .bold))
            Text("Sonsuz ve her seferinde farklı")
                .font(.subheadline)
                .foregroundStyle(Palette.ink2)
        }
        .padding(.top, 22)
        .padding(.bottom, 6)
    }

    // MARK: - Modlar

    private var modeButtons: some View {
        VStack(spacing: 12) {
            ForEach(GameMode.allCases) { mode in
                Button { route = mode } label: {
                    rowLabel(symbol: mode.symbol,
                             title: mode.title,
                             subtitle: mode.subtitle,
                             trailing: "\(store.progress.best(for: mode))")
                }
                .buttonStyle(GlassActionButtonStyle(tinted: mode == .endless))
            }

            Button { showStats = true } label: {
                rowLabel(symbol: "chart.bar.xaxis",
                         title: "İstatistikler",
                         subtitle: "Hangi konuda güçlüsün?",
                         trailing: nil)
            }
            .buttonStyle(GlassActionButtonStyle())
        }
        .inGlassContainer()
    }

    private func rowLabel(symbol: String, title: String, subtitle: String, trailing: String?) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(Palette.blue)
                .frame(width: 34, height: 34)
                .symbolRenderingMode(.hierarchical)

            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline)
                Text(subtitle).font(.footnote).foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 6)

            if let trailing {
                Text(trailing)
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(Palette.ink3)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .foregroundStyle(Palette.ink)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Konular

    private var topicsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Konular").font(.headline)
                Spacer()
                Text("dokunarak aç / kapat").font(.caption).foregroundStyle(Palette.ink3)
            }

            FlowLayout(spacing: 8) {
                ForEach(Category.allCases) { category in
                    let on = store.isSelected(category)
                    Button { store.toggle(category) } label: {
                        HStack(spacing: 6) {
                            Image(systemName: category.symbol).font(.system(size: 12, weight: .semibold))
                            Text(category.title).font(.subheadline.weight(.medium))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .foregroundStyle(on ? Palette.white : Palette.ink2)
                        .background(on ? Palette.blue : Color.clear, in: Capsule())
                    }
                    .buttonStyle(GlassActionButtonStyle(shape: .capsule))
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
        .padding(18)
        .liquidGlass(.rounded(26))
    }

    // MARK: - İlerleme

    private var progressCard: some View {
        HStack {
            metric("\(store.progress.level)", "SEVİYE")
            metric("\(Int((store.progress.accuracy * 100).rounded()))%", "DOĞRULUK")
            metric("\(store.progress.asked)", "SORU")
        }
        .padding(18)
        .liquidGlass(.rounded(26))
    }

    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.rounded(.title3, weight: .bold)).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(Palette.ink3).kerning(0.4)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Haptik anahtarı

    private var hapticToggle: some View {
        Button {
            store.setHaptics(!store.hapticsEnabled)
        } label: {
            HStack {
                Image(systemName: store.hapticsEnabled ? "iphone.radiowaves.left.and.right" : "iphone.slash")
                Text(store.hapticsEnabled ? "Haptik: Açık" : "Haptik: Kapalı")
            }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(store.hapticsEnabled ? Palette.blue : Palette.ink2)
        }
        .buttonStyle(GlassActionButtonStyle())
    }
}

// MARK: - Basit akış düzeni (etiketler için)

/// Satır sonunda kendiliğinden alta geçen yatay düzen.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
