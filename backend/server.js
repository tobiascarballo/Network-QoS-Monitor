const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: '*',
    exposedHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
  })
);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Endpoint de Descarga (Download): Genera un payload binario del tamaño solicitado
// Por defecto 5 MB (5 * 1024 * 1024 bytes) para una medición rápida y precisa
app.get('/api/speedtest/download', (req, res) => {
  const parsedSize = parseFloat(req.query.size || '5');
  const sizeMb = isNaN(parsedSize) || parsedSize <= 0 ? 5 : Math.min(parsedSize, 25); // límite seguro máx 25MB
  const totalBytes = Math.floor(sizeMb * 1024 * 1024);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', totalBytes);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  // Buffer de datos pseudoaleatorios para evitar compresión en tránsito
  const chunk = crypto.randomBytes(64 * 1024); // 64 KB chunks
  let sentBytes = 0;
  let clientConnected = true;

  req.on('close', () => {
    clientConnected = false;
  });

  function writeChunks() {
    if (!clientConnected || res.writableEnded) return;

    let ok = true;
    while (clientConnected && sentBytes < totalBytes && ok) {
      const remaining = totalBytes - sentBytes;
      const toSend = remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;
      sentBytes += toSend.length;
      ok = res.write(toSend);
    }

    if (!clientConnected) return;

    if (sentBytes >= totalBytes) {
      res.end();
    } else {
      res.once('drain', writeChunks);
    }
  }

  writeChunks();
});

// 2. Endpoint de Subida (Upload): Recibe stream de bytes y calcula recepción (Echo/Sink)
app.post('/api/speedtest/upload', (req, res) => {
  let receivedBytes = 0;
  const startTime = Date.now();
  let clientConnected = true;

  req.on('close', () => {
    clientConnected = false;
  });

  req.on('data', (chunk) => {
    receivedBytes += chunk.length;
  });

  req.on('end', () => {
    if (!clientConnected || res.writableEnded) return;

    const durationSeconds = (Date.now() - startTime) / 1000;
    const mbps = durationSeconds > 0 ? ((receivedBytes * 8) / (durationSeconds * 1e6)).toFixed(2) : '0';
    res.json({
      status: 'ok',
      bytesReceived: receivedBytes,
      durationSeconds: Number(durationSeconds.toFixed(3)),
      serverCalculatedMbps: Number(mbps),
    });
  });

  req.on('error', (err) => {
    console.error('[Upload Error]', err);
    if (!res.writableEnded) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[QoS Speedtest Server] Corriendo en http://0.0.0.0:${PORT}`);
});