import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.appName}>AI Practice Book <Text style={styles.beta}>β版</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingTop: 50, // ステータスバー分のスペース
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  beta: {
    fontSize: 14,
    fontWeight: 'normal',
    fontStyle: 'italic',
    color: '#E0E0E0',
  },
});
