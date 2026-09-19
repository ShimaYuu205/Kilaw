const express = require('express');
const db = require('../db');
const driveService = require('../driveService');

const router = express.Router();

/**
 * POST /api/projects/:id/import
 * Menggunakan driveFolderLink yang sudah "fixed" tersimpan di project
 * (diisi sekali saat create project, berperan seperti token sumber data).
 * Body opsional: { driveFolderLink } kalau mau ganti/menimpa link yang tersimpan.
 */
router.post('/:id/import', async (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project tidak ditemukan' });

  const link = req.body.driveFolderLink || project.driveFolderLink;
  if (!link) {
    return res.status(400).json({ error: 'Project ini belum punya driveFolderLink.' });
  }

  try {
    const { folderId, files } = await driveService.importFolder(link);

    for (const f of files) {
      db.upsertFile({
        projectId: project.id,
        path: f.path,
        name: f.name,
        mimeType: f.mimeType,
        content: f.content,
        driveFileId: f.driveFileId,
        driveModifiedTime: f.driveModifiedTime,
      });
    }
    // Hapus file lokal yang sudah tidak ada lagi di Drive (folder = source of truth)
    db.deleteFilesNotIn(
      project.id,
      files.map((f) => f.path)
    );

    db.updateProjectDriveInfo(project.id, { driveFolderLink: link, driveFolderId: folderId });
    const updated = db.touchProject(project.id);

    res.json({
      ok: true,
      project: updated,
      importedFiles: files.length,
      files: db.listFiles(project.id),
    });
  } catch (err) {
    const status = err.code === 'NO_API_KEY' ? 500 : 400;
    res.status(status).json({ ok: false, error: err.message });
  }
});

module.exports = router;
