# Panduan Integrasi API Streaming: Update Server Pixeldrain (`pdrain`) & Penanganan Mirror

**Kepada:** Tim Frontend  
**Dari:** Tim Backend / API  
**Perihal:** Dokumentasi Update API Streaming, Penambahan Server `pdrain` untuk Custom Player, dan Strategi Fallback Mirror  
**Status:** Ready to Use in Production  

---

## 1. Ringkasan Update Terbaru

Untuk mengatasi masalah pada mirror streaming sebelumnya:
1. **Filedon (Downtime 522):** Server origin `filedon.co` sedang mengalami *downtime* total dari penyedia sumbernya (Cloudflare 522 Connection Timed Out).
2. **Vidhide (IP-Locking 403):** CDN Vidhide mengunci token HLS ke IP server backend, sehingga jika dipaksa ke *Custom Player* akan menghasilkan `403 Forbidden`. Vidhide harus diputar menggunakan **Iframe bawaan**.
3. **Ondesuhd (Google Video IP-Locking & CSP):** Video dikunci ke IP server Desustream dan memiliki CSP `frame-ancestors` yang memblokir akses iframe langsung.

### 🌟 Solusi Baru: Penambahan Server `pdrain` (Pixeldrain)
Backend telah mengintegrasikan mirror **Pdrain (Pixeldrain)** ke dalam sistem streaming:
- ✅ **Full CORS:** Server Pixeldrain menyediakan header `Access-Control-Allow-Origin: *`.
- ✅ **Direct MP4:** Format video murni `.mp4` (tidak butuh library HLS.js, native di tag `<video>`).
- ✅ **Support Scrubbing/Seeking:** Mendukung `Accept-Ranges: bytes` (bisa forward/rewind instan tanpa buffering ulang).
- ✅ **Bebas IP-Locking:** Siapa pun dan IP provider mana pun (Indihome, Telkomsel, XL, dll.) bisa memutar video secara mulus di **Custom Player**.

---

## 2. Perubahan pada Response API

### A. Endpoint Detail Episode: `GET /api/episode/:slug`
Array `streaming_mirrors` pada setiap resolusi kini otomatis menyertakan server `pdrain` (jika tersedia dari sumbernya):

```json
{
  "status": "success",
  "data": {
    "title": "Re:Zero kara Hajimeru Isekai Seikatsu Episode 7 Subtitle Indonesia",
    "streaming_mirrors": [
      {
        "quality": "720p",
        "sources": [
          { "name": "ondesuhd", "url": "https://desustream.net/..." },
          { "name": "filedon", "url": "https://filedon.co/embed/X6QNwTstkn" },
          { "name": "vidhide", "url": "https://odvidhide.com/embed/0656m0xiob61" },
          { "name": "mega", "url": "https://mega.nz/embed/..." },
          { "name": "pdrain", "url": "https://link.desustream.com/?id=d2JkL0hDRWxReWo4YUlhaDBYdk5ab1pJbEpWWVBKWmZTSEVuMkh5MnBvTG0=" }
        ]
      }
    ]
  }
}
```

> **Tindakan Tim Frontend:**
> Tombol server `pdrain` akan otomatis muncul jika Anda me-render tombol berdasarkan array `sources`.

---

### B. Endpoint Resolusi Stream: `GET /api/resolve-stream?url={mirrorUrl}`
Kirimkan URL dari server `pdrain` atau mirror lainnya ke endpoint ini.

#### 1. Jika URL berupa `pdrain` (atau `odstream`):
Endpoint mengembalikan direct video URL mentah:
```json
{
  "status": "success",
  "data": {
    "url": "https://pixeldrain.com/api/file/d9iWDUAH",
    "type": "mp4",
    "mirror": "pdrain"
  }
}
```
👉 **Pasang langsung `data.url` ke tag `<video src="...">` pada Custom Player Anda!**

#### 2. Jika URL berupa mirror yang tidak mendukung Custom Player (`vidhide`, `ondesuhd`, `mega`):
Endpoint mengembalikan `data: null`:
```json
{
  "status": "success",
  "data": null
}
```
👉 **Frontend mendeteksi `data === null` dan langsung mengaktifkan mode `iframe` bawaan.**

---

## 3. Matriks Rekomendasi Pemutaran Tiap Server

