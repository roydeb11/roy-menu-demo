#include "masura_logic.h"
#include <cstdio>
#include <cstdlib>
// Masura her ilmekte rastgele aci doner; 6 pencere, her biri 360'in %25'i acik.
// Pencere ACIK + iplik var -> 250-450 ; pencere ACIK + gobek gorunuyor -> 850-1000 ; pencere KAPALI (flans) -> 400-600
int main(){ srand(7); int hata=0;
  for(int senaryo=0;senaryo<2;senaryo++){
    MasuraLogic m(700,20); int alarmIlmek=-1;
    for(int i=0;i<6000;i++){
      bool bos = (senaryo==1 && i>=4000);
      uint16_t tepe=0;
      for(int k=0;k<20;k++){ bool pencere = (rand()%100)<25;
        uint16_t v = !pencere ? 400+rand()%200 : (bos ? 850+rand()%150 : 250+rand()%200);
        if(v>tepe) tepe=v; }
      if(m.ilmek(tepe,true) && alarmIlmek<0) alarmIlmek=i;
    }
    if(senaryo==0){ printf("%s  Dolu masura, donen flans pencereleri, 6000 ilmek: alarm %s\n", alarmIlmek<0?"GECTI":"KALDI", alarmIlmek<0?"yok":"VAR"); if(alarmIlmek>=0) hata++; }
    else { bool ok = alarmIlmek>=4000 && alarmIlmek<4040; printf("%s  Gobek 4000. ilmekte acildi -> alarm %d. ilmekte\n", ok?"GECTI":"KALDI", alarmIlmek); if(!ok) hata++; }
  }
  printf(hata?"SONUC: KALDI\n":"SONUC: TUM TESTLER GECTI\n"); return hata; }
