//
//  Question.swift
//  Zihin
//
//  Soru modeli. Web sürümündeki zihin/js/engine.js ile birebir aynı
//  spesifikasyonu uygular; ikisi de aynı testlerden geçer.
//

import Foundation

/// Soru kategorileri.
enum Category: String, CaseIterable, Codable, Identifiable, Sendable {
    case add, sub, mul, div, pct, daily, visual

    var id: String { rawValue }

    /// Ekranda görünen Türkçe ad.
    var title: String {
        switch self {
        case .add:    "Toplama"
        case .sub:    "Çıkarma"
        case .mul:    "Çarpma"
        case .div:    "Bölme"
        case .pct:    "Yüzde"
        case .daily:  "Günlük Hayat"
        case .visual: "Görsel"
        }
    }

    /// SF Symbols adı — Apple ikon rehberine uygun, metin ağırlığıyla eşleşir.
    var symbol: String {
        switch self {
        case .add:    "plus"
        case .sub:    "minus"
        case .mul:    "multiply"
        case .div:    "divide"
        case .pct:    "percent"
        case .daily:  "cart"
        case .visual: "eye"
        }
    }

    /// Kısa etiket için matematiksel işaret.
    var glyph: String {
        switch self {
        case .add:    "+"
        case .sub:    "−"
        case .mul:    "×"
        case .div:    "÷"
        case .pct:    "%"
        case .daily:  "₺"
        case .visual: "◉"
        }
    }
}

/// Görsel soruların çizim tarifi.
enum VisualSpec: Equatable, Sendable {
    case dots(groups: Int, per: Int)
    case grid(rows: Int, cols: Int)
    case bars(a: Int, b: Int)
    case pie(percent: Int)
    case numberLine(start: Double, end: Double, ticks: Int, at: Int)
    case coins(items: [CoinStack])

    struct CoinStack: Equatable, Sendable, Identifiable {
        let id = UUID()
        let value: Int
        let count: Int

        static func == (l: CoinStack, r: CoinStack) -> Bool {
            l.value == r.value && l.count == r.count
        }
    }

    /// Görselin kendi verisinden hesaplanan doğru cevap — test için.
    var derivedAnswer: Double {
        switch self {
        case let .dots(g, p):            Double(g * p)
        case let .grid(r, c):            Double(r * c)
        case let .bars(a, b):            Double(abs(a - b))
        case let .pie(p):                Double(p)
        case let .numberLine(s, e, t, a): s + (e - s) / Double(t) * Double(a)
        case let .coins(items):          Double(items.reduce(0) { $0 + $1.value * $1.count })
        }
    }
}

/// Tek bir soru.
struct Question: Identifiable, Equatable, Sendable {
    let id: String
    let index: Int
    let level: Int
    let category: Category
    /// Büyük punto ile gösterilen işlem (ör. "48 × 7"). Sözel sorularda nil.
    let expression: String?
    /// Sözel/problem metni. İşlem sorularında nil.
    let text: String?
    let visual: VisualSpec?
    /// Cevabın birimi ("TL", "%", "litre"…). Yoksa nil.
    let unit: String?
    let answer: Double
    let options: [Double]
    let hint: String
    /// Tekrar engellemek için kullanılan imza.
    let signature: String

    static func == (l: Question, r: Question) -> Bool { l.id == r.id }
}
