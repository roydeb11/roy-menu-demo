//
//  VisualFigureView.swift
//  Zihin
//
//  Görsel soruların çizimleri. Yalnızca üç ton kullanılır; çizimler
//  belirdiklerinde kısa, yumuşak bir animasyonla gelir.
//

import SwiftUI

struct VisualFigureView: View {
    let spec: VisualSpec
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        content
            .opacity(appeared ? 1 : 0)
            .scaleEffect(appeared ? 1 : 0.94)
            .onAppear {
                if reduceMotion { appeared = true }
                else { withAnimation(.spring(response: 0.5, dampingFraction: 0.82)) { appeared = true } }
            }
            .accessibilityLabel(accessibilityText)
    }

    @ViewBuilder
    private var content: some View {
        switch spec {
        case let .dots(groups, per):            DotsFigure(groups: groups, per: per)
        case let .grid(rows, cols):             GridFigure(rows: rows, cols: cols)
        case let .bars(a, b):                   BarsFigure(a: a, b: b)
        case let .pie(percent):                 PieFigure(percent: percent)
        case let .numberLine(s, e, ticks, at):  NumberLineFigure(start: s, end: e, ticks: ticks, at: at)
        case let .coins(items):                 CoinsFigure(items: items)
        }
    }

    private var accessibilityText: String {
        switch spec {
        case let .dots(g, p):       "\(g) grup, her grupta \(p) nokta"
        case let .grid(r, c):       "\(r) satır \(c) sütunluk ızgara"
        case let .bars(a, b):       "İki çubuk: \(a) birim ve \(b) birim"
        case let .pie(p):           "Dairenin yüzde \(p)'i dolu"
        case let .numberLine(s, e, _, _): "\(Fmt.num(s)) ile \(Fmt.num(e)) arası sayı doğrusu"
        case let .coins(items):     items.map { "\($0.count) adet \($0.value) lira" }.joined(separator: ", ")
        }
    }
}

// MARK: - Noktalar

private struct DotsFigure: View {
    let groups: Int
    let per: Int

    var body: some View {
        let columns = min(groups, 3)
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: columns), spacing: 10) {
            ForEach(0..<groups, id: \.self) { _ in
                let inner = min(per, 3)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: inner), spacing: 6) {
                    ForEach(0..<per, id: \.self) { _ in
                        Circle().fill(Palette.blue).frame(width: 14, height: 14)
                    }
                }
                .padding(10)
                .background(Palette.glassFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Palette.glassStroke, lineWidth: 1))
            }
        }
    }
}

// MARK: - Izgara

private struct GridFigure: View {
    let rows: Int
    let cols: Int

    var body: some View {
        VStack(spacing: 5) {
            ForEach(0..<rows, id: \.self) { _ in
                HStack(spacing: 5) {
                    ForEach(0..<cols, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Palette.blue.opacity(0.88))
                            .aspectRatio(1, contentMode: .fit)
                    }
                }
            }
        }
        .frame(maxWidth: CGFloat(cols) * 34)
    }
}

// MARK: - Çubuklar

private struct BarsFigure: View {
    let a: Int
    let b: Int
    @State private var grown = false

    var body: some View {
        let maxV = CGFloat(max(a, b))
        HStack(alignment: .bottom, spacing: 40) {
            bar(value: a, color: Palette.blue, maxV: maxV)
            bar(value: b, color: Palette.ink.opacity(0.62), maxV: maxV)
        }
        .frame(height: 132)
        .onAppear { withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) { grown = true } }
    }

    private func bar(value: Int, color: Color, maxV: CGFloat) -> some View {
        VStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(color)
                .frame(width: 54, height: grown ? 110 * CGFloat(value) / maxV : 0)
            Text("\(value)")
                .font(.rounded(.footnote, weight: .semibold))
                .foregroundStyle(Palette.ink3)
        }
    }
}

// MARK: - Pasta

private struct PieFigure: View {
    let percent: Int
    @State private var shown = false

    var body: some View {
        ZStack {
            Circle().fill(Palette.glassFill)
            Circle().stroke(Palette.glassStroke, lineWidth: 1)
            Circle()
                .trim(from: 0, to: shown ? CGFloat(percent) / 100 : 0)
                .fill(Palette.blue.opacity(0.9))
                .rotationEffect(.degrees(-90))
                .mask(Circle())
            // çeyrek kılavuzları — okumayı kolaylaştırır
            ForEach(0..<4, id: \.self) { i in
                Rectangle()
                    .fill(Palette.ink.opacity(0.18))
                    .frame(width: 1, height: 72)
                    .offset(y: -36)
                    .rotationEffect(.degrees(Double(i) * 90))
            }
        }
        .frame(width: 148, height: 148)
        .onAppear { withAnimation(.easeOut(duration: 0.7)) { shown = true } }
    }
}

// MARK: - Sayı doğrusu

private struct NumberLineFigure: View {
    let start: Double
    let end: Double
    let ticks: Int
    let at: Int
    @State private var shown = false

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let step = w / CGFloat(ticks)
            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(Palette.ink3)
                    .frame(width: w, height: 2)
                    .offset(y: 42)

                ForEach(0...ticks, id: \.self) { i in
                    let major = i == 0 || i == ticks
                    Rectangle()
                        .fill(major ? Palette.ink : Palette.ink3)
                        .frame(width: major ? 2 : 1, height: major ? 22 : 12)
                        .offset(x: CGFloat(i) * step, y: major ? 32 : 37)
                }

                Text(Fmt.num(start))
                    .font(.rounded(.caption, weight: .semibold))
                    .foregroundStyle(Palette.ink3)
                    .offset(x: -8, y: 60)
                Text(Fmt.num(end))
                    .font(.rounded(.caption, weight: .semibold))
                    .foregroundStyle(Palette.ink3)
                    .offset(x: w - 16, y: 60)

                VStack(spacing: 2) {
                    Text("?")
                        .font(.rounded(.headline, weight: .bold))
                        .foregroundStyle(Palette.blue)
                    Image(systemName: "arrowtriangle.down.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.blue)
                }
                .offset(x: CGFloat(at) * step - 9, y: 0)
                .opacity(shown ? 1 : 0)
                .offset(y: shown ? 0 : -10)
            }
        }
        .frame(height: 84)
        .padding(.horizontal, 14)
        .onAppear { withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(0.12)) { shown = true } }
    }
}

// MARK: - Para

private struct CoinsFigure: View {
    let items: [VisualSpec.CoinStack]

    private var flattened: [(id: Int, value: Int)] {
        var out: [(Int, Int)] = []
        var i = 0
        for s in items {
            for _ in 0..<s.count { out.append((i, s.value)); i += 1 }
        }
        return out.map { (id: $0.0, value: $0.1) }
    }

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
            ForEach(flattened, id: \.id) { item in
                if item.value <= 5 {
                    ZStack {
                        Circle().fill(Palette.glassFill)
                        Circle().stroke(Palette.ink, lineWidth: 1.5)
                        Text("\(item.value)").font(.rounded(.headline, weight: .bold))
                    }
                    .frame(height: 52)
                } else {
                    ZStack {
                        RoundedRectangle(cornerRadius: 7, style: .continuous).fill(Palette.blueFill)
                        RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(Palette.blueStroke, lineWidth: 1.5)
                        Text("\(item.value)").font(.rounded(.headline, weight: .bold)).foregroundStyle(Palette.blue)
                    }
                    .frame(height: 38)
                }
            }
        }
        .padding(.horizontal, 8)
    }
}
