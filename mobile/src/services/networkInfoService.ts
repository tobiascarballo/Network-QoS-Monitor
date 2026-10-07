import { Platform } from 'react-native';
import NetInfo, { NetInfoState, NetInfoCellularGeneration } from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { CellularGeneration, NetworkType } from '../types';

export interface CurrentDeviceState {
  networkType: NetworkType;
  cellularGeneration?: CellularGeneration;
  carrierName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('[NetworkInfoService] Error pidiendo permisos de ubicación:', err);
    return false;
  }
}

export async function getCurrentNetworkState(): Promise<{
  networkType: NetworkType;
  cellularGeneration?: CellularGeneration;
  carrierName?: string;
}> {
  try {
    if (Platform.OS === 'web') {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        return { networkType: 'none', carrierName: 'Sin Conexión' };
      }
      return {
        networkType: 'wifi',
        carrierName: 'Wi-Fi / Red Local (Web)',
      };
    }

    const net = await NetInfo.fetch();

    let netType: NetworkType = 'unknown';
    if (net.type === 'wifi') netType = 'wifi';
    else if (net.type === 'cellular') netType = 'cellular';
    else if (net.type === 'none') netType = 'none';

    let cellularGen: CellularGeneration | undefined = undefined;
    let carrier: string | undefined = undefined;

    if (net.type === 'cellular' && net.details) {
      carrier = (net.details as any).carrier ?? 'Operador Celular';
      const gen = (net.details as any).cellularGeneration as NetInfoCellularGeneration;
      if (gen === '2g') cellularGen = '2g';
      else if (gen === '3g') cellularGen = '3g';
      else if (gen === '4g') cellularGen = '4g';
      else if (gen === '5g') cellularGen = '5g';
      else cellularGen = 'unknown';
    } else if (net.type === 'wifi') {
      carrier = (net.details as any)?.ssid || 'Red Wi-Fi';
    }

    return {
      networkType: netType,
      cellularGeneration: cellularGen,
      carrierName: carrier,
    };
  } catch (err) {
    console.warn('[NetworkInfoService] Error obteniendo estado de red:', err);
    return { networkType: 'unknown' };
  }
}

export async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number; accuracy?: number }> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      // Coordenadas por defecto (Sede FCyT Concepción del Uruguay) en caso de denegación en simulador
      return { latitude: -32.4844, longitude: -58.2327, accuracy: 10 };
    }

    // Intentamos primero la última posición conocida para velocidad instantánea
    const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
        accuracy: lastKnown.coords.accuracy ?? 5,
      };
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 5,
    };
  } catch (err) {
    console.warn('[NetworkInfoService] Fallback a coordenadas predeterminadas:', err);
    return { latitude: -32.4844, longitude: -58.2327, accuracy: 20 };
  }
}