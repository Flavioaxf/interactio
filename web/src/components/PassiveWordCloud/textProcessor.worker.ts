/**
 * textProcessor.worker.ts
 * 
 * Web Worker dedicado para processamento e contagem assíncrona de palavras
 * em tempo real, evitando bloqueios na thread principal (React).
 * Totalmente isolado e independente de módulos externos para empacotamento seguro no Next.js.
 */

// ─────────────────────────────────────────────
// Tipagens locais (zero dependências externas)
// ─────────────────────────────────────────────

export interface WordFrequency {
  text: string;
  count: number;
}

export interface TextProcessorWorkerInput {
  type: 'PROCESS_TEXT' | 'RESET';
  text?: string;
  minWordLength?: number;
  maxWords?: number;
}

export interface TextProcessorWorkerOutput {
  type: 'WORDS_UPDATED';
  words: WordFrequency[];
  totalWords: number;
}

export interface ProcessTextOptions {
  minWordLength?: number;
  maxWords?: number;
}

// ─────────────────────────────────────────────
// Dicionário de Stop Words em PT-BR (embutido)
// ─────────────────────────────────────────────

export const STOP_WORDS_PT_BR: readonly string[] = [
  // Artigos definidos e indefinidos
  'o', 'a', 'os', 'as',
  'um', 'uma', 'uns', 'umas',

  // Preposições essenciais e acidentais
  'a', 'ante', 'apos', 'após', 'ate', 'até',
  'com', 'contra', 'de', 'desde', 'em', 'entre',
  'para', 'per', 'perante', 'por', 'sem', 'sob', 'sobre', 'tras', 'trás',

  // Contrações e formas combinadas
  'do', 'da', 'dos', 'das',
  'no', 'na', 'nos', 'nas',
  'pelo', 'pela', 'pelos', 'pelas',
  'pro', 'pra', 'pros', 'pras',
  'dum', 'duma', 'duns', 'dumas',
  'num', 'numa', 'nuns', 'numas',
  'ao', 'aos', 'a', 'à', 'as', 'às',
  'daqui', 'dali', 'dai', 'daí',

  // Pronomes pessoais e de tratamento
  'eu', 'tu', 'ele', 'ela', 'nos', 'nós', 'vos', 'vós', 'eles', 'elas',
  'me', 'te', 'se', 'lhe', 'lhes', 'mim', 'ti', 'si',
  'comigo', 'contigo', 'consigo', 'conosco', 'convosco',
  'voce', 'você', 'voces', 'vocês', 'gente',

  // Pronomes possessivos
  'meu', 'minha', 'meus', 'minhas',
  'teu', 'tua', 'teus', 'tuas',
  'seu', 'sua', 'seus', 'suas',
  'nosso', 'nossa', 'nossos', 'nossas',
  'vosso', 'vossa', 'vossos', 'vossas',

  // Pronomes demonstrativos
  'este', 'esta', 'estes', 'estas', 'isto',
  'esse', 'essa', 'esses', 'essas', 'isso',
  'aquele', 'aquela', 'aqueles', 'aquelas', 'aquilo',
  'deste', 'desta', 'destes', 'destas', 'disto',
  'desse', 'dessa', 'desses', 'dessas', 'disso',
  'daquele', 'daquela', 'daqueles', 'daquelas', 'daquilo',
  'neste', 'nesta', 'nestes', 'nestas', 'nisto',
  'nesse', 'nessa', 'nesses', 'nessas', 'nisso',
  'naquele', 'naquela', 'naqueles', 'naquelas', 'naquilo',

  // Pronomes relativos, interrogativos e indefinidos
  'que', 'quem', 'onde', 'cujo', 'cuja', 'cujos', 'cujas',
  'qual', 'quais', 'quanto', 'quanta', 'quantos', 'quantas',
  'alguem', 'alguém', 'ninguem', 'ninguém', 'tudo', 'nada', 'algo',
  'cada', 'outro', 'outra', 'outros', 'outras',
  'muito', 'muita', 'muitos', 'muitas',
  'pouco', 'pouca', 'poucos', 'poucas',
  'tanto', 'tanta', 'tantos', 'tantas',
  'qualquer', 'quaisquer',

  // Conjunções coordenativas e subordinativas
  'e', 'mas', 'porem', 'porém', 'contudo', 'todavia', 'entretanto',
  'ou', 'ora', 'quer', 'ja', 'já',
  'logo', 'portanto', 'pois', 'porque', 'por que', 'porquê', 'porquanto',
  'se', 'caso', 'como', 'conforme', 'segundo', 'consoante',
  'embora', 'enquanto', 'quando',

  // Advérbios comuns e marcadores
  'nao', 'não', 'sim', 'tambem', 'também',
  'mais', 'menos', 'tao', 'tão',
  'bem', 'mal', 'assim',
  'aqui', 'ali', 'ai', 'aí', 'la', 'lá', 'ca', 'cá',
  'agora', 'depois', 'antes', 'hoje', 'ontem', 'amanha', 'amanhã',
  'sempre', 'nunca', 'jamais',
  'talvez', 'apenas', 'so', 'só', 'somente', 'quase',

  // Marcadores orais e vícios de linguagem em palestras
  'ne', 'né', 'tipo', 'ta', 'tá', 'to', 'tô',
  'entao', 'então', 'dai', 'daí',
  'ah', 'eh', 'éh', 'oh', 'ó', 'ai', 'ué',
  'veja', 'olha', 'sabe', 'entende', 'beleza', 'ok',

  // Formas verbais auxiliares e de altíssima frequência (ser, estar, ter, haver, ir, fazer)
  'e', 'é', 'era', 'foi', 'foram', 'fomos', 'sendo', 'sido', 'sou', 'somos', 'sao', 'são', 'ser', 'sera', 'será', 'serao', 'serão',
  'esta', 'está', 'estao', 'estão', 'estava', 'estavam', 'estive', 'estiveram', 'estamos', 'estar',
  'tem', 'têm', 'temos', 'tinha', 'tinham', 'teve', 'tiveram', 'ter', 'tera', 'terá',
  'ha', 'há', 'havia', 'haviam', 'houve', 'haver',
  'vai', 'vao', 'vão', 'vou', 'vamos', 'ia', 'iam', 'foi', 'ir',
  'faz', 'fazem', 'fez', 'fizeram', 'fazendo', 'fazer',
];

