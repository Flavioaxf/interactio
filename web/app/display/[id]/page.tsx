'use client';

import { useState, useEffect, useRef, useMemo, use } from 'react';
import { db } from '../../../src/firebase';
import { ref, onValue } from 'firebase/database';
import type { Card, CardMap, Response, SessionMeta } from '../../../src/types';
import { PassiveWordCloud, WordCloudGraph } from '../../../src/components/PassiveWordCloud';

// ─────────────────────────────────────────────
// Tipos locais
// ─────────────────────────────────────────────

interface TallyEntry {
  optionId: string;
  text:     string;
  count:    number;
  pct:      number;    // 0–100
  color:    string;
}

interface WordEntry {
  word:  string;
  count: number;
  size:  number; // px (calculado)
}

// ─────────────────────────────────────────────
// Hook principal: escuta toda a sessão
// ─────────────────────────────────────────────

function useDisplaySession(sessionId: string) {
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    const upperId = sessionId.toUpperCase();
    const sessionRef = ref(db, `sessions/${upperId}`);
    const fallbackRef = ref(db, `interactio/sessions/${upperId}`);

    // Timeout de segurança para garantir que o loading nunca fique infinito
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 3500);

    const parseSessionData = (data: any) => {
      if (!data) return false;

      // Formato padrão do Admin (Studio e Live Control): array interactions + currentInteraction
      if (data.interactions && Array.isArray(data.interactions)) {
        const currentIndex = typeof data.currentInteraction === 'number' ? data.currentInteraction : 0;
        const currentInteraction = data.interactions[currentIndex];

        const sessionMeta: SessionMeta = {
          title: data.title || data.meta?.title || 'Interactio Apresentação',
          code: data.code || data.meta?.code || upperId,
          hostId: data.userId || data.meta?.hostId || '',
          createdAt: data.createdAt || data.meta?.createdAt || Date.now(),
          status: data.status || data.meta?.status || 'active',
        };
        setMeta(sessionMeta);
        setActiveCardId(currentInteraction?.id || `slide_${currentIndex}`);

        if (currentInteraction) {
          let normalizedOptions: any = null;
          if (Array.isArray(currentInteraction.options)) {
            normalizedOptions = {};
            currentInteraction.options.forEach((optText: string, idx: number) => {
              const key = `opt_${String.fromCharCode(97 + idx)}`;
              normalizedOptions[key] = { order: idx + 1, text: optText };
            });
          } else if (currentInteraction.options && typeof currentInteraction.options === 'object') {
            normalizedOptions = currentInteraction.options;
          }

          const card: Card = {
            order: currentIndex + 1,
            type: currentInteraction.type as any,
            question: currentInteraction.question ?? '',
            options: normalizedOptions,
            config: {
              timer: 0,
              anonymous: true,
              maxWordsPerUser: currentInteraction.limit === 'unlimited' ? 99 : (typeof currentInteraction.limit === 'number' ? currentInteraction.limit : 3),
            },
            status: 'active',
          };
          setActiveCard(card);

          // Normaliza respostas
          const rawResponses = data.responses?.[currentIndex] ?? {};
          const mappedResponses: Record<string, Response> = {};
          let answeredCount = 0;

          Object.entries(rawResponses).forEach(([uid, val]) => {
            answeredCount++;
            let resVal: string | string[] = '';
            if (typeof val === 'number') {
              resVal = `opt_${String.fromCharCode(97 + val)}`;
            } else if (typeof val === 'string' || Array.isArray(val)) {
              resVal = val as any;
            }
            mappedResponses[uid] = {
              value: resVal,
              answeredAt: Date.now(),
            };
          });

          setResponses(mappedResponses);
          setTotalAnswered(answeredCount);
        } else {
          setActiveCard(null);
          setResponses({});
          setTotalAnswered(0);
        }
        return true;
      }

      // Formato alternativo legado: cards map + activeCardId
      if (data.cards && typeof data.cards === 'object') {
        const sessionMeta: SessionMeta = {
          title: data.meta?.title || 'Interactio Apresentação',
          code: data.meta?.code || upperId,
          hostId: data.meta?.hostId || '',
          createdAt: data.meta?.createdAt || Date.now(),
          status: data.meta?.status || 'active',
        };
        setMeta(sessionMeta);

        const activeId = data.activeCardId;
        setActiveCardId(activeId ?? null);
        const currentCard = activeId ? data.cards[activeId] : null;
        setActiveCard(currentCard ?? null);

        if (activeId && data.responses?.[activeId]) {
          const rawResponses = data.responses[activeId];
          setResponses(rawResponses);
          setTotalAnswered(Object.keys(rawResponses).length);
        } else {
          setResponses({});
          setTotalAnswered(0);
        }
        return true;
      }

      setMeta({
        title: data.title || data.meta?.title || 'Interactio Apresentação',
        code: data.code || data.meta?.code || upperId,
        hostId: '',
        createdAt: Date.now(),
        status: data.status || 'draft',
      });
      setActiveCard(null);
      setResponses({});
      setTotalAnswered(0);
      return true;
    };

    let unsubFallback: (() => void) | null = null;

    const unsubMain = onValue(
      sessionRef,
      (snapshot) => {
        clearTimeout(safetyTimeout);
        const data = snapshot.val();
        if (data) {
          parseSessionData(data);
          setIsLoading(false);
        } else {
          unsubFallback = onValue(
            fallbackRef,
            (fallbackSnap) => {
              const fallbackData = fallbackSnap.val();
              if (fallbackData) {
                parseSessionData(fallbackData);
              } else {
                setMeta({
                  title: 'Aguardando início da apresentação...',
                  code: upperId,
                  hostId: '',
                  createdAt: Date.now(),
                  status: 'draft',
                });
                setActiveCard(null);
              }
              setIsLoading(false);
            },
            (err) => {
              console.error('Erro ao buscar no fallback:', err);
              setIsLoading(false);
            }
          );
        }
      },
      (err) => {
        console.error('Erro ao buscar na sessão principal:', err);
        clearTimeout(safetyTimeout);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimeout);
      unsubMain();
      if (unsubFallback) unsubFallback();
    };
  }, [sessionId]);

  return { meta, activeCard, activeCardId, responses, totalAnswered, isLoading };
}

