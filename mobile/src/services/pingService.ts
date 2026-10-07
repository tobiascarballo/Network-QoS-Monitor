import { PingResult, PingTarget } from '../types';

export const DEFAULT_PING_TARGETS: PingTarget[] = [
  { id: 'google', label: 'Google DNS', host: 'https://dns.google', port: 443 },
  { id: 'cloudflare', label: 'Cloudflare', host: 'https://1.1.1.1/cdn-cgi/trace', port: 443 },
  { id: 'quad9', label: 'Quad9 DNS', host: 'https://quad9.net', port: 443 },
];

/**
 * Ejecuta una sonda individual de latencia midiendo el tiempo de ida y vuelta (RTT) real
 * Compatible tanto con navegadores Web (CORS/no-cors) como con Android / iOS.
 */
async function pingOnce(url: string, timeoutMs: number = 3000): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }
  // Mapear IPs crudas sin certificados SSL a sus hostnames equivalentes
  if (cleanUrl.includes('8.8.8.8')) {
    cleanUrl = 'https://dns.google';
  } else if (cleanUrl.includes('9.9.9.9') || cleanUrl.includes('dns.quad9.net:5053')) {
    cleanUrl = 'https://quad9.net';
  }

  const sep = cleanUrl.includes('?') ? '&' : '?';
  const targetUrl = `${cleanUrl}${sep}_t=${Date.now()}`;
  const start = performance.now();

  try {
    // 1. Intentar GET estándar (funciona en móvil nativo y endpoints con CORS abierto)
    await fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const duration = performance.now() - start;
    return Math.max(1, Math.round(duration));
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return null; // Timeout
    }

    // 2. Si falla por CORS en navegador Web, probar con mode: 'no-cors'
    // El navegador realiza el handshake TCP/TLS y mide el RTT real de red
    try {
      const startNoCors = performance.now();
      await fetch(targetUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      const duration = performance.now() - startNoCors;
      return Math.max(1, Math.round(duration));
    } catch {
      return null; // Paquete perdido o timeout
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ejecuta N sondas sobre un host y calcula min, avg, max, jitter y packet loss
 */
export async function measureHostQoS(
  target: PingTarget,
  probeCount: number = 5
): Promise<PingResult> {
  const samples: number[] = [];
  let lostCount = 0;

  for (let i = 0; i < probeCount; i++) {
    const rtt = await pingOnce(target.host);
    if (rtt !== null) {
      samples.push(rtt);
    } else {
      lostCount++;
    }
    // Breve pausa entre sondas para no saturar el canal (RFC 2544)
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const packetLossPct = Math.round((lostCount / probeCount) * 100);

  if (samples.length === 0) {
    return {
      host: target.label,
      minRtt: 0,
      avgRtt: 0,
      maxRtt: 0,
      jitter: 0,
      packetLossPct: 100,
      samples: [],
    };
  }

  const minRtt = Math.min(...samples);
  const maxRtt = Math.max(...samples);
  const avgRtt = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);

  // Cálculo de Jitter: promedio de las diferencias absolutas entre muestras consecutivas
  let totalJitter = 0;
  for (let i = 1; i < samples.length; i++) {
    totalJitter += Math.abs(samples[i] - samples[i - 1]);
  }
  const jitter = samples.length > 1 ? Math.round(totalJitter / (samples.length - 1)) : 0;

  return {
    host: target.label,
    minRtt,
    avgRtt,
    maxRtt,
    jitter,
    packetLossPct,
    samples,
  };
}

/**
 * Ejecuta el suite completo de sondas sobre la lista de hosts (RF-02)
 */
export async function runFullPingSuite(targets: PingTarget[] = DEFAULT_PING_TARGETS): Promise<PingResult[]> {
  const results: PingResult[] = [];
  for (const target of targets) {
    const res = await measureHostQoS(target, 4);
    results.push(res);
  }
  return results;
}