/**
 * textProcessor.worker.ts
 * 
 * Web Worker dedicado para processamento e contagem assíncrona de palavras
 * em tempo real, evitando bloqueios na thread principal (React).
 */

import { isStopWord, normalizeWord } from './stopWords';
import type {
  TextProcessorWorkerInput,
  TextProcessorWorkerOutput,
  WordFrequency,
} from '../../types';

export interface ProcessTextOptions {
  minWordLength?: number;
  maxWords?: number;
}

/**
 * Limpa o texto recebido, remove caracteres especiais e números,
 * filtra stop words em PT-BR e retorna um array ordenado por frequência.
 */
export function processText(
  rawText: string,
  options: ProcessTextOptions = {}
): { words: WordFrequency[]; totalWords: number } {
  const minWordLength = options.minWordLength ?? 2;
  const maxWords = options.maxWords ?? 80;

  if (!rawText || typeof rawText !== 'string') {
    return { words: [], totalWords: 0 };
  }

  // 1. Limpeza: substitui pontuações, caracteres especiais e números por espaços
  // Preserva todas as letras Unicode (incluindo acentuação em PT-BR)
  const cleaned = rawText
    .replace(/[^\p{L}\s]/gu, ' ')
    .toLowerCase();

  // 2. Tokenização por espaços em branco
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  const freqMap = new Map<string, number>();
  let validWordCount = 0;

  // 3. Filtragem e contabilização
  for (let i = 0; i < tokens.length; i++) {
    const word = normalizeWord(tokens[i]);

    // Ignora termos menores que o tamanho mínimo estipulado
    if (word.length < minWordLength) {
      continue;
    }

    // Ignora termos contidos no dicionário de Stop Words PT-BR
    if (isStopWord(word)) {
      continue;
    }

    validWordCount++;
    const current = freqMap.get(word) ?? 0;
    freqMap.set(word, current + 1);
  }

  // 4. Converte para array e ordena por frequência decrescente
  const sortedWords: WordFrequency[] = Array.from(freqMap.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

  // 5. Aplica limite de palavras se configurado
  const words = maxWords > 0 ? sortedWords.slice(0, maxWords) : sortedWords;

  return {
    words,
    totalWords: validWordCount,
  };
}

// ─────────────────────────────────────────────
// Listener de mensagens do Web Worker (executado estritamente no contexto de Web Worker do navegador, protegido contra SSR)
// ─────────────────────────────────────────────

if (
  typeof self !== 'undefined' &&
  typeof window === 'undefined' &&
  typeof (self as any).addEventListener === 'function' &&
  typeof (self as any).postMessage === 'function'
) {
  const handleWorkerMessage = (event: MessageEvent<TextProcessorWorkerInput>) => {
    const data = event.data;
    if (!data) return;

    switch (data.type) {
      case 'PROCESS_TEXT': {
        const text = data.text ?? '';
        const { words, totalWords } = processText(text, {
          minWordLength: data.minWordLength,
          maxWords: data.maxWords,
        });

        const response: TextProcessorWorkerOutput = {
          type: 'WORDS_UPDATED',
          words,
          totalWords,
        };

        (self as any).postMessage(response);
        break;
      }

      case 'RESET': {
        const response: TextProcessorWorkerOutput = {
          type: 'WORDS_UPDATED',
          words: [],
          totalWords: 0,
        };

        (self as any).postMessage(response);
        break;
      }

      default:
        break;
    }
  };

  (self as any).addEventListener('message', handleWorkerMessage);
  (self as any).onmessage = handleWorkerMessage;
}

