# Kelimelik AI

AI destekli İngilizce kelime öğrenme uygulaması. Kelimeleri ezberlemek yerine anlam, örnek cümle ve pratik modlarıyla kullanmayı öğretir.

**Canlı demo:** https://eren-baykara.github.io/vocab-coach-ai/

## Özellikler

- **Hızlı kelime ekleme** — Kelime anında kütüphaneye eklenir; AI içerik ve yazım kontrolü arka planda çalışır
- **AI kelime kartları** — Türkçe anlam, tanım, fonetik, TOEFL/günlük örnekler, mini ders, eş/anlamdaşlar
- **Yazım düzeltme** — Yazım hatası şüphesi varsa eklemeden sonra popup ile öneri sunar
- **Çalışma setleri** — TOEFL, akademik veya günlük konuşma gibi odaklı setler; varsayılan **Tüm Kelimeler** görünümü
- **Pratik modları**
  - Anlam quizi
  - Ters quiz (Türkçe → İngilizce)
  - Boşluk doldurma
  - Kart sıralama (çalışma oturumu)
- **Kelime detayı** — Dinle (TTS), kişisel not, set yönetimi, AI içerik yenileme
- **Onboarding** — Sınav hedefi (TOEFL / IELTS / Genel), İngilizce seviyesi, günlük süre
- **PWA + Safari uyumu** — GitHub Pages üzerinde web/PWA; iOS Safari için özel alert ve modal desteği

## Teknoloji

| Katman | Stack |
|--------|--------|
| Uygulama | [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), React Native, Expo Router |
| Backend | [Supabase](https://supabase.com/) — Auth, Postgres, RLS, Edge Functions |
| AI | OpenAI (`generate-word-content`, `suggest-word-correction`) |
| Deploy | GitHub Actions → GitHub Pages |

## Proje yapısı

```
src/
  app/                  # Expo Router ekranları
    (tabs)/             # Bugün, Setler, Kelimeler, Profil
    word/[id].tsx       # Kelime detayı
    review.tsx          # Quiz modları
    card-sort.tsx       # Kart sıralama
    onboarding.tsx      # İlk kurulum
  lib/
    supabase.ts         # Supabase client
    wordActions.ts      # Kelime ekleme / düzeltme
    word-correction-context.tsx
    app-alert.tsx       # Web uyumlu alert/confirm
supabase/
  migrations/           # Veritabanı şeması
  functions/            # Edge Functions (AI)
.github/workflows/      # GitHub Pages deploy
```

## Geliştirme

### Gereksinimler

- Node.js 22+
- npm
- Supabase projesi (Auth + Postgres + Edge Functions)
- OpenAI API anahtarı (Edge Function secrets)

### Kurulum

```bash
git clone https://github.com/eren-baykara/vocab-coach-ai.git
cd vocab-coach-ai
npm install
```

Proje kökünde `.env` oluştur:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### Çalıştırma

```bash
npm start          # Expo dev server
npm run web        # Sadece web
npm run export:web # Statik web export (GitHub Pages ile aynı çıktı)
```

### Supabase

1. Migration'ları uygula:

   ```bash
   supabase db push
   ```

2. Edge function secret'larını ayarla:

   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (opsiyonel, varsayılan: `gpt-5-mini`)

3. Function'ları deploy et:

   ```bash
   supabase functions deploy generate-word-content
   supabase functions deploy suggest-word-correction
   ```

## GitHub Pages deploy

`master` veya `main` branch'e push edildiğinde `.github/workflows/deploy-pages.yml` otomatik çalışır.

Repository **Settings → Secrets and variables → Actions** altında şu secret'lar gerekli:

| Secret | Açıklama |
|--------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key |

**Settings → Pages** bölümünde source olarak **GitHub Actions** seçilmeli; `github-pages` environment'ında deploy branch'i (`master` / `main`) izinli olmalı.

Statik export `baseUrl: /vocab-coach-ai` ile üretilir (`app.json` → `experiments.baseUrl`). Farklı bir path kullanırsan `app.json` içindeki `baseUrl` değerini güncelle.

## Ortam notları

- Uygulama **hesap zorunludur**; misafir modu yoktur.
- AI içerik üretimi arka planda çalışır; kelime listeye hemen düşer.
- Safari iOS PWA'da güncelleme görünmüyorsa hard refresh yap veya ana ekran kısayolunu yeniden ekle.

## Lisans

Bu proje kişisel / eğitim amaçlıdır. Ticari kullanım veya yeniden dağıtım için repo sahibiyle iletişime geçin.
