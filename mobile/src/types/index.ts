export type NetworkType = 'wifi' | 'cellular' | 'vpn' | 'other' | 'none' | 'unknown';
export type CellularGeneration = '2g' | '3g' | '4g' | '5g' | 'unknown';

export interface PingResult {
  host: string;
  minRtt: number;
  avgRtt: number;
  maxRtt: number;
  jitter: number;
  packetLossPct: number;
  samples: number[];
}

export interface ThroughputResult {
  downloadMbps: number;
  uploadMbps: number;
  durationSeconds: number;
  bytesReceived: number;
  bytesSent: number;
}

export interface QoSMeasurement {
  id?: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  networkType: NetworkType;
  cellularGeneration?: CellularGeneration;
  carrierName?: string;
  signalStrengthDbm?: number;
  avgLatencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  downloadMbps: number;
  uploadMbps: number;
  testedHosts: string;
}

export interface PingTarget {
  id: string;
  label: string;
  host: string;
  port: number;
}