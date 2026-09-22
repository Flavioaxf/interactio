// packages/types/index.ts
// Tipos compartilhados entre Admin, Telão e Participante.
// Em um monorepo Turborepo/Nx, este pacote é importado como @interactio/types.

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

export type CardType =
  | 'multiple_choice'
  | 'word_cloud'
  | 'open_text'
  | 'rating'
  | 'quiz';

export type CardStatus    = 'draft' | 'active' | 'closed';
export type SessionStatus = 'draft' | 'active' | 'closed';

// ─────────────────────────────────────────────
// Opções de um card de múltipla escolha / quiz
// ─────────────────────────────────────────────

export interface CardOption {
  order: number;
  text:  string;
  /** Apenas para tipo 'quiz' — indica a opção correta */
  isCorrect?: boolean;
}

export interface CardOptions {
  [optionId: string]: CardOption; // ex: "opt_a", "opt_b"
}

// ─────────────────────────────────────────────
// Configuração específica por tipo de card
// ─────────────────────────────────────────────

export interface CardConfig {
  timer:           number;   // segundos; 0 = livre
  anonymous:       boolean;
  allowChange?:    boolean;  // participante pode alterar o voto
  maxWordsPerUser?: number;  // word_cloud
  scale?:          number;   // rating: 5 ou 10
  labelMin?:       string;   // rating
  labelMax?:       string;   // rating
}

// ─────────────────────────────────────────────
// Card (pergunta)
// ─────────────────────────────────────────────

export interface Card {
  order:    number;
  type:     CardType;
  question: string;
  options:  CardOptions | null;
  config:   CardConfig;
  status:   CardStatus;
}

export interface CardMap {
  [cardId: string]: Card;
}

// ─────────────────────────────────────────────
// Resposta de um participante
// ─────────────────────────────────────────────

/** value é string para MC/quiz/rating, string[] para word_cloud, string para open_text */
export interface Response {
  value:      string | string[];
  answeredAt: number; // Unix ms
}

export interface ResponseMap {
  [userId: string]: Response;
}

export interface SessionResponses {
  [cardId: string]: ResponseMap;
}

// ─────────────────────────────────────────────
// Participante (presença online)
// ─────────────────────────────────────────────

export interface Participant {
  displayName: string;
  joinedAt:    number;
  online:      boolean;
}

export interface ParticipantMap {
  [userId: string]: Participant;
}

// ─────────────────────────────────────────────
// Metadados da Sessão
// ─────────────────────────────────────────────

export interface SessionMeta {
  title:     string;
  code:      string;  // código curto legível, ex: "BX-4927"
  hostId:    string;
  createdAt: number;
  status:    SessionStatus;
}

// ─────────────────────────────────────────────
// Sessão completa (nó raiz no Firebase)
// ─────────────────────────────────────────────

export interface Session {
  meta:         SessionMeta;
  activeCardId: string | null;
  cards:        CardMap;
  responses:    SessionResponses;
  participants: ParticipantMap;
}

// ─────────────────────────────────────────────
// Helpers de criação (usados no Admin)
// ─────────────────────────────────────────────

/**
 * Monta um objeto Card pronto para salvar no Firebase.
 * O ID do card é gerado fora desta função (via push()).
 */
export function buildMultipleChoiceCard(params: {
  order:    number;
  question: string;
  options:  string[];   // textos das opções em ordem
  timer:    number;
  anonymous: boolean;
}): Card {
  const options: CardOptions = {};
  const keys = ['opt_a','opt_b','opt_c','opt_d','opt_e'];
  params.options.forEach((text, i) => {
    options[keys[i]] = { order: i + 1, text };
  });

  return {
    order:    params.order,
    type:     'multiple_choice',
    question: params.question,
    options,
    config: {
      timer:       params.timer,
      anonymous:   params.anonymous,
      allowChange: false,
    },
    status: 'draft',
  };
}
