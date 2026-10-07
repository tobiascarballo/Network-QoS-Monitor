import { Platform } from 'react-native';
import { ThroughputResult } from '../types';

// En red local Wi-Fi tu PC tiene la IP 192.168.1.86; en web se usa localhost; en emulador 10.0.2.2
export const DEFAULT_BACKEND_URL = Platform.select({
  android: 'http://192.168.1.86:3000',
  ios: 'http://192.168.1.86:3000',
  web: 'http://localhost:3000',
  default: 'http://192.168.1.86:3000',
}) as string;

const DEFAULT_TIMEOUT_MS = 12000;

/**
 * Mide Throughput de Descarga (Download) descargando un payload binario conocido
 */
export async function measureDownload(
  backendUrl: string = DEFAULT_BACKEND_URL,
  sizeMb: number = 2
): Promise<{ mbps: number; bytes: number; durationSec: number }> {
  const url = `${backendUrl}/api/speedtest/download?size=${sizeMb}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      headers: { 'bypass-tunnel-reminder': '1' },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const durationSec = (performance.now() - start) / 1000;
    const bytes = buffer.byteLength;

    // Throughput (Mbps) = (Bytes * 8) / (segundos * 10^6)
    const mbps = durationSec > 0 ? (bytes * 8) / (durationSec * 1e6) : 0;

    return {
      mbps: Number(mbps.toFixed(2)),
      bytes,
      durationSec: Number(durationSec.toFixed(2)),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout al descargar (${DEFAULT_TIMEOUT_MS / 1000}s). El servidor no respondió.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mide Throughput de Subida (Upload) enviando un payload generado en memoria
 */
export async function measureUpload(
  backendUrl: string = DEFAULT_BACKEND_URL,
  sizeMb: number = 1
): Promise<{ mbps: number; bytes: number; durationSec: number }> {
  const url = `${backendUrl}/api/speedtest/upload`;
  const totalBytes = Math.floor(sizeMb * 1024 * 1024);
  const payload = 'A'.repeat(totalBytes);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'bypass-tunnel-reminder': '1',
      },
      body: payload,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const durationSec = (performance.now() - start) / 1000;
    const mbps = durationSec > 0 ? (totalBytes * 8) / (durationSec * 1e6) : 0;

    return {
      mbps: Number(mbps.toFixed(2)),
      bytes: totalBytes,
      durationSec: Number(durationSec.toFixed(2)),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout al subir (${DEFAULT_TIMEOUT_MS / 1000}s). El servidor no respondió.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ejecuta el test completo de Throughput (Descarga + Subida) (RF-03)
 */
export async function runThroughputTest(backendUrl: string = DEFAULT_BACKEND_URL): Promise<ThroughputResult> {
  const dl = await measureDownload(backendUrl, 2);
  const ul = await measureUpload(backendUrl, 1);

  return {
    downloadMbps: dl.mbps,
    uploadMbps: ul.mbps,
    durationSeconds: Number((dl.durationSec + ul.durationSec).toFixed(2)),
    bytesReceived: dl.bytes,
    bytesSent: ul.bytes,
  };
}