# Drive Live Preview — MVP

Aplikasi mobile "live server" untuk HTML/CSS/JS: edit kode di dalam app,
lihat hasilnya langsung di WebView, dan tarik/​sync isi folder dari Google
Drive publik sebagai sumber kolaborasi.

```
drive-live-preview/
├── backend/     Express API + penyimpanan lokal (siap ganti ke MongoDB)
└── mobile/      Expo (React Native) app
```

## 1. Menjalankan Backend

```bash
cd backend
npm install
cp .env.example .env      # lalu isi GOOGLE_DRIVE_API_KEY (lihat bagian 3)
npm start                 # -> Backend jalan di http://localhost:4000
```

Cek cepat:
```bash
curl http://localhost:4000/api/health
```

**Sudah saya jalankan & test langsung di sandbox** (bukan cuma ditulis, tapi
benar-benar dieksekusi) — hasilnya:
- ✅ `POST /api/projects` → buat project baru, tersimpan.
- ✅ `POST /api/files` → tambah file (index.html, style.css, app.js) manual.
- ✅ `GET /api/projects/:id/files` → file tree kembali dengan benar.
- ✅ `GET /api/projects/:id/preview` → HTML+CSS+JS berhasil di-compose jadi satu
  dokumen siap dirender WebView (CSS di-inject ke `<style>`, JS ke `<script>`).
- ✅ `PUT /api/files/:id` → update isi file, dan `project.version` otomatis
  naik (ini mekanisme yang dipakai mobile app untuk auto-refresh preview).
- ✅ Unit test `driveService.js` (parsing link Drive, rekursi sub-folder,
  download isi file) — dites dengan Drive API di-mock (tanpa perlu API key
  atau koneksi internet nyata untuk membuktikan logikanya benar):
  ```bash
  cd backend && npm run test:drive
  ```
  Semua 4 skenario lulus (parseFolderId 4 bentuk link, isTextFile, walkFolder
  rekursif ke sub-folder, importFolder end-to-end).

## 2. Menjalankan Mobile App

```bash
cd mobile
npm install
npx expo start
```

Scan QR dengan **Expo Go** (Android/iOS) — TIDAK perlu dev build karena app
ini sengaja tidak pakai Google OAuth SDK (lihat bagian 3).

⚠️ **Wajib diubah**: buka `mobile/src/api/client.js`, ganti `BASE_URL`:
- Testing di HP fisik via Expo Go → pakai IP LAN komputer kamu, mis.
  `http://192.168.1.10:4000/api` (backend dan HP harus 1 jaringan WiFi).
- Testing via `expo start --web` di komputer yang sama → `localhost` sudah OK.

**Yang sudah divalidasi di sandbox saya:**
- ✅ `npm install` sukses (1160 packages, Expo SDK 51 + React Navigation + WebView).
- ✅ Semua 5 file React Native (App.js + 3 screens + api client) lulus
  parsing Babel (JSX valid, tidak ada syntax error).
- ⚠️ `npx expo export` **tidak bisa saya jalankan sampai selesai** di sandbox
  ini karena perlu akses ke `exp.host`/`api.expo.dev` yang diblokir oleh
  konfigurasi jaringan container saya. Artinya: **jalankan `npx expo start`
  sendiri** di komputer kamu untuk lihat app-nya jalan beneran — bagian ini
  belum ter-run-time-test, baru ter-syntax-check.

## 3. Import dari Google Drive (link folder publik, tanpa OAuth)

Kenapa tanpa OAuth: OAuth Google butuh custom native scheme yang **tidak
jalan di Expo Go**, harus dev build (`expo prebuild` + build native). Supaya
MVP ini bisa langsung dites tanpa dev build, import Drive pakai **API Key**
(bukan OAuth) yang hanya bisa baca folder/file yang di-share publik.

Langkah setup API key:
1. Buka https://console.cloud.google.com/apis/library/drive.googleapis.com,
   aktifkan **Google Drive API**.
2. Buat **API key** di https://console.cloud.google.com/apis/credentials
   (batasi ke Drive API saja untuk keamanan).
3. Isi ke `backend/.env` → `GOOGLE_DRIVE_API_KEY=...`.
4. Share folder Drive kamu: klik kanan → Share → **"Anyone with the link" → Viewer**.
5. Tempel link folder itu di layar "Project Baru" di app, atau lewat API:
   ```bash
   curl -X POST http://localhost:4000/api/projects \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","driveFolderLink":"https://drive.google.com/drive/folders/XXXX"}'
   ```

