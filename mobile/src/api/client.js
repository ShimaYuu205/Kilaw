/**
 * client.js
 * ---------
 * PENTING: kalau test di HP fisik pakai Expo Go, "localhost" di HP BUKAN
 * komputer kamu. Ganti BASE_URL ke IP LAN komputer kamu, misal:
 *   http://192.168.1.10:4000/api
 * (jalankan `ipconfig`/`ifconfig` untuk cek IP). Kalau test di web/emulator
 * di komputer yang sama dengan backend, "localhost" sudah cukup.
 */
export const BASE_URL = 'https://b3bb6f80b240a1.lhr.life/api';


async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request gagal (${res.status})`);
  }
  return data;
}

export const api = {
  listProjects: () => request('/projects'),
  createProject: (name, driveFolderLink) =>
    request('/projects', { method: 'POST', body: JSON.stringify({ name, driveFolderLink }) }),
  getProject: (id) => request(`/projects/${id}`),
  getFiles: (projectId) => request(`/projects/${projectId}/files`),
  getPreview: (projectId) => request(`/projects/${projectId}/preview`),
  updateFileContent: (fileId, content) =>
    request(`/files/${fileId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  addFile: (payload) => request('/files', { method: 'POST', body: JSON.stringify(payload) }),
  importFromDrive: (projectId, driveFolderLink) =>
    request(`/projects/${projectId}/import`, {
      method: 'POST',
      body: JSON.stringify({ driveFolderLink }),
    }),
};
