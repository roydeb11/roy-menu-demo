//
//  QuestionGenerator.swift
//  Zihin
//
//  Sonsuz, her seferinde farklı soru üretimi.
//  zihin/js/engine.js ile birebir aynı spesifikasyon.
//

import Foundation

// MARK: - Şık üretimi

/// Doğru cevabı içeren, dördü de benzersiz şık listesi üretir.
/// `errors` kategoriye özgü "tipik hata" adaylarıdır; yetmezse yedek
/// stratejiler listeyi dörde tamamlar.
func buildOptions(
    _ r: inout Rand,
    answer: Double,
    errors: [Double],
    integer: Bool = true,
    allowNegative: Bool = false
) -> [Double] {
    func norm(_ v: Double) -> Double { integer ? v.rounded() : round2(v) }

    var seen: Set<Double> = [norm(answer)]
    var out: [Double] = []

    func consider(_ v: Double) {
        guard out.count < 3, v.isFinite else { return }
        let n = norm(v)
        guard allowNegative || n >= 0 else { return }
        guard !seen.contains(n) else { return }
        seen.insert(n)
        out.append(n)
    }

    for e in r.shuffled(errors) { consider(e) }

    let magnitude = max(1, abs(answer))
    for d in r.shuffled([1, 2, 3, 5, 10, -1, -2, -3, -5, -10] as [Double]) { consider(answer + d) }

    let scale = max(1, (magnitude * 0.1).rounded())
    var k = 1
    while out.count < 3 && k <= 40 {
        consider(answer + (r.bool() ? 1 : -1) * scale * Double(k))
        consider(answer + (r.bool() ? 1 : -1) * Double(k))
        k += 1
    }
    while out.count < 3 {
        consider(norm(answer) + Double(out.count + 1) + Double(r.int(11, 99)))
    }

    return r.shuffled([norm(answer)] + out)
}

/// Rakam yer değiştirme hatası (143 → 134). Tek haneliyse NaN döner ve elenir.
func digitSwap(_ n: Double) -> Double {
    var chars = Array(String(Int(abs(n).rounded())))
    guard chars.count >= 2 else { return .nan }
    let i = chars.count - 2
    chars.swapAt(i, i + 1)
    let v = Double(String(chars)) ?? .nan
    return n < 0 ? -v : v
}

// MARK: - Ham soru (üreteç çıktısı)

/// Üreteçlerin döndürdüğü ara yapı; `QuestionEngine` bunu `Question`a çevirir.
struct RawQuestion {
    var category: Category
    var expression: String?
    var text: String?
    var visual: VisualSpec?
    var unit: String?
    var answer: Double
    var options: [Double]
    var hint: String
    var signature: String
}

// MARK: - Dört işlem

func genAdd(_ r: inout Rand, level L: Int) -> RawQuestion {
    var a: Double, b: Double
    var decimals = false

    switch L {
    case ...2:  a = Double(r.int(2, 20));      b = Double(r.int(2, 20))
    case 3...4: a = Double(r.int(12, 99));     b = Double(r.int(12, 99))
    case 5...6: a = Double(r.int(120, 899));   b = Double(r.int(25, 199))
    case 7...8: a = Double(r.int(450, 4999));  b = Double(r.int(150, 3999))
    default:    a = Double(r.int(1500, 9999)); b = Double(r.int(1500, 9999))
    }

    if L >= 5 && r.bool(0.28) {
        decimals = true
        a = round2(Double(r.int(15, 480)) + r.pick([0.25, 0.5, 0.75, 0.9, 0.05]))
        b = round2(Double(r.int(5, 260)) + r.pick([0.25, 0.5, 0.75, 0.1]))
    }

    let answer = round2(a + b)
    let errors = [a + b + 10, a + b - 10, a + b + 1, a + b - 1, a - b, digitSwap(a + b), a + b + 100]
    return RawQuestion(
        category: .add,
        expression: "\(Fmt.num(a)) + \(Fmt.num(b))",
        text: nil, visual: nil, unit: nil,
        answer: answer,
        options: buildOptions(&r, answer: answer, errors: errors, integer: !decimals),
        hint: "\(Fmt.num(a)) + \(Fmt.num(b)) = \(Fmt.num(answer))",
        signature: "add:\(a)+\(b)"
    )
}

