# Street View Guess Game

Google Maps Street View altyapisiyla calisan, clue atlas sistemi bulunan GeoGuessr benzeri Next.js uygulamasi. Oyun login istemez, middleware kullanmaz ve istemcide `Oyna` ile baslar. Clue katalogu Supabase uzerinden okunacak sekilde hazirlanmistir; Supabase bagli degilse local seed fallback devreye girer.

## Ana Ozellikler

- Google Maps JavaScript API ile Street View panorama
- KML dosyasindan turetilmis statik lokasyon havuzu
- Ayarlanabilir round suresi
- Fullscreen oyun akisi
- Buyuyebilen sag mini harita
- sessionStorage ile refresh sonrasi round devami
- Round sonu ulke baglamina gore clue ozeti
- `/clues` altinda arama, filtreleme, kategori ve ulke rehberleri
- Supabase-backed clue katalogu ve seed sync akisi

## Veri Kaynaklari

- KML havuzu: `C:\Users\xmemo\OneDrive\Desktop\equitable-stochastic.2023-06-24.full.kml`
- Clue referans mantigi:
  - Plonk It rehber akisi
  - GeoHints kategori mantigi
  - `fabiencelier/geoguessr-tips` topluluk ipuclari

Bu kaynaklardaki bilgiler birebir kopyalanmaz; uygulama icinde normalize edilmis ve ozgunlestirilmis veri kayitlarina donusturulur.

## Ortam Degiskenleri

`.env.local` icine su degiskenleri gir:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
SUPABASE_SECRET_KEY=your_supabase_secret_key_here
```

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` istemciye aciktir, domain restriction ile kilitlenmelidir.
- `SUPABASE_SECRET_KEY` kesinlikle istemciye acilmamali, sadece server veya seed script tarafinda kullanilmalidir.

## Kurulum

```bash
npm install
```

Gelisim sunucusu:

```bash
npm run dev
```

Lint ve build:

```bash
npm run lint
npm run build
```

## KML Donusumu

```bash
npm run build:kml-points -- "C:\Users\xmemo\OneDrive\Desktop\equitable-stochastic.2023-06-24.full.kml"
```

## Supabase Akisi

CLI iskeleti:

```bash
npx supabase init
```

Remote projeye link:

```bash
npm run db:link:remote
```

Not:
- Bu adim icin `supabase login` veya `SUPABASE_ACCESS_TOKEN` gerekir.

Migration push:

```bash
npm run db:push:remote
```

Seed sync:

```bash
npm run db:seed:clues
```

### Supabase Schema

Migration dosyasi:

- `supabase/migrations/20260404034500_create_clue_catalog.sql`

Olusan tablolar:

- `public.clue_categories`
- `public.country_profiles`
- `public.clues`

Bu tablolar public read RLS politikasi ile anon ve authenticated kullanicilara okunabilir. Yazma islemleri secret key ile seed script tarafindan yapilir.

## Vercel Akisi

Vercel ortam degiskenlerini locale cekmek icin:

```bash
npm run vercel:pull
```

Dashboard tarafinda su degiskenleri eklenmeli:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Not:
- Vercel CLI ile link/env islemleri icin aktif `vercel login` gerekir.

## Mimari

- Oyun state'i istemcide kalir.
- Clue verisi once Supabase'den okunmaya calisilir.
- Supabase baglantisi yoksa local seed kataloguna fallback yapilir.
- Oyun ici round clue paneli country guide verisini `/api/clues/countries/[countryCode]` uzerinden ister.
- `/clues` sayfalari SEO dostu SSG/server render akisi kullanir.

## Onemli Dosyalar

- `src/components/street-guess-game.tsx`
- `src/components/clues/round-clue-insights.tsx`
- `src/components/clues/clue-explorer.tsx`
- `src/lib/clues/seed.ts`
- `src/lib/clues/repository.ts`
- `src/lib/supabase/server.ts`
- `scripts/sync-clues-to-supabase.mts`
- `supabase/migrations/20260404034500_create_clue_catalog.sql`
