'use client';

/**
 * PassiveWordCloud.tsx
 * 
 * Componente principal da funcionalidade de Nuvem de Palavras por Escuta Passiva.
 * Suporta dois modos de exibição de alto padrão (estilo Apple / TED Keynote):
 * 1. Modo Silencioso (!isRevealed): Tela de espera minimalista e sofisticada com áudio
 *    visualizer animado em CSS e acúmulo contínuo em background via Web Worker.
 * 2. O Grande Reveal (isRevealed): Transição suave para tela cheia com WordCloudGraph
 *    projetando todos os termos acumulados para a plateia.
 */

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Eye,
  EyeOff,
  RotateCcw,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { usePassiveListening } from './usePassiveListening';
import { WordCloudGraph } from './WordCloudGraph';
import type { WordFrequency } from '../../types';

export interface PassiveWordCloudProps {
  /** Indica se a nuvem final de palavras deve ser revelada no telão (default: false) */
  isRevealed?: boolean;
  /** Pergunta orientadora ou tema da palestra / mesa redonda */
  question?: string;
  /** Palavras iniciais pré-carregadas (opcional) */
  initialWords?: WordFrequency[];
  /** Iniciar a escuta do microfone automaticamente ao montar */
  autoStart?: boolean;
  /** Idioma da transcrição (padrão: 'pt-BR') */
  lang?: string;
  /** Limite máximo de termos visíveis simultaneamente */
  maxWords?: number;
  /** Comprimento mínimo das palavras a serem computadas */
  minWordLength?: number;
  /** Exibir controles de controle do microfone e reset */
  showControls?: boolean;
  /** Exibir legenda de transcrição em tempo real */
  showTranscriptPreview?: boolean;
  /** Callback opcional quando o estado de revelação é alternado na UI */
  onToggleReveal?: (revealed: boolean) => void;
  /** Classe CSS customizada */
  className?: string;
  /** Estilos inline customizados */
  style?: React.CSSProperties;
}

