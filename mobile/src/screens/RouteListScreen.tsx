import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform
} from 'react-native';
import { mobileApiRequest } from '../api/client';
import { DeliveryExecutionModal } from '../components/DeliveryExecutionModal';
import { useLocationTelemetry } from '../hooks/useLocationTelemetry';

interface StopItem {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  status: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    geoLat: number;
    geoLng: number;
    stopNumber?: number;
    outstandingBalance?: number;
    containersHeld?: Array<{ productName: string; qtyHeld: number; depositAmount: number }>;
  };
  items: Array<{
    productId: string;
    productName: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
}

interface RouteListScreenProps {
  user: any;
  onSelectCustomer: (customerId: string, deliveryId?: string) => void;
  onLogout: () => void;
}

export const RouteListScreen: React.FC<RouteListScreenProps> = ({ user, onSelectCustomer, onLogout }) => {
  const [deliveries, setDeliveries] = useState<StopItem[]>([]);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Active delivery completion modal
  const [executingDelivery, setExecutingDelivery] = useState<StopItem | null>(null);

  // 20-Second Real-Time GPS Telemetry
  const telemetry = useLocationTelemetry(true);

  const fetchRoute = async () => {
    try {
      const res = await mobileApiRequest('/rider/route');
      if (res.success && res.data) {
        setRouteInfo(res.data);
        setDeliveries(res.data.assignedDeliveries || []);
      }
    } catch (e) {
      // Handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRoute();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRoute();
  };

  const handleNavigate = (item: StopItem) => {
    const lat = item.customer.geoLat || 31.4504;
    const lng = item.customer.geoLng || 73.1350;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        alert(`Opening Directions to: ${item.customer.name}\n${item.customer.address}`);
      });
    }
  };

  const pendingCount = deliveries.filter(d => d.status === 'pending' || d.status === 'assigned').length;
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading today's assigned route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── TOP APP HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>OmniRoute Delivery</Text>
          <Text style={styles.riderGreeting} numberOfLines={1}>
            👤 {user?.name || 'Rider'} • {routeInfo?.visitPlans?.[0]?.routeName || 'Active Zone'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleRefresh}>
            <Text style={styles.iconBtnText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, styles.logoutBtn]} onPress={onLogout}>
            <Text style={styles.iconBtnText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LIVE GPS TELEMETRY STATUS BAR ── */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryStatus}>
          <View style={[styles.telemetryDot, { backgroundColor: telemetry.isTracking ? '#10b981' : '#f59e0b' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.telemetryText} numberOfLines={1}>
              {telemetry.isTracking
                ? `🟢 GPS Online • ${telemetry.currentCoords ? `${telemetry.currentCoords.lat.toFixed(4)}, ${telemetry.currentCoords.lng.toFixed(4)}` : 'Connected'} • 🔋${telemetry.batteryLevel}%`
                : telemetry.permissionGranted
                ? '📡 Connecting Real GPS...'
                : '⚠️ Location permission required'}
            </Text>
            {telemetry.lastPingTime && (
              <Text style={styles.telemetrySubText}>
                Last broadcast: {telemetry.lastPingTime.toLocaleTimeString()} (Auto 20s)
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.pingNowBtn}
            onPress={telemetry.triggerManualPing}
          >
            <Text style={styles.pingNowBtnText}>📡 Ping</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── STATS SUMMARY BAR ── */}
      <View style={styles.statsBar}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{deliveries.length}</Text>
          <Text style={styles.statLabel}>Total Stops</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#0284c7' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>{deliveredCount}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
      </View>

      {/* ── SEGMENTED VIEW SWITCHER ── */}
      <View style={styles.viewSwitcher}>
        <TouchableOpacity
          style={[styles.switchTab, viewMode === 'list' && styles.switchTabActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.switchTabText, viewMode === 'list' && styles.switchTabTextActive]}>
            📋 Stop List ({deliveries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchTab, viewMode === 'map' && styles.switchTabActive]}
          onPress={() => setViewMode('map')}
        >
          <Text style={[styles.switchTabText, viewMode === 'map' && styles.switchTabTextActive]}>
            🗺️ Waypoints Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MAIN CONTENT (SCROLLVIEW) ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0284c7" />}
      >
        {deliveries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Deliveries Assigned Today</Text>
            <Text style={styles.emptySubtitle}>
              Orders created in the admin panel for your zone will automatically appear here.
            </Text>
          </View>
        ) : viewMode === 'map' ? (
          /* WAYPOINTS MAP VIEW */
          <View style={styles.mapContainer}>
            <Text style={styles.sectionHeading}>Route Waypoint Sequence</Text>
            {deliveries.map((item, idx) => (
              <View key={item.deliveryId} style={styles.waypointCard}>
                <View style={styles.waypointIndex}>
                  <Text style={styles.waypointIndexText}>#{item.customer.stopNumber || idx + 1}</Text>
                </View>
                <View style={styles.waypointInfo}>
                  <Text style={styles.waypointName} numberOfLines={1}>{item.customer.name}</Text>
                  <Text style={styles.waypointAddress} numberOfLines={2}>{item.customer.address}</Text>
                </View>
                <TouchableOpacity
                  style={styles.waypointNavBtn}
                  onPress={() => handleNavigate(item)}
                >
                  <Text style={styles.waypointNavBtnText}>🧭 Go</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          /* STOP LIST VIEW */
          deliveries.map((item, idx) => {
            const isDelivered = item.status === 'delivered';
            const balance = item.customer.outstandingBalance || 0;
            const stopNum = item.customer.stopNumber || idx + 1;
            const bottlesHeld = item.customer.containersHeld?.reduce((s, c) => s + c.qtyHeld, 0) || 0;

            return (
              <View
                key={item.deliveryId}
                style={[
                  styles.stopCard,
                  isDelivered && styles.stopCardDelivered
                ]}
              >
                {/* CARD HEADER */}
                <View style={styles.cardHeader}>
                  <View style={styles.stopBadge}>
                    <Text style={styles.stopBadgeText}>STOP #{stopNum}</Text>
                  </View>
                  <View style={[styles.statusBadge, isDelivered ? styles.statusDelivered : styles.statusPending]}>
                    <Text style={[styles.statusBadgeText, isDelivered ? styles.statusTextDelivered : styles.statusTextPending]}>
                      {isDelivered ? '✅ DELIVERED' : '⏳ PENDING'}
                    </Text>
                  </View>
                </View>

                {/* CUSTOMER INFO */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSelectCustomer(item.customer.id, item.deliveryId)}
                  style={styles.customerSection}
                >
                  <Text style={styles.customerName} numberOfLines={1}>{item.customer.name}</Text>
                  <Text style={styles.customerAddress} numberOfLines={2}>📍 {item.customer.address}</Text>
                  <Text style={styles.customerPhone}>📞 {item.customer.phone}</Text>
                </TouchableOpacity>

                {/* ORDER ITEMS & FINANCIALS */}
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📦 Order Items:</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {item.items.map(i => `${i.qty}x ${i.productName}`).join(', ') || '19L Water Bottle'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>💵 Order Amount:</Text>
                    <Text style={styles.detailAmount}>Rs. {Number(item.totalAmount || 0).toLocaleString()}</Text>
                  </View>

                  {/* DUES & CONTAINERS */}
                  <View style={styles.badgeRow}>
                    {balance > 0 ? (
                      <View style={styles.dueBadgeWarning}>
                        <Text style={styles.dueBadgeWarningText}>💰 Due: Rs. {balance.toLocaleString()}</Text>
                      </View>
                    ) : (
                      <View style={styles.dueBadgeClear}>
                        <Text style={styles.dueBadgeClearText}>✅ Dues: Clear</Text>
                      </View>
                    )}

                    {bottlesHeld > 0 && (
                      <View style={styles.bottleBadge}>
                        <Text style={styles.bottleBadgeText}>🔄 {bottlesHeld}x Empties Held</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* ACTION BUTTONS */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => handleNavigate(item)}
                  >
                    <Text style={styles.navBtnText}>🧭 Google Maps</Text>
                  </TouchableOpacity>

                  {!isDelivered && (
                    <TouchableOpacity
                      style={styles.deliverBtn}
                      onPress={() => setExecutingDelivery(item)}
                    >
                      <Text style={styles.deliverBtnText}>🚚 Start Delivery</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── DELIVERY EXECUTION MODAL ── */}
      {executingDelivery && (
        <DeliveryExecutionModal
          visible={!!executingDelivery}
          deliveryId={executingDelivery.deliveryId}
          customerName={executingDelivery.customer.name}
          orderNumber={executingDelivery.orderNumber}
          totalAmount={executingDelivery.totalAmount}
          onClose={() => setExecutingDelivery(null)}
          onSuccess={() => {
            setExecutingDelivery(null);
            fetchRoute();
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flex: 1,
    marginRight: 10,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  riderGreeting: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284c7',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  iconBtnText: {
    fontSize: 15,
  },
  telemetryBar: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  telemetryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  telemetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1',
  },
  telemetrySubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  pingNowBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  pingNowBtnText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  viewSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#f8fafc',
  },
  switchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  switchTabActive: {
    backgroundColor: '#0284c7',
  },
  switchTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  switchTabTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  stopCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  stopCardDelivered: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stopBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusDelivered: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPending: {
    color: '#b45309',
  },
  statusTextDelivered: {
    color: '#15803d',
  },
  customerSection: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  cardDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
    textAlign: 'right',
  },
  detailAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f766e',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  dueBadgeWarning: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  dueBadgeWarningText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
  },
  dueBadgeClear: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  dueBadgeClearText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  bottleBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  bottleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  navBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  deliverBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  mapContainer: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  waypointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  waypointIndex: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointIndexText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  waypointInfo: {
    flex: 1,
  },
  waypointName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  waypointAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  waypointNavBtn: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  waypointNavBtnText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
  },
});
