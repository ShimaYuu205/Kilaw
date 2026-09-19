const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/projects
router.get('/', (req, res) => {
  res.json(db.listProjects());
});

// POST /api/projects  { name, driveFolderLink? }
router.post('/', (req, res) => {
  const { name, driveFolderLink } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name wajib diisi' });
  }
  const driveFolderId = driveFolderLink
    ? require('../driveService').parseFolderId(driveFolderLink)
    : null;
  const project = db.createProject({ name: name.trim(), driveFolderLink, driveFolderId });
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
  res.json(project);
});

// GET /api/projects/:id/files
router.get('/:id/files', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
  res.json({ project, files: db.listFiles(req.params.id) });
});

// GET /api/projects/:id/preview  -> compose html+css+js jadi satu dokumen utk WebView
router.get('/:id/preview', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
  const files = db.listFiles(req.params.id);
  const html = composePreviewHtml(files);
  res.json({ version: project.version, updatedAt: project.updatedAt, html });
});

function composePreviewHtml(files) {
  const indexFile =
    files.find((f) => f.path.toLowerCase() === 'index.html') ||
    files.find((f) => f.name.toLowerCase().endsWith('.html'));

  if (!indexFile) {
    return `<html><body style="font-family:sans-serif;padding:24px;color:#888">
      <h3>Belum ada index.html</h3>
      <p>Tambahkan file index.html di project ini untuk melihat preview.</p>
    </body></html>`;
  }

  let html = indexFile.content;

  // Inject semua file .css sebagai <style> (pengganti <link> lokal, supaya
  // WebView tidak perlu resolve path file lokal satu per satu)
  const cssFiles = files.filter((f) => f.name.toLowerCase().endsWith('.css'));
  const styleTag = cssFiles.map((f) => `<style>/* ${f.path} */\n${f.content}</style>`).join('\n');

  // Inject semua file .js sebagai <script> di akhir body
  const jsFiles = files.filter((f) => f.name.toLowerCase().endsWith('.js'));
  const scriptTag = jsFiles
    .map((f) => `<script>/* ${f.path} */\n${f.content}\n</script>`)
    .join('\n');

  if (html.includes('</head>')) {
    html = html.replace('</head>', `${styleTag}\n</head>`);
  } else {
    html = styleTag + html;
  }
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${scriptTag}\n</body>`);
  } else {
    html = html + scriptTag;
  }
  return html;
}

module.exports = router;
module.exports.composePreviewHtml = composePreviewHtml;
