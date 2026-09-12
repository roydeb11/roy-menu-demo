//
//  ZihinMathApp.swift
//  Zihin — zihinden matematik antrenmanı
//
//  Tasarım: Apple Human Interface Guidelines + Liquid Glass.
//  Palet üç tondan ibarettir: siyah, beyaz, systemBlue.
//

import SwiftUI

@main
struct ZihinMathApp: App {
    @State private var store = GameStore()

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environment(store)
                .tint(Palette.blue)
        }
    }
}
