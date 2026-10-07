import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoCellularGeneration } from '@react-native-community/netinfo';
import {
  QoSMeasurement,
  PingResult,
  ThroughputResult,
  NetworkType,
  CellularGeneration,
  PingTarget,
} from '../types';
import {
  DEFAULT_PING_TARGETS,
  runFullPingSuite,
} from '../services/pingService';
import {
  DEFAULT_BACKEND_URL,
  runThroughputTest,
} from '../services/throughputService';
import {
  getCurrentNetworkState,
  getCurrentCoordinates,
} from '../services/networkInfoService';
import {
  insertMeasurement,
  getAllMeasurements,
  getFilteredMeasurements,
  clearAllMeasurements,
} from '../db/database';

export interface QoSContextType {
  measurements: QoSMeasurement[];
  lastPingResults: PingResult[];
  lastThroughput: ThroughputResult | null;
  currentNetwork: {
    networkType: NetworkType;
    cellularGeneration?: CellularGeneration;
    carrierName?: string;
  };
  isRunningTest: boolean;
  testPhase: string;
  backendUrl: string;
  pingTargets: PingTarget[];
  isBackgroundEnabled: boolean;
  setBackendUrl: (url: string) => void;
  setPingTargets: (targets: PingTarget[]) => void;
  setIsBackgroundEnabled: (enabled: boolean) => void;
  runManualTest: (isSilent?: boolean) => Promise<void>;
  filterHistory: (networkType?: string, startDate?: string, endDate?: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

const QoSContext = createContext<QoSContextType | null>(null);

const STORAGE_KEY_BACKEND = '@qos_backend_url';
const STORAGE_KEY_TARGETS = '@qos_ping_targets';
const STORAGE_KEY_BG = '@qos_bg_enabled';

export function QoSProvider({ children }: { children: React.ReactNode }) {
  const [measurements, setMeasurements] = useState<QoSMeasurement[]>([]);
  const [lastPingResults, setLastPingResults] = useState<PingResult[]>([]);
  const [lastThroughput, setLastThroughput] = useState<ThroughputResult | null>(null);
  const [currentNetwork, setCurrentNetwork] = useState<{
    networkType: NetworkType;
    cellularGeneration?: CellularGeneration;
    carrierName?: string;
  }>({ networkType: 'unknown' });

  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testPhase, setTestPhase] = useState<string>('En reposo');
  const [backendUrl, setBackendUrlState] = useState<string>(DEFAULT_BACKEND_URL);
  const [pingTargets, setPingTargetsState] = useState<PingTarget[]>(DEFAULT_PING_TARGETS);
  const [isBackgroundEnabled, setIsBackgroundEnabledState] = useState<boolean>(false);

  const bgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setBackendUrl = (url: string) => {
    setBackendUrlState(url);
    AsyncStorage.setItem(STORAGE_KEY_BACKEND, url).catch(() => {});
  };

  const setPingTargets = (targets: PingTarget[]) => {
    setPingTargetsState(targets);
    AsyncStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(targets)).catch(() => {});
  };

