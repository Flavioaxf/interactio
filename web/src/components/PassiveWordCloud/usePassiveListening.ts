'use client';

/**
 * usePassiveListening.ts
 * 
 * Custom hook para escuta passiva contínua através da Web Speech API.
 * Gerencia ciclo de vida do microfone, reinicializações automáticas após pausas
 * de silêncio e delega a contagem e filtragem de palavras para o textProcessor.worker.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PassiveListeningStatus,
  WordFrequency,
  TextProcessorWorkerInput,
  TextProcessorWorkerOutput,
} from '../../types';
import { processText } from './textProcessor.worker';

export interface UsePassiveListeningOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxWords?: number;
  minWordLength?: number;
  autoStart?: boolean;
}

export interface UsePassiveListeningReturn {
  status: PassiveListeningStatus;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  words: WordFrequency[];
  totalWords: number;
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
    maxWords = 80,
    minWordLength = 2,
    autoStart = false,
  } = options;

  const [status, setStatus] = useState<PassiveListeningStatus>('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [words, setWords] = useState<WordFrequency[]>([]);
  const [totalWords, setTotalWords] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const shouldListenRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dispatchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializa o Web Worker e registra event listeners de forma segura dentro do useEffect (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let worker: Worker | null = null;
    let handleMessage: ((event: MessageEvent<TextProcessorWorkerOutput>) => void) | null = null;

    try {
      worker = new Worker(new URL('./textProcessor.worker.ts', import.meta.url));

      handleMessage = (event: MessageEvent<any>) => {
        const data = event.data;
        console.log('⚙️ Worker devolveu:', data);
        if (data && data.type === 'WORDS_UPDATED') {
          setWords(data.words || []);
          setTotalWords(data.totalSpoken || 0);
        }
      };

      worker.onmessage = handleMessage;
      worker.addEventListener('message', handleMessage);
      workerRef.current = worker;
      workerRef.current.onerror = (error) => console.error('🚨 Erro crítico no Worker:', error);
    } catch (err) {
      console.warn(
        '[usePassiveListening] Web Worker não pôde ser instanciado diretamente. Usando processamento síncrono como fallback.',
        err
      );
      workerRef.current = null;
    }

    return () => {
      if (worker) {
        if (handleMessage) {
          worker.removeEventListener('message', handleMessage);
        }
        worker.terminate();
      }
      workerRef.current = null;
    };
  }, []);


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
        // Se a API estiver em transição ou colisão de estado, agenda retry
        if (shouldListenRef.current) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
                setStatus('listening');
              } catch (e) {
                // Já ativo
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

      // 'no-speech' ocorre rotineiramente quando o locutor pausa a fala; não deve abortar
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
      // Força o reinício da escuta automaticamente enquanto o estado indicar que deve continuar a escutar
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
          if (workerRef.current && text.trim()) {
            workerRef.current.postMessage({
              action: 'PROCESS_TEXT',
              text: text.trim(),
              minWordLength,
              maxWords
            });
          }
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
      if (dispatchTimerRef.current) {
        clearTimeout(dispatchTimerRef.current);
        dispatchTimerRef.current = null;
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

      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch (e) {}
        workerRef.current = null;
      }
    };
  }, [continuous, interimResults, lang, autoStart]);

  // Controles públicos
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
    } catch (e) {
      // Caso já esteja iniciado, sem efeito adverso
    }
  }, [status]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (dispatchTimerRef.current) {
      clearTimeout(dispatchTimerRef.current);
      dispatchTimerRef.current = null;
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

    if (workerRef.current) {
      try {
        workerRef.current.terminate();
      } catch (e) {}
      workerRef.current = null;
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
    setWords([]);
    setTotalWords(0);

    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET' } as TextProcessorWorkerInput);
    }
  }, []);

  return {
    status,
    isListening,
    transcript,
    interimTranscript,
    words,
    totalWords,
    error,
    start,
    stop,
    toggle,
    reset,
  };
}