func genSub(_ r: inout Rand, level L: Int) -> RawQuestion {
    var a: Double, b: Double
    var decimals = false

    switch L {
    case ...2:  a = Double(r.int(6, 20));       b = Double(r.int(1, Int(a) - 1))
    case 3...4: a = Double(r.int(30, 99));      b = Double(r.int(5, Int(a) - 2))
    case 5...6: a = Double(r.int(150, 900));    b = Double(r.int(20, Int(a) - 10))
    case 7...8: a = Double(r.int(800, 5000));   b = Double(r.int(120, Int(a) - 50))
    default:    a = Double(r.int(3000, 9999));  b = Double(r.int(900, Int(a) - 200))
    }

    if L >= 5 && r.bool(0.25) {
        decimals = true
        a = round2(Double(r.int(60, 900)) + r.pick([0.5, 0.25, 0.75]))
        b = round2(Double(r.int(10, max(11, Int(a) - 10))) + r.pick([0.25, 0.5]))
    }

    let answer = round2(a - b)
    let errors = [b - a, a + b, answer + 10, answer - 10, answer + 1, answer - 1, digitSwap(answer)]
    return RawQuestion(
        category: .sub,
        expression: "\(Fmt.num(a)) − \(Fmt.num(b))",
        text: nil, visual: nil, unit: nil,
        answer: answer,
        options: buildOptions(&r, answer: answer, errors: errors, integer: !decimals),
        hint: "\(Fmt.num(a)) − \(Fmt.num(b)) = \(Fmt.num(answer))",
        signature: "sub:\(a)-\(b)"
    )
}

func genMul(_ r: inout Rand, level L: Int) -> RawQuestion {
    let a: Double, b: Double
    switch L {
    case ...2:  a = Double(r.int(2, 6));    b = Double(r.int(2, 9))
    case 3...4: a = Double(r.int(3, 12));   b = Double(r.int(3, 12))
    case 5...6: a = Double(r.int(11, 29));  b = Double(r.int(3, 12))
    case 7...8: a = Double(r.int(12, 49));  b = Double(r.int(11, 29))
    default:    a = Double(r.int(101, 999)); b = Double(r.int(11, 49))
    }

    let answer = a * b
    let errors = [a * b + a, a * b - a, a * b + b, a * b - b, a + b, (a + 1) * b, a * (b + 1), digitSwap(answer)]
    return RawQuestion(
        category: .mul,
        expression: "\(Fmt.num(a)) × \(Fmt.num(b))",
        text: nil, visual: nil, unit: nil,
        answer: answer,
        options: buildOptions(&r, answer: answer, errors: errors),
        hint: "\(Fmt.num(a)) × \(Fmt.num(b)) = \(Fmt.num(answer))",
        signature: "mul:\(a)x\(b)"
    )
}

func genDiv(_ r: inout Rand, level L: Int) -> RawQuestion {
    // Bölünen, tam bölünecek biçimde kurulur — kalan asla olmaz.
    let d: Double, q: Double
    switch L {
    case ...2:  d = Double(r.int(2, 5));   q = Double(r.int(2, 9))
    case 3...4: d = Double(r.int(2, 9));   q = Double(r.int(3, 12))
    case 5...6: d = Double(r.int(3, 12));  q = Double(r.int(4, 25))
    case 7...8: d = Double(r.int(4, 19));  q = Double(r.int(6, 49))
    default:    d = Double(r.int(11, 39)); q = Double(r.int(11, 99))
    }

    let n = d * q
    let errors = [q + 1, q - 1, d, n - d, q * 2, (q / 2).rounded(), q + 10, digitSwap(q)]
    return RawQuestion(
        category: .div,
        expression: "\(Fmt.num(n)) ÷ \(Fmt.num(d))",
        text: nil, visual: nil, unit: nil,
        answer: q,
        options: buildOptions(&r, answer: q, errors: errors),
        hint: "\(Fmt.num(d)) × \(Fmt.num(q)) = \(Fmt.num(n)) olduğundan \(Fmt.num(n)) ÷ \(Fmt.num(d)) = \(Fmt.num(q))",
        signature: "div:\(n)/\(d)"
    )
}

// MARK: - Yüzde

