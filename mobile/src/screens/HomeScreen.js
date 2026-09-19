import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

export default function HomeScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh tiap kali screen ini kembali fokus (mis. balik dari Editor)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Project Saya</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('Import')}
        >
          <Text style={styles.newBtnText}>+ Baru / Import Drive</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText}>
          Gagal konek ke backend: {error}{'\n'}Pastikan server berjalan & BASE_URL benar.
        </Text>
      )}

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          !error && (
            <Text style={styles.empty}>
              Belum ada project. Tap "+ Baru / Import Drive" untuk mulai.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Editor', { projectId: item.id, projectName: item.name })}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>
              {item.driveFolderLink ? '🔗 Terhubung ke Google Drive' : '📁 Lokal'}
            </Text>
            <Text style={styles.cardMeta}>v{item.version} · update terakhir {new Date(item.updatedAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  newBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  newBtnText: { color: 'white', fontWeight: '600', fontSize: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#6b7280' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
  errorText: { color: '#dc2626', paddingHorizontal: 16, paddingBottom: 8, fontSize: 12 },
});
