import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { QoSMeasurement } from '../types';

const IS_WEB = Platform.OS === 'web';
const WEB_STORAGE_KEY = '@qos_measurements_web';

// -------------------------------------------------------------
// Implementación Nativa (Android / iOS con SQLite WAL)
// -------------------------------------------------------------
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('qos_monitor.db');
      await initTables(db);
      return db;
    })();
  }
  return dbPromise;
}

async function initTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS qos_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      networkType TEXT NOT NULL,
      cellularGeneration TEXT,
      carrierName TEXT,
      signalStrengthDbm REAL,
      avgLatencyMs REAL NOT NULL,
      jitterMs REAL NOT NULL,
      packetLossPct REAL NOT NULL,
      downloadMbps REAL NOT NULL,
      uploadMbps REAL NOT NULL,
      testedHosts TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_qos_timestamp ON qos_measurements(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_qos_networkType ON qos_measurements(networkType);
  `);
}

// -------------------------------------------------------------
// Implementación Web Fallback (AsyncStorage / localStorage)
// -------------------------------------------------------------
async function getWebList(): Promise<QoSMeasurement[]> {
  try {
    const raw = await AsyncStorage.getItem(WEB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveWebList(list: QoSMeasurement[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[Database Web] Error guardando mediciones:', e);
  }
}

// -------------------------------------------------------------
// Operaciones CRUD unificadas (Cross-Platform)
// -------------------------------------------------------------
export async function insertMeasurement(m: QoSMeasurement): Promise<number> {
  if (IS_WEB) {
    const list = await getWebList();
    const newId = Date.now();
    const record: QoSMeasurement = { ...m, id: newId };
    list.unshift(record);
    await saveWebList(list);
    return newId;
  }

  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO qos_measurements (
      timestamp, latitude, longitude, accuracy, networkType,
      cellularGeneration, carrierName, signalStrengthDbm,
      avgLatencyMs, jitterMs, packetLossPct, downloadMbps, uploadMbps, testedHosts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.timestamp,
      m.latitude,
      m.longitude,
      m.accuracy ?? null,
      m.networkType,
      m.cellularGeneration ?? null,
      m.carrierName ?? null,
      m.signalStrengthDbm ?? null,
      m.avgLatencyMs,
      m.jitterMs,
      m.packetLossPct,
      m.downloadMbps,
      m.uploadMbps,
      m.testedHosts,
    ]
  );
  return result.lastInsertRowId;
}

export async function getAllMeasurements(limit: number = 100): Promise<QoSMeasurement[]> {
  if (IS_WEB) {
    const list = await getWebList();
    return list.slice(0, limit);
  }

  const db = await getDatabase();
  return await db.getAllAsync<QoSMeasurement>(
    `SELECT * FROM qos_measurements ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
}

export async function getFilteredMeasurements(
  networkType?: string,
  startDate?: string,
  endDate?: string
): Promise<QoSMeasurement[]> {
  if (IS_WEB) {
    let list = await getWebList();
    if (networkType && networkType !== 'all') {
      list = list.filter((m) => m.networkType === networkType);
    }
    if (startDate) {
      list = list.filter((m) => m.timestamp >= startDate);
    }
    if (endDate) {
      list = list.filter((m) => m.timestamp <= endDate);
    }
    return list;
  }

  const db = await getDatabase();
  let query = `SELECT * FROM qos_measurements WHERE 1=1`;
  const params: any[] = [];

  if (networkType && networkType !== 'all') {
    query += ` AND networkType = ?`;
    params.push(networkType);
  }
  if (startDate) {
    query += ` AND timestamp >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND timestamp <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY timestamp DESC`;
  return await db.getAllAsync<QoSMeasurement>(query, params);
}

export async function clearAllMeasurements(): Promise<void> {
  if (IS_WEB) {
    await AsyncStorage.removeItem(WEB_STORAGE_KEY);
    return;
  }

  const db = await getDatabase();
  await db.runAsync(`DELETE FROM qos_measurements`);
}