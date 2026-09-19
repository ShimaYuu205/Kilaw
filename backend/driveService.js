/**
 * driveService.js
 * ---------------
 * Import folder Google Drive PUBLIK (sharing: "Anyone with the link - Viewer")
 * TANPA OAuth. Cukup pakai Google API Key (Drive API v3), jadi bisa dipanggil
 * dari mana saja termasuk dari app Expo Go tanpa perlu dev build.
 *
 * Alur:
 *  1. parseFolderId(link)  -> ambil folderId dari berbagai bentuk URL Drive.
 *  2. listChildren(folderId) -> panggil files.list untuk 1 level folder.
 *  3. walkFolder(folderId)   -> rekursif ke semua sub-folder, hasilkan flat
 *     list file dengan path relatif (mis. "assets/css/style.css").
 *  4. downloadTextFile(fileId) -> ambil isi file (alt=media) untuk file teks
 *     (html/css/js/json/txt). File biner (gambar dll) di-skip isinya di MVP
 *     ini (cukup dicatat metadatanya) supaya tidak membengkak di DB lokal.
 *
 * CATATAN PENTING (batasan yang harus disampaikan ke user):
 *  - Folder & isinya harus di-share "Anyone with the link" (minimal Viewer),
 *    kalau tidak, Drive API akan menolak akses walau pakai API key.
 *  - Google Docs/Sheets/Slides asli (bukan file upload biasa) TIDAK bisa
 *    diambil dengan alt=media, harus export ke format lain (di luar scope MVP).
 *  - Ini BUKAN realtime push dari Drive; sinkronisasi dilakukan dengan cara
 *    "re-import" (polling), lihat routes/importDrive.js.
 */
const fetch = require('node-fetch');

const TEXT_EXTENSIONS = ['.html', '.htm', '.css', '.js', '.json', '.txt', '.md', '.svg'];
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function getApiKey() {
  const key = process.env.GOOGLE_DRIVE_API_KEY;
  if (!key) {
    const err = new Error(
      'GOOGLE_DRIVE_API_KEY belum diset di .env. Buat API key di Google Cloud Console ' +
        '(aktifkan "Google Drive API"), lalu isi di backend/.env'
    );
    err.code = 'NO_API_KEY';
    throw err;
  }
  return key;
}

/** Terima berbagai bentuk link folder Drive dan kembalikan folderId-nya. */
function parseFolderId(link) {
  if (!link) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/, // https://drive.google.com/drive/folders/<id>
    /open\?id=([a-zA-Z0-9_-]+)/, // https://drive.google.com/open?id=<id>
    /[?&]id=([a-zA-Z0-9_-]+)/, // ...?id=<id>
  ];
  for (const re of patterns) {
    const m = link.match(re);
    if (m) return m[1];
  }
  // Kalau user langsung paste ID mentah (bukan URL)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(link.trim())) return link.trim();
  return null;
}

function isTextFile(name) {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function driveFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(
      `Drive API error ${res.status}: ${body || res.statusText}. ` +
        `Pastikan folder di-share "Anyone with the link".`
    );
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function listChildren(folderId) {
  const apiKey = getApiKey();
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,size)');
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${apiKey}&pageSize=1000`;
  const data = await driveFetch(url);
  return data.files || [];
}

async function downloadTextFile(fileId) {
  const apiKey = getApiKey();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
  );
  if (!res.ok) {
    throw new Error(`Gagal download file ${fileId}: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * Rekursif menelusuri folder, hasilkan flat array:
 * { path, name, mimeType, driveFileId, driveModifiedTime, isFolder }
 */
async function walkFolder(folderId, basePath = '') {
  const children = await listChildren(folderId);
  let result = [];
  for (const child of children) {
    const relPath = basePath ? `${basePath}/${child.name}` : child.name;
    if (child.mimeType === FOLDER_MIME) {
      result.push({ path: relPath, name: child.name, mimeType: child.mimeType, isFolder: true });
      const nested = await walkFolder(child.id, relPath);
      result = result.concat(nested);
    } else {
      result.push({
        path: relPath,
        name: child.name,
        mimeType: child.mimeType,
        driveFileId: child.id,
        driveModifiedTime: child.modifiedTime,
        isFolder: false,
      });
    }
  }
  return result;
}

/**
 * Import penuh: walk folder + download isi file teks.
 * Mengembalikan array file siap disimpan ke DB (lihat db.upsertFile).
 */
async function importFolder(folderLink) {
  const folderId = parseFolderId(folderLink);
  if (!folderId) {
    throw new Error('Link folder Google Drive tidak valid/dikenali.');
  }
  const entries = await walkFolder(folderId);
  const files = entries.filter((e) => !e.isFolder);

  const withContent = [];
  for (const f of files) {
    let content = '';
    if (isTextFile(f.name)) {
      try {
        content = await downloadTextFile(f.driveFileId);
      } catch (e) {
        content = `/* Gagal mengambil isi file: ${e.message} */`;
      }
    } else {
      content = ''; // file biner: metadata saja untuk MVP
    }
    withContent.push({ ...f, content });
  }
  return { folderId, files: withContent };
}

module.exports = {
  parseFolderId,
  isTextFile,
  listChildren,
  downloadTextFile,
  walkFolder,
  importFolder,
};
