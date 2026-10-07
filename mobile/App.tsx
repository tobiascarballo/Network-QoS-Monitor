import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { QoSProvider } from './src/context/QoSContext';
import DashboardScreen from './src/screens/DashboardScreen';
import HeatmapScreen from './src/screens/HeatmapScreen';
import HistoryScreen from './src/screens/HistoryScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'heatmap' | 'history'>('dashboard');

  return (
    <QoSProvider>
      <View style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Encabezado Superior */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Network QoS Monitor</Text>
          <Text style={styles.headerSubtitle}>Facultad de Ciencia y Tecnología (2026)</Text>
        </View>

        {/* Contenido de la Pantalla Activa */}
        <View style={styles.content}>
          {activeTab === 'dashboard' && <DashboardScreen />}
          {activeTab === 'heatmap' && <HeatmapScreen />}
          {activeTab === 'history' && <HistoryScreen />}
        </View>

        {/* Barra de Navegación Inferior */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('dashboard')}
          >
            <Feather
              name="activity"
              size={20}
              color={activeTab === 'dashboard' ? '#0284C7' : '#94A3B8'}
            />
            <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>
              Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('heatmap')}
          >
            <Feather
              name="map-pin"
              size={20}
              color={activeTab === 'heatmap' ? '#0284C7' : '#94A3B8'}
            />
            <Text style={[styles.navText, activeTab === 'heatmap' && styles.navTextActive]}>
              Heatmap
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setActiveTab('history')}
          >
            <Feather
              name="list"
              size={20}
              color={activeTab === 'history' ? '#0284C7' : '#94A3B8'}
            />
            <Text style={[styles.navText, activeTab === 'history' && styles.navTextActive]}>
              Historial
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </QoSProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : Platform.OS === 'ios' ? 44 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  content: { flex: 1, backgroundColor: '#F8FAFC' },
  navBar: {
    flexDirection: 'row',
    height: 56,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navText: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  navTextActive: { color: '#0284C7', fontWeight: '700' },
});