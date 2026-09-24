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
      worker = new Worker(
        new URL('./textProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      handleMessage = (event: MessageEvent<TextProcessorWorkerOutput>) => {
        const data = event.data;
        if (data && data.type === 'WORDS_UPDATED') {
          setWords(data.words);
          setTotalWords(data.totalWords);
        }
      };

      worker.addEventListener('message', handleMessage);
      workerRef.current = worker;
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

  // Envia texto para ser processado pelo worker (ou executa o fallback)
  const dispatchProcessText = useCallback(
    (textToProcess: string) => {
      if (dispatchTimerRef.current) {
        clearTimeout(dispatchTimerRef.current);
      }

      dispatchTimerRef.current = setTimeout(() => {
        if (workerRef.current) {
          const input: TextProcessorWorkerInput = {
            type: 'PROCESS_TEXT',
            text: textToProcess,
            minWordLength,
            maxWords,
          };
          workerRef.current.postMessage(input);
        } else {
          // Fallback síncrono se worker indisponível
          const result = processText(textToProcess, { minWordLength, maxWords });
          setWords(result.words);
          setTotalWords(result.totalWords);
        }
      }, 60);
    },
    [maxWords, minWordLength]
  );

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
        setError('Falha de conexão com o serviço de reconhecimento de voz.');
      } else {
        setError(`Erro no reconhecimento: ${errType}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);

      // Se a intenção do usuário ainda for escutar, reinicia automaticamente
      if (shouldListenRef.current) {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }

        restartTimerRef.current = setTimeout(() => {
          if (shouldListenRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              // Se já estiver iniciando ou ativo, ignora a colisão
            }
          }
        }, 200);
      } else {
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

      const combinedText = (fullAccumulated + ' ' + currentInterim).trim();
      dispatchProcessText(combinedText);
    };

    if (autoStart) {
      shouldListenRef.current = true;
      try {
        recognition.start();
      } catch (e) {
        // Ignora erro inicial de chamada
      }
    }

    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (dispatchTimerRef.current) clearTimeout(dispatchTimerRef.current);
      try {
        recognition.stop();
        recognition.abort();
      } catch (e) {
        // Componente desmontando
      }
      recognitionRef.current = null;
    };
  }, [continuous, interimResults, lang, autoStart, dispatchProcessText]);

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
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignora erro ao parar
      }
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
