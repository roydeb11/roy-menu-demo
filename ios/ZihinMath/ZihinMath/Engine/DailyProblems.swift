//
//  DailyProblems.swift
//  Zihin
//
//  Günlük hayat problemleri — 32 şablon, her biri rastgele sayılarla
//  doldurulur; aynı şablon her seferinde farklı bir soru üretir.
//

import Foundation

private let items: [(name: String, unit: String)] = [
    ("ekmek", "adet"), ("süt", "litre"), ("yumurta", "adet"), ("peynir", "paket"),
    ("kalem", "adet"), ("defter", "adet"), ("kitap", "adet"), ("tişört", "adet"),
    ("çay", "paket"), ("kahve", "paket"), ("elma", "kilo"), ("domates", "kilo"),
    ("pil", "adet"), ("havlu", "adet"), ("bardak", "adet"), ("sabun", "adet"),
]

private let names = ["Ayşe", "Mehmet", "Zeynep", "Can", "Elif", "Deniz", "Kerem", "Selin",
                     "Burak", "Merve", "Emre", "Ece", "Roy", "Nil", "Umut", "Derya"]

private let cities = ["Ankara", "İzmir", "Bursa", "Antalya", "Konya", "Adana", "Trabzon", "Eskişehir"]

/// Bir şablonun ürettiği ham veri.
private struct DailyDraft {
    var text: String
    var answer: Double
    var unit: String?
    var errors: [Double]
    var hint: String
    var signature: String
}

