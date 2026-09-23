'use client';

/**
 * PassiveWordCloud.tsx
 * 
 * Componente principal da funcionalidade de Nuvem de Palavras por Escuta Passiva.
 * Integra o motor de captura de áudio (usePassiveListening), processamento assíncrono
 * via Web Worker e renderização acelerada por Canvas com D3 Force Simulation.
 */

import React, { useState } from 'react';
import { usePassiveListening } from './usePassiveListening';
import { WordCloudGraph } from './WordCloudGraph';
import type { WordFrequency } from '../../types';

export interface PassiveWordCloudProps {
  /** Pergunta orientadora ou tema da palestra */
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
  /** Classe CSS customizada */
  className?: string;
  /** Estilos inline customizados */
  style?: React.CSSProperties;
}

export function PassiveWordCloud({
  question,
  initialWords,
  autoStart = true,
  lang = 'pt-BR',
  maxWords = 80,
  minWordLength = 2,
  showControls = true,
  showTranscriptPreview = true,
  className = '',
  style = {},
}: PassiveWordCloudProps) {
  const {
    status,
    isListening,
    transcript,
    interimTranscript,
    words: recognizedWords,
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

  // Palavras a serem exibidas: escutadas ativamente ou providas externamente
  const wordsToDisplay = recognizedWords.length > 0 ? recognizedWords : initialWords ?? [];

  // Último trecho de fala capturado para a legenda em tempo real
  const currentSentence = (interimTranscript || transcript.slice(-140)).trim();

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-between select-none ${className}`}
      style={{
        minHeight: 460,
        backgroundColor: 'transparent',
        ...style,
      }}
    >
      {/* Pergunta / Cabeçalho opcional */}
      {question && (
        <div className="w-full text-center mb-2 px-6 z-10">
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-100 tracking-tight">
            {question}
          </h2>
        </div>
      )}

      {/* Área Central: Visualização Canvas com D3 Force */}
      <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
        <WordCloudGraph
          words={wordsToDisplay}
          maxDisplayWords={maxWords}
          className="w-full h-full"
        />

        {/* Notificação de Erro / Incompatibilidade */}
        {error && (
          <div className="absolute top-4 bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs md:text-sm px-4 py-2 rounded-full backdrop-blur-md shadow-lg flex items-center gap-2 animate-bounce">
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Legenda Dinâmica de Transcrição */}
      {showLiveText && currentSentence && (
        <div className="w-full max-w-2xl px-6 mb-3 z-10 transition-opacity duration-300">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-2 text-center shadow-md">
            <p className="text-xs md:text-sm text-slate-400 font-mono italic truncate">
              "{currentSentence}"
            </p>
          </div>
        </div>
      )}

      {/* Barra de Controle do Palestrante / Telão */}
      {showControls && (
        <div className="w-full px-6 pb-4 flex items-center justify-between gap-4 z-20">
          {/* Badge de Status da Escuta */}
          <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-full px-4 py-1.5 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              {isListening && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  status === 'listening'
                    ? 'bg-emerald-500'
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
            <span className="text-[11px] text-slate-500 font-mono ml-1 border-l border-slate-700/60 pl-2">
              {wordsToDisplay.length} termos ({totalWords} falados)
            </span>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-full p-1 shadow-sm">
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>

            {/* Reiniciar Nuvem */}
            <button
              type="button"
              onClick={reset}
              title="Limpar e reiniciar nuvem de palavras"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-full transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Iniciar / Pausar Microfone */}
            <button
              type="button"
              onClick={toggle}
              title={isListening ? 'Pausar escuta passiva' : 'Iniciar escuta passiva'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isListening
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
              }`}
            >
              {isListening ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
                  </svg>
                  <span>Pausar</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
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
