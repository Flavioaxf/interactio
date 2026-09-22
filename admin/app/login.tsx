import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image
} from 'react-native';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import '../src/firebase';



export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMessage('Preencha e-mail e senha.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const auth = getAuth();

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.replace('/'); 
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMessage('E-mail ou senha incorretos.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Esse e-mail já está cadastrado.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setErrorMessage('Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.root, { justifyContent: 'center' }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { padding: isMobile ? 16 : 32 }]}>
        <View style={[styles.card, { padding: isMobile ? 32 : 48 }]}>
          
          <View style={styles.logoContainer}>
           <Image 
              source={require('../assets/images/icon.png')}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              inter<Text style={styles.highlight}>actio</Text>
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PAINEL DO APRESENTADOR</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            {isLoginMode ? 'Acesse sua conta para gerenciar sessões.' : 'Crie sua conta de professor grátis.'}
          </Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Seu e-mail profissional"
              placeholderTextColor="#8b89a0"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#8b89a0"
              secureTextEntry
              value={password}
              onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
            />

            <TouchableOpacity 
              style={styles.mainButton} 
              activeOpacity={0.8}
              onPress={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0f0e17" />
              ) : (
                <Text style={styles.mainButtonText}>
                  {isLoginMode ? 'Entrar no Painel →' : 'Criar Conta →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isLoginMode ? "Ainda não tem uma conta? " : "Já tem uma conta? "}
            </Text>
            <TouchableOpacity onPress={() => { setIsLoginMode(!isLoginMode); setErrorMessage(''); }}>
              <Text style={styles.switchLink}>
                {isLoginMode ? "Cadastre-se" : "Faça Login"}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17', alignItems: 'center' },
  container: { width: '100%', maxWidth: 500 },
  card: { backgroundColor: '#1a1924', borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 10, alignItems: 'center' },
  
  logoContainer: { alignItems: 'center', marginBottom: 24, overflow: 'visible' },
  
  title: { fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined, fontSize: 46, fontWeight: '900', letterSpacing: -1.5, color: '#e8e6f0', marginTop: 16, marginBottom: 8, includeFontPadding: false },
  highlight: { color: '#a78bfa' },
  badge: { backgroundColor: 'rgba(167, 139, 250, 0.15)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100 },
  badgeText: { fontSize: 10, color: '#a78bfa', fontWeight: '800', letterSpacing: 1.5 },
  subtitle: { color: '#8b89a0', fontSize: 13, fontWeight: '500', marginBottom: 32, textAlign: 'center' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 12, width: '100%', marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  form: { width: '100%', gap: 16 },
  input: { backgroundColor: '#0f0e17', color: '#e8e6f0', fontSize: 16, borderRadius: 16, paddingHorizontal: 20, height: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any) },
  mainButton: { backgroundColor: '#a78bfa', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 15 },
  mainButtonText: { color: '#0f0e17', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  switchContainer: { flexDirection: 'row', marginTop: 32, alignItems: 'center' },
  switchText: { color: '#5a5872', fontSize: 14, fontWeight: '500' },
  switchLink: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },
});