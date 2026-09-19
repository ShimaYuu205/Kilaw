/**
 * db.js
 * -----
 * MVP menggunakan lowdb (file JSON lokal) supaya bisa langsung dites tanpa
 * perlu setup MongoDB Atlas. Semua akses data dilewatkan lewat fungsi-fungsi
 * di bawah ini, jadi kalau nanti mau pindah ke MongoDB (Mongoose), cukup
 * ganti isi file ini saja tanpa mengubah routes/*.js.
 *
 * Struktur data:
 * projects: [{ id, name, driveFolderLink, driveFolderId, version, updatedAt, createdAt }]
 * files:    [{ id, projectId, path, name, mimeType, content, driveFileId,
 *              driveModifiedTime, updatedAt }]
 */
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const adapter = new FileSync(path.join(__dirname, 'data', 'db.json'));
const db = low(adapter);

db.defaults({ projects: [], files: [] }).write();

// ---------- Projects ----------
function createProject({ name, driveFolderLink = null, driveFolderId = null }) {
  const now = new Date().toISOString();
  const project = {
    id: uuidv4(),
    name,
    driveFolderLink,
    driveFolderId,
    version: 1,
    updatedAt: now,
    createdAt: now,
  };
  db.get('projects').push(project).write();
  return project;
}

function listProjects() {
  return db.get('projects').orderBy('createdAt', 'desc').value();
}

function getProject(id) {
  return db.get('projects').find({ id }).value();
}

function touchProject(id) {
  const now = new Date().toISOString();
  db.get('projects')
    .find({ id })
    .assign({ updatedAt: now })
    .update('version', (v) => (v || 0) + 1)
    .write();
  return getProject(id);
}

function updateProjectDriveInfo(id, { driveFolderLink, driveFolderId }) {
  db.get('projects').find({ id }).assign({ driveFolderLink, driveFolderId }).write();
  return getProject(id);
}

// ---------- Files ----------
function listFiles(projectId) {
  return db.get('files').filter({ projectId }).sortBy('path').value();
}

function getFile(id) {
  return db.get('files').find({ id }).value();
}

function findFileByPath(projectId, filePath) {
  return db.get('files').find({ projectId, path: filePath }).value();
}

function upsertFile({ projectId, path: filePath, name, mimeType, content, driveFileId, driveModifiedTime }) {
  const now = new Date().toISOString();
  const existing = findFileByPath(projectId, filePath);
  if (existing) {
    db.get('files')
      .find({ id: existing.id })
      .assign({ content, mimeType, driveFileId, driveModifiedTime, updatedAt: now })
      .write();
    return getFile(existing.id);
  }
  const file = {
    id: uuidv4(),
    projectId,
    path: filePath,
    name,
    mimeType,
    content: content || '',
    driveFileId: driveFileId || null,
    driveModifiedTime: driveModifiedTime || null,
    updatedAt: now,
  };
  db.get('files').push(file).write();
  return file;
}

function updateFileContent(id, content) {
  const now = new Date().toISOString();
  db.get('files').find({ id }).assign({ content, updatedAt: now }).write();
  return getFile(id);
}

function deleteFilesNotIn(projectId, keepPaths) {
  db.get('files')
    .remove((f) => f.projectId === projectId && !keepPaths.includes(f.path))
    .write();
}

module.exports = {
  createProject,
  listProjects,
  getProject,
  touchProject,
  updateProjectDriveInfo,
  listFiles,
  getFile,
  findFileByPath,
  upsertFile,
  updateFileContent,
  deleteFilesNotIn,
};
