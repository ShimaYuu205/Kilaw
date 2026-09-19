import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api/client';

const POLL_INTERVAL_MS = 3000; // "auto-refresh saat file berubah" via polling versi project

export default function EditorScreen({ route, navigation }) {
  const { projectId, projectName } = route.params;
  const [tab, setTab] = useState('code'); // 'code' | 'preview'
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('<html><body></body></html>');
  const [remoteVersion, setRemoteVersion] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const localVersionRef = useRef(null); // versi yang sedang ditampilkan di UI ini

  useEffect(() => {
    navigation.setOptions({ title: projectName });
  }, [projectName]);

  const loadFiles = useCallback(async () => {
    const data = await api.getFiles(projectId);
    setFiles(data.files);
    return data;
  }, [projectId]);

  const loadPreview = useCallback(async () => {
    const data = await api.getPreview(projectId);
    setPreviewHtml(data.html);
    setRemoteVersion(data.version);
    localVersionRef.current = data.version;
  }, [projectId]);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadFiles(), loadPreview()]);
      setLoading(false);
    })();
  }, [loadFiles, loadPreview]);

  // Polling: cek versi project tiap beberapa detik. Kalau berubah (dari file
  // lain yang di-edit, atau dari hasil "Sync dari Drive"), tarik ulang file
  // tree + preview -> ini yang mensimulasikan "kolaborasi realtime via cloud".
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const project = await api.getProject(projectId);
        if (localVersionRef.current !== null && project.version !== localVersionRef.current) {
          localVersionRef.current = project.version;
          await Promise.all([loadFiles(), loadPreview()]);
        }
      } catch (e) {
        // diamkan error polling supaya tidak mengganggu UX; akan retry otomatis
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [projectId, loadFiles, loadPreview]);

  const openFile = (file) => {
    if (dirty) {
      Alert.alert('Perubahan belum disimpan', 'Simpan dulu sebelum pindah file?', [
        { text: 'Buang perubahan', style: 'destructive', onPress: () => selectFile(file) },
        { text: 'Batal', style: 'cancel' },
      ]);
      return;
    }
    selectFile(file);
  };

  const selectFile = (file) => {
    setSelectedFile(file);
    setContent(file.content);
    setDirty(false);
    setTab('code');
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.updateFileContent(selectedFile.id, content);
      setDirty(false);
      await loadPreview(); // langsung refresh preview di sisi sendiri
      setTab('preview');
    } catch (e) {
      Alert.alert('Gagal menyimpan', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDrive = async () => {
    setSyncing(true);
    try {
      const res = await api.importFromDrive(projectId, undefined);
      await Promise.all([loadFiles(), loadPreview()]);
      Alert.alert('Sync selesai', `${res.importedFiles} file diimpor/diperbarui dari Drive.`);
    } catch (e) {
      Alert.alert('Sync gagal', e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'code' && styles.tabBtnActive]} onPress={() => setTab('code')}>
          <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>Editor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'preview' && styles.tabBtnActive]} onPress={() => setTab('preview')}>
          <Text style={[styles.tabText, tab === 'preview' && styles.tabTextActive]}>Live Preview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncBtn} onPress={handleSyncDrive} disabled={syncing}>
          {syncing ? <ActivityIndicator color="#4f46e5" size="small" /> : <Text style={styles.syncBtnText}>⟳ Sync Drive</Text>}
        </TouchableOpacity>
      </View>

      {tab === 'code' ? (
        <View style={styles.codeArea}>
          <FlatList
            horizontal
            data={files}
            keyExtractor={(f) => f.id}
            style={styles.fileTabs}
            contentContainerStyle={{ paddingHorizontal: 8, gap: 6 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.fileChip, selectedFile?.id === item.id && styles.fileChipActive]}
                onPress={() => openFile(item)}
              >
                <Text style={[styles.fileChipText, selectedFile?.id === item.id && styles.fileChipTextActive]}>
                  {item.path}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyHint}>Belum ada file. Sync dari Drive atau tambah manual lewat API.</Text>}
          />

          {selectedFile ? (
            <>
              <TextInput
                style={styles.editor}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                value={content}
                onChangeText={(v) => {
                  setContent(v);
                  setDirty(true);
                }}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || !dirty}>
                {saving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveBtnText}>{dirty ? 'Simpan & Preview' : 'Tersimpan'}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyHint}>Pilih file di atas untuk mulai edit.</Text>
            </View>
          )}
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: previewHtml }}
          style={{ flex: 1 }}
          key={remoteVersion} // ganti key -> force reload saat versi berubah (auto-refresh)
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#4f46e5' },
  tabText: { color: '#9ca3af', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: 'white' },
  syncBtn: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 8 },
  syncBtnText: { color: '#a5b4fc', fontWeight: '600', fontSize: 12 },
  codeArea: { flex: 1 },
  fileTabs: { flexGrow: 0, paddingVertical: 8 },
  fileChip: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  fileChipActive: { backgroundColor: '#4f46e5' },
  fileChipText: { color: '#9ca3af', fontSize: 12, fontFamily: 'monospace' },
  fileChipTextActive: { color: 'white' },
  editor: {
    flex: 1,
    backgroundColor: '#0b1220',
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 12,
    textAlignVertical: 'top',
  },
  saveBtn: { backgroundColor: '#16a34a', padding: 14, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '700' },
  emptyHint: { color: '#6b7280', fontSize: 12, padding: 16 },
});
