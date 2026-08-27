import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { mobileApiRequest, setAuthToken } from '../api/client';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('+923001234567');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('AquaFlow Pure Water Supply');
  const [password, setPassword] = useState('Rider@123456');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (loginPhone?: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await mobileApiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: loginPhone || identifier,
          password
        })
      });

      if (res.success && res.data.accessToken) {
        setAuthToken(res.data.accessToken);
        onLoginSuccess(res.data.user);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name || !identifier || !password || !companyName) {
      setErrorMsg('Full Name, Business Name, Phone, and Password are required');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await mobileApiRequest('/auth/rider-signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone: identifier,
          email,
          password,
          companyName
        })
      });

      if (res.success && res.data.accessToken) {
        setAuthToken(res.data.accessToken);
        onLoginSuccess(res.data.user);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>🚚</Text>
          </View>
          <Text style={styles.title}>OmniRoute Rider</Text>
          <Text style={styles.subtitle}>Field Delivery & Live GPS App</Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, !isSignup && styles.tabActive]}
            onPress={() => { setIsSignup(false); setErrorMsg(''); }}
          >
            <Text style={[styles.tabText, !isSignup && styles.tabTextActive]}>Rider Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isSignup && styles.tabActive]}
            onPress={() => { setIsSignup(true); setErrorMsg(''); }}
          >
            <Text style={[styles.tabText, isSignup && styles.tabTextActive]}>Register Rider</Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        ) : null}

        {isSignup && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ali Khan"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Business Name / Owner Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AquaPure Fresh Milk & Dairy"
                placeholderTextColor="#94a3b8"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
              />
            </View>
          </>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number / Email</Text>
          <TextInput
            style={styles.input}
            placeholder="+923001234567"
            placeholderTextColor="#94a3b8"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
        </View>

        {isSignup && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="ali.rider@aquaflow.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => (isSignup ? handleSignup() : handleLogin())}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{isSignup ? 'Create Account' : 'Sign In to Route'}</Text>
          )}
        </TouchableOpacity>

        {/* Quick Demo Rider Login */}
        {!isSignup && (
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Quick Rider Login:</Text>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => {
                setIdentifier('+923001234567');
                setPassword('Rider@123456');
                handleLogin('+923001234567');
              }}
            >
              <Text style={styles.demoButtonText}>⚡ Quick Login as Ali Khan (+923001234567)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  logoBadgeText: {
    fontSize: 26,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0284c7',
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  demoBox: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  demoButton: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '700',
  },
});
