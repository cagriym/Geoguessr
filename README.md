# Street View Guess Game

GeoGuessr mantiginda calisan, Next.js ile yazilmis bir prototip. Oyun login istemez, middleware kullanmaz ve sadece istemcide `Oyna` tusuna basildiginda baslar. Street View panoramasi Google Maps uzerinden acilir, oyuncu mini haritada tahminini birakir, sistem de gercek konumla tahmin arasindaki mesafeyi hesaplayip puan verir.

## Veri Kaynagi

Kaynak KML dosyasi:

- `C:\Users\xmemo\OneDrive\Desktop\equitable-stochastic.2023-06-24.full.kml`

Bu dosya runtime'da tarayicida parse edilmez. Bunun yerine build-time / one-time donusum ile `public/data/equitable-stochastic-2023-06-24.points.json` havuzuna cevrilir. Boylece ilk oyun baslangicinda istemci sadece hafif JSON dosyasini alir.

KML donusum komutu:

```bash
npm run build:kml-points -- "C:\Users\xmemo\OneDrive\Desktop\equitable-stochastic.2023-06-24.full.kml"
```

Script her 3 placemark'tan birini alip oyun havuzuna yazar. Verilen KML yapisinda bu, tekrarli marker gruplarinin resolve edilmis noktasini kullanir.

## Ozellikler

- Google Maps JavaScript API ile Street View panorama yukleme
- KML kaynagindan turetilmis statik lokasyon havuzu
- `Oyna` tusu ile client-side baslayan akış
- Ayarlanabilir round suresi secimi
- Oyun baslangicinda fullscreen Street View viewport istegi
- Sag mini haritayi buyutme / kucultme
- sessionStorage ile refresh sonrasi round devami
- Harita uzerine tahmin birakma
- Haversine formulu ile mesafe hesaplama
- Raund bazli skor, toplam skor ve ortalama sapma gostergeleri

## Kurulum

1. Bagimliliklari yukle:

```bash
npm install
```

2. Ornek ortam degiskenini kopyala:

```bash
copy .env.example .env.local
```

3. `.env.local` icine Google Maps anahtarini yaz:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
```

4. Google Cloud tarafinda su servis acik olmali:

- Maps JavaScript API

5. Gelistirme sunucusunu baslat:

```bash
npm run dev
```

6. Tarayicida `http://localhost:3000` adresini ac.

## Mimari Notlar

- Oyun artik otomatik baslamaz; `Oyna` veya varsa `Devam et` ile baslatilir.
- Round suresi idle ekrandan secilir ve aktif session icinde korunur.
- Middleware yoktur.
- Aktif oyun snapshot'i sessionStorage'a yazilir; bu sayede refresh sonrasinda ayni round geri yuklenebilir.
- Fullscreen istegi kullanici tiklamasiyla tetiklenir; tarayici izin vermezse oyun normal modda devam eder.
- Lokasyon havuzu tek bir `fetch(..., { cache: "force-cache" })` ile kullanilir ve ayni oturumda memory promise ile tekrar yuklenmez.
