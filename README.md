# Network QoS Monitor - TP5 Desarrollo de Aplicaciones

Aplicación móvil integral desarrollada con **React Native (Expo)** y backend en **Node.js / Express** para la medición, monitoreo georreferenciado y análisis de Calidad de Servicio (QoS) en redes móviles y Wi-Fi (Facultad de Ciencia y Tecnología, 2026).

---

## 📌 Características Principales

1. **Monitoreo de Red en Tiempo Real**:
   - Detección automática del tipo de conexión (**Wi-Fi**, **Celular: 2G/3G/4G/5G**, o desconectado).
   - Identificación de operador móvil / SSID Wi-Fi.
   - Estado de conectividad reactivo ante cambios de red.

2. **Evaluación de Latencia y Jitter (RFC 2544)**:
   - Sondas TCP individuales y multihost contra servidores de referencia (Google DNS, Cloudflare DNS, Quad9 DNS).
   - Cálculo de RTT Mínimo, Promedio, Máximo, Jitter (variabilidad RTT) y porcentaje de pérdida de paquetes.

3. **Prueba de Throughput (Ancho de Banda Real)**:
   - Medición de tasa de transferencia de bajada (**Download Mbps**) y subida (**Upload Mbps**) contra servidor dedicado en Docker/Node.
   - Selector configurable de IP del servidor con soporte para Emulador Android (`10.0.2.2`), Localhost (`127.0.0.1`) o red local LAN (`192.168.X.X`).

4. **Georreferenciación y Mapa de Calor (Heatmap)**:
   - Adquisición de coordenadas GPS en cada muestra.
   - Visualización sobre mapa interactivo (`react-native-maps`) con círculos codificados por color según RTT:
     - 🟢 **Óptimo**: < 50 ms
     - 🟡 **Regular**: 50 - 120 ms
     - 🔴 **Crítico**: > 120 ms
   - Inspección detallada al presionar cada punto en el mapa.

5. **Persistencia Local y Exportación**:
   - Almacenamiento local mediante base de datos **SQLite (WAL mode)**.
   - Historial filtrable por tipo de red (Todos, Wi-Fi, Celular).
   - Exportación completa a archivo **CSV** compartido mediante el sistema nativo (`expo-sharing`).

---

## 🚀 Puesta en Marcha

### 1. Iniciar el Servidor Backend (Docker o Node.js)

#### Opción A: Con Docker (Recomendado)
```bash
cd backend
docker compose up -d
```

#### Opción B: Directo con Node.js
```bash
cd backend
npm install
npm start
```
El servidor escuchará en `http://0.0.0.0:3000`. Podés verificar su estado accediendo a `http://localhost:3000/health`.

---

### 2. Iniciar la Aplicación Móvil (Expo)

```bash
cd mobile
npm start
```

- **Android Emulator**: Presioná `a` en la terminal o ejecutá `npm run android`.
- **Dispositivo Físico**: Escaneá el código QR con la app **Expo Go** (Android) o la Cámara (iOS).
  > **Nota para dispositivo físico**: Asegurate de que tu celular y tu PC estén en la misma red Wi-Fi. En la pestaña **Monitor** de la app, tocá el botón **Ajustar** e ingresá la IP local de tu PC (ejemplo: `http://192.168.1.100:3000`).

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React Native, Expo SDK 57, TypeScript, Expo SQLite, Expo Location, Expo File System (Legacy API), Expo Sharing, React Native Maps, NetInfo.
- **Backend**: Node.js, Express, Cors, Crypto (streams de alto rendimiento binario).
- **Contenedores**: Docker, Docker Compose.
