/**
 * Test parseFolderId (murni regex, tanpa network) dan walkFolder (dengan
 * fetch di-mock supaya tidak perlu koneksi internet nyata / API key).
 * Jalankan: node test/driveService.test.js
 */
const assert = require('assert');
const Module = require('module');

// --- Mock node-fetch SEBELUM driveService di-require ---
const mockFolderTree = {
  root: [
    { id: 'f1', name: 'index.html', mimeType: 'text/html', modifiedTime: '2026-01-01T00:00:00Z' },
    { id: 'folder-css', name: 'css', mimeType: 'application/vnd.google-apps.folder' },
  ],
  'folder-css': [
    { id: 'f2', name: 'style.css', mimeType: 'text/css', modifiedTime: '2026-01-01T00:00:00Z' },
  ],
};
const mockFileContents = {
  f1: '<html><body>Hello Drive</body></html>',
  f2: 'body{margin:0}',
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'node-fetch') {
    return async function mockFetch(url) {
      if (url.includes('/files?q=')) {
        const idMatch = decodeURIComponent(url).match(/'([^']+)' in parents/);
        const folderId = idMatch[1];
        const files = mockFolderTree[folderId] || [];
        return { ok: true, json: async () => ({ files }) };
      }
      if (url.includes('alt=media')) {
        const idMatch = url.match(/files\/([^?]+)\?/);
        const fileId = idMatch[1];
        return { ok: true, text: async () => mockFileContents[fileId] || '' };
      }
      return { ok: false, status: 404, text: async () => 'not found', statusText: 'Not Found' };
    };
  }
  return originalLoad.apply(this, arguments);
};

process.env.GOOGLE_DRIVE_API_KEY = 'AIzaSyBDNt5j_l2BCaSBii7wNj_YzRyMGx309aU';
const driveService = require('../driveService');

async function run() {
  // 1. parseFolderId - berbagai bentuk link
  assert.strictEqual(
    driveService.parseFolderId('https://drive.google.com/drive/folders/1AbCdEf-123_xyz?usp=sharing'),
    '1AbCdEf-123_xyz'
  );
  assert.strictEqual(
    driveService.parseFolderId('https://drive.google.com/open?id=ZZZ999aaa'),
    'ZZZ999aaa'
  );
  assert.strictEqual(driveService.parseFolderId('1AbCdEf-123_xyz_ini_id_mentah'), '1AbCdEf-123_xyz_ini_id_mentah');
  assert.strictEqual(driveService.parseFolderId('https://example.com/not a drive link'), null);
  console.log('✔ parseFolderId: OK (URL folder, ?id=, raw id, invalid link)');

  // 2. isTextFile
  assert.strictEqual(driveService.isTextFile('index.html'), true);
  assert.strictEqual(driveService.isTextFile('photo.png'), false);
  console.log('✔ isTextFile: OK');

  // 3. walkFolder rekursif (folder + sub-folder)
  const entries = await driveService.walkFolder('root');
  const paths = entries.map((e) => e.path).sort();
  assert.deepStrictEqual(paths, ['css', 'css/style.css', 'index.html']);
  console.log('✔ walkFolder: rekursif sub-folder OK ->', paths.join(', '));

  // 4. importFolder end-to-end (walk + download content)
  const result = await driveService.importFolder('https://drive.google.com/drive/folders/root');
  const idx = result.files.find((f) => f.path === 'index.html');
  const css = result.files.find((f) => f.path === 'css/style.css');
  assert.strictEqual(idx.content, '<html><body>Hello Drive</body></html>');
  assert.strictEqual(css.content, 'body{margin:0}');
  console.log('✔ importFolder: isi file ter-download & ter-mapping dengan benar');

  console.log('\nSEMUA TEST driveService LULUS ✅');
}

run().catch((e) => {
  console.error('❌ TEST GAGAL:', e);
  process.exit(1);
});
