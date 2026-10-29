// Arduino Nano / Uno - Masura ipi bitiyor dedektoru (bagimsiz calisir, makine elektronigine dokunmaz)
// A0  : fiber optik amplifikatorun analog cikisi (0-5V)  [veya E3Z/fiber amp dijital cikis -> esik 512]
// D2  : igne ust olu nokta (NUD) sinyali - endüktif sensor (makine govdesindeki volan/mil mıknatısı)
// D3  : RESET butonu (GND'ye, dahili pull-up)
// D5  : ikaz lambasi / buzzer (transistor/rolé uzerinden)
// D6  : (opsiyonel) STOP rolesi -> kontrol kutusunun "durdur/pause" girisi, SADECE kilavuzla dogrulandiktan sonra
#include "masura_logic.h"

const uint8_t PIN_SENSOR = A0, PIN_NUD = 2, PIN_RESET = 3, PIN_LAMBA = 5, PIN_STOP = 6;
const unsigned long DIKIS_ZAMAN_ASIMI_MS = 300; // bu sure NUD gelmezse makine durmus sayilir

MasuraLogic logic(700, 20);           // esik=700, art arda 20 ilmek
volatile bool yeniIlmek = false;
unsigned long sonIlmekMs = 0;
uint16_t tepe = 0;                    // ilmek boyunca en yuksek yansima (masura flans pencereleri donerken)

void nudISR() { yeniIlmek = true; }

void setup() {
  pinMode(PIN_NUD, INPUT_PULLUP);
  pinMode(PIN_RESET, INPUT_PULLUP);
  pinMode(PIN_LAMBA, OUTPUT);
  pinMode(PIN_STOP, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_NUD), nudISR, FALLING);
  Serial.begin(115200);
}

void loop() {
  uint16_t okuma = analogRead(PIN_SENSOR);   // surekli oku, tepe degeri tut
  if (okuma > tepe) tepe = okuma;
  if (yeniIlmek) {
    yeniIlmek = false;
    unsigned long simdi = millis();
    bool dikiyor = (simdi - sonIlmekMs) < DIKIS_ZAMAN_ASIMI_MS;
    sonIlmekMs = simdi;
    uint16_t v = tepe; tepe = 0;
    logic.ilmek(v, dikiyor);
    Serial.println(v);               // kalibrasyon: Serial Plotter'da dolu/bos degerleri gorun
  }
  if (digitalRead(PIN_RESET) == LOW) logic.sifirla();
  digitalWrite(PIN_LAMBA, logic.alarm ? HIGH : LOW);
  digitalWrite(PIN_STOP,  logic.alarm ? HIGH : LOW);
}
