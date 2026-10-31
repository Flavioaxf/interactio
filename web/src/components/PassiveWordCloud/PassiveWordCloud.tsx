'use client';

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Sparkles, RotateCcw, BrainCircuit, AlertTriangle } from 'lucide-react';
import { usePassiveListening } from './usePassiveListening';
import { WordCloudGraph } from './WordCloudGraph';
import type { WordFrequency } from '../../types';

export interface PassiveWordCloudProps {
  isRevealed?: boolean;
  aiStatus?: 'listening' | 'generating' | 'revealed';
  question?: string;
  autoStart?: boolean;
  className?: string;
  onWordsUpdated?: (words: WordFrequency[], newAiStatus?: 'revealed' | 'listening') => void;
}

export function PassiveWordCloud({
  isRevealed = false,
  aiStatus,
  question,
  autoStart = true,
  className = '',
  onWordsUpdated
}: PassiveWordCloudProps) {
  // A ORELHA
  const { status, isListening, transcript, error, toggle, reset } = usePassiveListening({ autoStart });

  // O CÉREBRO
  const [aiWords, setAiWords] = useState<WordFrequency[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const actuallyRevealed = isRevealed || aiStatus === 'revealed';

  // O GATILHO DA IA
  useEffect(() => {
    if (actuallyRevealed && transcript.trim().length > 10 && aiWords.length === 0 && !isAnalyzing && !aiError) {
      const fetchAI = async () => {
        setIsAnalyzing(true);
        setAiError(null);
        console.log('🧠 [IA] Enviando texto acumulado para análise:', transcript);
        
        try {
          const res = await fetch('/api/ai-wordcloud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript })
          });
          
          if (!res.ok) throw new Error('Falha na rota da IA (Status: ' + res.status + ')');
          
          const data = await res.json();
          console.log('✨ [IA] Resposta recebida:', data);
          
          const formattedWords = data.words || [];
          setAiWords(formattedWords);
          
          // Envia de volta para o Telão salvar no Firebase (para o PDF puxar depois)
          if (onWordsUpdated) {
            onWordsUpdated(formattedWords, 'revealed');
          }
          
        } catch (err) {
          console.error('🚨 [Erro na IA]:', err);
          setAiError('Falha ao comunicar com a Inteligência Artificial.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      
      fetchAI();
    }
  }, [actuallyRevealed, transcript, aiWords.length, isAnalyzing, aiError, onWordsUpdated]);

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-[#09080e] min-h-[65vh] ${className}`}>
      
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* FASE 1: ESCUTA SILENCIOSA */}
      {!actuallyRevealed && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 z-10 animate-in fade-in duration-700">
          <div className="w-32 h-32 rounded-full border border-purple-500/30 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(167,139,250,0.1)]">
            <Mic className={`w-10 h-10 ${isListening ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Escuta de Palco Ativa</h1>
          <p className="text-[#8e8b9f] mb-8">Acumulando contexto do debate em background...</p>
        </div>
      )}

      {/* FASE 2: IA PENSANDO */}
      {actuallyRevealed && isAnalyzing && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center px-6 z-10 animate-in fade-in zoom-in duration-500">
          <BrainCircuit className="w-16 h-16 text-purple-400 animate-bounce mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">A Inteligência Artificial está analisando o debate...</h2>
          <p className="text-purple-300/60 animate-pulse">Extraindo os temas mais relevantes</p>
        </div>
      )}

      {/* FASE 3: NUVEM REVELADA */}
      {actuallyRevealed && !isAnalyzing && (
        <div className="relative w-full flex-1 flex flex-col items-center justify-between z-10 pt-8 pb-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="text-center z-20 mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300">
                Síntese do Debate Gerada por IA
              </span>
            </div>
            {question && <h2 className="text-2xl font-extrabold text-white">{question}</h2>}
          </div>

          {aiError ? (
            <div className="flex flex-col items-center justify-center flex-1 text-rose-400 gap-4">
              <AlertTriangle className="w-12 h-12" />
              <p className="text-center px-6">{aiError}</p>
            </div>
          ) : (
            <div className="w-full flex-1 flex items-center justify-center">
              {aiWords.length > 0 ? (
                <div style={{ flex: 1, minHeight: 480, display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <WordCloudGraph 
                    words={aiWords.map((w: any) => ({ 
                      text: w.word || w.text, 
                      count: w.count || w.value || 1 
                    }))} 
                    minFontSize={24} 
                    maxFontSize={84} 
                  />
                </div>
              ) : (
                <p className="text-slate-500">Nenhum termo relevante extraído da fala.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controles Debug (Invisíveis no telão, aparecem ao passar o mouse) */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-10 hover:opacity-100 transition-opacity z-50">
        <button onClick={toggle} className="p-2 bg-white/10 rounded-full text-white">{isListening ? <MicOff size={16}/> : <Mic size={16}/>}</button>
        <button onClick={reset} className="p-2 bg-white/10 rounded-full text-white"><RotateCcw size={16}/></button>
      </div>
    </div>
  );
}