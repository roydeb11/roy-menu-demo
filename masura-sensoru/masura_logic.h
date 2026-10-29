// Masura (bobbin) ipi bitiyor dedektoru - saf mantik, Arduino ve PC'de ayni calisir.
// Prensip: fiber optik yansima sensoru masura gobegine (core) bakar.
//   Iplik VAR  -> isik iplige carpar, yansima dusuk/degisken
//   Iplik AZ   -> parlak gobek (veya gobege yapistirilan reflektor) acilir, yansima YUKSEK
// Sadece makine DIKERKEN ve her ilmekte (igne ust olu nokta sinyali) bir ornek alinir;
// art arda N ornek "gobek gorunuyor" ise alarm verilir (gurultuye/tek seferlik parlamaya dayanikli).
#pragma once
#include <stdint.h>

struct MasuraLogic {
  uint16_t esik;          // ADC esigi (0-1023): bunun ustu = gobek gorunuyor
  uint16_t gerekenArdisik;// alarm icin art arda kac ilmek
  uint16_t sayac = 0;
  bool alarm = false;

  MasuraLogic(uint16_t e, uint16_t n) : esik(e), gerekenArdisik(n) {}

  // Her ilmekte bir kez cagrilir. dikiyor=false iken ornek alinmaz (bobin degisimi, durus).
  bool ilmek(uint16_t adc, bool dikiyor) {
    if (!dikiyor) return alarm;
    if (adc > esik) { if (sayac < 65535) sayac++; } else sayac = 0;
    if (sayac >= gerekenArdisik) alarm = true;
    return alarm;
  }
  // Operator yeni masura takip RESET'e basinca
  void sifirla() { sayac = 0; alarm = false; }
};
