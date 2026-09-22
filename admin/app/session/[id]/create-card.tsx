import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import '../../../src/firebase';

export default function CreateCardScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const sessionId = typeof id === 'string' ? id : id?.[0];
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768;

  const [quickTab, setQuickTab] = useState('multiple_choice');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [limit, setLimit] = useState<number | 'unlimited'>(3);
  const [isLaunching, setIsLaunching] = useState(false);
  
  // Estado para armazenar o ID do utilizador logado
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Busca o utilizador assim que a tela abre
    const auth = getAuth();
    if (auth.currentUser) {
      setCurrentUserId(auth.currentUser.uid);
    }
  }, []);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  const handleLaunch = async () => {
    if (question.trim() === '') return alert("Por favor, digite o que você quer perguntar.");
    if (!currentUserId) return alert("Erro: Usuário não identificado.");

    setIsLaunching(true);
    try {
      const db = getDatabase();
      const sessionIdStr = typeof id === 'string' ? id : id[0];
      
      const newInteraction = {
        id: `slide_${Date.now()}`,
        type: quickTab,
        question: question.trim(),
        options: quickTab === 'multiple_choice' ? options.filter(opt => opt.trim() !== '') : [],
        limit: quickTab === 'word_cloud' ? limit : 'unlimited',
        createdAt: Date.now()
      };

      // Usamos 'set' em vez de 'update' porque é a primeira vez que esta sessão é gravada
      await set(ref(db, `sessions/${sessionIdStr}`), {
        interactions: [newInteraction],
        currentInteraction: 0,
        status: 'active', // Força o status para Ao Vivo no Dashboard
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: currentUserId // Carimba o dono da sessão para não ficar invisível
      });

      setIsLaunching(false);
      // Vai direto para o telão (Live Control)
      router.replace(`/session/${sessionIdStr}/live-control` as any);
      
    } catch (error) {
      alert("Erro ao lançar a interação. Verifique sua conexão.");
      setIsLaunching(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, isMobile && { paddingHorizontal: 16 }]}>
        <View style={styles.topLeft}>
          {/* Botão de voltar alterado para ir direto para o Dashboard como você pediu */}
          <TouchableOpacity onPress={() => router.replace('/dashboard')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#e8e6f0" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image 
              source={require('@/assets/images/favicon.png')} 
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Modo Rápido</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, isMobile && { padding: 24, borderRadius: 24 }]}>
          
          <View style={[styles.tabsContainer, isMobile && { flexDirection: 'column', gap: 8 }]}>
            <TouchableOpacity style={[styles.tab, quickTab === 'multiple_choice' && styles.tabActiveMultipleChoice]} onPress={() => setQuickTab('multiple_choice')} activeOpacity={0.7}>
              <View style={[styles.iconBox, { backgroundColor: quickTab === 'multiple_choice' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="bar-chart" size={16} color={quickTab === 'multiple_choice' ? '#38bdf8' : '#8b89a0'} /></View>
              <Text style={[styles.tabText, quickTab === 'multiple_choice' && { color: '#e8e6f0' }]}>Múltipla Escolha</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tab, quickTab === 'word_cloud' && styles.tabActiveWordCloud]} onPress={() => setQuickTab('word_cloud')} activeOpacity={0.7}>
              <View style={[styles.iconBox, { backgroundColor: quickTab === 'word_cloud' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="cloud" size={16} color={quickTab === 'word_cloud' ? '#f472b6' : '#8b89a0'} /></View>
              <Text style={[styles.tabText, quickTab === 'word_cloud' && { color: '#e8e6f0' }]}>Nuvem de Palavras</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.tab, quickTab === 'qna' && styles.tabActiveQA]} onPress={() => setQuickTab('qna')} activeOpacity={0.7}>
              <View style={[styles.iconBox, { backgroundColor: quickTab === 'qna' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="chatbubbles" size={16} color={quickTab === 'qna' ? '#a78bfa' : '#8b89a0'} /></View>
              <Text style={[styles.tabText, quickTab === 'qna' && { color: '#e8e6f0' }]}>Q&A Livre</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{quickTab === 'qna' ? 'TÓPICO OU INSTRUÇÃO' : 'O QUE VOCÊ QUER PERGUNTAR?'}</Text>
            <TextInput 
              style={styles.textArea} 
              placeholder={quickTab === 'qna' ? "Ex: Mande suas dúvidas sobre o projeto..." : "Digite a sua pergunta surpresa..."} 
              placeholderTextColor="#5a5872" 
              multiline 
              value={question} 
              onChangeText={setQuestion} 
            />
          </View>

          {quickTab === 'multiple_choice' && (
            <View style={styles.section}>
              <Text style={styles.label}>OPÇÕES DE RESPOSTA</Text>
              {options.map((opt, index) => (
                <View key={index} style={styles.optionRow}>
                  <View style={styles.optionLetterBox}><Text style={styles.optionLetterText}>{getOptionLetter(index)}</Text></View>
                  <TextInput 
                    style={styles.optionInput} 
                    placeholder={`Opção ${getOptionLetter(index)}`} 
                    placeholderTextColor="#5a5872" 
                    value={opt} 
                    onChangeText={(text) => { const updatedOptions = [...options]; updatedOptions[index] = text; setOptions(updatedOptions); }} 
                  />
                </View>
              ))}
              {options.length < 6 && (
                <TouchableOpacity style={styles.addOptionButton} onPress={addOption} activeOpacity={0.6}>
                  <Ionicons name="add" size={18} color="#a78bfa" />
                  <Text style={styles.addOptionText}>Adicionar opção (Máx. 6)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {quickTab === 'word_cloud' && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: '#f472b6' }]}>RESPOSTAS POR PARTICIPANTE</Text>
              <View style={[styles.limitRow, isMobile && { flexWrap: 'wrap' }]}>
                {[1, 3, 5, 'unlimited'].map((limitValue) => {
                  const isActive = limit === limitValue;
                  return (
                    <TouchableOpacity key={limitValue.toString()} style={[styles.limitButton, isMobile && { minWidth: '45%' }, isActive && styles.limitButtonActive]} onPress={() => setLimit(limitValue as any)} activeOpacity={0.7}>
                      <Text style={[styles.limitButtonText, isActive && styles.limitButtonTextActive]}>{limitValue === 'unlimited' ? 'Ilimitado' : limitValue}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity 
            style={[
              styles.launchButton, 
              quickTab === 'multiple_choice' && { backgroundColor: '#38bdf8', shadowColor: '#38bdf8' },
              quickTab === 'word_cloud' && { backgroundColor: '#f472b6', shadowColor: '#f472b6' },
              quickTab === 'qna' && { backgroundColor: '#a78bfa', shadowColor: '#a78bfa' }
            ]} 
            onPress={handleLaunch} 
            disabled={isLaunching} 
            activeOpacity={0.8}
          >
            {isLaunching ? <ActivityIndicator color="#0f0e17" /> : (
              <View style={styles.launchButtonInner}>
                <Ionicons name="flash" size={20} color="#0f0e17" />
                <Text style={styles.launchButtonText}>Lançar no Telão Instantaneamente</Text>
              </View>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' },
  topBar: { height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: '#13121d', zIndex: 10 }, 
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 }, 
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }, 
  headerTitle: { color: '#e8e6f0', fontSize: 18, fontWeight: '800' },
  
  scrollArea: { padding: 40, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }, 
  card: { width: '100%', maxWidth: 800, backgroundColor: 'rgba(26, 25, 36, 0.8)', borderRadius: 32, padding: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, backdropFilter: 'blur(20px)' as any },
  
  tabsContainer: { flexDirection: 'row', gap: 12, marginBottom: 40, flexWrap: 'wrap' }, 
  tab: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, 
  tabActiveMultipleChoice: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(56, 189, 248, 0.3)' }, 
  tabActiveWordCloud: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(244, 114, 182, 0.3)' }, 
  tabActiveQA: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(167, 139, 250, 0.3)' }, 
  iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }, 
  tabText: { color: '#8b89a0', fontWeight: '700', fontSize: 14 }, 
  
  section: { marginBottom: 32 }, 
  label: { color: '#a78bfa', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 }, 
  textArea: { backgroundColor: '#0f0e17', color: '#e8e6f0', fontSize: 18, borderRadius: 16, padding: 24, minHeight: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, 
  
  optionRow: { flexDirection: 'row', marginBottom: 12 }, 
  optionLetterBox: { backgroundColor: 'rgba(56, 189, 248, 0.1)', width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.15)' }, 
  optionLetterText: { color: '#38bdf8', fontSize: 18, fontWeight: '800' }, 
  optionInput: { flex: 1, backgroundColor: '#0f0e17', color: '#e8e6f0', height: 56, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, 
  addOptionButton: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', borderStyle: 'dashed', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, 
  addOptionText: { color: '#38bdf8', fontWeight: '700', fontSize: 15 }, 
  
  limitRow: { flexDirection: 'row', gap: 12 }, 
  limitButton: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center' }, 
  limitButtonActive: { borderColor: 'rgba(244, 114, 182, 0.4)', backgroundColor: 'rgba(244, 114, 182, 0.1)' }, 
  limitButtonText: { color: '#8b89a0', fontWeight: '700', fontSize: 15 }, 
  limitButtonTextActive: { color: '#f472b6', fontWeight: '900' },

  launchButton: { paddingVertical: 20, borderRadius: 16, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 15, marginTop: 16 }, 
  launchButtonInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, 
  launchButtonText: { color: '#0f0e17', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }
});