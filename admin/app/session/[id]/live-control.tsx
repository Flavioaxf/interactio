import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Dimensions, 
  Animated, 
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Image
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import '../../../src/firebase'; 

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const CLOUD_COLORS = ['#f472b6', '#38bdf8', '#34d399', '#a78bfa', '#fbbf24', '#f87171'];

// ── COMPONENTE DA PALAVRA ──
function AnimatedCloudWord({ data, maxCount }: any) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 50,
      useNativeDriver: false
    }).start();
  }, []);

  return (
    <Animated.Text 
      style={[
        styles.cloudWord, 
        { 
          position: 'absolute',
          fontSize: data.fontSize, 
          lineHeight: data.fontSize * 1.1,
          color: data.color,
          transform: [
            { translateX: data.x },
            { translateY: data.y },
            { scale: scaleAnim },
            { rotate: data.isVertical ? '-90deg' : '0deg' }
          ],
          textShadowColor: data.count === maxCount ? data.color : 'transparent',
        },
        Platform.OS === 'web' && { transition: 'transform 0.5s ease-out, font-size 0.5s ease' } as any
      ]}
    >
      {data.text.toLowerCase()}
    </Animated.Text>
  );
}

function NetworkBackground() {
  const [particles, setParticles] = useState<any[]>([]);
  const requestRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    const initParticles = Array.from({ length: 40 }).map(() => ({
      x: Math.random() * windowWidth,
      y: Math.random() * windowHeight,
      vx: (Math.random() - 0.5) * 0.4, 
      vy: (Math.random() - 0.5) * 0.4,
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

      if (dist < 180) {
        const opacity = (1 - dist / 180) * 0.15; 
        lines.push(<Line key={`${i}-${j}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={`rgba(167, 139, 250, ${opacity})`} strokeWidth={1} />);
      }
    }
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[styles.bgGlow, { top: -200, left: -200, backgroundColor: 'rgba(167, 139, 250, 0.1)' }]} />
      <View style={[styles.bgGlow, { bottom: -200, right: -200, backgroundColor: 'rgba(56, 189, 248, 0.05)' }]} />
      <Svg height="100%" width="100%">
        {lines}
        {particles.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={p.radius} fill="#a78bfa" opacity={0.2} />)}
      </Svg>
    </View>
  );
}

export default function LiveControlScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter(); 
  const sessionId = typeof id === 'string' ? id.toUpperCase() : '';
  
  const PARTICIPANT_BASE_URL = "https://interactio-web.vercel.app";
  
  const joinUrl = `${PARTICIPANT_BASE_URL}/p/${sessionId}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(joinUrl)}&margin=0`;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [votes, setVotes] = useState<{ [key: string]: number }>({});
  
  const [qnaQuestions, setQnaQuestions] = useState<{id: string, text: string}[]>([]);
  
  // 👉 ESTADOS DOS NÚMEROS AQUI
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [totalVotesCount, setTotalVotesCount] = useState(0); // ADICIONADO!
  
  const [showQR, setShowQR] = useState(false);

  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickTab, setQuickTab] = useState('multiple_choice');
  const [quickQuestion, setQuickQuestion] = useState('');
  const [quickOptions, setQuickOptions] = useState(['', '']);
  const [quickLimit, setQuickLimit] = useState<number | 'unlimited'>(3);
  const [isLaunching, setIsLaunching] = useState(false);

  const [cloudLayout, setCloudLayout] = useState<any[]>([]);
  const [cloudScale, setCloudScale] = useState(1); 

  useEffect(() => {
    if (!sessionId) return;
    const db = getDatabase();
    const sessionRef = ref(db, `sessions/${sessionId}`);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSessionData(data);
        const currentIndex = typeof data.currentInteraction === 'number' ? data.currentInteraction : 0;
        const currentInteraction = data.interactions?.[currentIndex];
        
        const isWordCloud = currentInteraction?.type === 'word_cloud';
        const isQnA = currentInteraction?.type === 'qna' || currentInteraction?.type === 'q_and_a'; 
        
        const responses = data.responses ? data.responses[currentIndex] : {};
        const counts: { [key: string]: number } = {};
        const questionsList: {id: string, text: string}[] = [];
        
        // 1. VARIÁVEL PARA O CABEÇALHO (Pessoas Online)
        const onlineCount = data.participants ? Object.keys(data.participants).length : 0;
        
        // 2. VARIÁVEL PARA A PORCENTAGEM (Total de Votos)
        let totalVotes = 0; 
        
        if (responses) {
          Object.entries(responses).forEach(([partId, val]: [string, any]) => { 
            totalVotes++; // Contagem de votos aqui
            
            if (isWordCloud && Array.isArray(val)) {
              val.forEach(word => { counts[word] = (counts[word] || 0) + 1; });
            } else if (isQnA && Array.isArray(val)) {
              val.forEach((qText, qIdx) => { 
                questionsList.push({ id: `${partId}_${qIdx}`, text: qText }); 
              });
            } else if (!isWordCloud && !isQnA) {
              counts[val] = (counts[val] || 0) + 1; 
            }
          });
        }
        
        setVotes(counts);
        setQnaQuestions(questionsList.reverse()); 
        setTotalParticipants(onlineCount); 
        setTotalVotesCount(totalVotes); // AGORA NÃO VAI DAR ERRO!
      } else {
        setErrorMessage("Sessão não encontrada.");
      }
      setLoading(false);
    }, (error) => {
      setErrorMessage(`Erro de conexão: ${error.message}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [sessionId]);

  const currentIndex = typeof sessionData?.currentInteraction === 'number' ? sessionData.currentInteraction : 0;
  const currentInteraction = sessionData?.interactions?.[currentIndex];
  const totalSlides = sessionData?.interactions?.length || 1;

  useEffect(() => {
    if (currentInteraction?.type !== 'word_cloud') return;

    const sortedWords = Object.entries(votes)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count);

    if (sortedWords.length === 0) {
      setCloudLayout([]);
      setCloudScale(1);
      return;
    }

    const maxCount = sortedWords[0].count;
    const minFont = 24;
    const maxFont = 110; 
    
    const placed: any[] = [];
    let minLeft = 0; let maxRight = 0; let minTop = 0; let maxBottom = 0;

    sortedWords.forEach((wordObj, index) => {
      const fontSize = maxCount === 1 
        ? 50 
        : minFont + ((wordObj.count - 1) / (maxCount - 1)) * (maxFont - minFont);

      const isVertical = (index % 3 === 0) && index !== 0 && fontSize < 70; 
      
      const charWidth = fontSize * 0.55; 
      const wordWidth = wordObj.text.length * charWidth;
      const wordHeight = fontSize * 1.1;

      const w = isVertical ? wordHeight : wordWidth;
      const h = isVertical ? wordWidth : wordHeight;

      let angle = index * 137.5; 
      let radius = 0;
      let hasPlaced = false;
      const step = 4; 

      while (!hasPlaced && radius < 1500) { 
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle) * 0.6; 

        const pad = 6; 
        const bounds = {
          left: x - w / 2 - pad, right: x + w / 2 + pad,
          top: y - h / 2 - pad, bottom: y + h / 2 + pad
        };

        const collision = placed.some(p => {
          return !(bounds.left >= p.bounds.right || bounds.right <= p.bounds.left || 
                   bounds.top >= p.bounds.bottom || bounds.bottom <= p.bounds.top);
        });

        if (!collision) {
          placed.push({ ...wordObj, x, y, fontSize, isVertical, bounds, color: CLOUD_COLORS[index % CLOUD_COLORS.length] });
          hasPlaced = true;
          if (bounds.left < minLeft) minLeft = bounds.left;
          if (bounds.right > maxRight) maxRight = bounds.right;
          if (bounds.top < minTop) minTop = bounds.top;
          if (bounds.bottom > maxBottom) maxBottom = bounds.bottom;
        } else {
          angle += 0.5;
          radius += step;
        }
      }
    });

    const cloudTotalWidth = Math.max(maxRight - minLeft, 100);
    const cloudTotalHeight = Math.max(maxBottom - minTop, 100);
    const safeAreaWidth = windowWidth * 0.85; 
    const safeAreaHeight = windowHeight * 0.50; 

    let newScale = 1;
    if (cloudTotalWidth > safeAreaWidth || cloudTotalHeight > safeAreaHeight) {
      newScale = Math.min(safeAreaWidth / cloudTotalWidth, safeAreaHeight / cloudTotalHeight) * 0.95;
    }

    setCloudScale(newScale);
    setCloudLayout(placed);
  }, [votes, currentInteraction]);

  const changeSlide = async (direction: 'next' | 'prev') => {
    if (!sessionData || !sessionData.interactions) return;
    let newIndex = currentIndex;
    if (direction === 'next' && currentIndex < totalSlides - 1) newIndex = currentIndex + 1;
    else if (direction === 'prev' && currentIndex > 0) newIndex = currentIndex - 1;
    else return;

    const db = getDatabase();
    await update(ref(db, `sessions/${sessionId}`), { currentInteraction: newIndex });
  };

  const addQuickOption = () => { if (quickOptions.length < 6) setQuickOptions([...quickOptions, '']); };
  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  const handleLaunchQuickInteraction = async () => {
    if (quickQuestion.trim() === '') return alert("Por favor, digite uma instrução ou tópico.");
    setIsLaunching(true);
    try {
      const db = getDatabase();
      const newInteraction = {
        id: `slide_${Date.now()}`,
        type: quickTab,
        question: quickQuestion.trim(),
        options: quickTab === 'multiple_choice' ? quickOptions.filter(opt => opt.trim() !== '') : [],
        limit: quickTab === 'word_cloud' ? quickLimit : 'unlimited', 
        createdAt: Date.now()
      };

      const currentInteractions = sessionData?.interactions || [];
      const newInteractions = [...currentInteractions, newInteraction];

      await update(ref(db, `sessions/${sessionId}`), {
        interactions: newInteractions,
        currentInteraction: newInteractions.length - 1,
        updatedAt: Date.now()
      });

      setIsQuickCreateOpen(false);
      setQuickQuestion('');
      setQuickOptions(['', '']);
      setIsLaunching(false);
    } catch (error) {
      alert("Erro ao lançar a interação.");
      setIsLaunching(false);
    }
  };

  const handleEndSession = async () => {
    try {
      const db = getDatabase();
      await update(ref(db, `sessions/${sessionId}`), {
        status: 'finished', 
        finishedAt: Date.now()
      });
      setIsEndSessionModalOpen(false);
      router.replace('/dashboard'); 
    } catch (error) {
      alert("Erro ao encerrar a sessão.");
    }
  };

  if (loading || errorMessage) return <LoadingOrError loading={loading} errorMessage={errorMessage} router={router} />;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <NetworkBackground />

      <View style={styles.topBar}>
        <View style={styles.topLeftGroup}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/dashboard')} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#e8e6f0" />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Image 
              source={require('@/assets/images/favicon.png')} 
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>inter<Text style={styles.highlightText}>actio</Text></Text>
          </View>
        </View>
        
        <View style={styles.pinCard}>
          <Text style={styles.joinLabel}>Acesse o link do túnel com o PIN:</Text>
          <View style={styles.pinBadge}>
            <Text style={styles.pinText}>{sessionId}</Text>
          </View>
          <TouchableOpacity style={styles.qrTriggerButton} onPress={() => setShowQR(true)} activeOpacity={0.8}>
            <Ionicons name="qr-code" size={20} color="#0f0e17" />
          </TouchableOpacity>
        </View>

        <View style={styles.topRightGroup}>
          <View style={styles.statsCard}>
            <View style={styles.statsIconBox}>
              <Ionicons name="people" size={24} color="#a78bfa" />
            </View>
            <View>
              <Text style={styles.statsLabel}>PARTICIPANTES</Text>
              <Text style={styles.statsText}>{totalParticipants}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.endSessionBtn} onPress={() => setIsEndSessionModalOpen(true)} activeOpacity={0.8}>
            <Ionicons name="power" size={20} color="#ef4444" />
            <Text style={styles.endSessionText}>Encerrar Sessão</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mainContainer}>
        <Text style={styles.questionTitle}>
          {currentInteraction?.question || "Aguardando próxima pergunta..."}
        </Text>
        
        <View style={styles.interactionArea}>
          {currentInteraction?.type === 'multiple_choice' && (
            <ScrollView style={{width: '100%'}} contentContainerStyle={{alignItems: 'center'}}>
              <View style={styles.barsContainer}>
                {Array.isArray(currentInteraction?.options) && currentInteraction.options.map((option: string, index: number) => {
                  const count = votes[index] || 0;
                  
                  // 👉 AQUI A MATEMÁTICA FOI ATUALIZADA
                  const percentage = totalVotesCount > 0 ? (count / totalVotesCount) : 0;
                  
                  return (
                    <View key={index} style={styles.barWrapper}>
                      <View style={styles.barLabelGroup}>
                        <Text style={styles.barOptionText}>{option}</Text>
                        <Text style={styles.barCountText}>{count} <Text style={styles.barPercentText}>({(percentage * 100).toFixed(0)}%)</Text></Text>
                      </View>
                      <View style={styles.barTrack}>
                        <AnimatedBar percentage={percentage} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {currentInteraction?.type === 'word_cloud' && (
            <View style={styles.cloudWrapper}>
              {cloudLayout.length === 0 ? (
                <View style={styles.waitingCloud}>
                  <Ionicons name="cloud-outline" size={80} color="rgba(244, 114, 182, 0.2)" />
                  <Text style={styles.waitingCloudText}>Aguardando as primeiras palavras...</Text>
                </View>
              ) : (
                <View style={[styles.cloudCanvas, { transform: [{ scale: cloudScale }] }]}>
                  {cloudLayout.map((cw) => (
                    <AnimatedCloudWord 
                      key={cw.text} 
                      data={cw} 
                      maxCount={cloudLayout.length > 0 ? Math.max(...cloudLayout.map(w => w.count)) : 1}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
          
          {(currentInteraction?.type === 'qna' || currentInteraction?.type === 'q_and_a') && (
            <View style={styles.qnaWrapper}>
              {qnaQuestions.length === 0 ? (
                <View style={styles.waitingCloud}>
                  <Ionicons name="chatbubbles-outline" size={80} color="rgba(56, 189, 248, 0.2)" />
                  <Text style={styles.waitingCloudText}>Aguardando respostas da audiência...</Text>
                </View>
              ) : (
                <ScrollView style={{width: '100%'}} contentContainerStyle={styles.qnaScrollContent}>
                  <View style={styles.qnaGrid}>
                    {qnaQuestions.map((item) => (
                      <View key={item.id} style={styles.qnaCard}>
                        <View style={styles.qnaIconWrapper}>
                          <Ionicons name="person" size={24} color="#38bdf8" />
                        </View>
                        <Text style={styles.qnaCardText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Interactio OS • Transmissão ao Vivo</Text>
      </View>

      <View style={styles.slideControls}>
        <TouchableOpacity style={[styles.controlButton, currentIndex === 0 && styles.controlButtonDisabled]} onPress={() => changeSlide('prev')} disabled={currentIndex === 0}>
          <Ionicons name="chevron-back" size={28} color={currentIndex === 0 ? '#5a5872' : '#e8e6f0'} />
        </TouchableOpacity>
        
        <View style={styles.slideIndicator}>
          <Text style={styles.slideIndicatorText}>Slide {currentIndex + 1} de {totalSlides}</Text>
        </View>
        
        <TouchableOpacity style={[styles.controlButton, currentIndex === totalSlides - 1 && styles.controlButtonDisabled]} onPress={() => changeSlide('next')} disabled={currentIndex === totalSlides - 1}>
          <Ionicons name="chevron-forward" size={28} color={currentIndex === totalSlides - 1 ? '#5a5872' : '#e8e6f0'} />
        </TouchableOpacity>

        <View style={styles.controlDivider} />

        <TouchableOpacity style={styles.quickAddButton} onPress={() => setIsQuickCreateOpen(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#0f0e17" />
          <Text style={styles.quickAddButtonText}>Nova Interação</Text>
        </TouchableOpacity>
      </View>

      {isEndSessionModalOpen && (
        <View style={styles.endModalOverlay}>
          <View style={styles.endModalCard}>
            <View style={styles.endModalIconBox}>
              <Ionicons name="power" size={40} color="#ef4444" />
            </View>
            <Text style={styles.endModalTitle}>Encerrar Sessão?</Text>
            <Text style={styles.endModalDesc}>A sessão ficará fechada para novas respostas e os dados ficarão salvos para análise posterior.</Text>
            <View style={styles.endModalButtonsRow}>
              <TouchableOpacity style={styles.endModalCancelBtn} onPress={() => setIsEndSessionModalOpen(false)} activeOpacity={0.7}>
                <Text style={styles.endModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.endModalConfirmBtn} onPress={handleEndSession} activeOpacity={0.8}>
                <Text style={styles.endModalConfirmText}>Sim, Encerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isQuickCreateOpen && (
        <View style={styles.quickCreateOverlay}>
          <ScrollView contentContainerStyle={styles.quickCreateScroll}>
            <View style={styles.quickCreateCard}>
              <View style={styles.quickCreateHeader}>
                <Text style={styles.quickCreateTitle}>Lançar nova interação</Text>
                <TouchableOpacity onPress={() => setIsQuickCreateOpen(false)} style={styles.quickCreateCloseBtn}>
                  <Ionicons name="close" size={24} color="#8b89a0" />
                </TouchableOpacity>
              </View>
              <View style={styles.qcTabsContainer}>
                <TouchableOpacity style={[styles.qcTab, quickTab === 'multiple_choice' && styles.qcTabActiveMultipleChoice]} onPress={() => setQuickTab('multiple_choice')} activeOpacity={0.7}>
                  <View style={[styles.qcIconBox, { backgroundColor: quickTab === 'multiple_choice' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="bar-chart" size={16} color={quickTab === 'multiple_choice' ? '#38bdf8' : '#8b89a0'} /></View>
                  <Text style={[styles.qcTabText, quickTab === 'multiple_choice' && { color: '#e8e6f0' }]}>Múltipla Escolha</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.qcTab, quickTab === 'word_cloud' && styles.qcTabActiveWordCloud]} onPress={() => setQuickTab('word_cloud')} activeOpacity={0.7}>
                  <View style={[styles.qcIconBox, { backgroundColor: quickTab === 'word_cloud' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="cloud" size={16} color={quickTab === 'word_cloud' ? '#f472b6' : '#8b89a0'} /></View>
                  <Text style={[styles.qcTabText, quickTab === 'word_cloud' && { color: '#e8e6f0' }]}>Nuvem</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.qcTab, quickTab === 'qna' && styles.qcTabActiveQna]} onPress={() => setQuickTab('qna')} activeOpacity={0.7}>
                  <View style={[styles.qcIconBox, { backgroundColor: quickTab === 'qna' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.05)' }]}><Ionicons name="chatbubbles" size={16} color={quickTab === 'qna' ? '#a78bfa' : '#8b89a0'} /></View>
                  <Text style={[styles.qcTabText, quickTab === 'qna' && { color: '#e8e6f0' }]}>Resposta Livre</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.qcSection}>
                <Text style={styles.qcLabel}>{quickTab === 'qna' ? 'TÓPICO OU INSTRUÇÃO' : 'O QUE VOCÊ QUER PERGUNTAR AGORA?'}</Text>
                <TextInput style={styles.qcTextArea} placeholder={quickTab === 'qna' ? "Ex: Mande suas dúvidas sobre o projeto..." : "Digite a sua pergunta surpresa..."} placeholderTextColor="#5a5872" multiline value={quickQuestion} onChangeText={setQuickQuestion} />
              </View>
              
              {quickTab === 'multiple_choice' && (
                <View style={styles.qcSection}>
                  <Text style={styles.qcLabel}>OPÇÕES DE RESPOSTA</Text>
                  {quickOptions.map((opt, index) => (
                    <View key={index} style={styles.qcOptionRow}>
                      <View style={styles.qcOptionLetterBox}><Text style={styles.qcOptionLetterText}>{getOptionLetter(index)}</Text></View>
                      <TextInput style={styles.qcOptionInput} placeholder={`Opção ${getOptionLetter(index)}`} placeholderTextColor="#5a5872" value={opt} onChangeText={(text) => { const newOpts = [...quickOptions]; newOpts[index] = text; setQuickOptions(newOpts); }} />
                    </View>
                  ))}
                  {quickOptions.length < 6 && (
                    <TouchableOpacity style={styles.qcAddOptionButton} onPress={addQuickOption} activeOpacity={0.6}>
                      <Ionicons name="add" size={18} color="#a78bfa" />
                      <Text style={styles.qcAddOptionText}>Adicionar opção (Máx. 6)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {quickTab === 'word_cloud' && (
                <View style={styles.qcSection}>
                  <Text style={[styles.qcLabel, { color: '#f472b6' }]}>RESPOSTAS POR PARTICIPANTE</Text>
                  <View style={styles.qcLimitRow}>
                    {[1, 3, 5, 'unlimited'].map((limitValue) => (
                      <TouchableOpacity key={limitValue.toString()} style={[styles.qcLimitButton, quickLimit === limitValue && styles.qcLimitButtonActive]} onPress={() => setQuickLimit(limitValue as any)} activeOpacity={0.7}>
                        <Text style={[styles.qcLimitButtonText, quickLimit === limitValue && styles.qcLimitButtonTextActive]}>{limitValue === 'unlimited' ? 'Ilimitado' : limitValue}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={[styles.qcLaunchButton, quickTab === 'qna' && { backgroundColor: '#a78bfa', shadowColor: '#a78bfa' }]} 
                onPress={handleLaunchQuickInteraction} 
                disabled={isLaunching} 
                activeOpacity={0.8}
              >
                {isLaunching ? <ActivityIndicator color="#0f0e17" /> : (
                  <View style={styles.qcLaunchButtonInner}>
                    <Ionicons name="flash" size={20} color="#0f0e17" />
                    <Text style={styles.qcLaunchButtonText}>Lançar no Telão Instantaneamente</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── MODAL DO QR CODE REAL ── */}
      {showQR && (
        <TouchableOpacity style={styles.qrOverlay} activeOpacity={1} onPress={() => setShowQR(false)}>
          <View style={styles.qrModalCard}>
            <View style={styles.qrModalInnerBorder}>
              {/* Imagem gerada dinamicamente via API externa, sem precisar instalar npm! */}
              <Image 
                source={{ uri: qrCodeImageUrl }} 
                style={{ width: 320, height: 320, borderRadius: 16 }} 
              />
            </View>
            <Text style={styles.qrModalDesc}>Aponte a câmera do seu celular</Text>
            <Text style={styles.qrModalHint}>Toque em qualquer lugar para fechar</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AnimatedBar({ percentage }: { percentage: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, { toValue: percentage * 100, useNativeDriver: false, friction: 7, tension: 40 }).start();
  }, [percentage]);

  return <Animated.View style={[styles.barFill, { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />;
}

function LoadingOrError({ loading, errorMessage, router }: { loading: boolean, errorMessage: string, router: any }) {
  return (
    <View style={styles.loadingRoot}>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => router.replace('/dashboard')}>
        <Ionicons name="arrow-back" size={24} color="#e8e6f0" />
      </TouchableOpacity>
      {loading ? (
        <><ActivityIndicator size="large" color="#a78bfa" /><Text style={styles.loadingText}>Preparando o palco...</Text></>
      ) : (
        <><Ionicons name="warning-outline" size={64} color="#ef4444" /><Text style={[styles.loadingText, { color: '#ef4444', marginTop: 16 }]}>{errorMessage}</Text></>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' }, bgGlow: { position: 'absolute', width: 600, height: 600, borderRadius: 300, filter: 'blur(100px)' as any }, loadingRoot: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' }, loadingText: { color: '#8b89a0', marginTop: 24, fontSize: 20, fontWeight: '600' }, backButtonAbsolute: { position: 'absolute', top: 40, left: 40, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  topBar: { height: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 60, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(15, 14, 23, 0.6)', backdropFilter: 'blur(10px)' as any, zIndex: 50 }, topLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 20 }, topRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 }, backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }, logoText: { fontSize: 36, fontWeight: '800', color: '#e8e6f0', letterSpacing: -1 }, highlightText: { color: '#a78bfa' }, pinCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, paddingLeft: 24, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, joinLabel: { color: '#8b89a0', fontSize: 18, marginRight: 16 }, whiteText: { color: '#fff', fontWeight: '700' }, pinBadge: { backgroundColor: '#a78bfa', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 100, shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 }, pinText: { color: '#0f0e17', fontSize: 28, fontWeight: '900', letterSpacing: 2 }, qrTriggerButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e8e6f0', justifyContent: 'center', alignItems: 'center', marginLeft: 12, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }, statsCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, paddingRight: 24, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, statsIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(167, 139, 250, 0.15)', justifyContent: 'center', alignItems: 'center' }, statsLabel: { color: '#8b89a0', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, statsText: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', lineHeight: 28 },
  endSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 20, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }, endSessionText: { color: '#ef4444', fontSize: 14, fontWeight: '800' },
  
  mainContainer: { flex: 1, paddingHorizontal: 60, paddingTop: 40, paddingBottom: 100, zIndex: 10 },
  questionTitle: { color: '#e8e6f0', fontSize: 48, fontWeight: '900', marginBottom: 24, lineHeight: 56, letterSpacing: -1, textAlign: 'center' },
  interactionArea: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  
  barsContainer: { width: '100%', maxWidth: 1000, gap: 40 }, barWrapper: { width: '100%' }, barLabelGroup: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, alignItems: 'flex-end' }, barOptionText: { color: '#e8e6f0', fontSize: 24, fontWeight: '700' }, barCountText: { color: '#a78bfa', fontSize: 28, fontWeight: '900' }, barPercentText: { color: '#8b89a0', fontSize: 18, fontWeight: '600' }, barTrack: { height: 32, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' }, barFill: { height: '100%', backgroundColor: '#a78bfa', borderRadius: 16, shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 15 },
  
  cloudWrapper: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  waitingCloud: { alignItems: 'center', padding: 60, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, waitingCloudText: { color: '#8b89a0', fontSize: 24, fontWeight: '600', marginTop: 24 },
  cloudCanvas: { position: 'relative', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  cloudWord: { fontWeight: '900', letterSpacing: -2, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 },
  
  qnaWrapper: { flex: 1, width: '100%', maxWidth: 1200 },
  qnaScrollContent: { padding: 20, paddingBottom: 40 },
  qnaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, justifyContent: 'center' },
  qnaCard: { backgroundColor: 'rgba(26, 25, 36, 0.7)', padding: 32, borderRadius: 32, width: '48%', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.15)', flexDirection: 'row', gap: 20, alignItems: 'flex-start', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20 },
  qnaIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center', shrink: 0 },
  qnaCardText: { color: '#e8e6f0', fontSize: 22, lineHeight: 32, flex: 1, fontWeight: '500' },
  
  footer: { height: 60, justifyContent: 'center', alignItems: 'center', position: 'absolute', bottom: 0, width: '100%' }, footerBrand: { color: '#5a5872', fontSize: 14, fontWeight: '600', letterSpacing: 1 },
  slideControls: { position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26, 25, 36, 0.8)', borderRadius: 100, padding: 8, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, backdropFilter: 'blur(15px)' as any, zIndex: 100 }, controlButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }, controlButtonDisabled: { backgroundColor: 'transparent', opacity: 0.5 }, slideIndicator: { paddingHorizontal: 24 }, slideIndicatorText: { color: '#e8e6f0', fontSize: 18, fontWeight: '800', letterSpacing: 1 }, controlDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 }, quickAddButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#c4b5fd', paddingHorizontal: 20, height: 56, borderRadius: 28, marginLeft: 4 }, quickAddButtonText: { color: '#0f0e17', fontSize: 16, fontWeight: '800' },
  
  qrOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.90)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, ...(Platform.OS === 'web' && { backdropFilter: 'blur(20px)' } as any) }, qrModalCard: { backgroundColor: 'rgba(26, 25, 36, 0.8)', padding: 48, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(167, 139, 250, 0.3)', alignItems: 'center', shadowColor: '#a78bfa', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 50 }, qrModalInnerBorder: { padding: 32, backgroundColor: '#ffffff', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 32 }, qrModalDesc: { color: '#e8e6f0', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 }, qrModalHint: { color: '#8b89a0', fontSize: 16, fontWeight: '600' },
  
  endModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 3000, ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' } as any) },
  endModalCard: { width: '100%', maxWidth: 450, backgroundColor: '#1a1924', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center' },
  endModalIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  endModalTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  endModalDesc: { color: '#8b89a0', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  endModalButtonsRow: { flexDirection: 'row', gap: 16, width: '100%' },
  endModalCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  endModalCancelText: { color: '#e8e6f0', fontSize: 15, fontWeight: '700' },
  endModalConfirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  endModalConfirmText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },

  quickCreateOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 2000, ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' } as any) }, quickCreateScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: windowWidth, paddingVertical: 40 }, quickCreateCard: { width: '100%', maxWidth: 800, backgroundColor: '#1a1924', borderRadius: 32, padding: 40, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40 }, quickCreateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }, quickCreateTitle: { color: '#e8e6f0', fontSize: 28, fontWeight: '900' }, quickCreateCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }, qcTabsContainer: { flexDirection: 'row', gap: 12, marginBottom: 32, flexWrap: 'wrap' }, qcTab: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, qcTabActiveMultipleChoice: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(56, 189, 248, 0.3)' }, qcTabActiveWordCloud: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(244, 114, 182, 0.3)' }, qcTabActiveQna: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(167, 139, 250, 0.3)' }, qcIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }, qcTabText: { color: '#8b89a0', fontWeight: '700', fontSize: 14 }, qcSection: { marginBottom: 24 }, qcLabel: { color: '#38bdf8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }, qcTextArea: { backgroundColor: '#0f0e17', color: '#e8e6f0', fontSize: 18, borderRadius: 16, padding: 20, minHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, qcOptionRow: { flexDirection: 'row', marginBottom: 12 }, qcOptionLetterBox: { backgroundColor: 'rgba(56, 189, 248, 0.1)', width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.15)' }, qcOptionLetterText: { color: '#38bdf8', fontSize: 16, fontWeight: '800' }, qcOptionInput: { flex: 1, backgroundColor: '#0f0e17', color: '#e8e6f0', height: 48, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }, qcAddOptionButton: { flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', borderStyle: 'dashed', borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 }, qcAddOptionText: { color: '#38bdf8', fontWeight: '700', fontSize: 14 }, qcLimitRow: { flexDirection: 'row', gap: 8 }, qcLimitButton: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center' }, qcLimitButtonActive: { borderColor: 'rgba(244, 114, 182, 0.4)', backgroundColor: 'rgba(244, 114, 182, 0.1)' }, qcLimitButtonText: { color: '#8b89a0', fontWeight: '700', fontSize: 14 }, qcLimitButtonTextActive: { color: '#f472b6', fontWeight: '900' }, qcLaunchButton: { backgroundColor: '#38bdf8', paddingVertical: 16, borderRadius: 16, shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 15, marginTop: 16 }, qcLaunchButtonInner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, qcLaunchButtonText: { color: '#0f0e17', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});