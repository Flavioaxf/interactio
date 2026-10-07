'use client';

/**
 * PassiveWordCloud.tsx
 * 
 * Componente principal da funcionalidade de Nuvem de Palavras por Escuta Passiva.
 * Suporta 3 fases de IA:
 * 1. Escuta Silenciosa (aiStatus = 'listening'): Tela de espera com áudio visualizer animado em CSS e acúmulo contínuo em background.
 * 2. Processamento IA (aiStatus = 'generating'): Tela elegante de loading enquanto consulta Gemini.
 * 3. O Grande Reveal (aiStatus = 'revealed'): Transição para tela cheia com WordCloudGraph projetando os temas da IA.
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  Activity,
  CheckCircle2,
  BrainCircuit,
  Loader2
} from 'lucide-react';
import { usePassiveListening } from './usePassiveListening';
import { WordCloudGraph } from './WordCloudGraph';
import type { WordFrequency } from '../../types';

export interface PassiveWordCloudProps {
  /** Indica a fase atual (default: 'listening') */
  aiStatus?: 'listening' | 'generating' | 'revealed';
  /** Pergunta orientadora ou tema da palestra / mesa redonda */
  question?: string;
  /** Palavras pré-carregadas (já salvas no DB) */
  initialWords?: WordFrequency[];
  /** Iniciar a escuta do microfone automaticamente ao montar */
  autoStart?: boolean;
  /** Idioma da transcrição (padrão: 'pt-BR') */
  lang?: string;
  /** Exibir controles de controle do microfone e reset */
  showControls?: boolean;
  /** Exibir legenda de transcrição em tempo real */
  showTranscriptPreview?: boolean;
  /** Callback quando o estado de revelação é alternado na UI */
  onToggleReveal?: (revealed: boolean) => void;
  /** Callback disparado quando a IA termina e a lista de palavras é atualizada para ser salva */
  onWordsUpdated?: (words: WordFrequency[], newAiStatus?: 'revealed' | 'listening') => void;
  /** Classe CSS customizada */
  className?: string;
  /** Estilos inline customizados */
  style?: React.CSSProperties;
}

