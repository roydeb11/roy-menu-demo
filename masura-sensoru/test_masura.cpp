#include "masura_logic.h"
#include <cstdio>
#include <cstdlib>
static int hata=0;
#define KONTROL(k,msg) do{ if(k) printf("GECTI  %s\n",msg); else {printf("KALDI  %s\n",msg); hata++;} }while(0)

int main(){
  srand(42);
  // 1) Dolu masura: yansima 200-450 arasi gurultulu, 5000 ilmek -> alarm OLMAMALI
  { MasuraLogic m(700,20); bool a=false;
    for(int i=0;i<5000;i++) a = m.ilmek(200+rand()%250, true);
    KONTROL(!a, "Dolu masura 5000 ilmek: yanlis alarm yok"); }
  // 2) Tek tuk parlama (iplik kaymasi): her 50 ilmekte 3 ilmek 900 -> alarm OLMAMALI
  { MasuraLogic m(700,20); bool a=false;
    for(int i=0;i<5000;i++) a = m.ilmek((i%50<3)?900:300, true);
    KONTROL(!a, "Kisa parlamalar (3 ilmek) alarm tetiklemiyor"); }
  // 3) Masura bitiyor: 3000 dolu ilmekten sonra gobek acilir (850-1000) -> tam 20. ilmekte alarm
  { MasuraLogic m(700,20); int alarmIlmek=-1;
    for(int i=0;i<4000;i++){ uint16_t v = (i<3000)? 250+rand()%200 : 850+rand()%150;
      if(m.ilmek(v,true) && alarmIlmek<0) alarmIlmek=i; }
    printf("       alarm ilmegi = %d (beklenen 3019)\n", alarmIlmek);
    KONTROL(alarmIlmek==3019, "Gobek acilinca 20 ilmek icinde alarm"); }
  // 4) Makine dururken (dikiyor=false) parlak okuma -> alarm OLMAMALI (masura degisiminde kapak acik)
  { MasuraLogic m(700,20); bool a=false;
    for(int i=0;i<1000;i++) a = m.ilmek(1000,false);
    KONTROL(!a, "Makine dururken ornek alinmiyor"); }
  // 5) Alarm kilitlenir, reset ile cozulur
  { MasuraLogic m(700,20);
    for(int i=0;i<30;i++) m.ilmek(950,true);
    bool kilit = m.ilmek(300,true);
    m.sifirla(); bool sonra = m.ilmek(300,true);
    KONTROL(kilit && !sonra, "Alarm kilitli kalir, RESET ile temizlenir"); }
  printf(hata? "\nSONUC: %d TEST KALDI\n" : "\nSONUC: TUM TESTLER GECTI\n", hata);
  return hata;
}
