import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { api } from '../api/client';

export default function ImportScreen({ navigation }) {
  const [name, setName] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Nama project wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      // 1. Buat project. Link Drive disimpan "fixed" di project (seperti token
      //    sumber data) supaya bisa di-refresh/import ulang kapan saja.
      const project = await api.createProject(name.trim(), driveLink.trim() || null);

      // 2. Kalau ada link Drive, langsung coba import isinya sekarang.
      if (driveLink.trim()) {
        setStatus('Mengambil isi folder dari Google Drive...');
        try {
          await api.importFromDrive(project.id, driveLink.trim());
          setStatus('Import berhasil!');
        } catch (e) {
          // Project tetap dibuat walau import gagal (mis. API key belum diset,
          // atau folder belum public) -> user bisa retry lewat tombol Sync di Editor.
          setStatus(`Project dibuat, tapi import Drive gagal: ${e.message}`);
        }
      }
      navigation.replace('Editor', { projectId: project.id, projectName: project.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Nama Project</Text>
      <TextInput
        style={styles.input}
        placeholder="mis. Landing Page Klien A"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Link Folder Google Drive (opsional)</Text>
      <TextInput
        style={styles.input}
        placeholder="https://drive.google.com/drive/folders/xxxxxxxx"
        autoCapitalize="none"
        autoCorrect={false}
        value={driveLink}
        onChangeText={setDriveLink}
      />
      <Text style={styles.hint}>
        • Folder harus di-share "Anyone with the link (Viewer)".{'\n'}
        • Boleh berisi sub-folder (html/css/js akan dibaca rekursif).{'\n'}
        • Link ini disimpan permanen di project sebagai sumber sinkronisasi —
        kamu bisa tekan "Sync dari Drive" di halaman editor kapan saja untuk
        menarik perubahan terbaru (mis. teman kamu edit file di Drive).{'\n'}
        • Kosongkan kalau mau mulai dari project kosong (edit manual di app).
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}
      {status && <Text style={styles.status}>{status}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Buat Project</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
  },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 18 },
  error: { color: '#dc2626', marginTop: 12, fontSize: 13 },
  status: { color: '#2563eb', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: 'white', fontWeight: '700' },
});
