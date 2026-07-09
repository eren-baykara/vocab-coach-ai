# Kelimelik AI

> Ezberleme. AI ile kullanmayı öğren.

Türkçe konuşan öğrenciler için AI destekli İngilizce kelime uygulaması. TOEFL, IELTS ve günlük İngilizce için kelime ekler, anlam üretir ve tekrar pratiği sunar.

**Canlı demo (paylaşılacak link):** https://eren-baykara.github.io/vocab-coach-ai/

---

## Neden Kelimelik AI?

- Kelimeyi yaz → anında listeye düşer, AI içerik arka planda hazırlanır
- Yazım hatası varsa sonradan öneri popup’ı gelir
- Set bazlı çalışma: TOEFL, akademik, günlük konuşma
- Anlam, ters quiz, boşluk doldurma ve kart sıralama modları
- Fonetik, TTS dinleme, kişisel not, kelime detay sayfası
- Web + PWA; iOS Safari uyumlu

## Öne çıkan özellikler

| Özellik | Açıklama |
|---------|----------|
| AI kelime kartı | Türkçe anlam, tanım, örnek cümleler, mini ders |
| Akıllı yazım kontrolü | `innovatice` → `innovative` gibi düzeltme önerileri |
| Çalışma setleri | Özel setler + varsayılan **Tüm Kelimeler** |
| Tekrar sistemi | Bugün ekranında due/tekrar sayacı |
| Onboarding | Sınav hedefi, CEFR seviyesi, günlük süre |

## Teknoloji (özet)

Expo · React Native · Supabase · OpenAI Edge Functions · GitHub Pages

Detaylı mimari ve kaynak kod **özel depoda** tutulur; bu README ürün tanıtımı ve sahip notları içindir.

---

## Pazarlama için paylaş

Portfolio, LinkedIn veya CV’de şunları kullan:

- **Demo:** https://eren-baykara.github.io/vocab-coach-ai/
- **Kısa açıklama:** *AI destekli İngilizce kelime uygulaması — kelime ekle, AI anlam üretsin, setlerle çalış, quiz modlarıyla tekrar et.*
- **Repo linki paylaşma** — depo private olduğunda dışarıdan görünmez; sadece demo URL’si yeterli.

Ekran görüntüsü veya kısa video eklemen dönüşümü artırır.

---

## Gizlilik ve koruma

| Ne | Durum |
|----|--------|
| GitHub kaynak kodu | **Private** — klonlanamaz, dosyalar görünmez |
| Canlı uygulama (Pages) | **Public** — demo herkese açık (pazarlama için) |
| OpenAI / service role anahtarları | Sunucuda; repoda yok |
| Kullanıcı verileri | Supabase Auth + RLS |

**Önemli:** Web uygulaması tarayıcıya indirilen JS bundle içerir. Tam kaynak gizli olsa da, deneyimli biri arayüzü inceleyebilir. Asıl korunan kısım: repo, migration’lar, Edge Function’lar ve API secret’ları.

### Repoyu private yapmak uygulamayı bozar mı?

**Hayır.** Private yapınca:

- Canlı site açılmaya devam eder
- GitHub Actions deploy çalışır
- Push sonrası güncelleme yayınlanır
- Kullanıcılar giriş yapıp kelime eklemeye devam eder

Sadece GitHub’daki **kaynak kodu** dışarıdan görünmez olur.

**Manuel adım (sen yapmalısın):**

1. https://github.com/eren-baykara/vocab-coach-ai/settings
2. En altta **Danger Zone → Change repository visibility**
3. **Make private** seç → onayla

---

## Geliştirici notları *(yalnızca repo erişimi olanlar)*

```bash
npm install
npm start        # geliştirme
npm run web      # web
npm run export:web
```

Ortam değişkenleri (`.env`):

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Actions secret’ları: aynı iki değişken + Supabase Edge’de `OPENAI_API_KEY`.

Deploy: `master`/`main` push → `.github/workflows/deploy-pages.yml`

---

## Telif

© Eren Baykara. Tüm hakları saklıdır.

Bu yazılımın kaynak kodu, veritabanı şeması ve AI prompt’ları izinsiz kopyalanamaz, dağıtılamaz veya ticari amaçla kullanılamaz. Canlı demo yalnızca tanıtım ve deneme içindir.