  const setIsBackgroundEnabled = (enabled: boolean) => {
    setIsBackgroundEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEY_BG, enabled ? 'true' : 'false').catch(() => {});
  };

  const refreshHistory = async () => {
    try {
      const data = await getAllMeasurements(100);
      setMeasurements(data);
    } catch (err) {
      console.error('[QoSContext] Error leyendo base de datos:', err);
    }
  };

  const updateNetworkInfo = async () => {
    const net = await getCurrentNetworkState();
    setCurrentNetwork(net);
  };

  useEffect(() => {
    refreshHistory();
    updateNetworkInfo();

    // 1. Cargar preferencias guardadas
    AsyncStorage.getItem(STORAGE_KEY_BACKEND)
      .then((savedUrl) => {
        if (savedUrl && savedUrl.trim().length > 0) {
          const trimmed = savedUrl.trim();
          // Si tenía guardada una IP inválida o de emulador en el celular físico, migrar a la IP real
          if (
            trimmed.includes('192.168.1.50') ||
            (Platform.OS !== 'web' && (trimmed.includes('10.0.2.2') || trimmed.includes('localhost')))
          ) {
            setBackendUrlState('http://192.168.1.86:3000');
            AsyncStorage.setItem(STORAGE_KEY_BACKEND, 'http://192.168.1.86:3000').catch(() => {});
            return;
          }
          setBackendUrlState(trimmed);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(STORAGE_KEY_TARGETS)
      .then((savedTargets) => {
        if (savedTargets) {
          try {
            const parsed = JSON.parse(savedTargets);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const hasObsolete = parsed.some(
                (t: PingTarget) =>
                  !t.host ||
                  !t.host.startsWith('http') ||
                  t.host === '8.8.8.8' ||
                  t.host === '1.1.1.1' ||
                  t.host === '9.9.9.9' ||
                  t.host.includes(':5053')
              );
              if (!hasObsolete) {
                setPingTargetsState(parsed);
                return;
              }
            }
          } catch {
            // Error parsing JSON, fallback to default
          }
        }
        setPingTargetsState(DEFAULT_PING_TARGETS);
        AsyncStorage.setItem(STORAGE_KEY_TARGETS, JSON.stringify(DEFAULT_PING_TARGETS)).catch(() => {});
      })
      .catch(() => {});

    AsyncStorage.getItem(STORAGE_KEY_BG)
      .then((savedBg) => {
        if (savedBg === 'true') {
          setIsBackgroundEnabledState(true);
        }
      })
      .catch(() => {});

    // 2. Suscripción reactiva a cambios de red
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      let netType: NetworkType = 'unknown';

      if (Platform.OS === 'web') {
        netType = state.isConnected ? 'wifi' : 'none';
        setCurrentNetwork({
          networkType: netType,
          carrierName: state.isConnected ? 'Wi-Fi / Red Local (Web)' : 'Sin Conexión',
        });
        return;
      }

      if (state.type === 'wifi') netType = 'wifi';
      else if (state.type === 'cellular') netType = 'cellular';
      else if (state.type === 'none') netType = 'none';

      let cellularGen: CellularGeneration | undefined = undefined;
      let carrier: string | undefined = undefined;

      if (state.type === 'cellular' && state.details) {
        carrier = (state.details as any).carrier ?? 'Operador Celular';
        const gen = (state.details as any).cellularGeneration as NetInfoCellularGeneration;
        if (gen === '2g') cellularGen = '2g';
        else if (gen === '3g') cellularGen = '3g';
        else if (gen === '4g') cellularGen = '4g';
        else if (gen === '5g') cellularGen = '5g';
        else cellularGen = 'unknown';
      } else if (state.type === 'wifi') {
        carrier = (state.details as any)?.ssid || 'Red Wi-Fi';
      }

      setCurrentNetwork({
        networkType: netType,
        cellularGeneration: cellularGen,
        carrierName: carrier,
      });
    });

    return () => {
      unsubscribeNet();
    };
  }, []);

  // RF-07: Muestreo periódico en segundo plano / timer de background
  useEffect(() => {
    if (bgTimerRef.current) {
      clearInterval(bgTimerRef.current);
      bgTimerRef.current = null;
    }

    if (isBackgroundEnabled) {
      bgTimerRef.current = setInterval(() => {
        runManualTest(true);
      }, 45000); // Muestreo periódico cada 45 segundos
    }

    return () => {
      if (bgTimerRef.current) {
        clearInterval(bgTimerRef.current);
      }
    };
  }, [isBackgroundEnabled, backendUrl, pingTargets]);

  const runManualTest = async (isSilent: boolean = false) => {
    if (isRunningTest) return;
    setIsRunningTest(true);

    try {
      setTestPhase('Adquiriendo GPS y conectividad...');
      const [netState, coords] = await Promise.all([
        getCurrentNetworkState(),
        getCurrentCoordinates(),
      ]);
      setCurrentNetwork(netState);

      setTestPhase('Midiendo latencia y jitter (RFC 2544)...');
      const pingRes = await runFullPingSuite(pingTargets);
      setLastPingResults(pingRes);

      const validPings = pingRes.filter((p) => p.samples.length > 0);
      const avgLatencyMs = validPings.length > 0
        ? Math.round(validPings.reduce((acc, p) => acc + p.avgRtt, 0) / validPings.length)
        : 0;
      const avgJitterMs = validPings.length > 0
        ? Math.round(validPings.reduce((acc, p) => acc + p.jitter, 0) / validPings.length)
        : 0;
      const avgLossPct = validPings.length > 0
        ? Math.round(validPings.reduce((acc, p) => acc + p.packetLossPct, 0) / validPings.length)
        : 100;

      // RF-07: Notificación de degradación severa de calidad (en background o ante pérdida severa)
      if ((isSilent && (avgLatencyMs > 200 || avgLossPct >= 30)) || avgLossPct >= 60) {
        Alert.alert(
          '⚠️ Alerta de Degradación de Calidad (QoS)',
          `Se detectó alta latencia (${avgLatencyMs} ms) o pérdida severa de paquetes (${avgLossPct}%).`
        );
      }

      setTestPhase('Ejecutando speedtest (Throughput)...');
      let tpRes: ThroughputResult = {
        downloadMbps: 0,
        uploadMbps: 0,
        durationSeconds: 0,
        bytesReceived: 0,
        bytesSent: 0,
      };

      try {
        tpRes = await runThroughputTest(backendUrl);
        setLastThroughput(tpRes);
      } catch (tpError: any) {
        console.warn('[QoSContext] Fallo throughput contra backend:', tpError.message);
        if (!isSilent) {
          Alert.alert(
            'Aviso de Throughput',
            `No se pudo conectar a ${backendUrl}. Verificá que Docker esté corriendo o ajustá la IP.`
          );
        }
      }

      setTestPhase('Guardando registro...');
      const record: QoSMeasurement = {
        timestamp: new Date().toISOString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        networkType: netState.networkType,
        cellularGeneration: netState.cellularGeneration,
        carrierName: netState.carrierName,
        avgLatencyMs,
        jitterMs: avgJitterMs,
        packetLossPct: avgLossPct,
        downloadMbps: tpRes.downloadMbps,
        uploadMbps: tpRes.uploadMbps,
        testedHosts: JSON.stringify(
          pingRes.map((p) => ({
            host: p.host,
            min: p.minRtt,
            max: p.maxRtt,
            avg: p.avgRtt,
            jitter: p.jitter,
            loss: p.packetLossPct,
          }))
        ),
      };

      await insertMeasurement(record);
      await refreshHistory();

      setTestPhase('Completado');
    } catch (err: any) {
      console.error('[QoSContext] Error:', err);
      if (!isSilent) {
        Alert.alert('Error', err.message || 'Error en la prueba.');
      }
      setTestPhase('Error');
    } finally {
      setIsRunningTest(false);
    }
  };

  const filterHistory = async (networkType?: string, startDate?: string, endDate?: string) => {
    try {
      const filtered = await getFilteredMeasurements(networkType, startDate, endDate);
      setMeasurements(filtered);
    } catch (err) {
      console.error('[QoSContext] Error al filtrar:', err);
    }
  };

  const clearHistory = async () => {
    try {
      await clearAllMeasurements();
      setMeasurements([]);
      setLastPingResults([]);
      setLastThroughput(null);
    } catch (err) {
      console.error('[QoSContext] Error borrando base:', err);
    }
  };

  const contextValue: QoSContextType = {
    measurements,
    lastPingResults,
    lastThroughput,
    currentNetwork,
    isRunningTest,
    testPhase,
    backendUrl,
    pingTargets,
    isBackgroundEnabled,
    setBackendUrl,
    setPingTargets,
    setIsBackgroundEnabled,
    runManualTest,
    filterHistory,
    clearHistory,
    refreshHistory,
  };

  return (
    <QoSContext.Provider value={contextValue}>
      {children}
    </QoSContext.Provider>
  );
}

export function useQoS(): QoSContextType {
  const context = useContext(QoSContext);
  if (!context) {
    throw new Error('useQoS debe usarse dentro de un QoSProvider');
  }
  return context;
}