// ─────────────────────────────────────────────
// Helpers de contagem
// ─────────────────────────────────────────────

const OPTION_COLORS = ['#a78bfa','#60a5fa','#34d399','#fbbf24','#fb7185'];
const OPTION_KEYS   = ['opt_a','opt_b','opt_c','opt_d','opt_e'];

/** Conta votos por optionId → array ordenado por order */
function tallyMultipleChoice(card: Card, responses: Record<string, Response>): TallyEntry[] {
  if (!card.options) return [];

  const counts: Record<string, number> = {};
  Object.values(responses).forEach(r => {
    const val = r.value as string;
    counts[val] = (counts[val] ?? 0) + 1;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return OPTION_KEYS
    .filter(k => card.options![k])
    .map((k, i) => ({
      optionId: k,
      text:     card.options![k].text,
      count:    counts[k] ?? 0,
      pct:      Math.round(((counts[k] ?? 0) / total) * 100),
      color:    OPTION_COLORS[i % OPTION_COLORS.length],
    }))
    .sort((a, b) => b.count - a.count);
}

/** Agrega palavras de respostas word_cloud */
function tallyWordCloud(responses: Record<string, Response>): WordEntry[] {
  const freq: Record<string, number> = {};
  Object.values(responses).forEach(r => {
    const words = Array.isArray(r.value) ? r.value : [r.value as string];
    words.forEach(w => {
      const clean = w.trim().toLowerCase();
      if (clean) freq[clean] = (freq[clean] ?? 0) + 1;
    });
  });

  const max = Math.max(...Object.values(freq), 1);
  return Object.entries(freq)
    .map(([word, count]) => ({
      word,
      count,
      size: Math.round(20 + (count / max) * 52), // 20px–72px
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

// ─────────────────────────────────────────────
// Sub-componente: Gráfico de barras
// ─────────────────────────────────────────────

function BarChart({ entries, total }: { entries: TallyEntry[]; total: number }) {
  return (
    <div style={display.chartWrap}>
      {entries.map(entry => (
        <div key={entry.optionId} style={display.barRow}>
          {/* Label */}
          <div style={display.barLabel}>{entry.text}</div>

          {/* Barra */}
          <div style={display.barTrack}>
            <div
              style={{
                ...display.barFill,
                width:           `${entry.pct}%`,
                backgroundColor: entry.color,
                // Animação de crescimento via transition (CSS puro)
                transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          </div>

          {/* Porcentagem + contagem */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 80 }}>
            <span style={{ ...display.barPct, color: entry.color }}>{entry.pct}%</span>
            <span style={display.barCount}>{entry.count} {entry.count === 1 ? 'voto' : 'votos'}</span>
          </div>
        </div>
      ))}

      <div style={display.totalLine}>
        {total} {total === 1 ? 'resposta' : 'respostas'} recebidas
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Nuvem de palavras
// ─────────────────────────────────────────────

const CLOUD_COLORS = ['#a78bfa','#60a5fa','#34d399','#fbbf24','#fb7185','#f97316'];

function WordCloud({ words }: { words: WordEntry[] }) {
  return (
    <div style={display.cloudWrap}>
      {words.map((w, i) => (
        <span
          key={w.word}
          style={{
            fontSize:   w.size,
            color:      CLOUD_COLORS[i % CLOUD_COLORS.length],
            fontWeight: w.count > 2 ? 700 : 500,
            lineHeight: 1.2,
            padding:    '4px 8px',
            transition: 'font-size 0.5s ease',
            display:    'inline-block',
          }}
        >
          {w.word}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Respostas abertas
// ─────────────────────────────────────────────

function OpenTextList({ responses }: { responses: Record<string, Response> }) {
  const items = Object.entries(responses)
    .sort(([, a], [, b]) => b.answeredAt - a.answeredAt)
    .slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(([uid, r]) => (
        <div key={uid} style={display.openTextItem}>
          <span style={display.openTextAvatar}>
            #{uid.slice(-3).toUpperCase()}
          </span>
          <p style={display.openTextBody}>{r.value as string}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal do Telão
// ─────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function DisplayPage({ params }: PageProps) {
  // Desembrulha a Promise de params usando React.use() conforme Next.js 15+/16
  const resolvedParams = params && typeof (params as any).then === 'function'
    ? use(params as Promise<{ id: string }>)
    : (params as { id: string });
  const sessionId = resolvedParams?.id ?? '';
  const { meta, activeCard, responses, totalAnswered, isLoading } = useDisplaySession(sessionId);

  // Calcula dados do gráfico somente quando responses ou activeCard mudam
  const tally = useMemo(() => activeCard?.type === 'multiple_choice' || activeCard?.type === 'quiz'
    ? tallyMultipleChoice(activeCard, responses)
    : [], [activeCard, responses]);

  const wordData = useMemo(() => activeCard?.type === 'word_cloud'
    ? tallyWordCloud(responses)
    : [], [activeCard, responses]);

  // ── 1. Estado de Carregamento ──
  if (isLoading) {
    return (
      <div style={display.fullScreen}>
        <div style={display.waitingState}>
          <div style={display.sessionCode}>{sessionId.toUpperCase()}</div>
          <h1 style={display.sessionTitle}>Carregando sessão…</h1>
          <p style={display.waitingHint}>Conectando ao Interactio em tempo real...</p>
        </div>
      </div>
    );
  }

  // ── 2. Tela de espera (quando não há card ativo na sessão) ──
  if (!activeCard) {
    return (
      <div style={display.fullScreen}>
        <div style={display.waitingState}>
          <div style={display.sessionCode}>{meta?.code || sessionId.toUpperCase()}</div>
          <h1 style={display.sessionTitle}>{meta?.title || 'Aguardando o apresentador…'}</h1>
          <p style={display.waitingHint}>
            Entre em <strong style={{ color: '#a78bfa' }}>interactio.app</strong> com o código acima
          </p>
        </div>
      </div>
    );
  }

  // ── 3. Tela de pergunta/card ativa ──
  return (
    <div style={display.fullScreen}>
      {/* Header com sessão + contador */}
      <div style={display.topBar}>
        <span style={display.topBarCode}>{meta?.code || sessionId.toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={display.livePill}>
            <div style={display.liveDot} />
            Ao vivo
          </div>
        </div>
        <span style={display.topBarCount}>
          {activeCard.type === 'passive_word_cloud' ? 'Escuta ativa' : `${totalAnswered} respostas`}
        </span>
      </div>

      {/* Pergunta ou Título do Slide */}
      {activeCard.question ? (
        <h2 style={display.questionHeading}>{activeCard.question}</h2>
      ) : activeCard.type === 'passive_word_cloud' ? (
        <h2 style={display.questionHeading}>Escuta de Palco</h2>
      ) : null}

      {/* Resultados por tipo */}
      <div style={display.resultArea}>
        {activeCard.type === 'passive_word_cloud' && (
          <div style={{ flex: 1, minHeight: 480, display: 'flex' }}>
            <PassiveWordCloud />
          </div>
        )}
        {(activeCard.type === 'multiple_choice' || activeCard.type === 'quiz') && (
          <BarChart entries={tally} total={totalAnswered} />
        )}
        {activeCard.type === 'word_cloud' && (
          <div style={{ flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
            <WordCloudGraph
              words={wordData.map((w) => ({ text: w.word, count: w.count }))}
              minFontSize={24}
              maxFontSize={84}
            />
          </div>
        )}
        {activeCard.type === 'open_text' && (
          <OpenTextList responses={responses} />
        )}
        {activeCard.type === 'rating' && (
          <RatingDisplay responses={responses} scale={activeCard.config.scale ?? 10} total={totalAnswered} />
        )}
      </div>

      {/* Footer com instrução */}
      <div style={display.footer}>
        Acesse <strong style={{ color: '#a78bfa' }}>interactio.app</strong> e use o código{' '}
        <strong style={{ color: '#a78bfa' }}>{meta?.code || sessionId.toUpperCase()}</strong>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Rating (média + distribuição)
// ─────────────────────────────────────────────

function RatingDisplay({
  responses, scale, total,
}: { responses: Record<string, Response>; scale: number; total: number }) {
  const values = Object.values(responses).map(r => Number(r.value));
  const avg    = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '—';

  // Distribuição por nota
  const dist: Record<number, number> = {};
  for (let i = 1; i <= scale; i++) dist[i] = 0;
  values.forEach(v => { if (dist[v] !== undefined) dist[v]++; });
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 96, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{avg}</div>
      <div style={{ color: '#8b89a0', fontSize: 20, marginBottom: 32 }}>
        média de {total} {total === 1 ? 'resposta' : 'respostas'}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', justifyContent: 'center' }}>
        {Object.entries(dist).map(([val, count]) => (
          <div key={val} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width:           32,
              height:          Math.max(4, Math.round((count / maxCount) * 100)),
              backgroundColor: '#a78bfa',
              borderRadius:    4,
              transition:      'height 0.5s ease',
              opacity:         count > 0 ? 1 : 0.2,
            }} />
            <span style={{ fontSize: 11, color: '#5a5872' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Estilos do Telão (projetado em tela grande)
// ─────────────────────────────────────────────

const display: Record<string, React.CSSProperties> = {
  fullScreen: {
    minHeight:       '100dvh',
    backgroundColor: '#0f0e17',
    display:         'flex',
    flexDirection:   'column',
    padding:         '0 64px 40px',
  },
  topBar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '24px 0',
    borderBottom:   '1px solid rgba(255,255,255,0.06)',
    marginBottom:   40,
  },
  topBarCode: {
    fontFamily:    'monospace',
    fontSize:      18,
    fontWeight:    700,
    color:         '#5a5872',
    letterSpacing: '0.1em',
  },
  livePill: {
    display:         'flex',
    alignItems:      'center',
    gap:             8,
    backgroundColor: 'rgba(52,211,153,0.1)',
    border:          '1px solid rgba(52,211,153,0.2)',
    borderRadius:    100,
    padding:         '6px 16px',
    color:           '#34d399',
    fontSize:        14,
    fontWeight:      700,
  },
  liveDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    backgroundColor: '#34d399',
    animation:    'pulse 2s ease-in-out infinite',
  },
  topBarCount: {
    fontSize:  18,
    color:     '#8b89a0',
    minWidth:  120,
    textAlign: 'right',
  },
  questionHeading: {
    fontSize:     48,
    fontWeight:   800,
    color:        '#e8e6f0',
    lineHeight:   1.2,
    marginBottom: 48,
    letterSpacing: '-0.02em',
  },
  resultArea: {
    flex: 1,
  },
  chartWrap: {
    display:       'flex',
    flexDirection: 'column',
    gap:           20,
  },
  barRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        20,
  },
  barLabel: {
    fontSize:  20,
    color:     '#e8e6f0',
    fontWeight: 500,
    width:      280,
    flexShrink: 0,
  },
  barTrack: {
    flex:            1,
    height:          40,
    backgroundColor: '#1a1927',
    borderRadius:    8,
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 8,
    minWidth:     4,
  },
  barPct: {
    fontSize:   24,
    fontWeight: 800,
  },
  barCount: {
    fontSize: 13,
    color:    '#5a5872',
  },
  totalLine: {
    marginTop: 16,
    fontSize:  16,
    color:     '#5a5872',
    textAlign: 'right',
  },
  cloudWrap: {
    display:        'flex',
    flexWrap:       'wrap',
    gap:            8,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '20px 0',
  },
  openTextItem: {
    display:         'flex',
    gap:             14,
    alignItems:      'flex-start',
    backgroundColor: '#1a1927',
    borderRadius:    12,
    padding:         '14px 18px',
    border:          '1px solid rgba(255,255,255,0.06)',
  },
  openTextAvatar: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    color:           '#a78bfa',
    borderRadius:    8,
    padding:         '4px 8px',
    fontSize:        12,
    fontWeight:      700,
    flexShrink:      0,
  },
  openTextBody: {
    fontSize:  18,
    color:     '#e8e6f0',
    margin:    0,
    lineHeight: 1.5,
  },
  waitingState: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    flex:           1,
    gap:            20,
    textAlign:      'center',
  },
  sessionCode: {
    fontFamily:      'monospace',
    fontSize:        80,
    fontWeight:      800,
    color:           '#a78bfa',
    letterSpacing:   '0.12em',
    lineHeight:      1,
  },
  sessionTitle: {
    fontSize:   32,
    fontWeight: 600,
    color:      '#8b89a0',
    margin:     0,
  },
  waitingHint: {
    fontSize:  20,
    color:     '#5a5872',
    margin:    0,
  },
  footer: {
    textAlign: 'center',
    color:     '#5a5872',
    fontSize:  18,
    marginTop: 40,
    paddingTop: 24,
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
};
