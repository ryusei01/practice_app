import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Quiz Marketplace</Text>
        <Text style={styles.subtitle}>AI-Powered Learning Platform</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonOutline]}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={[styles.buttonText, styles.buttonOutlineText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.full_name}!</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.menuContainer}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push('/(app)/ai-dashboard')}
        >
          <Text style={styles.menuButtonText}>AI Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push('/(app)/question-sets')}
        >
          <Text style={styles.menuButtonText}>My Question Sets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => router.push('/(app)/question-sets/create')}
        >
          <Text style={styles.menuButtonText}>Create Question Set</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.sellerButton]}
          onPress={() => router.push('/(app)/seller-dashboard')}
        >
          <Text style={styles.menuButtonText}>Seller Dashboard</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.logoutButton]}
        onPress={logout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 48,
    textAlign: 'center',
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  menuContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
    marginBottom: 32,
  },
  menuButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sellerButton: {
    backgroundColor: '#34C759',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutlineText: {
    color: '#007AFF',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
  },
});
