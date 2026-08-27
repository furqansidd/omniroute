// Polyfill DOMException for React Native / Hermes environment
if (typeof (globalThis as any).DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || 'DOMException';
    }
  }
  (globalThis as any).DOMException = DOMExceptionPolyfill;
  (global as any).DOMException = DOMExceptionPolyfill;
}

import React, { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { RouteListScreen } from './src/screens/RouteListScreen';
import { CustomerDetailScreen } from './src/screens/CustomerDetailScreen';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | undefined>(undefined);

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedCustomerId(null);
    setSelectedDeliveryId(undefined);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        {!currentUser ? (
          <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />
        ) : selectedCustomerId ? (
          <CustomerDetailScreen
            customerId={selectedCustomerId}
            deliveryId={selectedDeliveryId}
            onBack={() => setSelectedCustomerId(null)}
          />
        ) : (
          <RouteListScreen
            user={currentUser}
            onSelectCustomer={(custId, delId) => {
              setSelectedCustomerId(custId);
              setSelectedDeliveryId(delId);
            }}
            onLogout={handleLogout}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
