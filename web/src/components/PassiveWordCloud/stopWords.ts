/**
 * Dicionário de Stop Words em Português Brasileiro (PT-BR)
 * 
 * Contém artigos, preposições, contrações, pronomes, conjunções, advérbios comuns
 * e marcadores discursivos da linguagem falada (ex: "né", "tipo", "tá").
 * 
 * Utilizado pelo Web Worker para filtrar termos de baixa relevância semântica
 * durante a escuta passiva em tempo real.
 */

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
  'faz', 'fazem', 'fez', 'fizeram', 'fazendo', 'fazer'
];

/** Set para busca O(1) de alta performance */
export const STOP_WORDS_SET: ReadonlySet<string> = new Set(
  STOP_WORDS_PT_BR.map(w => w.toLowerCase())
);

/**
 * Normaliza uma palavra para comparação (remove pontuação e converte para minúsculo).
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Verifica se um termo é considerado stop word em PT-BR.
 */
export function isStopWord(word: string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized || normalized.length <= 1) return true;

  if (STOP_WORDS_SET.has(normalized)) return true;

  // Verifica também a versão sem acentos
  const unaccented = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STOP_WORDS_SET.has(unaccented);
}
