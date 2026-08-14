# Laporan Isu: Kegagalan Resolusi Stream Vidhide (IP-Locking)

**Kepada:** Tim Backend / API
**Perihal:** Evaluasi endpoint `/api/resolve-stream` untuk sumber Vidhide
**Status Frontend:** Ekstraksi berhasil, namun diblokir oleh CDN saat *playback* (403 Forbidden).

---

## 1. Ringkasan Masalah

Fitur *Custom Video Player* di sisi *frontend* telah berhasil diintegrasikan dengan endpoint `/api/resolve-stream`. Ketika *frontend* meminta URL stream Vidhide, *backend* sukses memecah *obfuscation* dan mengembalikan URL m3u8 asli dari CDN Vidhide (contoh: `https://...acek-cdn.com/.../master.m3u8?t=...`). 

**Namun, ketika *Native Player* di *frontend* (`hls.js`) mencoba memutar URL tersebut, CDN Vidhide menolak koneksi dengan status `403 Forbidden`.** Akibatnya, *player* gagal memuat video dan terpaksa memanggil *fallback* ke mode `iframe` lawas.

## 2. Analisis Akar Masalah (Root Cause)

Kegagalan ini **bukan** disebabkan oleh *CORS* atau kesalahan *parsing* *User-Agent* (kedua hal ini sudah ditangani oleh *proxy frontend*), melainkan karena sistem perlindungan **IP-Locking** dari infrastruktur Vidhide.

Alur terjadinya *IP-Locking*:
1. **Fase Ekstraksi (Backend):** Server *backend* (misalnya di Vercel) mengeksekusi *unpacker engine* Vidhide dan mendapatkan token sesi `?t=...`. **Token ini dikunci secara permanen oleh sistem Vidhide ke IP Address milik server Vercel.**
2. **Fase Playback (Client):** Server Vercel memberikan URL m3u8 beserta token tersebut ke *browser user*.
3. **Fase Pemblokiran (CDN):** *Browser user* (yang menggunakan IP Indihome/Telkomsel/dll) melakukan *request* ke server CDN Vidhide menggunakan token milik Vercel. CDN membandingkan IP *user* dengan IP token. Karena tidak cocok, CDN memblokirnya (`403 Forbidden`).

> [!WARNING]
> Kondisi ini akan membuat *Native Player* sama sekali tidak bisa digunakan untuk Vidhide di *environment Production*, meskipun saat Anda melakukan *testing* secara lokal (di mana *backend* dan *browser* menggunakan IP Wi-Fi yang sama) pemutaran video terlihat sukses dan lancar.

## 3. Rekomendasi Solusi untuk Tim Backend

Mengingat arsitektur Kuronime yang bertujuan untuk *low-latency* dan efisiensi, tim Backend dapat mempertimbangkan salah satu dari tiga opsi berikut:

### Opsi A: Merubah Vidhide Menjadi "Iframe Only" (Rekomendasi Utama)
Sama halnya dengan perlakuan terhadap **Ondesuhd**, sistem *IP-Locking* sangat sulit dan mahal untuk ditembus pada skala produksi. 
- **Tindakan:** Ubah *logic* di endpoint `/api/resolve-stream` agar me-*return* `null` ketika menerima URL dari Vidhide/Odvidhide.
- **Hasil:** *Frontend* akan secara otomatis me-*render* Vidhide menggunakan `iframe` bawaan (seperti Ondesuhd), menghindari *error* 403, dan memastikan pengguna tetap bisa menonton tanpa kendala.

### Opsi B: Membangun Reverse Proxy Video (Opsi Mahal)
Jika manajemen bersikeras Vidhide harus menggunakan *Native Player* (tanpa `iframe`):
- **Tindakan:** *Backend* tidak lagi mengembalikan URL CDN Vidhide secara langsung. *Backend* harus membangun *streaming proxy endpoint* (misal: `/api/stream-video?url=...`). *Backend*-lah yang akan mengunduh pecahan `.ts` dari Vidhide dan melemparnya (*pipe*) kembali ke *browser user*.
- **Kelemahan:** Mengkonsumsi **Bandwidth Server ber-Tera-Tera byte** per bulan. Sangat tidak disarankan untuk aplikasi gratis.

### Opsi C: Client-Side Extraction (Berisiko)
Mengembalikan fungsi pemecah *obfuscation* (Packer unpacker) murni ke *browser frontend*.
- **Kelemahan:** Sistem keamanan *browser modern* akan sering kali memblokir akses ke `iframe` lintas-domain (*Cross-Origin*), sehingga teknik ekstraksi via DOM *browser* sangat rapuh dan mudah rusak jika Vidhide mengubah sedikit kode keamanan mereka.

---
**Kesimpulan Tim Frontend:**
Sistem *Auto-Fallback* di *frontend* sudah bekerja dengan sempurna mendeteksi kegagalan ini. Kami menunggu keputusan arsitektur lebih lanjut dari tim *Backend* apakah Vidhide akan dianaktirikan sebagai *Iframe Only* atau akan disediakan *video proxy* khusus.
