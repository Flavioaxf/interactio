'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PassiveListeningStatus } from '../../types';

export interface UsePassiveListeningOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  autoStart?: boolean;
}

export interface UsePassiveListeningReturn {
  status: PassiveListeningStatus;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
}

export function usePassiveListening({
  lang = 'pt-BR',
  continuous = true,
  interimResults = true,
  autoStart = false,
}: UsePassiveListeningOptions = {}): UsePassiveListeningReturn {
  const [status, setStatus] = useState<PassiveListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const isIntentionallyPaused = useRef(!autoStart);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setStatus('unsupported');
      setError('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      console.log('🎤 [Microfone] Escuta iniciada com sucesso.');
      setStatus('listening');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          console.log('🗣️ [Voz Captada]:', text.trim());
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + text.trim();
        } else {
          currentInterim += text;
        }
      }

      setTranscript(finalTranscriptRef.current);
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return; // Ignora o erro silenciosamente
      
      console.warn(`⚠️ [Erro no Microfone]: ${event.error}`);
      
      if (event.error === 'not-allowed') {
        setStatus('error');
        setError('Acesso ao microfone negado.');
        setIsListening(false);
        isIntentionallyPaused.current = true;
      }
    };

    recognition.onend = () => {
      if (!isIntentionallyPaused.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Falha ao reconectar o microfone:', e);
          }
        }, 500); 
      } else {
        setIsListening(false);
        setStatus('idle');
      }
    };

    recognitionRef.current = recognition;

    if (autoStart) {
      isIntentionallyPaused.current = false;
      try { recognition.start(); } catch (e) {}
    }

    return () => {
      isIntentionallyPaused.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, [lang, continuous, interimResults, autoStart]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    isIntentionallyPaused.current = false;
    try { recognitionRef.current.start(); } catch (e) {}
  }, []);

  const stop = useCallback(() => {
    isIntentionallyPaused.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    setStatus('idle');
  }, []);

  const toggle = useCallback(() => {
    isListening ? stop() : start();
  }, [isListening, start, stop]);

  const reset = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return { status, isListening, transcript, interimTranscript, error, start, stop, toggle, reset };
}