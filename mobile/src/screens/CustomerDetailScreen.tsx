import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { mobileApiRequest } from '../api/client';

interface CustomerDetailScreenProps {
  customerId: string;
  deliveryId?: string;
  onBack: () => void;
}

export const CustomerDetailScreen: React.FC<CustomerDetailScreenProps> = ({ customerId, deliveryId, onBack }) => {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Delivery form state
  const [deliveredQty, setDeliveredQty] = useState('2');
  const [emptiesCollected, setEmptiesCollected] = useState('2');
  const [cashCollected, setCashCollected] = useState('0');

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await mobileApiRequest(`/rider/customers/${customerId}`);
        if (res.success && res.data) {
          setCustomer(res.data);
          const latestOrder = res.data.orders?.[0];
          if (latestOrder) {
            const totalQty = latestOrder.items?.reduce((s: number, i: any) => s + i.qty, 0) || 2;
            setDeliveredQty(totalQty.toString());
            setEmptiesCollected(totalQty.toString());
            setCashCollected((latestOrder.totalAmount || 0).toString());
          }
        }
      } catch (e) {
        // Silently handled
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [customerId]);

  const handleCompleteDelivery = async () => {
    if (!deliveryId) {
      alert('No active delivery ID for this stop.');
      return;
    }

    setSubmitting(true);
    let geoLat: number | undefined = customer?.geoLat;
    let geoLng: number | undefined = customer?.geoLng;

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      geoLat = loc.coords.latitude;
      geoLng = loc.coords.longitude;
    } catch {}

    try {
      const res = await mobileApiRequest(`/deliveries/${deliveryId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'delivered',
          deliveredQty: Number(deliveredQty) || 0,
          emptiesCollectedQty: Number(emptiesCollected) || 0,
          cashCollected: Number(cashCollected) || 0,
          geoLat,
          geoLng
        })
      });

      if (res.success) {
        alert('✅ Delivery Completed Successfully! Stock, empty bottles, and payment voucher recorded.');
        onBack();
      } else {
        alert('Error: ' + (res.error || 'Failed to complete delivery'));
      }
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Delivery update failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const outstandingBalance = customer?.invoices?.reduce((sum: number, inv: any) => sum + (inv.totalAmount - inv.paidAmount), 0) || 0;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Loading Customer Stop Details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── TOP NAV ── */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Stop Detail & Proof</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── CUSTOMER CARD ── */}
        <View style={styles.card}>
          <View style={styles.customerHeader}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.customerName}>{customer?.name || 'Customer'}</Text>
              <Text style={styles.customerType}>🏷️ {customer?.customerType?.toUpperCase() || 'RESIDENTIAL'}</Text>
            </View>
            {customer?.stopNumber && (
              <View style={styles.stopBadge}>
                <Text style={styles.stopBadgeText}>STOP #{customer.stopNumber}</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📞 Phone:</Text>
            <Text style={styles.infoValue}>{customer?.phone}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Address:</Text>
            <Text style={styles.infoValue} numberOfLines={3}>{customer?.address}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🗺️ Zone:</Text>
            <Text style={styles.infoValue}>{customer?.zone?.name || 'Assigned Zone'}</Text>
          </View>
        </View>

        {/* ── FINANCIAL DUES & BOTTLE DEPOSIT CARD ── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>💰 Financial & Container Status</Text>

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Outstanding Invoices Due:</Text>
            <Text style={[styles.financialValue, outstandingBalance > 0 ? styles.balanceDue : styles.balanceClear]}>
              {outstandingBalance > 0 ? `Rs. ${outstandingBalance.toLocaleString()}` : 'Rs. 0 (Clear)'}
            </Text>
          </View>

          {customer?.securityLedgers && customer.securityLedgers.length > 0 && (
            <View style={styles.containersHeldBox}>
              <Text style={styles.containersHeldTitle}>📦 Empty Returnable Containers Held:</Text>
              {customer.securityLedgers.map((l: any, i: number) => (
                <Text key={i} style={styles.containerHeldItem}>
                  • {l.qtyHeld}x {l.product?.name || '19L Bottle'} (Deposit: Rs.{l.depositAmount})
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* ── DELIVERY FORM ── */}
        {deliveryId && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>🚚 Complete Stop Delivery</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delivered Bottle Quantity</Text>
              <TextInput
                style={styles.textInput}
                value={deliveredQty}
                onChangeText={setDeliveredQty}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Empty Bottles Collected</Text>
              <TextInput
                style={styles.textInput}
                value={emptiesCollected}
                onChangeText={setEmptiesCollected}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cash Collected (Rs.)</Text>
              <TextInput
                style={styles.textInput}
                value={cashCollected}
                onChangeText={setCashCollected}
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCompleteDelivery}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>✅ Confirm & Mark Delivered</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loaderContainer: {
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  backBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  customerType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 2,
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
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  financialLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  balanceDue: {
    color: '#dc2626',
  },
  balanceClear: {
    color: '#16a34a',
  },
  containersHeldBox: {
    marginTop: 10,
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  containersHeldTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 4,
  },
  containerHeldItem: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
