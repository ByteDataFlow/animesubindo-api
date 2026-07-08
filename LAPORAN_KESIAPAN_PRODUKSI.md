# 🚀 Laporan Verifikasi & Arsitektur: Kesiapan Produksi, Skalabilitas Tinggi, & Zero-Maintenance

**Proyek:** Anime Sub Indo API (Hono + TypeScript + Bun/Node + Vercel)  
**Tanggal:** 8 Juli 2026  
**Status Saat Ini:** Stabil, 100% Lulus Automated Unit Test (20/20 Cases), MAL Enrichment Akurasi Tinggi & Caching Terintegrasi.

---

## 📊 1. Ringkasan Eksekutif (Executive Summary)

API saat ini telah dibangun di atas fondasi yang sangat modern dan cepat (Hono, Zod, Cheerio, NodeCache, TypeScript). Fitur enrichment dari MyAnimeList (MAL) juga telah dilengkapi dengan *concurrency limiter* (maksimal 3 request serentak) dan *in-memory cache* (TTL 1 jam) untuk melindungi sistem dari *rate-limit*.

Namun, karena API ini beroperasi sebagai **Layer Agregasi & Scraping Pihak Ketiga** (Otakudesu & MyAnimeList), tantangan terbesar dalam lingkungan produksi nyata adalah:
1. **Sifat Stateless & Ephemeral dari Serverless (Vercel/Edge)** yang menyebabkan cache in-memory hilang saat *cold-start*.
2. **Perubahan Struktur DOM/HTML** dari web sumber yang dapat menyebabkan scraper patah sewaktu-waktu.
3. **Proteksi Anti-Bot (Cloudflare / WAF)** dari web sumber saat menerima lonjakan trafik.

Laporan ini menguraikan **4 Pilar Verifikasi & Peningkatan Arsitektur** agar API mencapai status **Production-Ready, High-Scalability, dan Maintenance-Less (Bebas Perawatan)**.

---

## 🏗️ 2. Arsitektur Produksi Ideal (Scalable & Maintenance-Less)

Untuk mendukung jutaan request tanpa membebani server sumber dan tanpa campur tangan manual, arsitektur perlu ditingkatkan dari *Local In-Memory Cache* ke **Distributed Cache & Circuit Breaker Pattern**:

```mermaid
graph TD
    Client["Klien / Apps / Web"] -->|HTTP GET| Cloudflare["Cloudflare CDN / WAF\n(Edge Caching & DDoS Protection)"]
    Cloudflare -->|Cache Miss| Gateway["Vercel Serverless / Hono Edge"]
    
    subgroup Gateway Layer
        Gateway -->|1. Check| RateLimit["Rate Limiter & CORS"]
        RateLimit -->|2. Validate| Zod["Zod Schema Validator"]
        Zod -->|3. Route| Controller["Controller Layer"]
    end

    Controller -->|4. Get Data| CacheLayer["Distributed Cache Layer\n(Upstash Redis / Vercel KV)"]
    
    CacheLayer -->|Hit (0ms Latency)| Controller
    CacheLayer -->|Miss / Stale| CircuitBreaker["Circuit Breaker & Concurrency Limiter"]
    
    CircuitBreaker -->|Fetch Scraping| ScraperEngine["Scraper Engine (Cheerio + Resilient DOM)"]
    CircuitBreaker -->|Source Down / 504| FallbackData["Emergency Cache / Stale Data"]
    
    ScraperEngine -->|Scrape| Upstream1["Otakudesu.blog"]
    ScraperEngine -->|Enrichment| Upstream2["MyAnimeList / Jikan"]
    
    ScraperEngine -->|Save TTL 1 Jam| CacheLayer
    Controller -->|JSON Response| Client

    subgroup Automated Maintenance & Observability
        Cron["GitHub Actions Cron / Vercel Cron\n(Daily Health & DOM Check)"] -->|E2E Test| Gateway
        Cron -->|DOM Changed / Fail| Alert["Telegram Bot / Discord Alert / Sentry"]
    end
```

---

## 🔍 3. Empat Pilar Verifikasi & Solusi Teknis

