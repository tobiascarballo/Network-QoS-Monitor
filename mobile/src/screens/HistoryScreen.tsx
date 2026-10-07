import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQoS } from '../context/QoSContext';
import { QoSMeasurement } from '../types';

export default function HistoryScreen() {
  const { measurements, filterHistory, clearHistory } = useQoS();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const handleApplyFilter = (type: string) => {
    setSelectedFilter(type);
    filterHistory(type === 'all' ? undefined : type);
  };

  /**
   * Exporta todo el historial a formato CSV compatible con Excel/Data Studio (RF-08)
   */
  const handleExportCSV = async () => {
    if (measurements.length === 0) {
      Alert.alert('Aviso', 'No hay datos registrados para exportar.');
      return;
    }

    try {
      const headers = 'ID,Timestamp,Lat,Lng,Network,Carrier,RTT_ms,Jitter_ms,Loss_pct,Download_Mbps,Upload_Mbps\n';
      const rows = measurements.map((m) => {
        const escapedCarrier = (m.carrierName ?? '').replace(/"/g, '""');
        const escapedNetwork = (m.networkType ?? '').replace(/"/g, '""');
        return `${m.id ?? ''},"${m.timestamp}",${m.latitude},${m.longitude},"${escapedNetwork}","${escapedCarrier}",${m.avgLatencyMs},${m.jitterMs},${m.packetLossPct},${m.downloadMbps},${m.uploadMbps}`;
      }).join('\n');

      const csvData = headers + rows;

      // Descarga directa en navegador Web
      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `qos_measurements_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Éxito', 'Archivo CSV descargado en tu navegador.');
        return;
      }

      // Descarga y compartir en Android / iOS nativo
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!baseDir) {
        throw new Error('No se pudo acceder al directorio del dispositivo.');
      }

      const fileUri = `${baseDir}qos_measurements_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Historial QoS (CSV)',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Guardado', `Archivo generado en: ${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Fallo al exportar CSV');
    }
  };

  const handleConfirmClear = () => {
    if (measurements.length === 0) {
      Alert.alert('Aviso', 'El historial ya está vacío.');
      return;
    }

    Alert.alert(
      'Borrar Base de Datos',
      '¿Estás seguro de que deseas eliminar todas las mediciones registradas? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar Todo',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            Alert.alert('Éxito', 'Historial eliminado correctamente.');
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: QoSMeasurement }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.typeBadge}>
          <MaterialCommunityIcons
            name={item.networkType === 'wifi' ? 'wifi' : 'signal-cellular-3'}
            size={16}
            color="#0284C7"
          />
          <Text style={styles.typeText}>{item.networkType.toUpperCase()}</Text>
        </View>
        <Text style={styles.timeText}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>RTT</Text>
          <Text style={styles.colVal}>{item.avgLatencyMs} ms</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Jitter</Text>
          <Text style={styles.colVal}>{item.jitterMs} ms</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Bajada</Text>
          <Text style={[styles.colVal, { color: '#10B981' }]}>{item.downloadMbps} M</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.colLabel}>Subida</Text>
          <Text style={[styles.colVal, { color: '#F59E0B' }]}>{item.uploadMbps} M</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Barra de Filtros (RF-09) */}
      <View style={styles.filterRow}>
        {['all', 'wifi', 'cellular'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterBtn, selectedFilter === filter && styles.filterBtnActive]}
            onPress={() => handleApplyFilter(filter)}
          >
            <Text style={[styles.filterBtnText, selectedFilter === filter && styles.filterBtnTextActive]}>
              {filter === 'all' ? 'Todos' : filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Botones de Acción (Exportar y Limpiar) */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
          <Feather name="download" size={15} color="#FFFFFF" />
          <Text style={styles.exportBtnText}> Exportar CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={handleConfirmClear}>
          <Feather name="trash-2" size={15} color="#EF4444" />
          <Text style={styles.clearBtnText}> Borrar DB</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={measurements}
        keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay mediciones en el historial.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#FFFFFF' },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#F1F5F9' },
  filterBtnActive: { backgroundColor: '#0284C7' },
  filterBtnText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterBtnTextActive: { color: '#FFFFFF' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0284C7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  exportBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  clearBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  listContent: { padding: 12, gap: 10 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  timeText: { fontSize: 11, color: '#94A3B8' },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  col: { alignItems: 'center' },
  colLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  colVal: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#94A3B8', fontSize: 13 },
});