export function PassiveWordCloud({
  isRevealed = false,
  question,
  initialWords,
  autoStart = true,
  lang = 'pt-BR',
  maxWords = 80,
  minWordLength = 2,
  showControls = true,
  showTranscriptPreview = false,
  onToggleReveal,
  className = '',
  style = {},
}: PassiveWordCloudProps) {
  // Motor de escuta contínua ativo em segundo plano tanto no modo silencioso quanto revelado
  const {
    status,
    isListening,
    transcript,
    interimTranscript,
    words,
    totalWords,
    error,
    toggle,
    reset,
  } = usePassiveListening({
    autoStart,
    lang,
    maxWords,
    minWordLength,
  });

  const [showLiveText, setShowLiveText] = useState(showTranscriptPreview);

  // Trecho de fala para legenda opcional
  const currentSentence = (interimTranscript || transcript.slice(-140)).trim();

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden ${className}`}
      style={{
        minHeight: '65vh',
        backgroundColor: '#09080e',
        ...style,
      }}
    >
      {/* Estilos CSS dedicados para as animações de aura e áudio bars estilo Apple/TED */}
      <style>{`
        @keyframes ted-ring-pulse {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.35;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.75;
          }
        }
        @keyframes ted-ring-outer {
          0% {
            transform: scale(0.85);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.35);
            opacity: 0.12;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.5;
          }
        }
        @keyframes ted-audio-1 {
          0%, 100% { height: 10px; opacity: 0.45; }
          50% { height: 32px; opacity: 1; }
        }
        @keyframes ted-audio-2 {
          0%, 100% { height: 18px; opacity: 0.55; }
          50% { height: 50px; opacity: 1; }
        }
        @keyframes ted-audio-3 {
          0%, 100% { height: 26px; opacity: 0.7; }
          50% { height: 68px; opacity: 1; }
        }
        @keyframes ted-audio-4 {
          0%, 100% { height: 34px; opacity: 0.8; }
          50% { height: 82px; opacity: 1; }
        }
        @keyframes ted-audio-5 {
          0%, 100% { height: 24px; opacity: 0.7; }
          50% { height: 64px; opacity: 1; }
        }
        @keyframes ted-audio-6 {
          0%, 100% { height: 16px; opacity: 0.55; }
          50% { height: 44px; opacity: 1; }
        }
        @keyframes ted-audio-7 {
          0%, 100% { height: 10px; opacity: 0.45; }
          50% { height: 28px; opacity: 1; }
        }
        @keyframes reveal-enter {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Brilhos atmosféricos sutis de fundo */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/05 rounded-full blur-[160px] pointer-events-none" />

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 1. MODO SILENCIOSO (!isRevealed) — Tela Minimalista de Espera */}
      {/* ─────────────────────────────────────────────────────────── */}
      {!isRevealed ? (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 py-12 transition-all duration-700 ease-out z-10">
          
          {/* Anéis Pulsantes Concéntricos e Visualizador de Áudio Central */}
          <div className="relative flex items-center justify-center my-6 md:my-10">
            {/* Anel mais externo expansivo */}
            <div
              className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border border-purple-500/20 pointer-events-none"
              style={{ animation: 'ted-ring-outer 4.8s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
            />

            {/* Anel intermediário respirando */}
            <div
              className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border border-violet-400/25 pointer-events-none"
              style={{ animation: 'ted-ring-pulse 3.2s ease-in-out infinite' }}
            />

            {/* Núcleo de vidro fosco escuro com borda luminosa */}
            <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-b from-[#181628]/90 to-[#0e0d17]/95 border border-purple-400/30 backdrop-blur-2xl shadow-[0_0_60px_rgba(167,139,250,0.18)] flex items-center justify-center">
              {/* Barras de frequência sonora animadas */}
              <div className="flex items-center justify-center gap-1.5 md:gap-2 h-24">
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300"
                  style={{ animation: isListening ? 'ted-audio-1 1.4s ease-in-out infinite' : 'none', height: 10 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300"
                  style={{ animation: isListening ? 'ted-audio-2 1.2s ease-in-out infinite 0.15s' : 'none', height: 18 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-violet-400 to-cyan-300"
                  style={{ animation: isListening ? 'ted-audio-3 1.5s ease-in-out infinite 0.3s' : 'none', height: 26 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-purple-400 to-emerald-300"
                  style={{ animation: isListening ? 'ted-audio-4 1.1s ease-in-out infinite 0.45s' : 'none', height: 34 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-violet-400 to-cyan-300"
                  style={{ animation: isListening ? 'ted-audio-5 1.6s ease-in-out infinite 0.2s' : 'none', height: 24 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300"
                  style={{ animation: isListening ? 'ted-audio-6 1.3s ease-in-out infinite 0.4s' : 'none', height: 16 }}
                />
                <span
                  className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-300"
                  style={{ animation: isListening ? 'ted-audio-7 1.4s ease-in-out infinite 0.25s' : 'none', height: 10 }}
                />
              </div>
            </div>
          </div>

          {/* Badge de status minimalista com luz de presença */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 mb-4 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              {isListening && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status === 'listening' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </span>
            <span className="text-[11px] md:text-xs font-semibold tracking-widest uppercase text-purple-200">
              {status === 'listening' ? 'Escuta de Palco Ativa' : 'Escuta em Espera'}
            </span>
          </div>

          {/* Tipografia Central Elegante estilo TED / Apple */}
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-[#f1f0f7] tracking-tight text-center max-w-3xl leading-tight mb-3">
            {question && question.trim() !== '' ? question : 'Processando debate ao vivo...'}
          </h1>

          <p className="text-sm md:text-base text-[#8e8b9f] max-w-xl text-center font-light leading-relaxed mb-6">
            Os conceitos e termos-chave estão sendo captados em segundo plano. A nuvem de palavras será revelada na síntese do palco.
          </p>

          {/* Pílula discreta de telemetria da mesa redonda */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-[#a5a3b7] font-medium">
              <strong className="text-white font-semibold">{words.length}</strong> termos catalogados
            </span>
            <span className="text-white/20">•</span>
            <span className="text-xs text-[#8e8b9f]">
              <strong className="text-white font-semibold">{totalWords}</strong> palavras faladas
            </span>
          </div>

          {/* Notificação de Erro / Microfone Bloqueado */}
          {error && (
            <div className="mt-4 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs md:text-sm px-4 py-2 rounded-full backdrop-blur-md shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────── */
        /* 2. O GRANDE REVEAL (isRevealed) — Tela Cheia com Nuvem D3 */
        /* ─────────────────────────────────────────────────────────── */
        <div
          className="relative w-full flex-1 flex flex-col items-center justify-between overflow-hidden z-10"
          style={{ animation: 'reveal-enter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          {/* Header Superior da Nuvem Revelada */}
          <div className="w-full pt-6 pb-2 px-6 flex flex-col items-center text-center z-20">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300">
                Síntese do Debate • Análise Final Revelada
              </span>
            </div>

            {question && question.trim() !== '' && (
              <h2 className="text-xl md:text-3xl font-extrabold text-[#f1f0f7] tracking-tight max-w-3xl">
                {question}
              </h2>
            )}

            <p className="text-xs text-[#8e8b9f] mt-1">
              {words.length} termos em destaque analisados a partir de {totalWords} palavras faladas
            </p>
          </div>

          {/* Área Central: Visualização Canvas com D3 Force */}
          <div className="relative w-full flex-1 min-h-[55vh] flex items-center justify-center overflow-hidden">
            <WordCloudGraph
              data={words}
              words={words}
              maxDisplayWords={maxWords}
              className="w-full h-full min-h-[55vh]"
            />
          </div>
        </div>
      )}

      {/* Legenda Dinâmica Opcional */}
      {showLiveText && currentSentence && (
        <div className="w-full max-w-2xl px-6 mb-2 z-20 transition-opacity duration-300">
          <div className="bg-[#13121d]/80 backdrop-blur-md border border-white/5 rounded-2xl px-4 py-2 text-center shadow-md">
            <p className="text-xs md:text-sm text-slate-400 font-mono italic truncate">
              "{currentSentence}"
            </p>
          </div>
        </div>
      )}

      {/* Barra de Controle Inferior (Discreta e Elegante) */}
      {showControls && (
        <div className="w-full px-6 pb-5 flex items-center justify-between gap-4 z-30">
          {/* Badge de Status do Microfone */}
          <div className="flex items-center gap-2.5 bg-[#141320]/80 border border-white/10 backdrop-blur-md rounded-full px-4 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              {isListening && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  status === 'listening'
                    ? 'bg-emerald-400'
                    : status === 'error' || status === 'unsupported'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-300">
              {status === 'listening'
                ? 'Escuta Ativa'
                : status === 'unsupported'
                ? 'Microfone Indisponível'
                : status === 'error'
                ? 'Microfone Bloqueado'
                : 'Escuta Pausada'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono ml-1 border-l border-white/10 pl-2">
              {isRevealed ? 'Visível no Telão' : 'Modo Silencioso'}
            </span>
          </div>

          {/* Botões de Ação do Apresentador */}
          <div className="flex items-center gap-2 bg-[#141320]/80 border border-white/10 backdrop-blur-md rounded-full p-1 shadow-sm">
            {/* Revelar / Ocultar Diretamente no Telão (se onToggleReveal fornecido) */}
            {onToggleReveal && (
              <button
                type="button"
                onClick={() => onToggleReveal(!isRevealed)}
                title={isRevealed ? 'Ocultar nuvem (Modo silencioso)' : 'Revelar análise no telão'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isRevealed
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25'
                    : 'bg-emerald-500 text-[#09080e] hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                }`}
              >
                {isRevealed ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Ocultar</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Revelar</span>
                  </>
                )}
              </button>
            )}

            {/* Alternar Legenda ao Vivo */}
            <button
              type="button"
              onClick={() => setShowLiveText((prev) => !prev)}
              title={showLiveText ? 'Ocultar legenda' : 'Exibir legenda'}
              className={`p-2 rounded-full transition-all ${
                showLiveText
                  ? 'text-purple-400 bg-purple-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
            </button>

            {/* Reiniciar Nuvem */}
            <button
              type="button"
              onClick={reset}
              title="Limpar e reiniciar contagem de palavras"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-full transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Iniciar / Pausar Microfone */}
            <button
              type="button"
              onClick={toggle}
              title={isListening ? 'Pausar escuta passiva' : 'Iniciar escuta passiva'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isListening
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Ouvir</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
