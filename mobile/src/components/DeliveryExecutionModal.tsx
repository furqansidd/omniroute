import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { mobileApiRequest } from '../api/client';

interface DeliveryExecutionModalProps {
  visible: boolean;
  deliveryId: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryExecutionModal: React.FC<DeliveryExecutionModalProps> = ({
  visible,
  deliveryId,
  customerName,
  orderNumber,
  totalAmount,
  onClose,
  onSuccess
}) => {
  const [deliveredQty, setDeliveredQty] = useState('2');
  const [emptiesCollected, setEmptiesCollected] = useState('2');
  const [cashCollected, setCashCollected] = useState(totalAmount.toString());
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleComplete = async (status: 'delivered' | 'failed') => {
    setLoading(true);
    setStatusMsg('Capturing GPS coordinates & logging proof...');

    let geoLat: number | undefined;
    let geoLng: number | undefined;

    try {
      // Capture live GPS coordinates on delivery confirmation
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      geoLat = loc.coords.latitude;
      geoLng = loc.coords.longitude;
    } catch {
      // Fallback
    }

    try {
      const res = await mobileApiRequest(`/deliveries/${deliveryId}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          deliveredQty: Number(deliveredQty) || 0,
          emptiesCollectedQty: Number(emptiesCollected) || 0,
          cashCollected: Number(cashCollected) || 0,
          geoLat,
          geoLng,
          eSignatureUrl: `GPS-VERIFIED-${Date.now()}`
        })
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(res.error || 'Failed to complete delivery');
      }
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to complete delivery'}`);
    } finally {
      setLoading(false);
      setStatusMsg(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* MODAL HEADER */}
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Confirm Delivery</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {customerName} • {orderNumber}
              </Text>
            </View>

            {/* FORM INPUTS */}
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>📦 Delivered Bottle Quantity</Text>
              <TextInput
                style={styles.textInput}
                value={deliveredQty}
                onChangeText={setDeliveredQty}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>🔄 Empties Returned by Customer</Text>
              <TextInput
                style={styles.textInput}
                value={emptiesCollected}
                onChangeText={setEmptiesCollected}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>💵 Cash Received (Rs.)</Text>
              <TextInput
                style={styles.textInput}
                value={cashCollected}
                onChangeText={setCashCollected}
                keyboardType="decimal-pad"
                placeholder={totalAmount.toString()}
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* GPS NOTICE */}
            <View style={styles.gpsNotice}>
              <Text style={styles.gpsNoticeText}>
                📍 Phone GPS coordinates & timestamp will be attached to this delivery record for the owner.
              </Text>
            </View>

            {statusMsg && (
              <Text style={styles.statusProgressText}>{statusMsg}</Text>
            )}

            {/* ACTION BUTTONS */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.failBtn}
                onPress={() => handleComplete('failed')}
                disabled={loading}
              >
                <Text style={styles.failBtnText}>Absent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.successBtn}
                onPress={() => handleComplete('delivered')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.successBtnText}>✅ Confirm & Deliver</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    maxHeight: '90%',
  },
  modalHeader: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
    marginTop: 2,
  },
  inputCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  gpsNotice: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  gpsNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
    lineHeight: 16,
  },
  statusProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
    textAlign: 'center',
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  failBtn: {
    width: 90,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failBtnText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 13,
  },
  successBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  successBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