export const STOP_WORDS_SET: ReadonlySet<string> = new Set(
  STOP_WORDS_PT_BR.map(w => w.toLowerCase())
);

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function isStopWord(word: string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized || normalized.length <= 1) return true;

  if (STOP_WORDS_SET.has(normalized)) return true;

  const unaccented = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STOP_WORDS_SET.has(unaccented);
}

// ─────────────────────────────────────────────
// Função principal de processamento de texto
// ─────────────────────────────────────────────

export function processText(
  rawText: string,
  options: ProcessTextOptions = {}
): { words: WordFrequency[]; totalWords: number } {
  const minWordLength = options.minWordLength ?? 2;
  const maxWords = options.maxWords ?? 80;

  if (!rawText || typeof rawText !== 'string') {
    return { words: [], totalWords: 0 };
  }

  // 1. Limpeza: preserva todas as letras Unicode (incluindo acentuação em PT-BR)
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

    if (word.length < minWordLength) {
      continue;
    }

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

  const words = maxWords > 0 ? sortedWords.slice(0, maxWords) : sortedWords;

  return {
    words,
    totalWords: validWordCount,
  };
}

// ─────────────────────────────────────────────
// Listener de mensagens do Web Worker (executado estritamente no contexto de Web Worker do navegador)
// ─────────────────────────────────────────────

let persistentFreqMap = new Map<string, number>();
let totalSpokenWords = 0;
let totalValidTerms = 0;

if (
  typeof self !== 'undefined' &&
  typeof window === 'undefined'
) {
  const handleWorkerMessage = (event: MessageEvent<any>) => {
    const data = event.data;
    if (!data) return;

    if (data.action === 'PROCESS_TEXT' || data.type === 'PROCESS_TEXT') {
      const text = data.text ?? '';
      const minWordLength = data.minWordLength ?? 2;
      const maxWords = data.maxWords ?? 80;

      if (text && typeof text === 'string') {
        const cleaned = text.replace(/[^\p{L}\s]/gu, ' ').toLowerCase();
        const tokens = cleaned.split(/\s+/).filter(Boolean);

        for (let i = 0; i < tokens.length; i++) {
          const word = normalizeWord(tokens[i]);
          if (word.length > 0) {
            totalSpokenWords++;
          }
          
          if (word.length >= minWordLength && !isStopWord(word)) {
            const current = persistentFreqMap.get(word) ?? 0;
            persistentFreqMap.set(word, current + 1);
            totalValidTerms++;
          }
        }
      }

      const sortedWords = Array.from(persistentFreqMap.entries())
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));

      const words = maxWords > 0 ? sortedWords.slice(0, maxWords) : sortedWords;

      if (typeof (self as any).postMessage === 'function') {
        (self as any).postMessage({
          type: 'WORDS_UPDATED',
          words,
          totalSpoken: totalSpokenWords,
          totalTerms: totalValidTerms
        });
      }
    } else if (data.action === 'RESET' || data.type === 'RESET') {
      persistentFreqMap.clear();
      totalSpokenWords = 0;
      totalValidTerms = 0;

      if (typeof (self as any).postMessage === 'function') {
        (self as any).postMessage({
          type: 'WORDS_UPDATED',
          words: [],
          totalSpoken: 0,
          totalTerms: 0
        });
      }
    }
  };

  if (typeof (self as any).addEventListener === 'function') {
    (self as any).addEventListener('message', handleWorkerMessage);
  }
  (self as any).onmessage = handleWorkerMessage;
}
