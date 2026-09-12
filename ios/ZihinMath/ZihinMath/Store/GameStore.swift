//
//  GameStore.swift
//  Zihin
//
//  Kalıcı ilerleme + aktif oturum durumu.
//

import Foundation
import Observation
import SwiftUI

/// Oyun modları. Sonsuz mod asla bitmez.
enum GameMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case endless, timed
    var id: String { rawValue }

    var title: String {
        switch self {
        case .endless: "Sonsuz Antrenman"
        case .timed:   "60 Saniye"
        }
    }

    var subtitle: String {
        switch self {
        case .endless: "Bitmez. Süre yok, sınır yok — sürekli yeni soru."
        case .timed:   "Hız turu — bir dakikada kaç soru?"
        }
    }

    var symbol: String {
        switch self {
        case .endless: "infinity"
        case .timed:   "timer"
        }
    }
}

/// Diske yazılan ilerleme.
struct Progress: Codable, Sendable {
    var bestEndless: Int = 0
    var bestTimed: Int = 0
    var asked: Int = 0
    var correct: Int = 0
    var bestStreak: Int = 0
    var seconds: Int = 0
    var level: Int = 1
    var categories: [Category] = Category.allCases
    var perCategory: [String: CategoryStat] = [:]

    struct CategoryStat: Codable, Sendable {
        var asked: Int = 0
        var correct: Int = 0
        var accuracy: Double { asked == 0 ? 0 : Double(correct) / Double(asked) }
    }

    var accuracy: Double { asked == 0 ? 0 : Double(correct) / Double(asked) }

    func best(for mode: GameMode) -> Int {
        mode == .endless ? bestEndless : bestTimed
    }

    mutating func setBest(_ value: Int, for mode: GameMode) {
        switch mode {
        case .endless: bestEndless = max(bestEndless, value)
        case .timed:   bestTimed = max(bestTimed, value)
        }
    }
}

/// Cevap sonrası kısa süreli görsel durum.
enum AnswerOutcome: Equatable {
    case none
    case correct(picked: Double)
    case wrong(picked: Double, correct: Double)
}

@Observable
@MainActor
final class GameStore {

    // MARK: Kalıcı durum
    private(set) var progress = Progress()

    // MARK: Oturum
    private(set) var mode: GameMode = .endless
    private(set) var engine = QuestionEngine()
    private(set) var question: Question?
    private(set) var score = 0
    private(set) var streak = 0
    private(set) var bestStreak = 0
    private(set) var asked = 0
    private(set) var correct = 0
    private(set) var outcome: AnswerOutcome = .none
    private(set) var feedback: String = ""
    private(set) var secondsLeft: Int = 60
    private(set) var isRunning = false
    /// Seri kilometre taşında ekranı yalayan parlama.
    private(set) var flareToken = 0

    private var askedAt = Date()
    private var locked = false
    private var advanceTask: Task<Void, Never>?

    private let haptics = HapticEngine.shared
    private static let key = "zihin.progress.v1"

    init() { load() }

    // MARK: - Kalıcılık

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: Self.key),
              let decoded = try? JSONDecoder().decode(Progress.self, from: data) else { return }
        progress = decoded
        if progress.categories.isEmpty { progress.categories = Category.allCases }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(progress) else { return }
        UserDefaults.standard.set(data, forKey: Self.key)
    }

    // MARK: - Konu seçimi

    func isSelected(_ c: Category) -> Bool { progress.categories.contains(c) }

    func toggle(_ c: Category) {
        if progress.categories.contains(c) {
            guard progress.categories.count > 1 else { return }   // en az bir konu açık kalmalı
            progress.categories.removeAll { $0 == c }
        } else {
            progress.categories.append(c)
        }
        haptics.select()
        save()
    }

    func setHaptics(_ on: Bool) {
        haptics.isEnabled = on
        if on { haptics.select() }
    }

    var hapticsEnabled: Bool { haptics.isEnabled }

    // MARK: - Oyun döngüsü

    func start(_ mode: GameMode) {
        self.mode = mode
        engine = QuestionEngine(categories: progress.categories, level: progress.level)
        score = 0; streak = 0; bestStreak = 0; asked = 0; correct = 0
        outcome = .none; feedback = ""
        secondsLeft = 60
        isRunning = true
        locked = false
        haptics.tapMedium()
        nextQuestion()
    }

    /// Sıradaki soru. Sonsuz modda bu akış hiç durmaz.
    func nextQuestion() {
        advanceTask?.cancel()
        question = engine.next()
        outcome = .none
        feedback = ""
        locked = false
        askedAt = Date()
        haptics.warmUp()
    }

    func submit(_ picked: Double) {
        guard let q = question, !locked, isRunning else { return }
        locked = true

        let seconds = Date().timeIntervalSince(askedAt)
        let isRight = picked == q.answer

        asked += 1
        var stat = progress.perCategory[q.category.rawValue] ?? .init()
        stat.asked += 1

        if isRight {
            correct += 1
            stat.correct += 1
            streak += 1
            bestStreak = max(bestStreak, streak)
            let points = scoreFor(level: engine.level, seconds: seconds, streak: streak - 1)
            score += points
            outcome = .correct(picked: picked)

            if streak % 5 == 0 {
                haptics.streakMilestone(streak)
                flareToken += 1
                feedback = "+\(points) puan · \(streak) seri"
            } else {
                haptics.correct()
                feedback = streak >= 3 ? "+\(points) puan · \(streak) seri" : "+\(points) puan"
            }
        } else {
            streak = 0
            outcome = .wrong(picked: picked, correct: q.answer)
            haptics.wrong()
            feedback = q.hint
        }

        progress.perCategory[q.category.rawValue] = stat

        if engine.record(correct: isRight, seconds: seconds) > 0 {
            haptics.levelUp()
            feedback = "Seviye \(engine.level)"
        }
        save()

        advanceTask = Task { [isRight] in
            try? await Task.sleep(for: .milliseconds(isRight ? 620 : 1750))
            guard !Task.isCancelled, isRunning else { return }
            nextQuestion()
        }
    }

    /// Süreli modda her saniye çağrılır.
    func tickSecond() {
        guard isRunning, mode == .timed else { return }
        secondsLeft -= 1
        if secondsLeft <= 5 && secondsLeft > 0 { haptics.tick() }
        if secondsLeft <= 0 { finish() }
    }

    func finish() {
        guard isRunning else { return }
        advanceTask?.cancel()
        isRunning = false
        commit()
        haptics.levelUp()
    }

    /// Oyundan çıkış — ilerleme kaydedilir.
    func quit() {
        advanceTask?.cancel()
        if isRunning { commit() }
        isRunning = false
        question = nil
        haptics.tapLight()
    }

    private func commit() {
        progress.level = engine.level
        progress.asked += asked
        progress.correct += correct
        progress.bestStreak = max(progress.bestStreak, bestStreak)
        progress.setBest(score, for: mode)
        save()
    }

    func resetStatistics() {
        progress = Progress()
        save()
    }
}
