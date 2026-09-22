import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Platform, 
  ActivityIndicator,
  useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { getDatabase, ref, update, get } from 'firebase/database';
import '../../../src/firebase';
import { getAuth } from 'firebase/auth';

interface Slide {
  id: string;
  type: string;
  question: string;
  options: string[];
  limit?: number | 'unlimited'; 
}

export default function StudioScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const sessionId = typeof id === 'string' ? id : id?.[0];
  
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768; 
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [liveIndex, setLiveIndex] = useState(0);
  const [isLive, setIsLive] = useState(false);
  
  // NOVO ESTADO: Para guardar o ID do utilizador atual
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [toast, setToast] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    // CARREGA O UTILIZADOR ATUAL ASSIM QUE ABRIR A TELA
    const auth = getAuth();
    if (auth.currentUser) {
      setCurrentUserId(auth.currentUser.uid);
    }

    const fetchSession = async () => {
      try {
        const db = getDatabase();
        const snapshot = await get(ref(db, `sessions/${sessionId}`));
        const data = snapshot.val();

        if (data && data.interactions && Array.isArray(data.interactions)) {
          setSlides(data.interactions);
          setLiveIndex(data.currentInteraction || 0);
          setIsLive(data.status === 'active');
        } else {
          setSlides([{
            id: `slide_${Date.now()}`,
            type: 'multiple_choice',
            question: '',
            options: ['', ''],
            limit: 3
          }]);
        }
      } catch (err) {
        showToast("Erro ao carregar dados da sessão.");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  const addNewSlide = () => {
    if (slides.length >= 15) return showToast("Limite máximo de 15 slides atingido.");
    const newSlide: Slide = {
      id: `slide_${Date.now()}`,
      type: 'multiple_choice',
      question: '',
      options: ['', ''],
      limit: 3
    };
    setSlides([...slides, newSlide]);
    setActiveIndex(slides.length); 
  };

  const removeSlide = (indexToRemove: number) => {
    if (slides.length === 1) return showToast("A sessão precisa de ter pelo menos um slide.");
    const newSlides = slides.filter((_, index) => index !== indexToRemove);
    setSlides(newSlides);
    if (activeIndex >= newSlides.length) setActiveIndex(newSlides.length - 1);
  };

  const updateCurrentSlide = (field: keyof Slide, value: any) => {
    const updatedSlides = [...slides];
    updatedSlides[activeIndex] = { ...updatedSlides[activeIndex], [field]: value };
    setSlides(updatedSlides);
  };

  const addOption = () => {
    if (slides[activeIndex].options.length < 6) {
      updateCurrentSlide('options', [...slides[activeIndex].options, '']);
    }
  };

  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  const handleSaveOnly = async () => {
    const emptySlideIndex = slides.findIndex(s => s.question.trim() === '');
    if (emptySlideIndex !== -1) {
      setActiveIndex(emptySlideIndex);
      return showToast(`O Slide ${emptySlideIndex + 1} está sem pergunta.`);
    }

    if (!currentUserId) {
        return showToast("Erro: Usuário não identificado.", "error");
    }

    setIsSaving(true);
    try {
      const db = getDatabase();
      const cleanSlides = slides.map(slide => ({
        ...slide,
        options: slide.type === 'multiple_choice' ? slide.options.filter(opt => opt.trim() !== '') : [],
        limit: slide.type === 'word_cloud' ? (slide.limit || 3) : 1
      }));

      // AQUI É A CORREÇÃO: Enviamos o userId junto com os outros dados da sessão
      await update(ref(db, `sessions/${sessionId}`), {
        interactions: cleanSlides,
        status: isLive ? 'active' : 'draft',
        updatedAt: Date.now(),
        userId: currentUserId 
      });

      showToast("Apresentação salva com sucesso! ✓", 'success');
    } catch (error) {
      showToast("Erro ao salvar. Verifique sua conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndPresent = async () => {
    if (isMobile) return; 

    const emptySlideIndex = slides.findIndex(s => s.question.trim() === '');
    if (emptySlideIndex !== -1) {
      setActiveIndex(emptySlideIndex);
      return showToast(`O Slide ${emptySlideIndex + 1} está sem pergunta.`);
    }

    if (!currentUserId) {
        return showToast("Erro: Usuário não identificado.", "error");
    }

    setIsSaving(true);
    try {
      const db = getDatabase();
      const cleanSlides = slides.map(slide => ({
        ...slide,
        options: slide.type === 'multiple_choice' ? slide.options.filter(opt => opt.trim() !== '') : [],
        limit: slide.type === 'word_cloud' ? (slide.limit || 3) : 1
      }));

      // AQUI É A CORREÇÃO: Enviamos o userId aqui também
      await update(ref(db, `sessions/${sessionId}`), {
        interactions: cleanSlides,
        currentInteraction: isLive ? liveIndex : 0,
        status: 'active',
        updatedAt: Date.now(),
        userId: currentUserId
      });

      setIsSaving(false);
      router.push(`/session/${sessionId}/live-control` as any);
      
    } catch (error) {
      showToast("Erro ao salvar. Verifique sua conexão.");
      setIsSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.loadingRoot}>
      <ActivityIndicator size="large" color="#a78bfa" />
      <Text style={{color: '#8b89a0', marginTop: 16}}>Sincronizando estúdio...</Text>
    </View>
  );

  const activeSlide = slides[activeIndex];

  const renderSlideList = () => (
    <ScrollView 
      horizontal={isMobile} 
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={isMobile ? styles.mobileSlideList : styles.desktopSlideList}
    >
      {slides.map((slide, index) => (
        <TouchableOpacity 
          key={slide.id} 
          style={[
            styles.slideThumbnail, 
            isMobile && styles.slideThumbnailMobile, 
            activeIndex === index && styles.slideThumbnailActive
          ]} 
          onPress={() => setActiveIndex(index)} 
          activeOpacity={0.7}
        >
          <View style={styles.slideHeader}>
            <Text style={[styles.slideNumber, activeIndex === index && styles.slideNumberActive]}>Slide {index + 1}</Text>
            {slides.length > 1 && (
              <TouchableOpacity onPress={() => removeSlide(index)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.slidePreview}>
            <Ionicons name={slide.type === 'multiple_choice' ? 'bar-chart' : slide.type === 'word_cloud' ? 'cloud' : 'chatbubbles'} size={20} color={activeIndex === index ? '#a78bfa' : '#5a5872'} />
            <Text style={styles.slidePreviewText} numberOfLines={isMobile ? 1 : 2}>
              {slide.question || "Digite sua pergunta..."}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity 
        style={[styles.addSlideButton, isMobile && styles.addSlideButtonMobile]} 
        onPress={addNewSlide} 
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={20} color="#a78bfa" />
        {!isMobile && <Text style={styles.addSlideText}>Novo Slide</Text>}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {toast && (
        <View style={[styles.toastContainer, { borderColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(52, 211, 153, 0.3)' }, isMobile && { top: 20 }]}>
          <View style={[styles.toastIconBox, { backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)' }]}>
            <Ionicons name={toast.type === 'error' ? "warning" : "checkmark-circle"} size={20} color={toast.type === 'error' ? "#ef4444" : "#34d399"} />
          </View>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      <View style={[styles.topBar, isMobile && styles.topBarMobile]}>
        <View style={styles.topLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#e8e6f0" />
          </TouchableOpacity>
          {!isMobile && <Text style={styles.headerTitle}>Interactio <Text style={styles.highlightText}>Studio</Text></Text>}
          <View style={styles.sessionCodeBadge}>
            <Text style={styles.sessionCodeLabel}>SESSÃO:</Text>
            <Text style={styles.sessionCodeText}>{sessionId}</Text>
          </View>
        </View>

        <View style={[styles.actionButtonsGroup, isMobile && { gap: 8 }]}>
          <TouchableOpacity 
            style={[styles.saveButton, isMobile && { paddingHorizontal: 16, backgroundColor: '#c4b5fd', borderColor: '#c4b5fd' }]} 
            onPress={handleSaveOnly} 
            disabled={isSaving} 
            activeOpacity={0.7}
          >
            <Ionicons name="save-outline" size={18} color={isMobile ? "#0f0e17" : "#e8e6f0"} />
            <Text style={[styles.saveButtonText, isMobile && { color: '#0f0e17', fontWeight: '800', marginLeft: 8 }]}>
              Salvar
            </Text>
          </TouchableOpacity>

          {!isMobile && (
            <TouchableOpacity style={styles.presentButton} onPress={handleSaveAndPresent} disabled={isSaving} activeOpacity={0.8}>
              {isSaving ? <ActivityIndicator color="#0f0e17" /> : (
                <>
                  <Ionicons name={isLive ? "refresh" : "play"} size={18} color="#0f0e17" />
                  <Text style={styles.presentButtonText}>
                    {isLive ? "Atualizar e Voltar" : "Salvar e Apresentar"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.workspace, { flexDirection: isMobile ? 'column' : 'row' }]}>
        
        <View style={[styles.sidebar, isMobile && styles.sidebarMobile]}>
          {renderSlideList()}
        </View>

        <View style={styles.editorArea}>
          <View style={[styles.bgGlow, { top: -100, left: -50, backgroundColor: 'rgba(167, 139, 250, 0.15)' }]} />
          <View style={[styles.bgGlow, { bottom: -100, right: -50, backgroundColor: 'rgba(56, 189, 248, 0.08)' }]} />

          <ScrollView contentContainerStyle={[styles.editorScroll, isMobile && { padding: 20 }]} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, isMobile && { padding: 24, borderRadius: 24 }]}>
              
              <View style={[styles.tabsContainer, isMobile && { flexDirection: 'column', gap: 8 }]}>
                <TouchableOpacity style={[styles.tab, activeSlide.type === 'multiple_choice' && styles.tabActiveMultipleChoice]} onPress={() => updateCurrentSlide('type', 'multiple_choice')} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: activeSlide.type === 'multiple_choice' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="bar-chart" size={16} color={activeSlide.type === 'multiple_choice' ? '#38bdf8' : '#8b89a0'} /></View>
                  <Text style={[styles.tabText, activeSlide.type === 'multiple_choice' && { color: '#e8e6f0' }]}>Múltipla Escolha</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tab, activeSlide.type === 'word_cloud' && styles.tabActiveWordCloud]} onPress={() => updateCurrentSlide('type', 'word_cloud')} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: activeSlide.type === 'word_cloud' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="cloud" size={16} color={activeSlide.type === 'word_cloud' ? '#f472b6' : '#8b89a0'} /></View>
                  <Text style={[styles.tabText, activeSlide.type === 'word_cloud' && { color: '#e8e6f0' }]}>Nuvem de Palavras</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tab, activeSlide.type === 'q_and_a' && styles.tabActiveQA]} onPress={() => updateCurrentSlide('type', 'q_and_a')} activeOpacity={0.7}>
                  <View style={[styles.iconBox, { backgroundColor: activeSlide.type === 'q_and_a' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="chatbubbles" size={16} color={activeSlide.type === 'q_and_a' ? '#34d399' : '#8b89a0'} /></View>
                  <Text style={[styles.tabText, activeSlide.type === 'q_and_a' && { color: '#e8e6f0' }]}>Q&A</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>O QUE VOCÊ QUER PERGUNTAR?</Text>
                <TextInput style={styles.textArea} placeholder="Ex: Como você descreve a cultura da empresa?" placeholderTextColor="#5a5872" multiline value={activeSlide.question} onChangeText={(text) => updateCurrentSlide('question', text)} />
              </View>

              {activeSlide.type === 'multiple_choice' && (
                <View style={styles.section}>
                  <Text style={styles.label}>OPÇÕES DE RESPOSTA</Text>
                  {activeSlide.options.map((opt, index) => (
                    <View key={index} style={styles.optionRow}>
                      <View style={styles.optionLetterBox}><Text style={styles.optionLetterText}>{getOptionLetter(index)}</Text></View>
                      <TextInput style={styles.optionInput} placeholder={`Opção ${getOptionLetter(index)}`} placeholderTextColor="#5a5872" value={opt} onChangeText={(text) => { const updatedOptions = [...activeSlide.options]; updatedOptions[index] = text; updateCurrentSlide('options', updatedOptions); }} />
                    </View>
                  ))}
                  {activeSlide.options.length < 6 && (
                    <TouchableOpacity style={styles.addOptionButton} onPress={addOption} activeOpacity={0.6}>
                      <Ionicons name="add" size={18} color="#a78bfa" />
                      <Text style={styles.addOptionText}>Adicionar opção (Máx. 6)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {activeSlide.type === 'word_cloud' && (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: '#f472b6' }]}>RESPOSTAS POR PARTICIPANTE</Text>
                  <View style={[styles.limitRow, isMobile && { flexWrap: 'wrap' }]}>
                    {[1, 3, 5, 'unlimited'].map((limitValue) => {
                      const currentLimit = activeSlide.limit || 3;
                      const isActive = currentLimit === limitValue;
                      return (
                        <TouchableOpacity key={limitValue.toString()} style={[styles.limitButton, isMobile && { minWidth: '45%' }, isActive && styles.limitButtonActive]} onPress={() => updateCurrentSlide('limit', limitValue)} activeOpacity={0.7}>
                          <Text style={[styles.limitButtonText, isActive && styles.limitButtonTextActive]}>{limitValue === 'unlimited' ? 'Ilimitado' : limitValue}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {activeSlide.type === 'word_cloud' && (
                <View style={[styles.infoBox, { borderColor: 'rgba(244, 114, 182, 0.2)' }, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                  <Ionicons name="information-circle-outline" size={24} color="#f472b6" />
                  <Text style={styles.infoText}>Neste formato, o público envia palavras curtas. Termos repetidos ganharão destaque automático no telão.</Text>
                </View>
              )}
              {activeSlide.type === 'q_and_a' && (
                <View style={[styles.infoBox, { borderColor: 'rgba(52, 211, 153, 0.2)' }, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
                  <Ionicons name="information-circle-outline" size={24} color="#34d399" />
                  <Text style={styles.infoText}>Neste formato, o público envia perguntas abertas e pode votar nas melhores dúvidas dos colegas.</Text>
                </View>
              )}

            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' }, loadingRoot: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' },
  
  topBar: { height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: '#13121d', zIndex: 10 }, 
  topBarMobile: { paddingHorizontal: 16 }, 
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 }, 
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }, 
  headerTitle: { color: '#e8e6f0', fontSize: 20, fontWeight: '800' }, highlightText: { color: '#a78bfa' }, 
  sessionCodeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(167, 139, 250, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.2)', marginLeft: 8 }, sessionCodeLabel: { color: '#8b89a0', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }, sessionCodeText: { color: '#a78bfa', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, 
  
  actionButtonsGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 }, 
  saveButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, saveButtonText: { color: '#e8e6f0', fontWeight: '700', fontSize: 15 }, 
  presentButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#a78bfa', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, presentButtonText: { color: '#0f0e17', fontWeight: '800', fontSize: 15 },
  
  workspace: { flex: 1 }, 
  sidebar: { width: 300, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', backgroundColor: '#13121d', zIndex: 5 }, 
  sidebarMobile: { width: '100%', height: 120, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }, 
  
  desktopSlideList: { padding: 24, gap: 16 },
  mobileSlideList: { padding: 16, gap: 12, alignItems: 'center' },

  slideThumbnail: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, 
  slideThumbnailMobile: { width: 160, padding: 12 }, 
  slideThumbnailActive: { borderColor: 'rgba(167, 139, 250, 0.4)', backgroundColor: 'rgba(167, 139, 250, 0.05)' }, 
  slideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, slideNumber: { color: '#8b89a0', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }, slideNumberActive: { color: '#a78bfa' }, slidePreview: { flexDirection: 'row', alignItems: 'center', gap: 12 }, slidePreviewText: { flex: 1, color: '#e8e6f0', fontSize: 13, fontWeight: '600', lineHeight: 18 }, 
  addSlideButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)', borderStyle: 'dashed' }, 
  addSlideButtonMobile: { width: 60, height: 75, padding: 0 }, 
  addSlideText: { color: '#a78bfa', fontWeight: '700' },
  
  editorArea: { flex: 1, backgroundColor: '#0f0e17', position: 'relative', overflow: 'hidden' }, bgGlow: { position: 'absolute', width: 600, height: 600, borderRadius: 300, filter: 'blur(120px)' as any, opacity: 0.8 }, 
  editorScroll: { padding: 40, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }, 
  card: { width: '100%', maxWidth: 800, backgroundColor: 'rgba(26, 25, 36, 0.8)', borderRadius: 32, padding: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 30, backdropFilter: 'blur(20px)' as any },
  
  tabsContainer: { flexDirection: 'row', gap: 12, marginBottom: 40, flexWrap: 'wrap' }, tab: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, tabActiveMultipleChoice: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(56, 189, 248, 0.3)' }, tabActiveWordCloud: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(244, 114, 182, 0.3)' }, tabActiveQA: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(52, 211, 153, 0.3)' }, iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }, tabText: { color: '#8b89a0', fontWeight: '700', fontSize: 14 }, 
  
  section: { marginBottom: 32 }, label: { color: '#a78bfa', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 }, textArea: { backgroundColor: '#0f0e17', color: '#e8e6f0', fontSize: 18, borderRadius: 16, padding: 24, minHeight: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, 
  
  optionRow: { flexDirection: 'row', marginBottom: 12 }, optionLetterBox: { backgroundColor: 'rgba(167, 139, 250, 0.1)', width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.15)' }, optionLetterText: { color: '#a78bfa', fontSize: 18, fontWeight: '800' }, optionInput: { flex: 1, backgroundColor: '#0f0e17', color: '#e8e6f0', height: 56, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, addOptionButton: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)', borderStyle: 'dashed', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, addOptionText: { color: '#a78bfa', fontWeight: '700', fontSize: 15 }, 
  
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 16 }, infoText: { flex: 1, color: '#8b89a0', fontSize: 15, lineHeight: 24 },
  
  limitRow: { flexDirection: 'row', gap: 12 }, limitButton: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center' }, limitButtonActive: { borderColor: 'rgba(244, 114, 182, 0.4)', backgroundColor: 'rgba(244, 114, 182, 0.1)' }, limitButtonText: { color: '#8b89a0', fontWeight: '700', fontSize: 15 }, limitButtonTextActive: { color: '#f472b6', fontWeight: '900' },
  
  toastContainer: { position: 'absolute', top: 40, alignSelf: 'center', backgroundColor: 'rgba(26, 25, 36, 0.95)', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100, borderWidth: 1, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, zIndex: 9999, ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' } as any) }, toastIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, toastText: { color: '#e8e6f0', fontSize: 15, fontWeight: '700' }
});