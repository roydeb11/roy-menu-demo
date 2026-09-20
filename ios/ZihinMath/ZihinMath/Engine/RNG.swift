//
//  RNG.swift
//  Zihin
//
//  Tekrarlanabilir sözde-rastgele sayı üreteci (mulberry32) ve yardımcıları.
//  Web sürümündeki makeRNG() ile aynı algoritma.
//

import Foundation

/// mulberry32 — hızlı, 32-bit durumlu PRNG.
struct Mulberry32: RandomNumberGenerator {
    private var state: UInt32

    init(seed: UInt32) { state = seed }

    private mutating func next32() -> UInt32 {
        state = state &+ 0x6d2b_79f5
        var t = state
        t = (t ^ (t >> 15)) &* (t | 1)
        t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
        return t ^ (t >> 14)
    }

    mutating func next() -> UInt64 {
        let hi = UInt64(next32())
        let lo = UInt64(next32())
        return (hi << 32) | lo
    }

    /// [0, 1) aralığında kayan nokta.
    mutating func unit() -> Double { Double(next32()) / 4_294_967_296.0 }
}

/// Soru üreteçlerinin kullandığı rastgelelik yardımcıları.
struct Rand {
    var gen: Mulberry32

    init(seed: UInt32) { gen = Mulberry32(seed: seed) }

    /// `lo` ve `hi` dahil tam sayı.
    mutating func int(_ lo: Int, _ hi: Int) -> Int {
        guard hi > lo else { return lo }
        return lo + Int(gen.unit() * Double(hi - lo + 1))
    }

    mutating func pick<T>(_ array: [T]) -> T {
        array[min(array.count - 1, Int(gen.unit() * Double(array.count)))]
    }

    mutating func bool(_ p: Double = 0.5) -> Bool { gen.unit() < p }

    mutating func shuffled<T>(_ array: [T]) -> [T] {
        var a = array
        guard a.count > 1 else { return a }
        for i in stride(from: a.count - 1, to: 0, by: -1) {
            let j = Int(gen.unit() * Double(i + 1))
            a.swapAt(i, min(j, i))
        }
        return a
    }

    /// Yuvarlak "para gibi" sayı: verilen adımın katı.
    mutating func money(_ lo: Int, _ hi: Int, step: Int? = nil) -> Int {
        let s = step ?? pick([5, 10, 25, 50])
        let a = Int((Double(lo) / Double(s)).rounded(.up))
        let b = Int((Double(hi) / Double(s)).rounded(.down))
        return (b >= a ? int(a, b) : a) * s
    }
}

/// İki ondalığa yuvarlar (para/yüzde hesapları için).
@inline(__always)
func round2(_ v: Double) -> Double { (v * 100).rounded() / 100 }

@inline(__always)
func clampInt(_ v: Int, _ lo: Int, _ hi: Int) -> Int { min(hi, max(lo, v)) }

/// Türkçe sayı biçimi: 1.234,5
enum Fmt {
    static let locale = Locale(identifier: "tr_TR")

    /// Tam sayıysa ondalıksız, değilse iki hane ile biçimlendirir.
    static func num(_ value: Double) -> String {
        let v = round2(value)
        if v == v.rounded() {
            return v.formatted(.number.locale(locale).precision(.fractionLength(0)))
        }
        return v.formatted(.number.locale(locale).precision(.fractionLength(2)))
    }

    static func num(_ value: Int) -> String { num(Double(value)) }
}