func genPct(_ r: inout Rand, level L: Int) -> RawQuestion {
    let easyP: [Int] = [10, 20, 25, 50, 5, 75]
    let hardP: [Int] = [12, 15, 18, 30, 35, 40, 45, 60, 65, 80, 90, 3, 8]

    enum Mode { case of, whatPct, discount, increase, reverse }
    let mode: Mode
    switch L {
    case ...3:  mode = .of
    case 4...6: mode = r.pick([.of, .of, .whatPct, .discount])
    default:    mode = r.pick([.of, .whatPct, .discount, .increase, .reverse])
    }

    switch mode {
    case .of:
        let p = L <= 4 ? r.pick(easyP) : r.pick(easyP + hardP)
        let base: Int
        switch L {
        case ...3:  base = r.money(40, 400, step: 20)
        case 4...6: base = r.money(80, 1200, step: 20)
        default:    base = r.money(200, 9000, step: 50)
        }
        let answer = round2(Double(base * p) / 100)
        let errors = [Double(base * p) / 1000, Double(base * p) / 10, Double(base) - answer,
                      answer * 2, answer / 2, answer + Double(base) * 0.01]
        return RawQuestion(
            category: .pct,
            expression: "%\(p) × \(Fmt.num(base))",
            text: "\(Fmt.num(base)) sayısının %\(p) kaçtır?",
            visual: nil, unit: nil, answer: answer,
            options: buildOptions(&r, answer: answer, errors: errors, integer: answer == answer.rounded()),
            hint: "\(Fmt.num(base)) × \(p) ÷ 100 = \(Fmt.num(answer))",
            signature: "pct:of:\(base):\(p)"
        )

    case .whatPct:
        let p = r.pick(easyP + hardP)
        let base = r.money(50, 800, step: r.pick([20, 25, 50]))
        let part = round2(Double(base * p) / 100)
        let answer = Double(p)
        let errors = [100 - answer, answer / 2, answer * 2, answer + 10, answer - 10,
                      (Double(base) / max(part, 1) * 10).rounded() / 10]
        return RawQuestion(
            category: .pct, expression: nil,
            text: "\(Fmt.num(part)), \(Fmt.num(base)) sayısının yüzde kaçıdır?",
            visual: nil, unit: "%", answer: answer,
            options: buildOptions(&r, answer: answer, errors: errors),
            hint: "\(Fmt.num(part)) ÷ \(Fmt.num(base)) × 100 = %\(Fmt.num(answer))",
            signature: "pct:what:\(part):\(base)"
        )

    case .discount:
        let p = r.pick([10, 15, 20, 25, 30, 40, 50, 60])
        let base = r.money(200, 6000, step: 50)
        let answer = round2(Double(base * (100 - p)) / 100)
        let errors = [round2(Double(base * p) / 100), Double(base - p),
                      round2(Double(base * (100 + p)) / 100), answer + Double(base) * 0.1, answer - Double(base) * 0.1]
        return RawQuestion(
            category: .pct, expression: nil,
            text: "\(Fmt.num(base)) TL'lik ürüne %\(p) indirim yapıldı. Yeni fiyat kaç TL?",
            visual: nil, unit: "TL", answer: answer,
            options: buildOptions(&r, answer: answer, errors: errors, integer: answer == answer.rounded()),
            hint: "\(Fmt.num(base)) − (\(Fmt.num(base)) × \(p) ÷ 100) = \(Fmt.num(answer)) TL",
            signature: "pct:disc:\(base):\(p)"
        )

    case .increase:
        let p = r.pick([5, 10, 15, 20, 25, 30, 40, 50])
        let base = r.money(1000, 60000, step: 250)
        let answer = round2(Double(base * (100 + p)) / 100)
        let errors = [round2(Double(base * p) / 100), round2(Double(base * (100 - p)) / 100),
                      Double(base + p), answer + Double(base) * 0.1]
        return RawQuestion(
            category: .pct, expression: nil,
            text: "\(Fmt.num(base)) TL'ye %\(p) zam yapıldı. Yeni tutar kaç TL?",
            visual: nil, unit: "TL", answer: answer,
            options: buildOptions(&r, answer: answer, errors: errors, integer: answer == answer.rounded()),
            hint: "\(Fmt.num(base)) × \(Double(100 + p) / 100) = \(Fmt.num(answer)) TL",
            signature: "pct:inc:\(base):\(p)"
        )

    case .reverse:
        let p = r.pick([10, 20, 25, 50])
        let answer = Double(r.money(200, 4000, step: 100))
        let sale = round2(answer * Double(100 - p) / 100)
        let errors = [round2(sale * Double(100 + p) / 100), sale + Double(p), round2(sale / 2),
                      answer + 100, answer - 100]
        return RawQuestion(
            category: .pct, expression: nil,
            text: "%\(p) indirimden sonra fiyat \(Fmt.num(sale)) TL oldu. İndirimsiz fiyat kaç TL?",
            visual: nil, unit: "TL", answer: answer,
            options: buildOptions(&r, answer: answer, errors: errors, integer: answer == answer.rounded()),
            hint: "\(Fmt.num(sale)) ÷ \(Double(100 - p) / 100) = \(Fmt.num(answer)) TL",
            signature: "pct:rev:\(sale):\(p)"
        )
    }
}
