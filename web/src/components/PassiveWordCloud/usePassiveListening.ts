'use client';

/**
 * usePassiveListening.ts
 * 
 * Custom hook para escuta passiva contínua através da Web Speech API.
 * Acumula o transcript contínuo que será enviado posteriormente para a IA.
 */

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

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: any) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: any) => any) | null;
}

export function usePassiveListening(
  options: UsePassiveListeningOptions = {}
): UsePassiveListeningReturn {
  const {
    lang = 'pt-BR',
    continuous = true,
    interimResults = true,
    autoStart = false,
  } = options;

  const [status, setStatus] = useState<PassiveListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inicialização da SpeechRecognition API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionConstructor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setStatus('unsupported');
      setError('A API de Reconhecimento de Fala (Web Speech API) não é suportada por este navegador.');
      return;
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionConstructor();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognitionRef.current = recognition;

    const startRecognitionSafely = () => {
      if (!shouldListenRef.current || !recognitionRef.current) return;
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setStatus('listening');
        setError(null);
      } catch (err: any) {
        if (shouldListenRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
                setStatus('listening');
              } catch (e) {
              }
            }
          }, 200);
        }
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setError(null);
    };

    recognition.onerror = (event: any) => {
      const errType = event.error;

      if (errType === 'no-speech') {
        return;
      }

      if (errType === 'not-allowed' || errType === 'service-not-allowed') {
        shouldListenRef.current = false;
        setIsListening(false);
        setStatus('error');
        setError('Acesso ao microfone negado ou bloqueado nas configurações do navegador.');
        return;
      }

      if (errType === 'network') {
        setError('Falha de conexão com o serviço de reconhecimento de voz. Tentando reconectar...');
      } else {
        console.warn('[usePassiveListening] Aviso no reconhecimento de voz:', errType);
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }

        restartTimerRef.current = setTimeout(() => {
          startRecognitionSafely();
        }, 100);
      } else {
        setIsListening(false);
        setStatus('idle');
      }
    };

    recognition.onresult = (event: any) => {
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript ?? '';

        if (item.isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + text.trim();
        } else {
          currentInterim += (currentInterim ? ' ' : '') + text.trim();
        }
      }

      const fullAccumulated = finalTranscriptRef.current;
      setTranscript(fullAccumulated);
      setInterimTranscript(currentInterim);
    };

    if (autoStart) {
      shouldListenRef.current = true;
      startRecognitionSafely();
    }

    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (recognition) {
        recognition.onstart = null;
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        try {
          recognition.stop();
        } catch (e) {}
        try {
          recognition.abort();
        } catch (e) {}
      }
      recognitionRef.current = null;
    };
  }, [continuous, interimResults, lang, autoStart]);

  const start = useCallback(() => {
    if (!recognitionRef.current) {
      if (status === 'unsupported') {
        setError('Reconhecimento de voz não suportado neste navegador.');
      }
      return;
    }

    shouldListenRef.current = true;
    setError(null);
    setStatus('listening');

    try {
      recognitionRef.current.start();
    } catch (e) {}
  }, [status]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      rec.onstart = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      try {
        rec.stop();
      } catch (e) {}
      try {
        rec.abort();
      } catch (e) {}
    }

    setIsListening(false);
    setStatus('idle');
  }, []);

  const toggle = useCallback(() => {
    if (shouldListenRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const reset = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    status,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    toggle,
    reset,
  };
}
