//
//  QuestionEngine.swift
//  Zihin
//
//  Sonsuz soru akışı: asla bitmez, pencere içinde asla tekrar etmez,
//  zorluk oyuncunun doğruluk ve hızına göre kendini ayarlar.
//

import Foundation
import Observation

@Observable
final class QuestionEngine {

    /// Şu anki zorluk seviyesi (1…10).
    private(set) var level: Int

    /// Aktif konular. Boş bırakılamaz.
    private(set) var categories: [Category]

    private var rand: Rand
    private let seed: UInt32
    private let historySize: Int

    /// Son soruların imzaları — aynı soru pencere içinde tekrar gelmez.
    private var recentSignatures: [String] = []
    /// Son kategoriler — üç ardışık soru aynı konudan gelmez.
    private var recentCategories: [Category] = []
    /// Uyarlanır zorluk penceresi.
    private var window: [(correct: Bool, seconds: Double)] = []

    private var counter = 0

    init(seed: UInt32? = nil, categories: [Category] = Category.allCases, level: Int = 1, historySize: Int = 60) {
        self.seed = seed ?? UInt32.random(in: 1...UInt32.max)
        self.rand = Rand(seed: self.seed)
        self.categories = categories.isEmpty ? Category.allCases : categories
        self.level = clampInt(level, 1, 10)
        self.historySize = historySize
    }

    func setCategories(_ cats: [Category]) {
        categories = cats.isEmpty ? Category.allCases : cats
    }

    // MARK: - Üretim

    private func pickCategory() -> Category {
        guard categories.count > 1 else { return categories[0] }
        let last2 = recentCategories.suffix(2)
        let fresh = categories.filter { !last2.contains($0) }
        return rand.pick(fresh.isEmpty ? categories : fresh)
    }

    private func generate(_ category: Category) -> RawQuestion {
        switch category {
        case .add:    genAdd(&rand, level: level)
        case .sub:    genSub(&rand, level: level)
        case .mul:    genMul(&rand, level: level)
        case .div:    genDiv(&rand, level: level)
        case .pct:    genPct(&rand, level: level)
        case .daily:  genDaily(&rand, level: level)
        case .visual: genVisual(&rand, level: level)
        }
    }

    /// Sıradaki soru. Her çağrıda yeni ve farklı — akış asla bitmez.
    func next() -> Question {
        var raw: RawQuestion?
        for _ in 0..<24 {
            let candidate = generate(pickCategory())
            if recentSignatures.contains(candidate.signature) { continue }
            raw = candidate
            break
        }
        let q = raw ?? generate(pickCategory())

        recentSignatures.append(q.signature)
        if recentSignatures.count > historySize { recentSignatures.removeFirst() }
        recentCategories.append(q.category)
        if recentCategories.count > 8 { recentCategories.removeFirst() }

        counter += 1
        return Question(
            id: "\(String(seed, radix: 36))-\(counter)",
            index: counter,
            level: level,
            category: q.category,
            expression: q.expression,
            text: q.text,
            visual: q.visual,
            unit: q.unit,
            answer: round2(q.answer),
            options: q.options.map(round2),
            hint: q.hint,
            signature: q.signature
        )
    }

    // MARK: - Uyarlanır zorluk

    /// Cevabı kaydeder ve gerekiyorsa seviyeyi değiştirir.
    /// - Returns: seviye farkı (-1, 0, +1).
    @discardableResult
    func record(correct: Bool, seconds: Double) -> Int {
        window.append((correct, seconds))
        if window.count > 8 { window.removeFirst() }
        guard window.count >= 5 else { return 0 }

        let accuracy = Double(window.filter(\.correct).count) / Double(window.count)
        let averageSeconds = window.reduce(0) { $0 + $1.seconds } / Double(window.count)
        let fastEnough = averageSeconds < 9.0 + Double(level) * 0.9

        let before = level
        if accuracy >= 0.85 && fastEnough {
            level = clampInt(level + 1, 1, 10)
        } else if accuracy <= 0.5 {
            level = clampInt(level - 1, 1, 10)
        }
        if level != before { window.removeAll() }
        return level - before
    }
}

// MARK: - Puanlama

/// Puan: taban (10 × seviye) + hız bonusu, seri çarpanıyla.
func scoreFor(level: Int, seconds: Double, streak: Int) -> Int {
    let base = 10 * level
    let speed = max(0, Int(((6.0 - min(seconds, 6.0)) / 0.3).rounded()))
    let multiplier = 1 + Double(min(streak, 20)) * 0.05
    return Int((Double(base + speed) * multiplier).rounded())
}
