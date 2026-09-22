import { Stack, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated // Importante para a transição
  ,

  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import '../../src/firebase';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Componente da Animação de Constelação (Network)
// ─────────────────────────────────────────────
function NetworkBackground() {
  const [particles, setParticles] = useState<any[]>([]);
  const requestRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    const initParticles = Array.from({ length: 30 }).map(() => ({
      x: Math.random() * windowWidth,
      y: Math.random() * windowHeight,
      vx: (Math.random() - 0.5) * 0.8, 
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2 + 1,
    }));
    particlesRef.current = initParticles;

    const animate = () => {
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > windowWidth) p.vx *= -1;
        if (p.y < 0 || p.y > windowHeight) p.vy *= -1;
      });
      setParticles([...particlesRef.current]);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const lines = [];
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const p1 = particles[i];
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        const opacity = 1 - dist / 150;
        lines.push(
          <Line
            key={`${i}-${j}`}
            x1={p1.x} y1={p1.y}
            x2={p2.x} y2={p2.y}
            stroke={`rgba(167, 139, 250, ${opacity * 0.3})`}
            strokeWidth={1}
          />
        );
      }
    }
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg height="100%" width="100%">
        {lines}
        {particles.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.radius} fill="#a78bfa" opacity={0.5} />
        ))}
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────
// Tela de Login/Cadastro
// ─────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // NOVO: Estado para a transição
  const [errorMessage, setErrorMessage] = useState('');

  // Animação para a tela de loading (fade in)
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMessage('Preencha os dados de acesso.');
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
      
      // SUCESSO! Ativar transição antes de redirecionar
      setIsNavigating(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300, // Duração do fade in (ms)
        useNativeDriver: true,
      }).start(() => {
        // Redireciona APÓS a tela preta aparecer
        setTimeout(() => {
          router.replace('/dashboard'); 
        }, 500); // Um pequeno delay extra (opcional) para garantir a leitura visual
      });
      
    } catch (error: any) {
      setIsLoading(false); // Só desativa o loading do botão se der erro
      setErrorMessage('Credenciais inválidas ou erro de conexão.');
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <NetworkBackground />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={[styles.container, { padding: isMobile ? 16 : 32 }]}>
          
          <View style={styles.card}>
            <View style={styles.logoContainer}>
              <Text style={styles.title}>
                inter<Text style={styles.highlight}>actio</Text>
              </Text>
              <View style={[styles.modeIndicator, { backgroundColor: isLoginMode ? 'rgba(167, 139, 250, 0.1)' : 'rgba(52, 211, 153, 0.1)' }]}>
                <Text style={[styles.modeText, { color: isLoginMode ? '#a78bfa' : '#34d399' }]}>
                  {isLoginMode ? 'ACESSAR CONTA' : 'NOVO CADASTRO'}
                </Text>
              </View>
            </View>

            <Text style={styles.instructions}>
              {isLoginMode 
                ? 'Bem-vindo de volta! Digite suas credenciais.' 
                : 'Crie sua conta para começar a interagir.'}
            </Text>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#5a5872"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isNavigating} // Desabilita input durante a transição
              />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor="#5a5872"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!isNavigating} // Desabilita input durante a transição
              />

              <TouchableOpacity 
                style={[styles.btnAction, { backgroundColor: isLoginMode ? '#a78bfa' : '#34d399' }]} 
                onPress={handleAuth}
                disabled={isLoading || isNavigating}
              >
                {isLoading && !isNavigating ? <ActivityIndicator color="#0f0e17" /> : (
                  <Text style={styles.btnActionText}>
                    {isLoginMode ? 'Entrar' : 'Finalizar Cadastro'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.toggleMode} 
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setErrorMessage('');
              }}
              disabled={isLoading || isNavigating}
            >
              <Text style={styles.toggleText}>
                {isLoginMode ? 'Não tem uma conta? ' : 'Já possui acesso? '}
                <Text style={[styles.toggleLink, { color: isLoginMode ? '#a78bfa' : '#34d399' }]}>
                  {isLoginMode ? 'Cadastre-se aqui' : 'Faça login'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── TELA DE TRANSIÇÃO (OVERLAY) ── */}
      {isNavigating && (
        <Animated.View style={[styles.transitionOverlay, { opacity: fadeAnim }]}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.transitionText}>A preparar o seu painel...</Text>
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' },
  keyboardView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { width: '100%', maxWidth: 450 },
  card: { backgroundColor: '#1a1924', borderRadius: 32, padding: 40, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 10 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 48, fontWeight: '800', letterSpacing: -1.5, color: '#e8e6f0' },
  highlight: { color: '#a78bfa' },
  modeIndicator: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, marginTop: 12 },
  modeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  instructions: { color: '#8b89a0', fontSize: 14, textAlign: 'center', marginBottom: 30, fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 12, marginBottom: 15, fontWeight: '600' },
  form: { width: '100%', gap: 12 },
  input: { backgroundColor: '#0f0e17', color: '#e8e6f0', borderRadius: 16, paddingHorizontal: 20, height: 56, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  btnAction: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnActionText: { color: '#0f0e17', fontSize: 16, fontWeight: '800' },
  toggleMode: { marginTop: 25 },
  toggleText: { color: '#5a5872', fontSize: 13, fontWeight: '500' },
  toggleLink: { fontWeight: '700' },
  
  // Estilo do Overlay de Transição
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject, // Cobre a tela toda
    backgroundColor: '#0f0e17', // Mesma cor do fundo para parecer que a UI sumiu
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999, // Fica por cima de tudo
  },
  transitionText: {
    color: '#a78bfa',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  }
});