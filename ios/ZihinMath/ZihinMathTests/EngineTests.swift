//
//  EngineTests.swift
//  ZihinMathTests
//
//  Motorun değişmezleri. Web sürümündeki zihin/tests/engine.test.mjs ile
//  aynı iddiaları doğrular.
//

import Testing
import Foundation
@testable import ZihinMath

@MainActor
struct EngineTests {

    // MARK: 1 — Şık bütünlüğü

    @Test("Her soruda dört benzersiz şık vardır ve doğru cevap içlerindedir")
    func optionsAreWellFormed() {
        for level in 1...10 {
            let engine = QuestionEngine(seed: UInt32(1000 + level), level: level)
            for _ in 0..<3000 {
                let q = engine.next()
                #expect(q.options.count == 4)
                #expect(Set(q.options).count == 4)
                #expect(q.options.contains(q.answer))
                #expect(q.answer.isFinite)
                #expect(q.options.allSatisfy { $0.isFinite })
                #expect(q.level == level)
            }
        }
    }

    // MARK: 2 — Aritmetik doğruluk

    @Test("Dört işlem ifadeleri yeniden hesaplandığında cevapla uyuşur")
    func arithmeticIsCorrect() {
        func parseTR(_ s: String) -> Double {
            Double(s.replacingOccurrences(of: ".", with: "")
                    .replacingOccurrences(of: ",", with: ".")) ?? .nan
        }

        for level in 1...10 {
            let engine = QuestionEngine(seed: UInt32(777 + level), level: level,
                                        categories: [.add, .sub, .mul, .div])
            for _ in 0..<2000 {
                let q = engine.next()
                let expression = try! #require(q.expression)
                let parts = expression.split(separator: " ").map(String.init)
                #expect(parts.count == 3)
                let a = parseTR(parts[0]), b = parseTR(parts[2])
                let expected: Double
                switch parts[1] {
                case "+": expected = a + b
                case "−": expected = a - b
                case "×": expected = a * b
                case "÷": expected = a / b
                default:  expected = .nan
                }
                #expect(round2(expected) == q.answer)
                if parts[1] == "−" { #expect(q.answer >= 0) }          // negatif sonuç olmaz
                if parts[1] == "÷" { #expect(q.answer == q.answer.rounded()) } // kalan olmaz
            }
        }
    }

    // MARK: 3 — Görsel tutarlılık

    @Test("Görsel soruların cevabı çizim verisinden türetilebilir")
    func visualsMatchTheirAnswer() {
        for level in 1...10 {
            let engine = QuestionEngine(seed: UInt32(4242 + level), level: level, categories: [.visual])
            for _ in 0..<2000 {
                let q = engine.next()
                let visual = try! #require(q.visual)
                #expect(round2(visual.derivedAnswer) == q.answer)
                if case .bars = visual { #expect(q.answer > 0) }       // eşit çubuk olmaz
            }
        }
    }

    // MARK: 4 — Tekrar yok

    @Test("Aynı soru geçmiş penceresi içinde iki kez çıkmaz")
    func noRepeatsWithinWindow() {
        let engine = QuestionEngine(seed: 31337, historySize: 60)
        var ring: [String] = []
        for _ in 0..<20000 {
            let q = engine.next()
            #expect(!ring.contains(q.signature))
            ring.append(q.signature)
            if ring.count > 60 { ring.removeFirst() }
        }
    }

    @Test("Üç ardışık soru aynı konudan gelmez")
    func noThreeInARow() {
        let engine = QuestionEngine(seed: 5150)
        var last: [Category] = []
        for _ in 0..<10000 {
            last.append(engine.next().category)
            if last.count > 3 { last.removeFirst() }
            if last.count == 3 {
                #expect(!(last[0] == last[1] && last[1] == last[2]))
            }
        }
    }

    // MARK: 5 — Sonsuzluk

    @Test("Akış kesintisiz devam eder — 200.000 soru")
    func streamNeverEnds() {
        let engine = QuestionEngine(seed: 2026)
        var produced = 0
        for _ in 0..<200_000 {
            let q = engine.next()
            if q.options.count == 4 && q.answer.isFinite { produced += 1 }
        }
        #expect(produced == 200_000)
    }

    // MARK: 6 — Uyarlanır zorluk

    @Test("Hep doğru ve hızlı cevaplarda seviye tavana çıkar")
    func difficultyRises() {
        let engine = QuestionEngine(seed: 11, level: 1)
        for _ in 0..<200 { _ = engine.next(); engine.record(correct: true, seconds: 1.5) }
        #expect(engine.level == 10)
    }

    @Test("Hep yanlış cevaplarda seviye tabana iner")
    func difficultyFalls() {
        let engine = QuestionEngine(seed: 12, level: 10)
        for _ in 0..<200 { _ = engine.next(); engine.record(correct: false, seconds: 20) }
        #expect(engine.level == 1)
    }

    // MARK: 7 — Kapsama ve filtreleme

    @Test("Günlük hayat şablonlarının tamamı üretilir")
    func allDailyTemplatesAppear() {
        let engine = QuestionEngine(seed: 8080, categories: [.daily], historySize: 5)
        var prefixes = Set<String>()
        for _ in 0..<40000 {
            prefixes.insert(String(engine.next().signature.split(separator: ":")[0]))
        }
        #expect(prefixes.count == dailyTemplateCount)
    }

    @Test("Tek konu seçilirse yalnız o konudan soru gelir", arguments: Category.allCases)
    func categoryFilterHolds(_ category: Category) {
        let engine = QuestionEngine(seed: 5, categories: [category])
        for _ in 0..<1000 { #expect(engine.next().category == category) }
    }

    @Test("Bütün konular üretilebiliyor")
    func everyCategoryIsReachable() {
        let engine = QuestionEngine(seed: 99)
        var seen = Set<Category>()
        for _ in 0..<5000 { seen.insert(engine.next().category) }
        #expect(seen.count == Category.allCases.count)
    }

    // MARK: 8 — Puanlama

    @Test("Puanlama beklendiği gibi çalışır")
    func scoring() {
        #expect(scoreFor(level: 1, seconds: 6, streak: 0) == 10)
        #expect(scoreFor(level: 10, seconds: 0, streak: 20) == 240)
        #expect(scoreFor(level: 5, seconds: 3, streak: 5) > scoreFor(level: 5, seconds: 5, streak: 5))
        #expect(scoreFor(level: 5, seconds: 3, streak: 10) > scoreFor(level: 5, seconds: 3, streak: 2))
    }

    // MARK: 9 — Metin sağlığı

    @Test("Soru metinlerinde bozuk biçimlendirme yoktur")
    func textIsClean() {
        let engine = QuestionEngine(seed: 4711)
        for _ in 0..<30000 {
            let q = engine.next()
            let blob = [q.text, q.expression, q.hint].compactMap { $0 }.joined(separator: "|")
            #expect(!blob.contains("nan"))
            #expect(!blob.contains("inf"))
            #expect(!blob.isEmpty)
        }
    }

    // MARK: 10 — Türkçe biçim

    @Test("Sayılar Türkçe biçimde gösterilir")
    func turkishFormatting() {
        #expect(Fmt.num(1_234_567) == "1.234.567")
        #expect(Fmt.num(1234.5) == "1.234,50")
        #expect(Fmt.num(0) == "0")
    }
}
