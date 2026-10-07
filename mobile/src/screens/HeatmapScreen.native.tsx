import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useQoS } from '../context/QoSContext';
import { QoSMeasurement } from '../types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class MapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[HeatmapNative] Error en componente de mapa:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

function HeatmapContent() {
  const { measurements } = useQoS();
  const [selectedPoint, setSelectedPoint] = useState<QoSMeasurement | null>(null);

  // Filtrar únicamente mediciones con coordenadas válidas para evitar crashes nativos
  const validMeasurements = measurements.filter(
    (m) =>
      typeof m.latitude === 'number' &&
      typeof m.longitude === 'number' &&
      !isNaN(m.latitude) &&
      !isNaN(m.longitude) &&
      m.latitude !== 0 &&
      m.longitude !== 0
  );

  // Coordenadas iniciales (primer punto válido o FCyT Concepción del Uruguay por defecto)
  const initialRegion = {
    latitude: validMeasurements[0]?.latitude ?? -32.4844,
    longitude: validMeasurements[0]?.longitude ?? -58.2327,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const getColorByLatency = (ms: number): string => {
    if (ms === 0) return '#64748B'; // Sin datos
    if (ms <= 50) return '#10B981'; // Óptimo (< 50ms)
    if (ms <= 120) return '#F59E0B'; // Regular (50-120ms)
    return '#EF4444'; // Crítico / Lento (> 120ms)
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {validMeasurements.map((m, index) => {
          const color = getColorByLatency(m.avgLatencyMs);
          return (
            <React.Fragment key={m.id ? `m-${m.id}` : `idx-${index}`}>
              <Circle
                center={{ latitude: m.latitude, longitude: m.longitude }}
                radius={35}
                fillColor={`${color}55`}
                strokeColor={color}
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                pinColor={color}
                onPress={() => setSelectedPoint(m)}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Leyenda de Calidad de Señal/RTT (RF-05) */}
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

      {/* Cartel cuando no hay puntos */}
      {validMeasurements.length === 0 && (
        <View style={styles.emptyNotice}>
          <Ionicons name="information-circle" size={18} color="#0284C7" />
          <Text style={styles.emptyNoticeText}>
            No hay mediciones georreferenciadas registradas aún.
          </Text>
        </View>
      )}

      {/* Modal/Tarjeta flotante de punto seleccionado */}
      {selectedPoint && (
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>Medición Georreferenciada</Text>
            <TouchableOpacity onPress={() => setSelectedPoint(null)}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.detailSub}>
            Red: {selectedPoint.networkType.toUpperCase()} {selectedPoint.carrierName ? `· ${selectedPoint.carrierName}` : ''}
          </Text>
          <View style={styles.detailMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RTT</Text>
              <Text style={styles.metricVal}>{selectedPoint.avgLatencyMs} ms</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Jitter</Text>
              <Text style={styles.metricVal}>{selectedPoint.jitterMs} ms</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Bajada</Text>
              <Text style={[styles.metricVal, { color: '#10B981' }]}>{selectedPoint.downloadMbps} M</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Subida</Text>
              <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{selectedPoint.uploadMbps} M</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function HeatmapScreen() {
  const { measurements } = useQoS();

  return (
    <MapErrorBoundary
      fallback={(error) => (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
          <View style={[styles.emptyNotice, { position: 'relative', bottom: 0, marginVertical: 12 }]}>
            <Ionicons name="warning" size={20} color="#F59E0B" />
            <Text style={[styles.emptyNoticeText, { flex: 1 }]}>
              Modo seguro de mapa activo (cobertura QoS registrada: {measurements.length} puntos).
            </Text>
          </View>
          {measurements.map((m, idx) => (
            <View key={m.id ?? idx} style={[styles.detailCard, { position: 'relative', bottom: 0, left: 0, right: 0, marginBottom: 10 }]}>
              <Text style={styles.detailTitle}>Medición #{m.id ?? idx + 1}</Text>
              <Text style={styles.detailSub}>Lat: {m.latitude.toFixed(4)}, Lng: {m.longitude.toFixed(4)}</Text>
              <Text style={styles.metricVal}>RTT: {m.avgLatencyMs} ms · {m.downloadMbps} Mbps</Text>
            </View>
          ))}
        </ScrollView>
      )}
    >
      <HeatmapContent />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E2E8F0' },
  map: { flex: 1, width: '100%', height: '100%' },
  legendCard: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  legendTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginRight: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#475569', fontWeight: '500' },
  emptyNotice: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyNoticeText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  detailCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  detailSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  detailMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metricItem: { alignItems: 'center' },
  metricLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  metricVal: { fontSize: 13, fontWeight: '700', color: '#0284C7', marginTop: 2 },
});