### Pilar 1: Ketahanan Scraping & Zero-Maintenance (Scraping Resilience)
Kelemahan utama scraper adalah ketergantungan pada selektor CSS/DOM. Jika admin Otakudesu mengganti nama kelas CSS, scraper tradisional akan mati.
* **Verifikasi yang Harus Dilakukan:**
  1. **Simulasi Perubahan DOM**: Menguji apa yang terjadi jika elemen `<div class="venz">` atau `strong` berubah atau hilang. API harus mengembalikan *error structured* yang jelas atau data *stale*, bukan *Unhandled Runtime Exception*.
  2. **Automated DOM Health-Check (Cron Job)**:
     * **Solusi Maintenance-Less:** Buat GitHub Actions Workflow atau Vercel Cron Job yang berjalan **setiap 12 jam atau 24 jam**.
     * Script ini menjalankan pengujian E2E (`scrapeHome`, `scrapeDetail`, `scrapeEpisode`) langsung ke server target.
     * Jika terjadi kegagalan scraping (karena DOM berubah), sistem otomatis mengirimkan notifikasi darurat via **Telegram Webhook / Discord Webhook / Email** kepada developer *sebelum* pengguna aplikasi menyadari kerusakan.
* **Tindakan Pencegahan:**
  * Gunakan **Multiple Fallback Selectors** pada Cheerio (misalnya: `$el.find('.hoverinfo_trigger').attr('href') || $el.find('a[href*="myanimelist.net/anime"]').attr('href')`).
  * Rotasi **User-Agent & Headers modern** secara acak untuk mencegah blokir WAF Cloudflare.

---

### Pilar 2: Skalabilitas Tinggi & Distributed Caching (High Scalability)
* **Masalah pada Serverless Saat Ini:**  
  `NodeCache` menyimpan data di memori RAM instance Node.js lokal. Di Vercel, ketika trafik tinggi, Vercel menyala-matikan puluhan *serverless instance* (cold start). Setiap instance baru memiliki RAM kosong (cache kosong), sehingga request pertama di tiap instance akan tetap memukul (scrape) Otakudesu & MAL secara bersamaan.
* **Verifikasi & Solusi yang Harus Dilakukan:**
  1. **Migrasi ke Distributed Cache (Upstash Redis / Vercel KV / Cloudflare KV)**:
     * Mengganti atau memadukan `NodeCache` dengan **Redis Serverless (Upstash)**.
     * Ketika satu instance berhasil men-scrape MAL/Otakudesu dan menyimpannya di Redis dengan TTL 3600 detik (1 jam), seluruh instance Vercel di seluruh dunia akan langsung membaca dari Redis.
     * **Hasil:** Latensi turun drastis ke **5–15 ms**, dan beban request ke MAL/Otakudesu berkurang hingga **99%**.
  2. **Strategi Stale-While-Revalidate (SWR)**:
     * Terapkan header HTTP: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
     * Jika cache berumur 1 jam 5 menit (kedaluwarsa), CDN/Vercel tetap memberikan data cache lama secara **instan (0 ms)** kepada user, sementara di *background* sistem melakukan scrape ulang untuk memperbarui cache. User tidak pernah mengalami *loading delay*.

---

### Pilar 3: Keandalan & Keamanan Produksi (Reliability & Security Hardening)
* **Verifikasi yang Harus Dilakukan:**
  1. **Load & Stress Testing (Menggunakan k6 atau Artillery)**:
     * Lakukan simulasi **500 - 2,000 Request Per Second (RPS)** secara konstan selama 5 menit ke endpoint `/api/home` dan `/api/anime/{slug}`.
     * **Indikator Sukses:** API tidak mengalami *Memory Leak*, CPU tetap stabil, dan Rate Limiter berhasil memblokir trafik berlebih dengan status `429 Too Many Requests`.
  2. **Verifikasi Circuit Breaker**:
     * Jika Otakudesu atau MyAnimeList sedang *down* (mengembalikan HTTP 500/502/504), API tidak boleh gantung (hang) atau membiarkan koneksi terbuka hingga *gateway timeout* Vercel (10 detik).
     * **Solusi:** Gunakan pola **Circuit Breaker**. Jika terjadi 3 kali error beruntun ke MAL, hentikan sementara request ke MAL selama 5 menit dan kembalikan response anime dengan `mal: null` agar endpoint utama tetap secepat kilat.
  3. **Hardening CORS & Rate Limiter**:
     * Pastikan konfigurasi CORS di `src/index.ts` hanya mengizinkan domain frontend resmi Anda di lingkungan produksi (menghindari pencurian kuota API oleh pihak ketiga).

---

### Pilar 4: Observabilitas & Automated Monitoring (Zero-Touch Monitoring)
Agar benar-benar *maintenance-less*, Anda tidak boleh membuang waktu memeriksa log server secara manual setiap hari.
* **Verifikasi & Solusi yang Harus Dilakukan:**
  1. **Integrasi Error Tracking Real-time (Sentry / GlitchTip)**:
     * Pasang middleware Sentry di Hono. Setiap kali terjadi error scraping, network timeout, atau perubahan DOM, log error beserta *stack trace* dan sampel HTML akan langsung dikirim ke dasbor Sentry.
  2. **Uptime & SLA Monitoring (UptimeRobot / Better Stack)**:
     * Pasang monitor gratis yang melakukan *ping* ke `/api/home` setiap 3 menit. Jika response time melebihi 2000 ms atau status bukan 200 OK, peringatan langsung dikirim ke ponsel Anda.

