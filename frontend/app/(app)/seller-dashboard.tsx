import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { paymentsApi, SellerDashboard } from '../../src/api/payments';

export default function SellerDashboardScreen() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  const loadDashboard = async () => {
    try {
      const data = await paymentsApi.getSellerDashboard();
      setDashboard(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
        Alert.alert('Error', 'You need to become a seller first');
      } else {
        console.error('Failed to load seller dashboard:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDashboard();
  };

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const returnUrl = 'exp://localhost:8081'; // Expo dev URL
      const refreshUrl = 'exp://localhost:8081';

      const result = await paymentsApi.createConnectAccountLink(returnUrl, refreshUrl);

      Alert.alert(
        'Stripe Connect',
        'Mock Stripe Connect setup initiated. In production, this would open Stripe Connect onboarding.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reload dashboard after connection
              loadDashboard();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate Stripe Connect setup');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Seller Dashboard</Text>
        <Text style={styles.subtitle}>Manage your sales and earnings</Text>
      </View>

      {!dashboard.is_connected ? (
        <View style={styles.connectSection}>
          <View style={styles.connectCard}>
            <Text style={styles.connectTitle}>Connect with Stripe</Text>
            <Text style={styles.connectDescription}>
              Connect your Stripe account to start receiving payments for your question sets.
            </Text>
            <TouchableOpacity
              style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
              onPress={handleConnectStripe}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Stripe Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>¥{dashboard.total_sales.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Sales</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>¥{dashboard.total_earnings.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Your Earnings</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dashboard.total_orders}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{dashboard.question_sets_count}</Text>
              <Text style={styles.statLabel}>Question Sets</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.connectedCard}>
              <Text style={styles.connectedTitle}>Stripe Connected</Text>
              <Text style={styles.connectedText}>
                Account ID: {dashboard.stripe_account_id}
              </Text>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>Active</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Fee</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                The platform takes a 10% fee from each sale. You receive 90% of the sale price.
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#34C759',
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  connectSection: {
    padding: 16,
  },
  connectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  connectDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: '#635BFF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  connectedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  connectedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  connectedBadge: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  connectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});
