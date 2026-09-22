import { useRouter, Stack } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
  Image,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, ref, onValue, remove, update } from 'firebase/database';
import { getAuth } from 'firebase/auth'; 
import '../src/firebase'; 

type TabType = 'home' | 'sessions' | 'settings';
type FilterType = 'all' | 'active' | 'draft' | 'finished';
type SortType = 'desc' | 'asc';

export default function DashboardScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < 768; 

  const [isModalVisible, setModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>('');
  
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortType>('desc');
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  const [creationState, setCreationState] = useState<{ active: boolean, mode: 'live' | 'studio' | null }>({
    active: false,
    mode: null
  });

  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'error' | 'success'} | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const auth = getAuth();
    if (auth.currentUser) setUserEmail(auth.currentUser.email);

    const db = getDatabase();
    const sessionsRef = ref(db, 'sessions');

    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const currentUserId = auth.currentUser?.uid;

        // ── 3. ISOLAMENTO DE DADOS: Filtra apenas as sessões criadas por este utilizador ──
        const sessionsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }))
        .filter(session => session.userId === currentUserId)
        .sort((a, b) => {
          const timeA = a.updatedAt || a.createdAt || 0;
          const timeB = b.updatedAt || b.createdAt || 0;
          return timeB - timeA;
        });

        setSessions(sessionsList);
      } else {
        setSessions([]);
      }
      setLoadingSessions(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTabSwitch = (tab: TabType) => {
    if (tab === activeTab) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setActiveTab(tab);
      slideAnim.setValue(30); 
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    });
  };

  const generateSessionId = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = letters.charAt(Math.floor(Math.random() * letters.length)) + letters.charAt(Math.floor(Math.random() * letters.length));
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `${randomLetters}-${randomNumbers}`;
  };

  const handleSelectMode = (mode: 'live' | 'studio') => {
    if (mode === 'live' && isMobile) return;
    setModalVisible(false);
    setCreationState({ active: true, mode }); 
    setTimeout(() => {
      const newSessionId = generateSessionId();
      setCreationState({ active: false, mode: null });
      if (mode === 'live') router.push(`/session/${newSessionId}/create-card` as any);
      else router.push(`/session/${newSessionId}/studio` as any);
    }, 2500);
  };

  // ── 2. TRANSFORMA RASCUNHO EM SESSÃO AO VIVO ──
  const handleStartPresentation = async (sessionId: string) => {
    try {
      const db = getDatabase();
      await update(ref(db, `sessions/${sessionId}`), { 
        status: 'active', 
        updatedAt: Date.now() 
      });
      router.push(`/session/${sessionId}/live-control` as any);
    } catch (error) {
      showToast('Erro ao iniciar apresentação.', 'error');
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true); 
    setTimeout(() => { router.replace('/' as any); }, 1800); 
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      const db = getDatabase();
      await remove(ref(db, `sessions/${sessionToDelete}`));
      showToast('Apresentação excluída com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao excluir apresentação.', 'error');
    } finally {
      setSessionToDelete(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Data desconhecida';
    return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getFilteredSessions = () => {
    return sessions.filter(session => {
      if (filterStatus === 'all') return true;
      const isDraft = session.status === 'draft';
      const isFinished = session.status === 'finished';
      if (filterStatus === 'draft') return isDraft;
      if (filterStatus === 'finished') return isFinished;
      if (filterStatus === 'active') return !isDraft && !isFinished;
      return true;
    }).sort((a, b) => {
      const timeA = a.updatedAt || a.createdAt || 0;
      const timeB = b.updatedAt || b.createdAt || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  };

  const renderSessionCard = (session: any) => {
    const isDraft = session.status === 'draft';
    const isFinished = session.status === 'finished';
    const slideCount = session.interactions ? session.interactions.length : 0;
    const idParts = session.id.split('-');
    const hasValidIdFormat = idParts.length === 2;
    const cardWidth = windowWidth > 1000 ? '31%' : windowWidth > 700 ? '47%' : '100%';

    return (
      <View key={session.id} style={[styles.sessionCard, { width: cardWidth as any }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, isDraft ? styles.statusDraft : isFinished ? styles.statusFinished : styles.statusActive]}>
            <View style={[styles.statusDot, { backgroundColor: isDraft ? '#8b89a0' : isFinished ? '#fbbf24' : '#34d399' }]} />
            <Text style={[styles.statusText, { color: isDraft ? '#8b89a0' : isFinished ? '#fbbf24' : '#34d399' }]}>
              {isDraft ? 'Rascunho' : isFinished ? 'Encerrada' : 'Ao Vivo'}
            </Text>
          </View>
          <View style={styles.headerRightControls}>
            <Text style={styles.cardDate}>{formatDate(session.updatedAt || session.createdAt)}</Text>
            <TouchableOpacity style={styles.deleteButton} onPress={() => setSessionToDelete(session.id)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, isMobile && { fontSize: 24 }]}>
            {hasValidIdFormat ? (
              <><Text style={{ color: '#e8e6f0' }}>{idParts[0]}</Text><Text style={{ color: '#a78bfa' }}>-{idParts[1]}</Text></>
            ) : (<Text style={{ color: '#e8e6f0' }}>{session.id}</Text>)}
          </Text>
          <Text style={styles.cardSubtitle}>{slideCount} {slideCount === 1 ? 'slide criado' : 'slides criados'}</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.cardBtnSecondary, isMobile && { flex: 1, backgroundColor: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.2)' }]} onPress={() => router.push(`/session/${session.id}/studio` as any)} activeOpacity={0.7}>
            <Ionicons name="pencil" size={16} color={isMobile ? "#a78bfa" : "#e8e6f0"} />
            <Text style={[styles.cardBtnSecondaryText, isMobile && { color: '#a78bfa' }]}>Editar</Text>
          </TouchableOpacity>

          {!isMobile && (
            isFinished ? (
              <TouchableOpacity style={[styles.cardBtnPrimary, { backgroundColor: '#fbbf24' }]} onPress={() => router.push(`/session/${session.id}/report` as any)} activeOpacity={0.8}>
                <Ionicons name="bar-chart" size={16} color="#0f0e17" />
                <Text style={styles.cardBtnPrimaryText}>Ver Relatório</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.cardBtnPrimary} onPress={() => handleStartPresentation(session.id)} activeOpacity={0.8}>
                <Ionicons name="play" size={16} color="#0f0e17" />
                <Text style={styles.cardBtnPrimaryText}>Apresentar</Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        const recentSessions = getFilteredSessions().slice(0, 6);
        return (
          <>
            <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 16 }]}>
              <View>
                <Text style={styles.welcomeText}>Bem-vindo de volta,</Text>
                <Text style={[styles.pageTitle, isMobile && { fontSize: 28 }]}>Seu Painel</Text>
              </View>
              <TouchableOpacity style={[styles.newSessionBtn, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={() => setModalVisible(true)} disabled={isLoggingOut || creationState.active} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color="#0f0e17" />
                <Text style={styles.newSessionBtnText}>Nova Sessão</Text>
              </TouchableOpacity>
            </View>

            {loadingSessions ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#a78bfa" />
                <Text style={styles.loadingText}>Carregando painel...</Text>
              </View>
            ) : recentSessions.length === 0 ? (
              <View style={[styles.emptyStateContainer, isMobile && { padding: 20 }]}>
                <View style={styles.emptyStateIconBox}><Ionicons name="folder-open-outline" size={32} color="#a78bfa" /></View>
                <Text style={[styles.emptyStateTitle, isMobile && { fontSize: 20, textAlign: 'center' }]}>Nenhuma sessão iniciada</Text>
                <Text style={styles.emptyStateDesc}>Crie a sua primeira sessão para engajar o seu público.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Acessos Recentes</Text>
                  <TouchableOpacity onPress={() => handleTabSwitch('sessions')}><Text style={styles.viewAllText}>Ver todas →</Text></TouchableOpacity>
                </View>
                <View style={styles.gridContainer}>{recentSessions.map(renderSessionCard)}</View>
              </ScrollView>
            )}
          </>
        );

      case 'sessions':
        const allFiltered = getFilteredSessions();
        return (
          <>
            <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 16 }]}>
              <View>
                <Text style={styles.welcomeText}>Gestão de Conteúdo</Text>
                <Text style={[styles.pageTitle, isMobile && { fontSize: 28 }]}>Minhas Sessões</Text>
              </View>
              <TouchableOpacity style={[styles.newSessionBtn, isMobile && { width: '100%', justifyContent: 'center' }]} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="add" size={20} color="#0f0e17" />
                <Text style={styles.newSessionBtnText}>Nova Sessão</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filtersBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'active', label: 'Ao Vivo' },
                  { id: 'finished', label: 'Encerradas' },
                  { id: 'draft', label: 'Rascunhos' }
                ].map((f) => (
                  <TouchableOpacity key={f.id} onPress={() => setFilterStatus(f.id as FilterType)} style={[styles.filterPill, filterStatus === f.id && styles.filterPillActive]}>
                    <Text style={[styles.filterPillText, filterStatus === f.id && styles.filterPillTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              <TouchableOpacity style={styles.sortButton} onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                <Ionicons name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} size={16} color="#a78bfa" />
                <Text style={styles.sortButtonText}>{sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigas'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {allFiltered.length === 0 ? (
                <View style={[styles.emptyStateContainer, { marginTop: 40 }]}>
                  <Ionicons name="search-outline" size={48} color="#5a5872" style={{marginBottom: 16}} />
                  <Text style={styles.emptyStateTitle}>Nenhum resultado</Text>
                  <Text style={styles.emptyStateDesc}>Não existem sessões que correspondam aos filtros selecionados.</Text>
                </View>
              ) : (
                <View style={styles.gridContainer}>{allFiltered.map(renderSessionCard)}</View>
              )}
            </ScrollView>
          </>
        );

      case 'settings':
        return (
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.welcomeText}>Preferências da Conta</Text>
                <Text style={styles.pageTitle}>Configurações</Text>
              </View>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Perfil do Apresentador</Text>
                <View style={styles.settingsCard}>
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsIconBox}><Ionicons name="person" size={20} color="#a78bfa" /></View>
                    <View style={styles.settingsTextGroup}>
                      <Text style={styles.settingsLabel}>Email da Conta</Text>
                      <Text style={styles.settingsValue}>{userEmail || 'A carregar...'}</Text>
                    </View>
                  </View>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsRow}>
                    <View style={styles.settingsIconBox}><Ionicons name="star" size={20} color="#fbbf24" /></View>
                    <View style={styles.settingsTextGroup}>
                      <Text style={styles.settingsLabel}>Plano</Text>
                      <Text style={styles.settingsValue}>Interactio Free (Educador)</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Sistema & Aparência</Text>
                <View style={styles.settingsCard}>
                  <View style={styles.settingsRow}>
                    <View style={[styles.settingsIconBox, {backgroundColor: 'rgba(56, 189, 248, 0.1)'}]}><Ionicons name="moon" size={20} color="#38bdf8" /></View>
                    <View style={styles.settingsTextGroup}>
                      <Text style={styles.settingsLabel}>Tema de Interface</Text>
                      <Text style={styles.settingsValue}>Modo Escuro (Padrão)</Text>
                    </View>
                  </View>
                  <View style={styles.settingsDivider} />
                  <View style={styles.settingsRow}>
                    <View style={[styles.settingsIconBox, {backgroundColor: 'rgba(52, 211, 153, 0.1)'}]}><Ionicons name="information-circle" size={20} color="#34d399" /></View>
                    <View style={styles.settingsTextGroup}>
                      <Text style={styles.settingsLabel}>Versão da Aplicação</Text>
                      <Text style={styles.settingsValue}>Interactio OS v1.0.0</Text>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </>
        );
    }
  };

  return (
    <View style={[styles.root, { flexDirection: isMobile ? 'column' : 'row' }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {toast && (
        <View style={[styles.toastWrapper, isMobile && { top: 20 }]}>
          <View style={[styles.toastContainer, { borderColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(52, 211, 153, 0.3)' }]}>
            <View style={[styles.toastIconBox, { backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(52, 211, 153, 0.1)' }]}><Ionicons name={toast.type === 'error' ? "warning" : "checkmark-circle"} size={20} color={toast.type === 'error' ? "#ef4444" : "#34d399"} /></View>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}

      {isMobile ? (
        <View style={{backgroundColor: '#13121d'}}>
          <View style={styles.mobileHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={require('@/assets/images/favicon.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
              <Text style={styles.logoText}>inter<Text style={styles.highlightText}>actio</Text></Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.mobileLogoutBtn}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <View style={styles.mobileNavContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileNavScroll}>
              <TouchableOpacity style={[styles.mobileNavPill, activeTab === 'home' && styles.mobileNavPillActive]} onPress={() => handleTabSwitch('home')}>
                <Text style={[styles.mobileNavText, activeTab === 'home' && styles.mobileNavTextActive]}>Início</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mobileNavPill, activeTab === 'sessions' && styles.mobileNavPillActive]} onPress={() => handleTabSwitch('sessions')}>
                <Text style={[styles.mobileNavText, activeTab === 'sessions' && styles.mobileNavTextActive]}>Minhas Sessões</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mobileNavPill, activeTab === 'settings' && styles.mobileNavPillActive]} onPress={() => handleTabSwitch('settings')}>
                <Text style={[styles.mobileNavText, activeTab === 'settings' && styles.mobileNavTextActive]}>Configurações</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={styles.sidebar}>
          <View style={styles.logoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={require('@/assets/images/favicon.png')} style={{ width: 32, height: 32 }} resizeMode="contain" />
              <Text style={styles.logoText}>inter<Text style={styles.highlightText}>actio</Text></Text>
            </View>
            <View style={styles.roleBadge}><Text style={styles.roleText}>APRESENTADOR</Text></View>
          </View>

          <View style={styles.navMenu}>
            <TouchableOpacity style={[styles.navItem, activeTab === 'home' && styles.navItemActive]} onPress={() => handleTabSwitch('home')}>
              <Ionicons name="home" size={20} color={activeTab === 'home' ? "#a78bfa" : "#8b89a0"} />
              <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>Início</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navItem, activeTab === 'sessions' && styles.navItemActive]} onPress={() => handleTabSwitch('sessions')}>
              <Ionicons name="layers-outline" size={20} color={activeTab === 'sessions' ? "#a78bfa" : "#8b89a0"} />
              <Text style={[styles.navText, activeTab === 'sessions' && styles.navTextActive]}>Minhas Sessões</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]} onPress={() => handleTabSwitch('settings')}>
              <Ionicons name="settings-outline" size={20} color={activeTab === 'settings' ? "#a78bfa" : "#8b89a0"} />
              <Text style={[styles.navText, activeTab === 'settings' && styles.navTextActive]}>Configurações</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut || creationState.active}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.mainArea, isMobile && { padding: 20 }]}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {renderContent()}
        </Animated.View>
      </View>

      {sessionToDelete && (
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, isMobile && { width: '90%', padding: 24 }]}>
            <View style={styles.deleteIconWrapper}><Ionicons name="trash-outline" size={40} color="#ef4444" /></View>
            <Text style={styles.deleteModalTitle}>Excluir Apresentação?</Text>
            <Text style={styles.deleteModalDesc}>Tem certeza que deseja excluir a sessão <Text style={{color: '#e8e6f0', fontWeight: 'bold'}}>{sessionToDelete}</Text>? Esta ação apagará todos os slides e não pode ser desfeita.</Text>
            <View style={[styles.deleteButtonsRow, isMobile && { flexDirection: 'column-reverse' }]}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setSessionToDelete(null)} activeOpacity={0.7}><Text style={styles.deleteCancelBtnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete} activeOpacity={0.8}><Text style={styles.deleteConfirmBtnText}>Sim, Excluir</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {isModalVisible && !isLoggingOut && !creationState.active && !sessionToDelete && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isMobile && { width: '90%', padding: 24, maxHeight: '85%' }]}>
            <View style={[styles.modalHeader, isMobile && { marginBottom: 20 }]}>
              <Text style={[styles.modalTitle, isMobile && { fontSize: 20 }]}>Como deseja interagir?</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}><Ionicons name="close" size={24} color="#8b89a0" /></TouchableOpacity>
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              <View style={[styles.modeCardsContainer, isMobile && { flexDirection: 'column', gap: 16 }]}>
                <TouchableOpacity style={[styles.modeCard, !isMobile && { flex: 1 }, isMobile && { padding: 20, opacity: 0.5, borderColor: 'rgba(255,255,255,0.02)' }]} activeOpacity={0.8} onPress={() => !isMobile && handleSelectMode('live')} disabled={isMobile}>
                  <View style={[styles.modeIconBox, { backgroundColor: isMobile ? 'rgba(255,255,255,0.05)' : 'rgba(56, 189, 248, 0.1)' }]}><Ionicons name={isMobile ? "lock-closed" : "flash"} size={32} color={isMobile ? "#5a5872" : "#38bdf8"} /></View>
                  <Text style={[styles.modeTitle, isMobile && { color: '#8b89a0' }]}>Modo Rápido</Text>
                  {isMobile ? <Text style={[styles.modeDesc, { color: '#ef4444', fontWeight: 'bold', marginBottom: 16 }]}>Disponível apenas no computador.</Text> : <Text style={styles.modeDesc}>Crie e lance uma interação instantaneamente.</Text>}
                  {!isMobile && <View style={styles.modeAction}><Text style={[styles.modeActionText, { color: '#38bdf8' }]}>Lançar agora →</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modeCard, !isMobile && { flex: 1 }, isMobile && { padding: 20 }]} activeOpacity={0.8} onPress={() => handleSelectMode('studio')}>
                  <View style={[styles.modeIconBox, { backgroundColor: 'rgba(167, 139, 250, 0.1)' }]}><Ionicons name="layers" size={32} color="#a78bfa" /></View>
                  <Text style={styles.modeTitle}>Modo Estúdio</Text>
                  <Text style={[styles.modeDesc, isMobile && { marginBottom: 16 }]}>Estruture múltiplas interações com antecedência.</Text>
                  <View style={styles.modeAction}><Text style={[styles.modeActionText, { color: '#a78bfa' }]}>Abrir estúdio →</Text></View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {creationState.active && (
        <View style={styles.overlayScreen}>
          <View style={styles.overlayContent}>
            <View style={[styles.overlayIconWrapper, { backgroundColor: creationState.mode === 'live' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(167, 139, 250, 0.1)', borderColor: creationState.mode === 'live' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(167, 139, 250, 0.2)' }]}><Ionicons name={creationState.mode === 'live' ? 'rocket' : 'color-palette'} size={48} color={creationState.mode === 'live' ? '#38bdf8' : '#a78bfa'} /></View>
            <Text style={[styles.overlayTitle, isMobile && { fontSize: 24 }]}>{creationState.mode === 'live' ? 'Preparando velocidade máxima...' : 'Montando o seu estúdio...'}</Text>
            <ActivityIndicator size="large" color={creationState.mode === 'live' ? '#38bdf8' : '#a78bfa'} style={{ marginTop: 32 }} />
          </View>
        </View>
      )}

      {isLoggingOut && (
        <View style={styles.overlayScreen}>
          <View style={styles.overlayContent}>
            <View style={[styles.overlayIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}><ActivityIndicator size="large" color="#ef4444" /></View>
            <Text style={styles.overlayTitle}>Até breve!</Text>
            <Text style={styles.overlayMessageText}>Encerrando a sua sessão com segurança...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' },
  mobileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }, 
  mobileLogoutBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12 },
  mobileNavContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 16 },
  mobileNavScroll: { paddingHorizontal: 20, gap: 12 },
  mobileNavPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
  mobileNavPillActive: { backgroundColor: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.2)' },
  mobileNavText: { color: '#8b89a0', fontSize: 14, fontWeight: '700' },
  mobileNavTextActive: { color: '#a78bfa' },
  
  sidebar: { width: 280, backgroundColor: '#13121d', padding: 24, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', justifyContent: 'space-between' }, logoContainer: { marginBottom: 40 }, logoText: { fontSize: 28, fontWeight: '900', color: '#e8e6f0', letterSpacing: -1 }, highlightText: { color: '#a78bfa' }, roleBadge: { backgroundColor: 'rgba(167, 139, 250, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8 }, roleText: { color: '#a78bfa', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, navMenu: { flex: 1, gap: 8 }, 
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 }, navItemActive: { backgroundColor: 'rgba(167, 139, 250, 0.1)' }, navText: { color: '#8b89a0', fontSize: 15, fontWeight: '600' }, navTextActive: { color: '#a78bfa', fontWeight: '800' }, logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, opacity: 0.8 }, logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  
  mainArea: { flex: 1, padding: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }, welcomeText: { color: '#8b89a0', fontSize: 16, marginBottom: 4 }, pageTitle: { color: '#e8e6f0', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }, newSessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#c4b5fd', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12 }, newSessionBtnText: { color: '#0f0e17', fontSize: 16, fontWeight: '800' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, loadingText: { color: '#8b89a0', marginTop: 16, fontSize: 16 }, emptyStateContainer: { flex: 1, backgroundColor: '#1a1924', borderRadius: 24, justifyContent: 'center', alignItems: 'center', padding: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' }, emptyStateIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(167, 139, 250, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, emptyStateTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', marginBottom: 12 }, emptyStateDesc: { color: '#8b89a0', fontSize: 16, textAlign: 'center', maxWidth: 400, lineHeight: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, sectionTitle: { color: '#8b89a0', fontSize: 14, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }, viewAllText: { color: '#a78bfa', fontSize: 14, fontWeight: '700' }, gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingBottom: 40 }, sessionCard: { backgroundColor: 'rgba(26, 25, 36, 0.8)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, headerRightControls: { flexDirection: 'row', alignItems: 'center', gap: 12 }, deleteButton: { padding: 6, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.1)' }, 
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 }, statusDraft: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }, statusActive: { backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.2)' }, statusFinished: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }, 
  cardDate: { color: '#5a5872', fontSize: 13, fontWeight: '600' }, cardBody: { marginBottom: 32 }, cardTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 }, cardSubtitle: { color: '#8b89a0', fontSize: 15 }, cardActions: { flexDirection: 'row', gap: 12 }, cardBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, cardBtnSecondaryText: { color: '#e8e6f0', fontSize: 14, fontWeight: '700' }, cardBtnPrimary: { flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#c4b5fd', borderRadius: 12 }, cardBtnPrimaryText: { color: '#0f0e17', fontSize: 14, fontWeight: '800' },
  toastWrapper: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 }, toastContainer: { backgroundColor: 'rgba(26, 25, 36, 0.95)', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100, borderWidth: 1, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' } as any) }, toastIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, toastText: { color: '#e8e6f0', fontSize: 15, fontWeight: '700' },
  
  filtersBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 16 },
  filtersScroll: { gap: 12, paddingRight: 20 },
  filterPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'transparent' },
  filterPillActive: { backgroundColor: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.3)' },
  filterPillText: { color: '#8b89a0', fontSize: 14, fontWeight: '700' },
  filterPillTextActive: { color: '#a78bfa' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' },
  sortButtonText: { color: '#a78bfa', fontSize: 14, fontWeight: '700' },

  settingsSection: { marginBottom: 40, maxWidth: 800 },
  settingsSectionTitle: { color: '#8b89a0', fontSize: 14, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  settingsCard: { backgroundColor: '#1a1924', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 8 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingsIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(167, 139, 250, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  settingsTextGroup: { flex: 1 },
  settingsLabel: { color: '#8b89a0', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  settingsValue: { color: '#e8e6f0', fontSize: 16, fontWeight: '700' },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000, ...(Platform.OS === 'web' && { backdropFilter: 'blur(8px)' } as any) }, modalContent: { width: '100%', maxWidth: 800, backgroundColor: '#1a1924', borderRadius: 32, padding: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }, modalTitle: { color: '#e8e6f0', fontSize: 28, fontWeight: '900' }, closeModalBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }, modeCardsContainer: { flexDirection: 'row', gap: 24 }, modeCard: { backgroundColor: '#0f0e17', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, modeIconBox: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }, modeTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', marginBottom: 12 }, modeDesc: { color: '#8b89a0', fontSize: 15, lineHeight: 22, marginBottom: 32, flex: 1 }, modeAction: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16 }, modeActionText: { fontSize: 15, fontWeight: '800' },
  overlayScreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 9999, ...(Platform.OS === 'web' && { backdropFilter: 'blur(15px)' } as any) }, overlayContent: { alignItems: 'center', maxWidth: 500, paddingHorizontal: 20 }, overlayIconWrapper: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 32, borderWidth: 1 }, overlayTitle: { color: '#e8e6f0', fontSize: 32, fontWeight: '900', marginBottom: 16, letterSpacing: -0.5, textAlign: 'center' }, overlayMessageText: { color: '#8b89a0', fontSize: 16, fontWeight: '500', textAlign: 'center', lineHeight: 24 },
  deleteModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000, ...(Platform.OS === 'web' && { backdropFilter: 'blur(8px)' } as any) }, deleteModalContent: { width: '100%', maxWidth: 450, backgroundColor: '#1a1924', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }, deleteIconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }, deleteModalTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' }, deleteModalDesc: { color: '#8b89a0', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 32 }, deleteButtonsRow: { flexDirection: 'row', gap: 16, width: '100%' }, deleteCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }, deleteCancelBtnText: { color: '#e8e6f0', fontSize: 15, fontWeight: '700' }, deleteConfirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }, deleteConfirmBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' }
});