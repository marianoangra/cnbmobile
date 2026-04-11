import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturou:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo deu errado</Text>
          <ScrollView style={styles.box}>
            <Text style={styles.msg}>{this.state.error?.toString()}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F1E', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
  box: { backgroundColor: '#1C2B3E', borderRadius: 12, padding: 16, maxHeight: 200, width: '100%', marginBottom: 24 },
  msg: { fontSize: 13, color: '#FF4444', fontFamily: 'monospace' },
  btn: { backgroundColor: '#39FF6A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { color: '#0A0F1E', fontWeight: 'bold', fontSize: 16 },
});
