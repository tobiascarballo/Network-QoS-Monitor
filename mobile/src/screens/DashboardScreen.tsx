import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { useQoS } from '../context/QoSContext';
import { PingResult } from '../types';

export default function DashboardScreen() {
  const {
    currentNetwork,
    isRunningTest,
    testPhase,
    runManualTest,
    lastPingResults,
    measurements,
    backendUrl,
    setBackendUrl,
    pingTargets,
    isBackgroundEnabled,
    setIsBackgroundEnabled,
  } = useQoS();

  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(backendUrl);
  const [chartTab, setChartTab] = useState<'latency' | 'throughput'>('latency');

  const latest = measurements[0];

  const getNetworkIcon = (): keyof typeof MaterialCommunityIcons.glyphMap => {
    if (currentNetwork.networkType === 'wifi') return 'wifi';
    if (currentNetwork.networkType === 'cellular') return 'signal-cellular-3';
    if (currentNetwork.networkType === 'none') return 'wifi-off';
    return 'help-network-outline';
  };

  const getNetworkName = () => {
    if (currentNetwork.networkType === 'none') return 'SIN CONEXIÓN';
    if (currentNetwork.networkType === 'wifi') return 'WI-FI';
    if (currentNetwork.networkType === 'cellular') {
      return `MÓVIL ${currentNetwork.cellularGeneration ? `(${currentNetwork.cellularGeneration.toUpperCase()})` : ''}`;
    }
    return currentNetwork.networkType.toUpperCase();
  };

  // Restaurar sondas registradas en la última sesión si el estado en memoria está vacío
  let displayPings: PingResult[] = lastPingResults;
  if (displayPings.length === 0 && latest?.testedHosts) {
    try {
      const parsed = JSON.parse(latest.testedHosts);
      if (Array.isArray(parsed)) {
        displayPings = parsed.map((item: any) => ({
          host: item.host,
          minRtt: item.min ?? item.avg ?? 0,
          maxRtt: item.max ?? item.avg ?? 0,
          avgRtt: item.avg ?? 0,
          jitter: item.jitter ?? 0,
          packetLossPct: item.loss ?? 0,
          samples: [],
        }));
      }
    } catch {
      // Ignorar errores de parseo
    }
  }

  const handleOpenConfig = () => {
    setTempUrl(backendUrl);
    setIsConfigModalVisible(true);
  };

  const handleSaveConfig = () => {
    const trimmed = tempUrl.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      Alert.alert('URL Inválida', 'La URL del servidor debe comenzar con http:// o https://');
      return;
    }
    setBackendUrl(trimmed);
    setIsConfigModalVisible(false);
    Alert.alert('Guardado', `Servidor actualizado a:\n${trimmed}`);
  };

  // Datos para gráficos de series temporales (RF-06): últimas 6 mediciones en orden cronológico
  const recentSessions = measurements.slice(0, 6).reverse();
  const maxLatency = Math.max(...recentSessions.map((m) => m.avgLatencyMs), 100);
  const maxThroughput = Math.max(
    ...recentSessions.map((m) => Math.max(m.downloadMbps, m.uploadMbps)),
    10
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Tarjeta de Red Activa (RF-01) */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.networkBadge}>
            <MaterialCommunityIcons
              name={getNetworkIcon()}
              size={24}
              color={currentNetwork.networkType === 'none' ? '#EF4444' : '#0284C7'}
            />
            <Text style={styles.networkType}>{getNetworkName()}</Text>
          </View>
          <Text style={styles.carrierText}>
            {currentNetwork.carrierName || (currentNetwork.networkType === 'none' ? 'Desconectado' : 'Red Local')}
          </Text>
        </View>

        <Text style={styles.statusSub}>
          {isRunningTest ? `Estado: ${testPhase}` : 'Dispositivo listo para sondas QoS'}
        </Text>
      </View>

      {/* 2. Tarjeta de Configuración de Servidor Throughput (RF-03) */}
      <View style={styles.serverCard}>
        <View style={styles.serverInfoRow}>
          <Feather name="server" size={16} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.serverTitle}>Servidor Throughput (Docker / Node)</Text>
            <Text style={styles.serverUrlText} numberOfLines={1}>{backendUrl}</Text>
          </View>
          <TouchableOpacity style={styles.serverEditBtn} onPress={handleOpenConfig}>
            <Feather name="settings" size={14} color="#0284C7" />
            <Text style={styles.serverEditBtnText}> Ajustar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Muestreo Periódico en Background (RF-07) */}
      <View style={styles.bgCard}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="clock" size={15} color="#8B5CF6" />
              <Text style={styles.bgTitle}>Muestreo en Segundo Plano (RF-07)</Text>
            </View>
            <Text style={styles.bgSub}>
              {isBackgroundEnabled
                ? 'Activo: Sondea red cada 45s y alerta degradación'
                : 'Pausado: Se ejecuta solo de forma manual'}
            </Text>
          </View>
          <Switch
            value={isBackgroundEnabled}
            onValueChange={setIsBackgroundEnabled}
            trackColor={{ false: '#CBD5E1', true: '#8B5CF6' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 4. Botón de Test Manual */}
      <TouchableOpacity
        style={[styles.testButton, isRunningTest && styles.buttonDisabled]}
        onPress={() => runManualTest(false)}
        disabled={isRunningTest}
      >
        {isRunningTest ? (
          <View style={styles.rowCenter}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.testButtonText}> Evaluando Red...</Text>
          </View>
        ) : (
          <View style={styles.rowCenter}>
            <Feather name="play-circle" size={20} color="#FFFFFF" />
            <Text style={styles.testButtonText}> Iniciar Test Completo QoS</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 5. Métricas Principales de la Sesión */}
      <Text style={styles.sectionTitle}>Métricas de la Última Sesión</Text>
      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="timer-outline" size={24} color="#0284C7" />
          <Text style={styles.metricLabel}>Latencia RTT</Text>
          <Text style={styles.metricValue}>
            {latest ? `${latest.avgLatencyMs} ms` : '--'}
          </Text>
          <Text style={styles.metricHint}>Promedio TCP</Text>
        </View>

        <View style={styles.metricCard}>
          <MaterialCommunityIcons name="pulse" size={24} color="#8B5CF6" />
          <Text style={styles.metricLabel}>Jitter</Text>
          <Text style={styles.metricValue}>
            {latest ? `${latest.jitterMs} ms` : '--'}
          </Text>
          <Text style={styles.metricHint}>Desviación RTT</Text>
        </View>

        <View style={styles.metricCard}>
          <Feather name="arrow-down-circle" size={24} color="#10B981" />
          <Text style={styles.metricLabel}>Descarga</Text>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>
            {latest ? `${latest.downloadMbps} M` : '--'}
          </Text>
          <Text style={styles.metricHint}>Mbps medidos</Text>
        </View>

        <View style={styles.metricCard}>
          <Feather name="arrow-up-circle" size={24} color="#F59E0B" />
          <Text style={styles.metricLabel}>Subida</Text>
          <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
            {latest ? `${latest.uploadMbps} M` : '--'}
          </Text>
          <Text style={styles.metricHint}>Mbps calculados</Text>
        </View>
      </View>

      {/* 6. Series Temporales por Sesión (RF-06) */}
      <View style={styles.chartCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.chartTitle}>Series Temporales por Sesión (RF-06)</Text>
          <View style={styles.chartTabRow}>
            <TouchableOpacity
              style={[styles.chartTabBtn, chartTab === 'latency' && styles.chartTabBtnActive]}
              onPress={() => setChartTab('latency')}
            >
              <Text style={[styles.chartTabBtnText, chartTab === 'latency' && styles.chartTabBtnTextActive]}>
                RTT
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartTabBtn, chartTab === 'throughput' && styles.chartTabBtnActive]}
              onPress={() => setChartTab('throughput')}
            >
              <Text style={[styles.chartTabBtnText, chartTab === 'throughput' && styles.chartTabBtnTextActive]}>
                Throughput
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {recentSessions.length === 0 ? (
          <View style={styles.chartEmpty}>
            <Ionicons name="stats-chart-outline" size={24} color="#94A3B8" />
            <Text style={styles.emptyText}>Realizá al menos un test para generar series temporales.</Text>
          </View>
        ) : (
          <View style={styles.chartBody}>
            {chartTab === 'latency' ? (
              <View style={styles.barsContainer}>
                {recentSessions.map((session, i) => {
                  const heightPct = Math.max(15, (session.avgLatencyMs / maxLatency) * 90);
                  const barColor =
                    session.avgLatencyMs <= 50 ? '#10B981' : session.avgLatencyMs <= 120 ? '#F59E0B' : '#EF4444';
                  const timeLabel = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={styles.barValueText}>{session.avgLatencyMs}m</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${heightPct}%`, backgroundColor: barColor }]} />
                      </View>
                      <Text style={styles.barTimeText}>{timeLabel}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.barsContainer}>
                {recentSessions.map((session, i) => {
                  const dlPct = Math.max(12, (session.downloadMbps / maxThroughput) * 90);
                  const ulPct = Math.max(12, (session.uploadMbps / maxThroughput) * 90);
                  const timeLabel = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={styles.barValueText}>{session.downloadMbps.toFixed(0)}M</Text>
                      <View style={styles.barTrackDual}>
                        <View style={[styles.barFill, { height: `${dlPct}%`, backgroundColor: '#10B981', width: 8 }]} />
                        <View style={[styles.barFill, { height: `${ulPct}%`, backgroundColor: '#F59E0B', width: 8 }]} />
                      </View>
                      <Text style={styles.barTimeText}>{timeLabel}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.chartLegend}>
              {chartTab === 'latency' ? (
                <>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendHint}>&lt; 50ms</Text>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendHint}>50-120ms</Text>
                  <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendHint}>&gt; 120ms</Text>
                </>
              ) : (
                <>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.legendHint}>Bajada (DL)</Text>
                  <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendHint}>Subida (UL)</Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>

      {/* 7. Sondas por Host (RFC 2544 - RF-02) */}
      <Text style={styles.sectionTitle}>Sondas TCP por Host (RFC 2544)</Text>
      {displayPings.length > 0 ? (
        displayPings.map((p, index) => (
          <View key={index} style={styles.hostRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.hostLabel}>{p.host}</Text>
              <Text style={styles.hostSub}>
                Min: {p.minRtt} ms · Max: {p.maxRtt} ms · Pérdida: {p.packetLossPct}%
              </Text>
            </View>
            <View style={styles.hostMetrics}>
              <Text style={styles.hostValue}>{p.avgRtt} ms</Text>
              <Text style={styles.hostJitter}>Jitter: {p.jitter} ms</Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="information-circle-outline" size={22} color="#94A3B8" />
          <Text style={styles.emptyText}>Presione "Iniciar Test" para registrar sondas.</Text>
        </View>
      )}

      {/* Modal de Configuración de Servidor (RF-02 y RF-03) */}
      <Modal
        visible={isConfigModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConfigModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Servidor Throughput</Text>
            <Text style={styles.modalSub}>
              Ingresá la URL del backend donde se ejecuta Docker o Node.
            </Text>

            <TextInput
              style={styles.modalInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://192.168.1.X:3000"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[styles.presetBtn, { backgroundColor: '#E0F2FE', borderColor: '#0284C7', borderWidth: 1 }]}
                onPress={() => setTempUrl('http://192.168.1.86:3000')}
              >
                <Text style={[styles.presetBtnText, { color: '#0284C7', fontWeight: 'bold' }]}>Mi PC Wi-Fi (192.168.1.86)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setTempUrl('http://localhost:3000')}
              >
                <Text style={styles.presetBtnText}>Web (localhost)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetBtn}
                onPress={() => setTempUrl('http://10.0.2.2:3000')}
              >
                <Text style={styles.presetBtnText}>Emulador (10.0.2.2)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConfigModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveConfig}
              >
                <Text style={styles.modalSaveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  networkType: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  carrierText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  statusSub: { fontSize: 13, color: '#475569', marginTop: 10 },
  testButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  testButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 6 },
  metricValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginVertical: 2 },
  metricHint: { fontSize: 11, color: '#94A3B8' },
  bgCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  bgTitle: { fontSize: 12, fontWeight: '700', color: '#6D28D9' },
  bgSub: { fontSize: 11, color: '#7C3AED', marginTop: 2 },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  chartTabRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2 },
  chartTabBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  chartTabBtnActive: { backgroundColor: '#0284C7' },
  chartTabBtnText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  chartTabBtnTextActive: { color: '#FFFFFF' },
  chartEmpty: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  chartBody: { marginTop: 14 },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 110,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  barCol: { alignItems: 'center', width: 44 },
  barValueText: { fontSize: 9, fontWeight: '700', color: '#64748B', marginBottom: 4 },
  barTrack: {
    height: 80,
    width: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barTrackDual: {
    height: 80,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 2,
    borderRadius: 6,
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barTimeText: { fontSize: 9, color: '#94A3B8', marginTop: 4 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  legendHint: { fontSize: 10, color: '#64748B' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hostLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  hostSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  hostMetrics: { alignItems: 'flex-end' },
  hostValue: { fontSize: 15, fontWeight: '700', color: '#0284C7' },
  hostJitter: { fontSize: 11, color: '#94A3B8' },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { color: '#64748B', fontSize: 12 },
  serverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serverTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  serverUrlText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  serverEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  serverEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSaveBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});