| Nama Server | Tipe Player Frontend | Endpoint Resolver | Keterangan |
|---|---|---|---|
| **`pdrain`** | **Custom Player (`<video>`)** | `/api/resolve-stream` | **Paling Direkomendasikan.** Sangat kencang, stabil, direct MP4. |
| **`odstream`** | **Custom Player (`<video>`)** | `/api/resolve-stream` | Direct MP4 via Archive.org. |
| **`filedon`** | **Custom Player (`<video>`)** | `/api/resolve-stream` | Direct MP4 via Cloudflare R2 (saat server origin Filedon pulih). |
| **`vidhide`** | **Iframe Player (`<iframe>`)** | Fallback ke embed | Gunakan embed bawaan `iframe src={source.url}`. Lancar tanpa iklan popup backend. |
| **`mega`** | **Iframe Player (`<iframe>`)** | Fallback ke embed | Gunakan embed bawaan `iframe src={source.url}`. |
| **`ondesuhd`** | **Iframe via Proxy / Fallback** | `/api/proxy-stream` | Memerlukan proxy backend karena CSP Desustream. |

---

## 4. Rekomendasi Kode Implementasi Frontend (React / Next.js)

Berikut adalah contoh fungsi pemutar di sisi Frontend yang cerdas, efisien, dan otomatis memilih server terbaik:

```tsx
import React, { useState, useEffect } from 'react';

interface StreamSource {
  name: string;
  url: string;
}

export function VideoPlayerArea({ sources }: { sources: StreamSource[] }) {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // 1. Prioritaskan server Custom Player secara otomatis saat episode dibuka:
  //    Urutan prioritas: pdrain -> odstream -> filedon -> vidhide -> lainnya
  useEffect(() => {
    if (!sources || sources.length === 0) return;

    const priority = ['pdrain', 'odstream', 'filedon', 'vidhide', 'mega', 'ondesuhd'];
    const bestSource = [...sources].sort((a, b) => {
      const idxA = priority.indexOf(a.name.toLowerCase());
      const idxB = priority.indexOf(b.name.toLowerCase());
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    })[0];

    handleSelectServer(bestSource);
  }, [sources]);

  // 2. Fungsi penanganan klik server
  async function handleSelectServer(source: StreamSource) {
    setSelectedServer(source.name);
    setLoading(true);
    setVideoUrl(null);

    try {
      // Panggil resolver backend
      const res = await fetch(`/api/resolve-stream?url=${encodeURIComponent(source.url)}`);
      const json = await res.json();

      if (json.status === 'success' && json.data?.url) {
        // SUKSES: Gunakan Custom Player
        setVideoUrl(json.data.url);
        setIsIframe(false);
      } else {
        // FALLBACK: Gunakan Iframe bawaan
        setIsIframe(true);
        // Khusus ondesuhd/desustream yang memblokir CSP, lewatkan ke proxy backend
        if (source.name.toLowerCase().includes('ondesu')) {
          setIframeSrc(`/api/proxy-stream?url=${encodeURIComponent(source.url)}`);
        } else {
          setIframeSrc(source.url);
        }
      }
    } catch (err) {
      console.error('Gagal resolve stream, fallback ke iframe:', err);
      setIsIframe(true);
      setIframeSrc(source.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="player-container">
      {/* AREA VIDEO */}
      <div className="video-viewport">
        {loading && <div className="spinner">Memuat video...</div>}

        {!loading && !isIframe && videoUrl && (
          <video
            controls
            autoPlay
            playsInline
            src={videoUrl}
            className="w-full h-full custom-player"
          />
        )}

        {!loading && isIframe && (
          <iframe
            src={iframeSrc}
            allowFullScreen
            allow="autoplay; encrypted-media"
            className="w-full h-full border-0"
          />
        )}
      </div>

      {/* TOMBOL PEMILIHAN SERVER */}
      <div className="server-buttons flex gap-2 mt-4">
        {sources.map((s) => (
          <button
            key={s.name}
            onClick={() => handleSelectServer(s)}
            className={`px-4 py-2 rounded font-semibold transition ${
              selectedServer === s.name ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Ringkasan Kunci untuk Tim Frontend

1. **Jadikan `pdrain` sebagai default server** jika tersedia pada daftar sources, karena:
   - Langsung memutar video di **Custom Player**.
   - Tidak ada error *403 Forbidden* atau *Refuse to connect*.
   - Loading instan dan pengguna dapat melakukan scrubbing timeline dengan lancar.
2. Mekanisme **Auto-Fallback** yang sudah ada di frontend tetap dipertahankan untuk server Iframe (`vidhide`, `mega`, `ondesuhd`).
