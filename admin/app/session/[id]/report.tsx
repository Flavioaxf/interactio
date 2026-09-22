import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Dimensions, 
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image
} from 'react-native';
import { getDatabase, ref, get } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import '../../../src/firebase'; 

const { width: windowWidth } = Dimensions.get('window');

export default function ReportScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter(); 
  const isMobile = windowWidth < 768;
  
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [totalUniqueParticipants, setTotalUniqueParticipants] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchReportData = async () => {
      try {
        const db = getDatabase();
        const sessionId = typeof id === 'string' ? id : id[0];
        const sessionRef = ref(db, `sessions/${sessionId}`);
        
        const snapshot = await get(sessionRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          setSessionData(data);
          
          const uniqueParticipants = new Set<string>();
          if (data.responses) {
            Object.values(data.responses).forEach((slideResponses: any) => {
              if (slideResponses) {
                Object.keys(slideResponses).forEach(participantId => {
                  uniqueParticipants.add(participantId);
                });
              }
            });
          }
          setTotalUniqueParticipants(uniqueParticipants.size);
        } else {
          setErrorMessage("Sessão não encontrada ou dados indisponíveis.");
        }
      } catch (error: any) {
        setErrorMessage(`Erro ao carregar relatório: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [id]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const chunkArray = (arr: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // ── GERADOR DE PDF ESTRUTURADO E PAGINADO (OTIMIZADO) ──
  const exportSessionReport = async () => {
    if (!sessionData) return;
    setIsExporting(true);
    
    try {
      const sessionIdStr = typeof id === 'string' ? id.toUpperCase() : (id ? id[0].toUpperCase() : '');
      const dateStr = formatDate(sessionData.finishedAt || sessionData.updatedAt);

      // CABEÇALHO PADRÃO (Repetido nas páginas internas)
      const headerHtml = `
        <div class="header">
          <div class="logo" style="margin: 0; font-size: 32px; color: #e8e6f0; font-weight: 900; letter-spacing: -1px;">inter<span style="color: #a78bfa;">actio</span></div>
          <div class="session-meta">
            <div class="session-title">RESULTADOS DA SESSÃO</div>
            <div class="session-date" style="font-size: 18px;">${sessionIdStr}</div>
          </div>
        </div>
      `;

      const interactions = sessionData.interactions || [];
      let interactionsPagesHtml = '';
      const pageIds = ['pdf-cover', 'pdf-summary'];

      interactions.forEach((interaction: any, index: number) => {
        const type = interaction.type || 'multiple_choice';
        const isQnA = type === 'qna' || type === 'q_and_a';
        
        let typeLabel = "MÚLTIPLA ESCOLHA";
        let badgeClass = "badge-mc";
        if (type === 'word_cloud') { typeLabel = "NUVEM DE PALAVRAS"; badgeClass = "badge-wc"; }
        else if (isQnA) { typeLabel = "RESPOSTA LIVRE"; badgeClass = "badge-qna"; }

        const responses = sessionData.responses ? sessionData.responses[index] : null;
        let contentChunks: any[][] = [];

        // 1. Processa e fatia os dados para caberem nas páginas
        if (type === 'multiple_choice') {
          const counts: {[key: number]: number} = {};
          let total = 0;
          if (responses) {
            Object.values(responses).forEach((val: any) => {
              if (typeof val === 'number') { counts[val] = (counts[val] || 0) + 1; total++; }
            });
          }
          const optionsList = interaction.options && Array.isArray(interaction.options) ? interaction.options : [];
          const rows = optionsList.map((opt: string, optIndex: number) => {
            const count = counts[optIndex] || 0;
            const perc = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
            return `
              <div class="bar-row">
                <div class="bar-labels">
                  <span class="bar-opt">${String.fromCharCode(65 + optIndex)}. ${opt}</span>
                  <span class="bar-vals">${count} votos <span>(${perc}%)</span></span>
                </div>
                <div class="bar-track"><div class="bar-fill" style="width: ${perc}%;"></div></div>
              </div>
            `;
          });
          contentChunks = chunkArray(rows, 6);

        } else if (type === 'word_cloud') {
          const wordCounts: {[key: string]: number} = {};
          if (responses) {
            Object.values(responses).forEach((val: any) => {
              if (Array.isArray(val)) val.forEach(word => { 
                const w = word.toUpperCase(); wordCounts[w] = (wordCounts[w] || 0) + 1; 
              });
            });
          }
          const sortedWords = Object.entries(wordCounts).sort((a,b) => b[1] - a[1]);
          const chips = sortedWords.map(([w, c]) => `<div class="chip"><span class="chip-text">${w}</span><div class="chip-count">${c}</div></div>`);
          
          if (chips.length === 0) contentChunks = [['<div class="no-data">Nenhuma palavra enviada.</div>']];
          else {
            const chipGroups = chunkArray(chips, 60);
            contentChunks = chipGroups.map(group => [`<div class="chips">${group.join('')}</div>`]);
          }

        } else if (isQnA) {
          const allAnswers: string[] = [];
          if (responses) {
            Object.values(responses).forEach((val: any) => {
              if (Array.isArray(val)) allAnswers.push(...val);
            });
          }
          const items = allAnswers.map(ans => `<div class="qna-item">"${ans}"</div>`);
          if (items.length === 0) contentChunks = [['<div class="no-data">Nenhuma resposta enviada.</div>']];
          else contentChunks = chunkArray(items, 5);
        }

        // 2. Monta as páginas baseadas nos chunks
        contentChunks.forEach((chunkContent, chunkIndex) => {
          const isContinuation = chunkIndex > 0;
          const pageId = `pdf-int-${index}-part-${chunkIndex}`;
          pageIds.push(pageId);
          
          const slideNumDisplay = (index + 1).toString().padStart(2, '0');

          interactionsPagesHtml += `
            <div id="${pageId}" class="page">
              ${headerHtml}
              <div class="section-title">Análise por Interação</div>
              <div class="interaction-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                  <span class="badge ${badgeClass}">${typeLabel}</span>
                  <span style="color: #5a5872; font-weight: 800; font-size: 12px; letter-spacing: 1px;">SLIDE ${slideNumDisplay}${isContinuation ? ' (CONT.)' : ''}</span>
                </div>
                <div class="question">${interaction.question || 'Sem instrução definida'}</div>
                <div class="results-area">
                  ${chunkContent.join('')}
                </div>
              </div>
            </div>
          `;
        });
      });

      if (interactions.length === 0) {
        interactionsPagesHtml = `
          <div id="pdf-int-empty" class="page">
            ${headerHtml}
            <div class="section-title">Análise por Interação</div>
            <div class="interaction-card"><div class="no-data">Esta sessão não possui interações registradas.</div></div>
          </div>
        `;
        pageIds.push('pdf-int-empty');
      }

      pageIds.push('pdf-final'); 

      const cssStyles = `
        * { box-sizing: border-box; }
        @page { margin: 0; size: A4 portrait; }
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0e17; color: #e8e6f0; margin: 0; padding: 0; }
        
        .page { width: 800px; height: 1131px; background-color: #0f0e17; padding: 60px; position: relative; overflow: hidden; }
        .page-cover { background: linear-gradient(145deg, #0f0e17 20%, #2d1b4e 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .page-final { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 80px; }
        
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(251, 191, 36, 0.3); padding-bottom: 24px; margin-bottom: 40px; }
        .logo { font-size: 36px; font-weight: 900; letter-spacing: -1px; color: #e8e6f0; margin: 0; }
        .logo span { color: #a78bfa; }
        .session-meta { text-align: right; }
        .session-title { color: #fbbf24; font-size: 12px; font-weight: 900; letter-spacing: 2px; margin: 0; }
        .session-date { color: #e8e6f0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin-top: 4px; }
        
        .summary-container { display: flex; gap: 24px; margin-bottom: 48px; width: 100%; }
        .summary-card { flex: 1; background-color: #1a1924; border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; }
        .summary-icon { font-size: 24px; margin-bottom: 12px; }
        .summary-val { font-size: 36px; font-weight: 900; color: #e8e6f0; margin-bottom: 4px; }
        .summary-label { font-size: 14px; font-weight: 600; color: #8b89a0; }
        
        .section-title { font-size: 24px; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.5px; color: #e8e6f0; }
        .interaction-card { background-color: #1a1924; border: 1px solid rgba(255,255,255,0.05); border-radius: 32px; padding: 40px; }
        .badge { display: inline-block; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 800; letter-spacing: 1px; }
        .badge-mc { background-color: rgba(167, 139, 250, 0.1); color: #a78bfa; }
        .badge-wc { background-color: rgba(244, 114, 182, 0.1); color: #f472b6; }
        .badge-qna { background-color: rgba(56, 189, 248, 0.1); color: #38bdf8; }
        
        .question { font-size: 26px; font-weight: 800; line-height: 1.4; margin-bottom: 32px; color: #e8e6f0; }
        .results-area { background-color: #0f0e17; border: 1px solid rgba(255,255,255,0.03); border-radius: 24px; padding: 32px; }
        
        .bar-row { margin-bottom: 24px; }
        .bar-row:last-child { margin-bottom: 0; }
        .bar-labels { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
        .bar-opt { font-weight: 700; font-size: 16px; color: #e8e6f0; }
        .bar-vals { font-weight: 800; font-size: 16px; color: #e8e6f0; }
        .bar-vals span { color: #8b89a0; font-weight: 600; font-size: 14px; margin-left: 4px;}
        .bar-track { width: 100%; height: 16px; background-color: rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; }
        .bar-fill { height: 100%; background-color: #a78bfa; border-radius: 8px; }
        
        .chips { display: flex; flex-wrap: wrap; gap: 12px; }
        .chip { display: flex; align-items: center; background-color: rgba(244, 114, 182, 0.1); border: 1px solid rgba(244, 114, 182, 0.2); padding: 8px 8px 8px 16px; border-radius: 100px; }
        .chip-text { color: #f472b6; font-weight: 700; font-size: 15px; margin-right: 12px; text-transform: uppercase; }
        .chip-count { width: 28px; height: 28px; border-radius: 14px; background-color: #f472b6; color: #0f0e17; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; }
        
        .qna-item { background-color: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.1); padding: 24px; border-radius: 16px; margin-bottom: 16px; font-size: 16px; line-height: 1.6; color: #e8e6f0; }
        .qna-item:last-child { margin-bottom: 0; }
        .no-data { color: #5a5872; font-style: italic; font-size: 16px; }
      `;

      if (Platform.OS === 'web') {
        const loadScript = (src: string) => new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });

        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

        const pdfWrapper = document.createElement('div');
        pdfWrapper.id = "pdf-export-container";
        pdfWrapper.style.position = 'absolute';
        pdfWrapper.style.top = '-99999px'; 
        pdfWrapper.style.left = '-99999px'; 
        
        pdfWrapper.innerHTML = `
          <style>${cssStyles}</style>
          
          <div id="pdf-cover" class="page page-cover">
            <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
              <div class="logo" style="font-size: 80px; color: #e8e6f0; margin: 0;">inter<span style="color: #a78bfa;">actio</span></div>
            </div>
            <div style="color: #fbbf24; font-size: 18px; font-weight: 800; letter-spacing: 6px; margin-bottom: 80px;">SISTEMA DE APRESENTAÇÃO INTERATIVA</div>
            
            <div style="background-color: #1a1924; border: 1px solid rgba(251, 191, 36, 0.3); padding: 60px; border-radius: 32px; text-align: center; width: 100%; box-sizing: border-box; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
               <div style="color: #8b89a0; font-size: 16px; font-weight: 700; letter-spacing: 2px; margin-bottom: 16px;">RELATÓRIO OFICIAL DA SESSÃO</div>
               <div style="color: #e8e6f0; font-size: 80px; font-weight: 900; letter-spacing: 4px; margin-bottom: 24px;">${sessionIdStr}</div>
               <div style="color: #5a5872; font-size: 18px; font-weight: 600;">Apresentação encerrada em:<br/><span style="color:#e8e6f0;">${dateStr}</span></div>
            </div>
          </div>

          <div id="pdf-summary" class="page">
            ${headerHtml}
            <div class="section-title">Visão Geral</div>
            <div class="summary-container">
              <div class="summary-card">
                <div class="summary-icon">📅</div>
                <div class="summary-val">${dateStr.split(',')[0]}</div>
                <div class="summary-label">Data de Encerramento</div>
              </div>
              <div class="summary-card">
                <div class="summary-icon">📚</div>
                <div class="summary-val">${interactions.length}</div>
                <div class="summary-label">Total de Slides</div>
              </div>
              <div class="summary-card">
                <div class="summary-icon">👥</div>
                <div class="summary-val">${totalUniqueParticipants}</div>
                <div class="summary-label">Participantes Únicos</div>
              </div>
            </div>
          </div>

          ${interactionsPagesHtml}

          <div id="pdf-final" class="page page-final">
             <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
               <div class="logo" style="font-size: 40px; color: #e8e6f0; margin: 0; opacity: 0.4;">inter<span style="color: #a78bfa;">actio</span></div>
             </div>
             <div style="color: #5a5872; font-size: 16px; font-weight: 600; opacity: 0.8;">Obrigado por utilizar nossa plataforma.</div>
          </div>
        `;
        
        document.body.appendChild(pdfWrapper);
        await new Promise(resolve => setTimeout(resolve, 300));

        // @ts-ignore
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // ── AQUI ESTÁ O SEGREDO DA OTIMIZAÇÃO DE TAMANHO (De 158MB para ~2MB) ──
        for (let i = 0; i < pageIds.length; i++) {
          const element = document.getElementById(pageIds[i]);
          if (element) {
            // @ts-ignore
            const canvas = await window.html2canvas(element, { backgroundColor: '#0f0e17', scale: 2 });
            if (i > 0) pdf.addPage();
            
            // Usando JPEG com 80% de qualidade em vez de PNG puro, reduz absurdamente o peso.
            const imgData = canvas.toDataURL('image/jpeg', 0.80);
            
            // O parâmetro 'FAST' otimiza o jsPDF internamente
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          }
        }

        pdf.save(`Relatorio_Interactio_${sessionIdStr}.pdf`);
        document.body.removeChild(pdfWrapper);

      } else {
        const fallbackHtml = `
          <!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssStyles}</style></head>
          <body>
            <div class="page page-cover" style="page-break-after: always;">
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <div class="logo" style="font-size: 80px; color: #e8e6f0; margin: 0;">inter<span style="color: #a78bfa;">actio</span></div>
              </div>
              <div style="color: #fbbf24; font-size: 18px; font-weight: 800; letter-spacing: 6px; margin-bottom: 80px;">SISTEMA DE APRESENTAÇÃO INTERATIVA</div>
              <div style="background-color: #1a1924; border: 1px solid rgba(251, 191, 36, 0.3); padding: 60px; border-radius: 32px; text-align: center; width: 100%; box-sizing: border-box;">
                 <div style="color: #8b89a0; font-size: 16px; font-weight: 700; letter-spacing: 2px; margin-bottom: 16px;">RELATÓRIO OFICIAL DA SESSÃO</div>
                 <div style="color: #e8e6f0; font-size: 80px; font-weight: 900;">${sessionIdStr}</div>
              </div>
            </div>
            <div class="page" style="page-break-after: always;">
              ${headerHtml}
              <div class="summary-container">
                <div class="summary-card"><div class="summary-val">${dateStr.split(',')[0]}</div><div class="summary-label">Data de Encerramento</div></div>
                <div class="summary-card"><div class="summary-val">${interactions.length}</div><div class="summary-label">Total de Slides</div></div>
                <div class="summary-card"><div class="summary-val">${totalUniqueParticipants}</div><div class="summary-label">Participantes Únicos</div></div>
              </div>
            </div>
            ${interactionsPagesHtml.replace(/class="page"/g, 'class="page" style="page-break-after: always;"')}
            <div class="page page-final">
               <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                 <div class="logo" style="font-size: 40px; color: #e8e6f0; margin: 0; opacity: 0.4;">inter<span style="color: #a78bfa;">actio</span></div>
               </div>
            </div>
          </body></html>
        `;
        const { uri } = await Print.printToFileAsync({ html: fallbackHtml, base64: false });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Relatorio_Interactio_${sessionIdStr}.pdf`, UTI: 'com.adobe.pdf' });
      }

    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      alert(`Não foi possível gerar o PDF. Verifique o console para mais detalhes.`);
    } finally {
      setIsExporting(false);
    }
  };

  // ── RENDERIZADORES DA TELA DO APLICATIVO ──
  const renderMultipleChoiceResult = (interaction: any, responses: any) => {
    if (!interaction.options || !Array.isArray(interaction.options)) return <Text style={styles.noDataText}>Sem opções definidas.</Text>;
    
    const counts = interaction.options.map(() => 0);
    let totalVotes = 0;

    if (responses) {
      Object.values(responses).forEach((val: any) => {
        if (typeof val === 'number' && counts[val] !== undefined) {
          counts[val]++;
          totalVotes++;
        }
      });
    }

    return (
      <View style={styles.resultsContainer}>
        {interaction.options.map((option: string, idx: number) => {
          const count = counts[idx] || 0;
          const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          
          return (
            <View key={idx} style={styles.barWrapper}>
              <View style={styles.barLabelGroup}>
                <Text style={styles.barOptionText}>{option}</Text>
                <Text style={styles.barCountText}>{count} votos <Text style={styles.barPercentText}>({percentage.toFixed(0)}%)</Text></Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderWordCloudResult = (responses: any) => {
    if (!responses) return <Text style={styles.noDataText}>Nenhuma palavra enviada.</Text>;
    
    const wordCounts: { [key: string]: number } = {};
    Object.values(responses).forEach((val: any) => {
      if (Array.isArray(val)) {
        val.forEach(word => {
          const upperWord = word.toUpperCase();
          wordCounts[upperWord] = (wordCounts[upperWord] || 0) + 1;
        });
      }
    });

    const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);

    if (sortedWords.length === 0) return <Text style={styles.noDataText}>Nenhuma palavra enviada.</Text>;

    return (
      <View style={styles.chipsContainer}>
        {sortedWords.map(([word, count], idx) => (
          <View key={idx} style={styles.chip}>
            <Text style={styles.chipText}>{word}</Text>
            <View style={styles.chipBadge}>
              <Text style={styles.chipBadgeText}>{count}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderQnAResult = (responses: any) => {
    if (!responses) return <Text style={styles.noDataText}>Nenhuma resposta enviada.</Text>;
    
    const allAnswers: string[] = [];
    Object.values(responses).forEach((val: any) => {
      if (Array.isArray(val)) {
        allAnswers.push(...val);
      }
    });

    if (allAnswers.length === 0) return <Text style={styles.noDataText}>Nenhuma resposta enviada.</Text>;

    return (
      <View style={styles.qnaList}>
        {allAnswers.map((ans, idx) => (
          <View key={idx} style={styles.qnaItem}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color="#38bdf8" style={{ marginTop: 2 }} />
            <Text style={styles.qnaItemText}>{ans}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading || errorMessage) {
    return (
      <View style={styles.loadingRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => router.replace('/dashboard')}>
          <Ionicons name="arrow-back" size={24} color="#e8e6f0" />
        </TouchableOpacity>
        {loading ? (
          <><ActivityIndicator size="large" color="#fbbf24" /><Text style={styles.loadingText}>A compilar relatório...</Text></>
        ) : (
          <><Ionicons name="warning-outline" size={64} color="#ef4444" /><Text style={[styles.loadingText, { color: '#ef4444', marginTop: 16 }]}>{errorMessage}</Text></>
        )}
      </View>
    );
  }

  const interactions = sessionData?.interactions || [];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/dashboard')} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#e8e6f0" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.iconWrapper}>
              <Ionicons name="bar-chart" size={24} color="#fbbf24" />
            </View>
            <View>
              <Text style={styles.headerSubtitle}>RELATÓRIO DA SESSÃO</Text>
              <Text style={styles.headerTitle}>{typeof id === 'string' ? id.toUpperCase() : (id ? id[0].toUpperCase() : '')}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.exportBtn} 
          onPress={exportSessionReport} 
          activeOpacity={0.8} 
          disabled={isExporting}
        >
          {isExporting ? <ActivityIndicator color="#fbbf24" size="small" /> : <Ionicons name="document-text" size={20} color="#fbbf24" />}
          <Text style={styles.exportBtnText}>Exportar PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, isMobile && { width: '100%', marginBottom: 16 }]}>
            <Ionicons name="calendar-outline" size={32} color="#a78bfa" />
            <Text style={styles.summaryValue}>{formatDate(sessionData.finishedAt || sessionData.updatedAt)}</Text>
            <Text style={styles.summaryLabel}>Data de Encerramento</Text>
          </View>
          
          <View style={[styles.summaryCard, isMobile && { width: '100%', marginBottom: 16 }]}>
            <Ionicons name="layers-outline" size={32} color="#38bdf8" />
            <Text style={styles.summaryValue}>{interactions.length}</Text>
            <Text style={styles.summaryLabel}>Total de Slides</Text>
          </View>
          
          <View style={[styles.summaryCard, isMobile && { width: '100%' }]}>
            <Ionicons name="people-outline" size={32} color="#34d399" />
            <Text style={styles.summaryValue}>{totalUniqueParticipants}</Text>
            <Text style={styles.summaryLabel}>Participantes Únicos</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Análise por Interação</Text>

        {interactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Esta sessão não possui interações registadas.</Text>
          </View>
        ) : (
          <View style={styles.interactionsList}>
            {interactions.map((interaction: any, index: number) => {
              const type = interaction.type || 'multiple_choice';
              const isQnA = type === 'qna' || type === 'q_and_a';
              const slideResponses = sessionData.responses ? sessionData.responses[index] : null;
              
              let typeLabel = "Múltipla Escolha";
              let iconName = "bar-chart-outline";
              let iconColor = "#a78bfa";
              
              if (type === 'word_cloud') {
                typeLabel = "Nuvem de Palavras";
                iconName = "cloud-outline";
                iconColor = "#f472b6";
              } else if (isQnA) {
                typeLabel = "Resposta Livre";
                iconName = "chatbubbles-outline";
                iconColor = "#38bdf8";
              }

              const slideNumDisplay = (index + 1).toString().padStart(2, '0');

              return (
                <View key={index} style={styles.interactionCard}>
                  <View style={styles.interactionHeader}>
                    <View style={styles.interactionTypeBadge}>
                      <Ionicons name={iconName as any} size={16} color={iconColor} />
                      <Text style={[styles.interactionTypeText, { color: iconColor }]}>{typeLabel}</Text>
                    </View>
                    <Text style={styles.slideNumberBadge}>SLIDE ${slideNumDisplay}</Text>
                  </View>
                  
                  <Text style={styles.interactionQuestion}>{interaction.question || "Sem instrução"}</Text>
                  
                  <View style={styles.interactionBody}>
                    {type === 'multiple_choice' && renderMultipleChoiceResult(interaction, slideResponses)}
                    {type === 'word_cloud' && renderWordCloudResult(slideResponses)}
                    {isQnA && renderQnAResult(slideResponses)}
                  </View>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0e17' },
  loadingRoot: { flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b89a0', marginTop: 24, fontSize: 20, fontWeight: '600' },
  backButtonAbsolute: { position: 'absolute', top: 40, left: 40, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  header: { height: 100, backgroundColor: '#13121d', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  iconWrapper: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center' },
  headerSubtitle: { color: '#fbbf24', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(251, 191, 36, 0.1)', paddingHorizontal: 20, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
  exportBtnText: { color: '#fbbf24', fontSize: 14, fontWeight: '800' },

  scrollContent: { padding: 40, paddingBottom: 100, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  
  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 24, marginBottom: 48, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: 250, backgroundColor: '#1a1924', padding: 32, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'flex-start' },
  summaryValue: { color: '#e8e6f0', fontSize: 32, fontWeight: '900', marginTop: 16, marginBottom: 4 },
  summaryLabel: { color: '#8b89a0', fontSize: 15, fontWeight: '600' },
  
  sectionTitle: { color: '#e8e6f0', fontSize: 24, fontWeight: '800', marginBottom: 24, letterSpacing: -0.5 },
  
  emptyState: { padding: 40, alignItems: 'center', backgroundColor: '#1a1924', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyStateText: { color: '#8b89a0', fontSize: 16 },
  noDataText: { color: '#5a5872', fontSize: 15, fontStyle: 'italic', marginTop: 12 },
  
  interactionsList: { gap: 32 },
  interactionCard: { backgroundColor: '#1a1924', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  interactionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  interactionTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  interactionTypeText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  slideNumberBadge: { color: '#5a5872', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  interactionQuestion: { color: '#e8e6f0', fontSize: 28, fontWeight: '800', marginBottom: 32, lineHeight: 36 },
  interactionBody: { backgroundColor: '#0f0e17', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  
  // Múltipla Escolha
  resultsContainer: { gap: 20 },
  barWrapper: { gap: 12 },
  barLabelGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barOptionText: { color: '#e8e6f0', fontSize: 16, fontWeight: '700' },
  barCountText: { color: '#e8e6f0', fontSize: 16, fontWeight: '800' },
  barPercentText: { color: '#8b89a0', fontSize: 14, fontWeight: '600' },
  barTrack: { height: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#a78bfa', borderRadius: 8 },
  
  // Word Cloud
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(244, 114, 182, 0.1)', paddingVertical: 8, paddingLeft: 16, paddingRight: 8, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(244, 114, 182, 0.2)' },
  chipText: { color: '#f472b6', fontSize: 15, fontWeight: '700', marginRight: 12 },
  chipBadge: { backgroundColor: '#f472b6', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  chipBadgeText: { color: '#0f0e17', fontSize: 13, fontWeight: '900' },
  
  // Q&A
  qnaList: { gap: 12 },
  qnaItem: { flexDirection: 'row', gap: 16, backgroundColor: 'rgba(56, 189, 248, 0.05)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.1)' },
  qnaItemText: { color: '#e8e6f0', fontSize: 15, lineHeight: 24, flex: 1 }
});