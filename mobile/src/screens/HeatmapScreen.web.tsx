import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQoS } from '../context/QoSContext';
import { QoSMeasurement } from '../types';

export default function HeatmapScreenWeb() {
  const { measurements } = useQoS();
  const [selectedPoint, setSelectedPoint] = useState<QoSMeasurement | null>(null);

  // Filtrar mediciones con coordenadas válidas
  const validMeasurements = measurements.filter(
    (m) =>
      typeof m.latitude === 'number' &&
      typeof m.longitude === 'number' &&
      !isNaN(m.latitude) &&
      !isNaN(m.longitude) &&
      m.latitude !== 0 &&
      m.longitude !== 0
  );

  const activePoint = selectedPoint || validMeasurements[0] || null;

  const getColorByLatency = (ms: number): string => {
    if (ms === 0) return '#64748B'; // Sin datos
    if (ms <= 50) return '#10B981'; // Óptimo (< 50ms)
    if (ms <= 120) return '#F59E0B'; // Regular (50-120ms)
    return '#EF4444'; // Crítico (> 120ms)
  };

  // Coordenadas para OpenStreetMap
  const centerLat = activePoint?.latitude ?? -32.4844;
  const centerLng = activePoint?.longitude ?? -58.2327;
  const delta = 0.015;
  const bbox = `${centerLng - delta},${centerLat - delta},${centerLng + delta},${centerLat + delta}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${centerLat},${centerLng}`;

  return (
    <View style={styles.container}>
      {/* 1. Barra de Leyenda de Calidad RTT */}
      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>Calidad RTT</Text>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>&lt; 50 ms</Text>
          <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>50-120 ms</Text>
          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>&gt; 120 ms</Text>
        </View>
      </View>

      {/* 2. Visualizador de Mapa Web (OpenStreetMap) */}
      <View style={styles.mapContainer}>
        {/* @ts-ignore iframe soporte en React Native Web */}
        <iframe
          title="OpenStreetMap QoS Heatmap"
          src={osmUrl}
          style={styles.iframeMap as any}
          frameBorder="0"
          scrolling="no"
        />

        {/* Badge flotante indicativo de modo Web */}
        <View style={styles.webBadge}>
          <Ionicons name="globe-outline" size={14} color="#0284C7" />
          <Text style={styles.webBadgeText}>
            Modo Web: OpenStreetMap (en Android/iOS se usa Google Maps nativo)
          </Text>
        </View>
      </View>

      {/* 3. Lista de Puntos Georreferenciados para Selección */}
      <View style={styles.pointsSection}>
        <Text style={styles.sectionTitle}>
          Puntos Medidos ({validMeasurements.length})
        </Text>

        {validMeasurements.length === 0 ? (
          <View style={styles.emptyNotice}>
            <Ionicons name="information-circle-outline" size={20} color="#94A3B8" />
            <Text style={styles.emptyText}>
              Aún no hay mediciones registradas con GPS. Ejecutá un test en el Monitor.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pointsScroll}>
            {validMeasurements.map((m, idx) => {
              const color = getColorByLatency(m.avgLatencyMs);
              const isSelected = activePoint === m;
              return (
                <TouchableOpacity
                  key={m.id ? `web-m-${m.id}` : `web-idx-${idx}`}
                  style={[styles.pointPill, isSelected && styles.pointPillSelected]}
                  onPress={() => setSelectedPoint(m)}
                >
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.pointPillText, isSelected && styles.pointPillTextSelected]}>
                    #{idx + 1} · {m.avgLatencyMs} ms
                  </Text>
                  <Text style={styles.pointPillSub}>
                    {m.networkType.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 4. Tarjeta Flotante con Datos del Punto Seleccionado */}
      {activePoint && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderLeft}>
              <MaterialCommunityIcons
                name={activePoint.networkType === 'wifi' ? 'wifi' : 'signal-cellular-3'}
                size={18}
                color="#0284C7"
              />
              <Text style={styles.detailTitle}>
                Medición #{activePoint.id ?? 1} ({new Date(activePoint.timestamp).toLocaleTimeString()})
              </Text>
            </View>
            <Text style={styles.coordText}>
              {activePoint.latitude.toFixed(4)}, {activePoint.longitude.toFixed(4)}
            </Text>
          </View>

          <Text style={styles.detailSub}>
            Red: {activePoint.networkType.toUpperCase()} {activePoint.carrierName ? `· ${activePoint.carrierName}` : ''}
          </Text>

          <View style={styles.detailMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RTT</Text>
              <Text style={styles.metricVal}>{activePoint.avgLatencyMs} ms</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Jitter</Text>
              <Text style={styles.metricVal}>{activePoint.jitterMs} ms</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Bajada</Text>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>{activePoint.downloadMbps} M</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Subida</Text>
              <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{activePoint.uploadMbps} M</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  legendCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  legendTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginRight: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
    minHeight: 280,
  },
  iframeMap: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  webBadge: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  webBadgeText: { fontSize: 11, fontWeight: '600', color: '#0F172A' },
  pointsSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pointsScroll: {
    flexDirection: 'row',
  },
  pointPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pointPillSelected: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  pointPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  pointPillTextSelected: {
    color: '#0284C7',
  },
  pointPillSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  coordText: { fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' },
  detailSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  detailMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricItem: { alignItems: 'center' },
  metricLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  metricVal: { fontSize: 13, fontWeight: '700', color: '#0284C7', marginTop: 2 },
});
