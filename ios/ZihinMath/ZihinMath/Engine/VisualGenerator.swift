//
//  VisualGenerator.swift
//  Zihin
//
//  Görsel odaklı sorular: sayma, alan modeli, çubuk karşılaştırma,
//  pasta yüzdesi, sayı doğrusu ve para toplamı.
//

import Foundation

func genVisual(_ r: inout Rand, level L: Int) -> RawQuestion {
    enum Kind { case dots, grid, bars, pie, numberLine, coins }

    let kinds: [Kind]
    switch L {
    case ...2:  kinds = [.dots, .grid, .bars]
    case 3...5: kinds = [.dots, .grid, .bars, .pie, .numberLine]
    default:    kinds = [.grid, .bars, .pie, .numberLine, .coins]
    }

    switch r.pick(kinds) {

    case .dots:
        let g = r.int(2, L <= 3 ? 4 : 6)
        let per = r.int(2, L <= 3 ? 5 : 9)
        let answer = Double(g * per)
        return RawQuestion(
            category: .visual, expression: nil, text: "Toplam kaç nokta var?",
            visual: .dots(groups: g, per: per), unit: nil, answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                Double(g + per), answer + Double(per), answer - Double(per),
                answer + Double(g), Double(g * (per + 1))]),
            hint: "\(g) grup × \(per) nokta = \(Fmt.num(answer))",
            signature: "v:dots:\(g):\(per)")

    case .grid:
        let rows = r.int(2, L <= 4 ? 6 : 9)
        let cols = r.int(2, L <= 4 ? 6 : 9)
        let answer = Double(rows * cols)
        return RawQuestion(
            category: .visual, expression: nil, text: "Izgaradaki kare sayısı kaçtır?",
            visual: .grid(rows: rows, cols: cols), unit: nil, answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                Double(rows + cols), Double(2 * (rows + cols)), answer + Double(rows),
                answer - Double(cols), Double((rows + 1) * cols)]),
            hint: "\(rows) satır × \(cols) sütun = \(Fmt.num(answer))",
            signature: "v:grid:\(rows):\(cols)")

    case .bars:
        var a = r.int(3, 20)
        var b = r.int(3, 20)
        if a == b { b = a < 20 ? a + 1 : a - 1 }          // eşit çubuk olmaz
        if a < b { swap(&a, &b) }
        let answer = Double(a - b)
        return RawQuestion(
            category: .visual, expression: nil, text: "Uzun çubuk kısa çubuktan kaç birim fazla?",
            visual: .bars(a: a, b: b), unit: nil, answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                Double(a + b), Double(a), Double(b), answer + 1, answer - 1, answer * 2]),
            hint: "\(a) − \(b) = \(Fmt.num(answer))",
            signature: "v:bars:\(a):\(b)")

    case .pie:
        let p = r.pick([10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90])
        let answer = Double(p)
        return RawQuestion(
            category: .visual, expression: nil, text: "Dairenin yüzde kaçı dolu?",
            visual: .pie(percent: p), unit: "%", answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                100 - answer, answer + 10, answer - 10, (answer / 2).rounded(), answer * 2]),
            hint: "Dolu dilim tüm dairenin %\(p)'i kadar.",
            signature: "v:pie:\(p)")

    case .numberLine:
        let step = r.pick([1, 2, 5, 10, 25, 50])
        let start = step * r.int(0, 8)
        let ticks = 10
        let end = start + step * ticks
        let at = r.int(1, ticks - 1)
        let answer = Double(start + step * at)
        return RawQuestion(
            category: .visual, expression: nil, text: "Ok hangi sayıyı gösteriyor?",
            visual: .numberLine(start: Double(start), end: Double(end), ticks: ticks, at: at),
            unit: nil, answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                answer + Double(step), answer - Double(step), Double(start),
                Double(end), answer + Double(step * 2)]),
            hint: "Aralık \(step); başlangıç \(start). \(at) adım sonra \(Fmt.num(answer)).",
            signature: "v:nl:\(start):\(step):\(at)")

    case .coins:
        let denominations = [1, 5, 10, 20, 50, 100, 200]
        var stacks: [VisualSpec.CoinStack] = []
        var total = 0
        for _ in 0..<r.int(2, 4) {
            let d = r.pick(denominations)
            let c = r.int(1, 4)
            stacks.append(.init(value: d, count: c))
            total += d * c
        }
        let answer = Double(total)
        return RawQuestion(
            category: .visual, expression: nil, text: "Görseldeki paraların toplamı kaç TL?",
            visual: .coins(items: stacks), unit: "TL", answer: answer,
            options: buildOptions(&r, answer: answer, errors: [
                answer + 10, answer - 10, answer + 50, answer - 50, answer * 2, (answer / 2).rounded()]),
            hint: stacks.map { "\($0.count)×\($0.value)" }.joined(separator: " + ") + " = \(total) TL",
            signature: "v:coins:" + stacks.map { "\($0.value)x\($0.count)" }.joined(separator: "_"))
    }
}