/// 32 şablon. Her biri `(inout Rand) -> DailyDraft?` — nil dönerse yeniden denenir.
private let templates: [(inout Rand) -> DailyDraft?] = [

    // 1 — market toplamı
    { r in
        let item = r.pick(items); let n = r.int(3, 12); let p = r.money(15, 180, step: 5)
        let answer = Double(n * p)
        return DailyDraft(
            text: "Markette \(n) \(item.unit) \(item.name) tanesi \(Fmt.num(p)) TL'den alındı. Toplam kaç TL ödenir?",
            answer: answer, unit: "TL",
            errors: [Double(n + p), answer + Double(p), answer - Double(p), answer * 10, Double((n - 1) * p)],
            hint: "\(n) × \(Fmt.num(p)) = \(Fmt.num(answer)) TL", signature: "d1:\(n):\(p):\(item.name)")
    },

    // 2 — hesabı bölüşmek
    { r in
        let n = r.pick([2, 3, 4, 5, 6, 8]); let per = r.money(60, 400, step: 5); let total = n * per
        return DailyDraft(
            text: "\(n) arkadaş \(Fmt.num(total)) TL'lik hesabı eşit olarak bölüşüyor. Kişi başı kaç TL düşer?",
            answer: Double(per), unit: "TL",
            errors: [Double(total - n), Double(per * 2), Double(per / 2), Double(per + 10), Double(total / (n + 1))],
            hint: "\(Fmt.num(total)) ÷ \(n) = \(Fmt.num(per)) TL", signature: "d2:\(total):\(n)")
    },

    // 3 — bahşiş
    { r in
        let t = r.pick([5, 10, 15, 20]); let bill = r.money(200, 2000, step: 50)
        let answer = round2(Double(bill * (100 + t)) / 100)
        return DailyDraft(
            text: "Restoran hesabı \(Fmt.num(bill)) TL. %\(t) bahşiş bırakırsan toplam kaç TL ödersin?",
            answer: answer, unit: "TL",
            errors: [round2(Double(bill * t) / 100), Double(bill + t), round2(Double(bill * (100 - t)) / 100), answer + 50],
            hint: "\(Fmt.num(bill)) + (\(Fmt.num(bill)) × %\(t)) = \(Fmt.num(answer)) TL", signature: "d3:\(bill):\(t)")
    },

    // 4 — KDV
    { r in
        let kdv = r.pick([1, 10, 20]); let net = r.money(100, 5000, step: 50)
        let answer = round2(Double(net * (100 + kdv)) / 100)
        return DailyDraft(
            text: "KDV hariç fiyatı \(Fmt.num(net)) TL olan ürüne %\(kdv) KDV eklenirse ödenecek tutar kaç TL?",
            answer: answer, unit: "TL",
            errors: [round2(Double(net * kdv) / 100), Double(net + kdv), round2(Double(net * (100 - kdv)) / 100), answer + 100],
            hint: "\(Fmt.num(net)) × \(Double(100 + kdv) / 100) = \(Fmt.num(answer)) TL", signature: "d4:\(net):\(kdv)")
    },

    // 5 — taksit
    { r in
        let n = r.pick([3, 4, 6, 9, 12]); let per = r.money(150, 2500, step: 50); let total = n * per
        return DailyDraft(
            text: "\(Fmt.num(total)) TL'lik telefon \(n) eşit taksite bölünüyor. Aylık taksit kaç TL?",
            answer: Double(per), unit: "TL",
            errors: [Double(total - n), Double(per + 100), Double(per * 2), Double(total / (n + 1)), Double(per - 50)],
            hint: "\(Fmt.num(total)) ÷ \(n) = \(Fmt.num(per)) TL", signature: "d5:\(total):\(n)")
    },

    // 6 — yakıt tüketimi
    { r in
        let per100 = r.pick([5, 6, 7, 8, 9, 10, 12]); let km = r.pick([100, 200, 300, 400, 500, 600, 800])
        let answer = round2(Double(per100 * km) / 100)
        return DailyDraft(
            text: "Bir otomobil 100 km'de \(per100) litre yakıyor. \(km) km yolda kaç litre yakar?",
            answer: answer, unit: "litre",
            errors: [Double(per100 * km), round2(Double(km) / Double(per100)), answer + Double(per100), answer * 10, answer / 2],
            hint: "\(per100) × \(km) ÷ 100 = \(Fmt.num(answer)) litre", signature: "d6:\(per100):\(km)")
    },

    // 7 — hız / yol / zaman
    { r in
        let v = r.pick([60, 70, 80, 90, 100, 110, 120]); let t = r.pick([2, 3, 4, 5, 6])
        let answer = Double(v * t)
        return DailyDraft(
            text: "Saatte \(v) km hızla giden araç \(t) saatte kaç km yol alır?",
            answer: answer, unit: "km",
            errors: [Double(v + t), Double(v / t), answer + Double(v), answer - Double(v), answer / 2],
            hint: "\(v) × \(t) = \(Fmt.num(answer)) km", signature: "d7:\(v):\(t)")
    },

    // 8 — maaş zammı
    { r in
        let z = r.pick([10, 15, 20, 25, 30, 40, 50]); let s = r.money(18000, 90000, step: 500)
        let answer = round2(Double(s * (100 + z)) / 100)
        return DailyDraft(
            text: "\(Fmt.num(s)) TL maaşa %\(z) zam yapıldı. Yeni maaş kaç TL?",
            answer: answer, unit: "TL",
            errors: [round2(Double(s * z) / 100), Double(s + z * 100), round2(Double(s * (100 - z)) / 100), answer + 1000],
            hint: "\(Fmt.num(s)) × \(Double(100 + z) / 100) = \(Fmt.num(answer)) TL", signature: "d8:\(s):\(z)")
    },

    // 9 — sınav yüzdesi
    { r in
        let total = r.pick([20, 25, 40, 50, 80, 100]); let pct = r.pick([40, 50, 60, 70, 75, 80, 90])
        let correct = Int((Double(total * pct) / 100).rounded())
        return DailyDraft(
            text: "\(r.pick(names)) \(total) soruluk sınavda \(correct) soruyu doğru yaptı. Başarı yüzdesi kaçtır?",
            answer: Double(pct), unit: "%",
            errors: [Double(100 - pct), Double(correct), Double(total - correct), Double(pct + 10), Double(pct - 10)],
            hint: "\(correct) ÷ \(total) × 100 = %\(pct)", signature: "d9:\(total):\(correct)")
    },

    // 10 — tarif ölçeklendirme
    { r in
        let gramPer4 = r.pick([200, 300, 400, 500, 600, 800]); let m = r.pick([2, 6, 8, 10, 12])
        let answer = Double(gramPer4 * m / 4)
        return DailyDraft(
            text: "4 kişilik tarifte \(Fmt.num(gramPer4)) gram un var. Aynı tarif \(m) kişi için kaç gram un ister?",
            answer: answer, unit: "gram",
            errors: [Double(gramPer4 + m), Double(gramPer4 * m), Double(gramPer4 * m / 8), Double(gramPer4)],
            hint: "(\(gramPer4) ÷ 4) × \(m) = \(Fmt.num(answer)) gram", signature: "d10:\(gramPer4):\(m)")
    },

    // 11 — indirim kuponu
    { r in
        let cart = r.money(300, 2500, step: 50); let coupon = r.pick([50, 75, 100, 150, 200, 250])
        let answer = Double(cart - coupon)
        return DailyDraft(
            text: "\(Fmt.num(cart)) TL'lik alışverişte \(Fmt.num(coupon)) TL'lik indirim kuponu kullanıldı. Ödenecek tutar kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(cart + coupon), Double(coupon), round2(Double(cart) * 0.9), answer - 50, answer + 100],
            hint: "\(Fmt.num(cart)) − \(Fmt.num(coupon)) = \(Fmt.num(answer)) TL", signature: "d11:\(cart):\(coupon)")
    },

    // 12 — saatlik ücret
    { r in
        let h = r.int(4, 40); let rate = r.money(80, 450, step: 10)
        let answer = Double(h * rate)
        return DailyDraft(
            text: "Saatlik ücreti \(Fmt.num(rate)) TL olan bir işte \(h) saat çalışıldı. Toplam kazanç kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(h + rate), answer + Double(rate), answer - Double(rate), answer * 10, (answer / 2).rounded()],
            hint: "\(h) × \(Fmt.num(rate)) = \(Fmt.num(answer)) TL", signature: "d12:\(h):\(rate)")
    },

    // 13 — benzin
    { r in
        let lt = r.pick([10, 15, 20, 25, 30, 40, 50]); let price = r.pick([42, 44, 46, 48, 50, 52])
        let answer = Double(lt * price)
        return DailyDraft(
            text: "Litresi \(Fmt.num(price)) TL olan benzinden \(lt) litre alındı. Kaç TL ödenir?",
            answer: answer, unit: "TL",
            errors: [Double(lt + price), answer + Double(price), (answer / 2).rounded(), answer * 10, answer - Double(price)],
            hint: "\(lt) × \(Fmt.num(price)) = \(Fmt.num(answer)) TL", signature: "d13:\(lt):\(price)")
    },

    // 14 — sınıf mevcudu yüzdesi
    { r in
        let n = r.pick([20, 25, 30, 40, 50, 60]); let p = r.pick([20, 25, 30, 40, 50, 60, 70])
        let answer = (Double(n * p) / 100).rounded()
        return DailyDraft(
            text: "\(n) kişilik sınıfın %\(p)'i kız öğrenci. Sınıfta kaç kız öğrenci var?",
            answer: answer, unit: "kişi",
            errors: [Double(n) - answer, Double(p), Double(n + p), answer * 2, (answer / 2).rounded()],
            hint: "\(n) × \(p) ÷ 100 = \(Fmt.num(answer)) kişi", signature: "d14:\(n):\(p)")
    },

    // 15 — kalan yüzde
    { r in
        let total = r.pick([40, 50, 60, 80, 100, 200]); let usedPct = r.pick([15, 20, 25, 30, 40, 60, 75])
        let used = Int((Double(total * usedPct) / 100).rounded())
        let answer = Double(100 - usedPct)
        return DailyDraft(
            text: "\(total) litrelik depodan \(used) litre kullanıldı. Deponun yüzde kaçı doludur?",
            answer: answer, unit: "%",
            errors: [Double(usedPct), Double(total - used), Double(used), answer + 10, answer - 10],
            hint: "(\(total) − \(used)) ÷ \(total) × 100 = %\(Fmt.num(answer))", signature: "d15:\(total):\(used)")
    },

    // 16 — iki kalemli alışveriş
    { r in
        let i1 = r.pick(items); let i2 = r.pick(items)
        let n1 = r.int(2, 9); let p1 = r.money(10, 120, step: 5)
        let n2 = r.int(2, 9); let p2 = r.money(10, 120, step: 5)
        let answer = Double(n1 * p1 + n2 * p2)
        return DailyDraft(
            text: "\(n1) \(i1.name) (tanesi \(Fmt.num(p1)) TL) ve \(n2) \(i2.name) (tanesi \(Fmt.num(p2)) TL) alındı. Toplam kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(n1 * p1), Double(n2 * p2), answer - Double(p1), answer + Double(p2), Double((n1 + n2) * (p1 + p2))],
            hint: "(\(n1)×\(Fmt.num(p1))) + (\(n2)×\(Fmt.num(p2))) = \(Fmt.num(answer)) TL",
            signature: "d16:\(n1):\(p1):\(n2):\(p2)")
    },

    // 17 — kaç gün sürer
    { r in
        let perDay = r.pick([10, 12, 15, 20, 24, 25, 30]); let days = r.int(4, 20)
        let pages = perDay * days
        return DailyDraft(
            text: "\(Fmt.num(pages)) sayfalık kitabı günde \(perDay) sayfa okuyan biri kaç günde bitirir?",
            answer: Double(days), unit: "gün",
            errors: [Double(days + 1), Double(days - 1), Double(perDay), Double(pages - perDay), Double(days * 2)],
            hint: "\(Fmt.num(pages)) ÷ \(perDay) = \(days) gün", signature: "d17:\(pages):\(perDay)")
    },

    // 18 — artış yüzdesi (fatura)
    { r in
        let a = r.money(400, 2000, step: 100); let p = r.pick([10, 20, 25, 50, 75, 100])
        let b = round2(Double(a * (100 + p)) / 100)
        return DailyDraft(
            text: "Elektrik faturası geçen ay \(Fmt.num(a)) TL, bu ay \(Fmt.num(b)) TL. Artış yüzde kaçtır?",
            answer: Double(p), unit: "%",
            errors: [Double(100 - p), b - Double(a), Double(p + 10), Double(p / 2), Double(p * 2)],
            hint: "(\(Fmt.num(b)) − \(Fmt.num(a))) ÷ \(Fmt.num(a)) × 100 = %\(p)", signature: "d18:\(a):\(b)")
    },

    // 19 — metrekare maliyet
    { r in
        let m2 = r.int(8, 120); let price = r.money(150, 1200, step: 50)
        let answer = Double(m2 * price)
        return DailyDraft(
            text: "\(m2) m² odanın zemini m² başına \(Fmt.num(price)) TL'ye kaplanacak. Toplam maliyet kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(m2 + price), answer + Double(price), (answer / 2).rounded(), answer * 10, answer - Double(price)],
            hint: "\(m2) × \(Fmt.num(price)) = \(Fmt.num(answer)) TL", signature: "d19:\(m2):\(price)")
    },

    // 20 — kumaştan kaç parça
    { r in
        let per = r.pick([2, 3, 4, 5]); let count = r.int(4, 25); let total = per * count
        return DailyDraft(
            text: "\(total) metre kumaştan, her biri \(per) metre olan kaç elbise dikilir?",
            answer: Double(count), unit: "adet",
            errors: [Double(count + 1), Double(count - 1), Double(total - per), Double(per), Double(count * 2)],
            hint: "\(total) ÷ \(per) = \(count) adet", signature: "d20:\(total):\(per)")
    },

    // 21 — basit faiz
    { r in
        let p = r.money(10000, 200000, step: 5000); let rate = r.pick([10, 15, 20, 25, 30, 40, 50])
        let answer = round2(Double(p * (100 + rate)) / 100)
        return DailyDraft(
            text: "Bankaya yatırılan \(Fmt.num(p)) TL, yıllık %\(rate) basit faizle 1 yıl sonra kaç TL olur?",
            answer: answer, unit: "TL",
            errors: [round2(Double(p * rate) / 100), Double(p + rate), round2(Double(p * (100 - rate)) / 100), answer + 5000],
            hint: "\(Fmt.num(p)) + (\(Fmt.num(p)) × %\(rate)) = \(Fmt.num(answer)) TL", signature: "d21:\(p):\(rate)")
    },

    // 22 — gidiş dönüş bilet
    { r in
        let n = r.int(2, 7); let price = r.money(150, 900, step: 25)
        let answer = Double(n * price * 2)
        return DailyDraft(
            text: "\(r.pick(cities)) otobüs bileti \(Fmt.num(price)) TL. \(n) kişi gidiş-dönüş için toplam kaç TL öder?",
            answer: answer, unit: "TL",
            errors: [Double(n * price), answer + Double(price), answer / 2, Double(n + price), answer - Double(price)],
            hint: "\(n) × \(Fmt.num(price)) × 2 = \(Fmt.num(answer)) TL", signature: "d22:\(n):\(price)")
    },

    // 23 — su şişesi litreye
    { r in
        let ml = r.pick([250, 330, 500, 750, 1000]); let n = r.pick([4, 6, 8, 10, 12, 20, 24])
        let answer = round2(Double(ml * n) / 1000)
        return DailyDraft(
            text: "\(ml) ml'lik \(n) şişe suyun toplamı kaç litredir?",
            answer: answer, unit: "litre",
            errors: [Double(ml * n), round2(answer * 10), round2(answer / 10), answer + 1, answer - 1],
            hint: "\(ml) × \(n) = \(Fmt.num(ml * n)) ml = \(Fmt.num(answer)) litre", signature: "d23:\(ml):\(n)")
    },

    // 24 — kâr yüzdesi
    { r in
        let cost = r.money(200, 3000, step: 100); let p = r.pick([10, 20, 25, 50, 100])
        let sell = round2(Double(cost * (100 + p)) / 100)
        return DailyDraft(
            text: "\(Fmt.num(cost)) TL'ye alınan ürün \(Fmt.num(sell)) TL'ye satıldı. Kâr yüzdesi kaçtır?",
            answer: Double(p), unit: "%",
            errors: [sell - Double(cost), Double(100 - p), Double(p + 10), Double(p * 2), Double(p / 2)],
            hint: "(\(Fmt.num(sell)) − \(Fmt.num(cost))) ÷ \(Fmt.num(cost)) × 100 = %\(p)", signature: "d24:\(cost):\(sell)")
    },

    // 25 — peşinat
    { r in
        let price = r.money(5000, 60000, step: 500); let p = r.pick([10, 20, 25, 30, 40, 50])
        let answer = round2(Double(price * p) / 100)
        return DailyDraft(
            text: "\(Fmt.num(price)) TL'lik ürün için %\(p) peşinat isteniyor. Peşinat kaç TL?",
            answer: answer, unit: "TL",
            errors: [round2(Double(price) - answer), Double(price + p), round2(answer * 2), round2(answer / 2)],
            hint: "\(Fmt.num(price)) × \(p) ÷ 100 = \(Fmt.num(answer)) TL", signature: "d25:\(price):\(p)")
    },

    // 26 — kalan dilim yüzdesi
    { r in
        let slices = r.pick([4, 5, 8, 10, 20]); let eatenPct = r.pick([20, 25, 40, 50, 60, 75])
        let eaten = Int((Double(slices * eatenPct) / 100).rounded())
        let answer = Double(100 - eatenPct)
        return DailyDraft(
            text: "\(slices) dilimlik pizzanın \(eaten) dilimi yendi. Yüzde kaçı kaldı?",
            answer: answer, unit: "%",
            errors: [Double(eatenPct), Double(slices - eaten), Double(eaten), answer + 10, answer - 10],
            hint: "(\(slices) − \(eaten)) ÷ \(slices) × 100 = %\(Fmt.num(answer))", signature: "d26:\(slices):\(eaten)")
    },

    // 27 — koşu temposu
    { r in
        let pace = r.pick([4, 5, 6, 7, 8]); let km = r.pick([3, 5, 8, 10, 12, 15, 21])
        let answer = Double(pace * km)
        return DailyDraft(
            text: "Km'yi \(pace) dakikada koşan biri \(km) km'yi kaç dakikada tamamlar?",
            answer: answer, unit: "dakika",
            errors: [Double(pace + km), Double(km / pace), answer + Double(pace), answer - Double(pace), answer * 2],
            hint: "\(pace) × \(km) = \(Fmt.num(answer)) dakika", signature: "d27:\(pace):\(km)")
    },

    // 28 — kira zammı sonrası yıllık
    { r in
        let rent = r.money(8000, 40000, step: 500); let z = r.pick([10, 20, 25])
        let newRent = round2(Double(rent * (100 + z)) / 100)
        let answer = round2(newRent * 12)
        return DailyDraft(
            text: "\(Fmt.num(rent)) TL kiraya %\(z) zam yapıldı. Zamlı kira ile 12 aylık toplam kaç TL?",
            answer: answer, unit: "TL",
            errors: [round2(Double(rent) * 12), newRent, round2(answer / 2), round2(answer + newRent)],
            hint: "\(Fmt.num(rent)) × \(Double(100 + z) / 100) = \(Fmt.num(newRent)); × 12 = \(Fmt.num(answer)) TL",
            signature: "d28:\(rent):\(z)")
    },

    // 29 — para üstü
    { r in
        let paid = r.pick([100, 200, 500, 1000])
        let spent = r.money(30, paid - 20, step: 5)
        let answer = Double(paid - spent)
        return DailyDraft(
            text: "\(Fmt.num(spent)) TL'lik alışveriş için \(Fmt.num(paid)) TL verildi. Para üstü kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(spent), Double(paid + spent), answer + 10, answer - 10, (answer / 2).rounded()],
            hint: "\(Fmt.num(paid)) − \(Fmt.num(spent)) = \(Fmt.num(answer)) TL", signature: "d29:\(paid):\(spent)")
    },

    // 30 — sağlam yüzdesi
    { r in
        let total = r.pick([20, 25, 50, 100, 200]); let brokenPct = r.pick([4, 5, 10, 20, 25])
        let broken = Int((Double(total * brokenPct) / 100).rounded())
        let answer = Double(total - broken)
        return DailyDraft(
            text: "\(total) yumurtanın \(broken) tanesi kırık. Kaç tanesi sağlamdır?",
            answer: answer, unit: "adet",
            errors: [Double(broken), Double(total), Double(100 - brokenPct), answer - 1, answer + 1],
            hint: "\(total) − \(broken) = \(Fmt.num(answer)) adet", signature: "d30:\(total):\(broken)")
    },

    // 31 — ortalama
    { r in
        let n = r.pick([3, 4, 5]); let avg = r.int(40, 95)
        var vals: [Int] = []; var sum = 0
        for _ in 0..<(n - 1) {
            let v = clampInt(avg + r.int(-15, 15), 10, 100)
            vals.append(v); sum += v
        }
        let last = avg * n - sum
        guard last >= 0 && last <= 100 else { return nil }
        vals.append(last)
        return DailyDraft(
            text: "Notları \(vals.map { Fmt.num($0) }.joined(separator: ", ")) olan öğrencinin not ortalaması kaçtır?",
            answer: Double(avg), unit: nil,
            errors: [Double(sum), Double(sum / (n + 1)), Double(avg + 5), Double(avg - 5), Double(vals.max() ?? avg)],
            hint: "(\(vals.map(String.init).joined(separator: " + "))) ÷ \(n) = \(avg)",
            signature: "d31:\(vals.map(String.init).joined(separator: "-"))")
    },

    // 32 — kampanya
    { r in
        let unit = r.money(20, 200, step: 5); let n = r.pick([3, 4, 6])
        let answer = Double((n - 1) * unit)
        return DailyDraft(
            text: "Tanesi \(Fmt.num(unit)) TL olan üründe \"\(n) al \(n - 1) öde\" kampanyası var. \(n) adet kaç TL?",
            answer: answer, unit: "TL",
            errors: [Double(n * unit), Double(unit), answer + Double(unit), answer - Double(unit), (answer / 2).rounded()],
            hint: "\(n - 1) × \(Fmt.num(unit)) = \(Fmt.num(answer)) TL", signature: "d32:\(unit):\(n)")
    },
]

/// Toplam şablon sayısı — testlerde kapsama doğrulaması için.
let dailyTemplateCount = templates.count

func genDaily(_ r: inout Rand, level: Int) -> RawQuestion {
    for _ in 0..<8 {
        let idx = r.int(0, templates.count - 1)
        guard let d = templates[idx](&r) else { continue }
        return RawQuestion(
            category: .daily, expression: nil, text: d.text, visual: nil, unit: d.unit,
            answer: d.answer,
            options: buildOptions(&r, answer: d.answer, errors: d.errors,
                                  integer: d.answer == d.answer.rounded()),
            hint: d.hint, signature: d.signature)
    }
    return genPct(&r, level: level)
}