export function PassiveWordCloud({
  aiStatus = 'listening',
  question,
  initialWords,
  autoStart = true,
  lang = 'pt-BR',
  showControls = true,
  showTranscriptPreview = false,
  onToggleReveal,
  onWordsUpdated,
  className = '',
  style = {},
}: PassiveWordCloudProps) {
  const {
    status,
    isListening,
    transcript,
    interimTranscript,
    error,
    toggle,
    reset,
  } = usePassiveListening({
    autoStart,
    lang,
  });

  const [words, setWords] = useState<WordFrequency[]>(initialWords || []);
  const [showLiveText, setShowLiveText] = useState(showTranscriptPreview);
  const [internalStatus, setInternalStatus] = useState(aiStatus);

  useEffect(() => {
    setInternalStatus(aiStatus);
  }, [aiStatus]);

  // Efeito principal de Geração de IA
  useEffect(() => {
    let isCancelled = false;

    const generateAI = async () => {
      if (aiStatus === 'generating' && transcript.length > 10) {
        try {
          const res = await fetch('/api/ai-wordcloud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript })
          });
          
          if (!res.ok) throw new Error('Falha na API');
          
          const data = await res.json();
          if (data.words && !isCancelled) {
            setWords(data.words);
            if (onWordsUpdated) {
              onWordsUpdated(data.words, 'revealed');
            }
          }
        } catch (err) {
          console.error("Erro ao gerar IA:", err);
          // Volta para listening silencioso em caso de falha silenciosa para não travar o telão
          if (!isCancelled && onWordsUpdated) {
            onWordsUpdated(words, 'listening');
          }
        }
      }
    };

    if (aiStatus === 'generating') {
      generateAI();
    }

    return () => {
      isCancelled = true;
    };
  }, [aiStatus, transcript, onWordsUpdated, words]);

  const currentSentence = (interimTranscript || transcript.slice(-140)).trim();

  // Compatibilidade com old 'isRevealed'
  const isRevealed = internalStatus === 'revealed';
  const isGenerating = internalStatus === 'generating';

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden ${className}`}
      style={{
        minHeight: '65vh',
        backgroundColor: '#09080e',
        ...style,
      }}
    >
      <style>{`
        @keyframes ted-ring-pulse { 0%, 100% { transform: scale(0.96); opacity: 0.35; } 50% { transform: scale(1.12); opacity: 0.75; } }
        @keyframes ted-ring-outer { 0% { transform: scale(0.85); opacity: 0.5; } 50% { transform: scale(1.35); opacity: 0.12; } 100% { transform: scale(0.85); opacity: 0.5; } }
        @keyframes ted-audio-1 { 0%, 100% { height: 10px; opacity: 0.45; } 50% { height: 32px; opacity: 1; } }
        @keyframes ted-audio-2 { 0%, 100% { height: 18px; opacity: 0.55; } 50% { height: 50px; opacity: 1; } }
        @keyframes ted-audio-3 { 0%, 100% { height: 26px; opacity: 0.7; } 50% { height: 68px; opacity: 1; } }
        @keyframes ted-audio-4 { 0%, 100% { height: 34px; opacity: 0.8; } 50% { height: 82px; opacity: 1; } }
        @keyframes ted-audio-5 { 0%, 100% { height: 24px; opacity: 0.7; } 50% { height: 64px; opacity: 1; } }
        @keyframes ted-audio-6 { 0%, 100% { height: 16px; opacity: 0.55; } 50% { height: 44px; opacity: 1; } }
        @keyframes ted-audio-7 { 0%, 100% { height: 10px; opacity: 0.45; } 50% { height: 28px; opacity: 1; } }
        @keyframes reveal-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Background Ambience */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/05 rounded-full blur-[160px] pointer-events-none" />

      {/* Fase 1: Escuta Silenciosa */}
      {internalStatus === 'listening' && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 py-12 transition-all duration-700 z-10">
          <div className="relative flex items-center justify-center my-6 md:my-10">
            <div className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border border-purple-500/20 pointer-events-none" style={{ animation: 'ted-ring-outer 4.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }} />
            <div className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border border-violet-400/25 pointer-events-none" style={{ animation: 'ted-ring-pulse 3.2s ease-in-out infinite' }} />
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-b from-[#181628]/90 to-[#0e0d17]/95 border border-purple-400/30 backdrop-blur-2xl shadow-[0_0_60px_rgba(167,139,250,0.18)] flex items-center justify-center">
              <div className="flex items-center justify-center gap-1.5 md:gap-2 h-24">
                <span className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300" style={{ animation: isListening ? 'ted-audio-1 1.4s ease-in-out infinite' : 'none', height: 10 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300" style={{ animation: isListening ? 'ted-audio-2 1.2s ease-in-out infinite 0.15s' : 'none', height: 18 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-violet-400 to-cyan-300" style={{ animation: isListening ? 'ted-audio-3 1.5s ease-in-out infinite 0.3s' : 'none', height: 26 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-purple-400 to-emerald-300" style={{ animation: isListening ? 'ted-audio-4 1.1s ease-in-out infinite 0.45s' : 'none', height: 34 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-violet-400 to-cyan-300" style={{ animation: isListening ? 'ted-audio-5 1.6s ease-in-out infinite 0.2s' : 'none', height: 24 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300" style={{ animation: isListening ? 'ted-audio-6 1.3s ease-in-out infinite 0.4s' : 'none', height: 16 }} />
                <span className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300" style={{ animation: isListening ? 'ted-audio-7 1.4s ease-in-out infinite 0.25s' : 'none', height: 10 }} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 mt-8">
            <h3 className="text-xl md:text-2xl font-light tracking-wide text-white/90">
              Escuta de Palco Ativa
            </h3>
            <p className="text-[#8e8b9f] text-sm md:text-base font-medium">
              Acumulando contexto do debate em background...
            </p>
          </div>
        </div>
      )}

      {/* Fase 2: Geração IA */}
      {internalStatus === 'generating' && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 py-12 transition-all duration-700 z-10">
          <div className="flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-2xl font-semibold tracking-wide text-white flex items-center gap-3">
                <BrainCircuit className="text-cyan-400" /> A IA está analisando o debate
              </h3>
              <p className="text-[#8e8b9f] text-lg max-w-md mx-auto">
                Sintetizando temas semânticos a partir de todo o histórico de áudio...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fase 3: Nuvem Revelada */}
      {internalStatus === 'revealed' && (
        <div
          className="relative w-full flex-1 flex flex-col items-center justify-center px-4 md:px-12 py-8 z-10"
          style={{ animation: 'reveal-enter 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}
        >
          {question && (
            <div className="mb-4 text-center z-20">
              <h2 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-indigo-200">
                {question}
              </h2>
            </div>
          )}
          
          <div className="w-full flex-1 flex items-center justify-center relative min-h-[400px]">
            {words.length > 0 ? (
              <WordCloudGraph
                words={words}
                minFontSize={20}
                maxFontSize={100}
                colors={['#a78bfa', '#818cf8', '#34d399', '#f472b6', '#38bdf8', '#e8e6f0']}
              />
            ) : (
              <div className="flex flex-col items-center text-center opacity-60">
                <MicOff className="w-12 h-12 text-[#5a5872] mb-4" />
                <p className="text-[#8b89a0] text-lg">Nenhum termo suficiente extraído pela IA.</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">
                Síntese IA Concluída
              </span>
            </div>
            <p className="text-xs text-[#8e8b9f] mt-1">
              {words.length} temas principais extraídos semanticamente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
