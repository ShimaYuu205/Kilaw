const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/files/:id
router.get('/:id', (req, res) => {
  const file = db.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
  res.json(file);
});

// PUT /api/files/:id  { content }
router.put('/:id', (req, res) => {
  const file = db.getFile(req.params.id);
  if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
  const { content } = req.body;
  const updated = db.updateFileContent(req.params.id, content ?? '');
  db.touchProject(file.projectId); // bump version -> trigger auto-refresh di client lain
  res.json(updated);
});

// POST /api/files  { projectId, path, name, mimeType, content }  (manual add, tanpa Drive)
router.post('/', (req, res) => {
  const { projectId, path, name, mimeType, content } = req.body;
  if (!projectId || !path || !name) {
    return res.status(400).json({ error: 'projectId, path, name wajib diisi' });
  }
  const project = db.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });
  const file = db.upsertFile({ projectId, path, name, mimeType, content });
  db.touchProject(projectId);
  res.status(201).json(file);
});

module.exports = router;