---

## 📋 4. Matriks & Checklist Prioritas Implementasi (Siap Produksi)

Berikut adalah daftar centang (checklist) verifikasi yang direkomendasikan sebelum atau sesudah meluncurkan API ke publik:

| Prioritas | Kategori | Tugas / Verifikasi | Parameter Sukses | Status Saat Ini |
| :---: | :--- | :--- | :--- | :---: |
| **P0 (Critical)** | **Testing** | Automated Unit & Integration Tests | Semua test lulus di bawah 1 detik | ✅ **LULUS (20/20)** |
| **P0 (Critical)** | **Scraping** | Perbaikan Akurasi MAL Enrichment | Singkatan ("Nigetsuri", "Hyakkano") akurat | ✅ **SELESAI (100%)** |
| **P0 (Critical)** | **Security** | Timeout Protection & Concurrency Limit | Max 3 request serentak, timeout 8 detik | ✅ **SELESAI** |
| **P1 (High)** | **Scalability** | Migrasi Cache ke Redis (Upstash / Vercel KV) | Cache bertahan antar *cold-start* serverless | 🔲 *Rekomendasi* |
| **P1 (High)** | **Performance** | Load Testing dengan k6 (1,000 RPS) | Latensi p95 < 50 ms, 0 error unhandled | 🔲 *Rekomendasi* |
| **P1 (High)** | **Maintenance** | Automated Daily DOM Check via GitHub Actions | Cron mendeteksi kerusakan DOM otomatis | 🔲 *Rekomendasi* |
| **P2 (Medium)** | **Resilience** | Implementasi Circuit Breaker untuk MAL/Otakudesu | API tetap jalan meski sumber eksternal down | 🔲 *Opsional* |
| **P2 (Medium)** | **Monitoring** | Integrasi Sentry Error Tracking | Error realtime masuk ke dasbor & Telegram | 🔲 *Opsional* |
| **P2 (Medium)** | **Performance** | Header SWR (`stale-while-revalidate`) | Latensi konstan 0 ms dari Edge CDN | 🔲 *Opsional* |

---

## 🛠️ 5. Contoh Rancangan "Automated Daily Health-Check" (GitHub Actions)

Untuk mewujudkan **Zero-Maintenance**, berikut adalah contoh konfigurasi GitHub Actions (`.github/workflows/health-check.yml`) yang dapat Anda gunakan untuk mengecek kesehatan scraping setiap hari secara otomatis:

```yaml
name: 🛡️ Automated API & DOM Health Check

on:
  schedule:
    # Berjalan setiap hari pada jam 00:00 UTC (07:00 WIB)
    - cron: '0 0 * * *'
  workflow_dispatch: # Bisa dijalankan manual via tombol di GitHub

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: 📥 Checkout Repository
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js / Bun
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: 📦 Install Dependencies
        run: npm ci

      - name: 🧪 Run E2E Scraping Tests
        run: npx vitest run tests/scrapers/otakudesu.test.ts
        env:
          NODE_ENV: production
          ENABLE_MAL_ENRICHMENT: true

      - name: 🚨 Notify Telegram on Failure (If DOM Changed or Broken)
        if: failure()
        run: |
          curl -s -X POST https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage \
            -d chat_id=${{ secrets.TELEGRAM_CHAT_ID }} \
            -d text="🚨 [EMERGENCY ALERT] Anime API Scraper Gagal! Kemungkinan struktur DOM Otakudesu atau MAL telah berubah. Segera periksa log GitHub Actions!"
```

---

## 💡 Kesimpulan & Langkah Selanjutnya
API Anda saat ini sudah **Sangat Siap (Production-Ready)** untuk skala kecil hingga menengah (ribuan pengguna aktif harian) dengan performa yang sangat cepat dan akurasi metadata MAL yang presisi.

Jika Anda berencana untuk mengaktifkan API ini untuk skala besar (ratusan ribu hingga jutaan request), langkah paling berdampak dengan *effort* terendah adalah:
1. **Memasang Redis (Upstash/Vercel KV)** untuk distributed caching.
2. **Menambahkan GitHub Actions Cron Job** di atas agar Anda tidak perlu memantau atau mengecek API secara manual (*maintenance-less*).

*Laporan ini disimpan di dalam repositori sebagai rujukan arsitektur pengembangan jangka panjang.*