**Cara kerja "link tersimpan seperti token"**: link folder disimpan di
`project.driveFolderLink` (dan `driveFolderId` hasil parse) sekali saat
project dibuat. Tombol **"⟳ Sync Drive"** di layar editor akan
memanggil ulang `POST /api/projects/:id/import` menggunakan link yang
tersimpan itu — jadi kamu tidak perlu tempel link berulang kali, cukup
tekan sync setiap kali ada perubahan di folder Drive (oleh kamu sendiri
atau kolaborator).

App membaca **rekursif semua sub-folder** (html/css/js/gambar/dll):
file teks (`.html .css .js .json .txt .md .svg`) isinya langsung diambil
dan ditampilkan di editor + preview; file lain (gambar, dsb.) baru dicatat
metadatanya di MVP ini (isi biner belum di-render di WebView).

**Batasan yang jujur perlu disampaikan:**
- Google Docs/Sheets/Slides *native* (bukan file upload biasa) tidak bisa
  diambil isinya lewat cara ini — perlu endpoint *export*, di luar scope MVP.
- Ini BUKAN real-time push. Sinkronisasi dari sisi Drive terjadi saat kamu
  (atau siapa pun yang buka app) menekan tombol Sync — bukan otomatis
  terdeteksi begitu file di Drive berubah.
- Kalau folder tidak di-share publik, Drive API akan menolak walau API key
  benar — errornya sudah ditangani dan ditampilkan jelas di app (bukan crash).

## 4. Cara "kolaborasi" bekerja di MVP ini

Ada **dua arah sinkronisasi**, keduanya lewat backend (bukan P2P):

1. **Edit di dalam app** → `PUT /api/files/:id` → `project.version` naik →
   semua device lain yang membuka project yang sama akan mem-polling
   `GET /api/projects/:id` tiap 3 detik, mendeteksi versi berubah, lalu
   otomatis reload file tree + WebView (`key={remoteVersion}` pada WebView
   memaksa reload). Ini sudah saya test lewat curl (lihat bagian 1) dan
   terbukti `version` naik setiap kali file diupdate.
2. **Edit di Google Drive** (oleh siapa pun yang punya akses folder) →
   user menekan "⟳ Sync Drive" di app → backend re-import isi folder →
   file yang berubah di-update, file yang dihapus di Drive juga dihapus di
   project (folder Drive dianggap *source of truth*) → `version` naik →
   device lain ikut auto-refresh via polling di atas.

Ini **bukan realtime socket-based collaboration** (seperti Google Docs), tapi
sinkronisasi berbasis polling + tombol sync, sesuai yang disepakati di
requirement awal ("Sync via Google Drive/cloud, simpel, refresh otomatis").

## 5. Kalau mau lanjut ke produksi

| Area | MVP sekarang | Upgrade selanjutnya |
|---|---|---|
| Database | lowdb (file JSON lokal) | Ganti isi `backend/db.js` ke Mongoose/MongoDB Atlas — signature fungsi sudah dirancang supaya mudah swap |
| Auth Drive | API key (folder publik saja) | `expo prebuild` + dev build + Google OAuth (`expo-auth-session`) untuk akses folder privat |
| Sync | Polling 3 detik + tombol manual | WebSocket/Socket.IO untuk push realtime, atau Drive Push Notifications (webhook) |
| Editor kode | `TextInput` polos | Syntax highlighting (mis. WebView + CodeMirror/Monaco) |
| File biner | Metadata saja | Simpan sebagai base64/CDN + render `<img>` di preview |

## 6. Ringkasan status testing (jujur, bukan klaim kosong)

| Komponen | Status |
|---|---|
| Backend CRUD project & file | ✅ Dijalankan & di-curl, hasil sesuai ekspektasi |
| Preview compose (HTML+CSS+JS jadi satu dokumen) | ✅ Diverifikasi output-nya lewat curl |
| Auto-refresh versi (bump saat file diedit) | ✅ Diverifikasi, version naik 1→4→5 di test |
| Drive import logic (parsing link, rekursi folder, download isi) | ✅ Unit test lulus (fetch di-mock, tanpa API key asli) |
| Drive import dengan API key & folder Drive ASLI | ⚠️ Belum dites (butuh API key milik kamu + folder publik asli, tidak bisa dari sandbox saya) |
| Mobile app — syntax semua file | ✅ Lulus parsing Babel |
| Mobile app — jalan di Expo Go / emulator sungguhan | ⚠️ Belum bisa dites dari sandbox saya (perlu device/emulator + akses exp.host yang diblokir jaringan sandbox) — **silakan jalankan `npx expo start` sendiri** |
