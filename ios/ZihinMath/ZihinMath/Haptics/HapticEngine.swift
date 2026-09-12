//
//  HapticEngine.swift
//  Zihin
//
//  Apple HIG "Playing haptics" ilkeleri:
//   • Standart desenler belgelenmiş anlamlarında kullanılır — başarı/uyarı/hata
//     bildirimi, çarpma (impact) ve seçim (selection).
//   • Her haptik, onu doğuran eylemle nedensel ilişki kurar; görsel geri
//     bildirimi pekiştirir, onun yerine geçmez.
//   • Aşırıya kaçılmaz: yalnızca cevap, seçim, seri kilometre taşı ve seviye
//     değişiminde çalar.
//   • Kullanıcı haptiği tamamen kapatabilir; uygulama haptiksiz de tam çalışır.
//
//  Seri ve seviye atlama için Core Haptics ile özel desenler kurulur
//  (geçici/transient olaylar + keskinlik ve şiddet denetimi).
//

import CoreHaptics
import UIKit

@MainActor
final class HapticEngine {

    static let shared = HapticEngine()

    /// Kullanıcı tercihi. Kapalıyken hiçbir haptik çalmaz.
    var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: Self.defaultsKey) }
    }

    private static let defaultsKey = "zihin.haptics.enabled"

    private let notification = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()
    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactRigid = UIImpactFeedbackGenerator(style: .rigid)

    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool { CHHapticEngine.capabilitiesForHardware().supportsHaptics }

    private init() {
        if UserDefaults.standard.object(forKey: Self.defaultsKey) == nil {
            isEnabled = true
        } else {
            isEnabled = UserDefaults.standard.bool(forKey: Self.defaultsKey)
        }
        prepareCoreHaptics()
    }

    // MARK: - Hazırlık

    /// Gecikmeyi en aza indirmek için Taptic Engine'i uyandırır.
    /// Soru gösterilmeden hemen önce çağrılır.
    func warmUp() {
        guard isEnabled else { return }
        notification.prepare()
        selection.prepare()
        impactLight.prepare()
        impactMedium.prepare()
    }

    private func prepareCoreHaptics() {
        guard supportsHaptics else { return }
        do {
            let e = try CHHapticEngine()
            e.isAutoShutdownEnabled = true
            e.resetHandler = { [weak self] in
                try? self?.engine?.start()
            }
            // Motor sistem tarafından durdurulduğunda (arka plana geçiş, ses
            // oturumu kesintisi) yapılacak bir şey yok: bir sonraki haptik
            // isteğinde resetHandler zaten yeniden başlatıyor.
            e.stoppedHandler = { _ in }
            try e.start()
            engine = e
        } catch {
            engine = nil          // haptik yoksa uygulama sessizce çalışmaya devam eder
        }
    }

    // MARK: - Standart desenler

    /// Doğru cevap — olumlu sonuç bildirimi.
    func correct() {
        guard isEnabled else { return }
        notification.notificationOccurred(.success)
    }

    /// Yanlış cevap — olumsuz sonuç bildirimi.
    func wrong() {
        guard isEnabled else { return }
        notification.notificationOccurred(.error)
    }

    /// Konu açma/kapama gibi değer değişimleri.
    func select() {
        guard isEnabled else { return }
        selection.selectionChanged()
    }

    /// Hafif dokunuş — gezinme, geri dönüş.
    func tapLight() {
        guard isEnabled else { return }
        impactLight.impactOccurred()
    }

    /// Belirgin dokunuş — oyun başlangıcı.
    func tapMedium() {
        guard isEnabled else { return }
        impactMedium.impactOccurred()
    }

    /// Süre sayacının son saniyeleri — keskin, kısa.
    func tick() {
        guard isEnabled else { return }
        impactRigid.impactOccurred(intensity: 0.55)
    }

    // MARK: - Özel desenler (Core Haptics)

    /// Seri kilometre taşı: hızlanan üç geçici darbe + yükselen keskinlik.
    func streakMilestone(_ streak: Int) {
        guard isEnabled else { return }
        let strength = min(1.0, 0.55 + Double(streak) * 0.02)
        let events: [CHHapticEvent] = [
            transient(at: 0.00, intensity: Float(strength * 0.70), sharpness: 0.35),
            transient(at: 0.09, intensity: Float(strength * 0.85), sharpness: 0.55),
            transient(at: 0.16, intensity: Float(strength), sharpness: 0.80),
        ]
        play(events, fallback: { self.notification.notificationOccurred(.success) })
    }

    /// Seviye atlama: yükselen dört darbenin ardından kısa sürekli titreşim.
    func levelUp() {
        guard isEnabled else { return }
        var events: [CHHapticEvent] = []
        for i in 0..<4 {
            events.append(transient(at: Double(i) * 0.07,
                                    intensity: Float(0.5 + Double(i) * 0.15),
                                    sharpness: Float(0.4 + Double(i) * 0.15)))
        }
        events.append(
            CHHapticEvent(eventType: .hapticContinuous, parameters: [
                .init(parameterID: .hapticIntensity, value: 0.55),
                .init(parameterID: .hapticSharpness, value: 0.30),
            ], relativeTime: 0.30, duration: 0.22)
        )
        play(events, fallback: { self.notification.notificationOccurred(.success) })
    }

    // MARK: - Yardımcılar

    private func transient(at time: TimeInterval, intensity: Float, sharpness: Float) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticTransient, parameters: [
            .init(parameterID: .hapticIntensity, value: intensity),
            .init(parameterID: .hapticSharpness, value: sharpness),
        ], relativeTime: time)
    }

    private func play(_ events: [CHHapticEvent], fallback: () -> Void) {
        guard supportsHaptics, let engine else { fallback(); return }
        do {
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            fallback()
        }
    }
}
