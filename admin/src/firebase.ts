// packages/firebase/config.ts
// Configuração central do Firebase — importada pelos três apps.

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, off, onValue, push, ref, set, update } from 'firebase/database';
import type { Card, Response, Session } from './types';

// ─────────────────────────────────────────────
// Inicialização (singleton — evita reinit no hot-reload)
// ─────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "AIzaSyB8ajCQBTRYqbk7QMJHrr7XBhOl2iJigq0",
  authDomain: "interactio-85336.firebaseapp.com",
  projectId: "interactio-85336",
  storageBucket: "interactio-85336.firebasestorage.app",
  messagingSenderId: "710301574624",
  appId: "1:710301574624:web:0589c17b26fca67d77b785",
  measurementId: "G-WKN6RJTZ04"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db   = getDatabase(app);
export const auth = getAuth(app);

// ─────────────────────────────────────────────
// Refs tipadas — centralizam os caminhos do DB
// ─────────────────────────────────────────────

export const Refs = {
  session:      (sid: string)               => ref(db, `interactio/sessions/${sid}`),
  sessionMeta:  (sid: string)               => ref(db, `interactio/sessions/${sid}/meta`),
  activeCardId: (sid: string)               => ref(db, `interactio/sessions/${sid}/activeCardId`),
  cards:        (sid: string)               => ref(db, `interactio/sessions/${sid}/cards`),
  card:         (sid: string, cid: string)  => ref(db, `interactio/sessions/${sid}/cards/${cid}`),
  responses:    (sid: string, cid: string)  => ref(db, `interactio/sessions/${sid}/responses/${cid}`),
  response:     (sid: string, cid: string, uid: string) =>
                                               ref(db, `interactio/sessions/${sid}/responses/${cid}/${uid}`),
  participants: (sid: string)               => ref(db, `interactio/sessions/${sid}/participants`),
  participant:  (sid: string, uid: string)  => ref(db, `interactio/sessions/${sid}/participants/${uid}`),
  sessionCodes: ()                          => ref(db, `interactio/sessionCodes`),
  codeToId:     (code: string)              => ref(db, `interactio/sessionCodes/${code}`),
};

// ─────────────────────────────────────────────
// Auth — login anônimo para participantes
// ─────────────────────────────────────────────

export async function signInAnon(): Promise<string> {
  const { user } = await signInAnonymously(auth);
  return user.uid;
}

// ─────────────────────────────────────────────
// API do Admin
// ─────────────────────────────────────────────

/**
 * Adiciona um card à sessão e retorna o ID gerado pelo Firebase.
 * O card é salvo com status 'draft' — só vai ao ar quando setActiveCard() for chamado.
 */
export async function addCardToSession(sessionId: string, card: Card): Promise<string> {
  const cardsRef = Refs.cards(sessionId);
  const newCardRef = push(cardsRef);               // gera ID único
  await set(newCardRef, card);
  return newCardRef.key!;
}

/**
 * Ativa um card: atualiza activeCardId na sessão e
 * muda o status do card anterior para 'closed' e do novo para 'active'.
 * Operação atômica via multi-path update.
 */
export async function setActiveCard(
  sessionId:     string,
  newCardId:     string,
  previousCardId: string | null,
): Promise<void> {
  const updates: Record<string, unknown> = {
    [`interactio/sessions/${sessionId}/activeCardId`]: newCardId,
    [`interactio/sessions/${sessionId}/cards/${newCardId}/status`]: 'active',
  };
  if (previousCardId) {
    updates[`interactio/sessions/${sessionId}/cards/${previousCardId}/status`] = 'closed';
  }
  await update(ref(db), updates);
}

// ─────────────────────────────────────────────
// API do Participante
// ─────────────────────────────────────────────

/**
 * Resolve o código curto (ex: "BX-4927") para o sessionId interno.
 * Retorna null se o código não existir.
 */
export async function resolveSessionCode(code: string): Promise<string | null> {
  const snap = await get(Refs.codeToId(code.toUpperCase()));
  return snap.exists() ? (snap.val() as string) : null;
}

/**
 * Registra a presença do participante.
 * onDisconnect garante remoção automática ao fechar o browser/app.
 */
export async function joinSession(sessionId: string, uid: string): Promise<void> {
  const { onDisconnect } = await import('firebase/database');
  const presenceRef = Refs.participant(sessionId, uid);
  await set(presenceRef, {
    displayName: `Anônimo #${uid.slice(-4)}`,
    joinedAt:    Date.now(),
    online:      true,
  });
  onDisconnect(presenceRef).remove();
}

/**
 * Envia a resposta do participante para um card.
 * A chave é o uid — garante exatamente 1 resposta por usuário por card.
 */
export async function submitResponse(
  sessionId: string,
  cardId:    string,
  uid:       string,
  value:     string | string[],
): Promise<void> {
  const responsePayload: Response = {
    value,
    answeredAt: Date.now(),
  };
  await set(Refs.response(sessionId, cardId, uid), responsePayload);
}

// ─────────────────────────────────────────────
// Listeners em tempo real
// ─────────────────────────────────────────────

/**
 * Ouve mudanças no activeCardId.
 * Retorna função de unsubscribe para limpar no useEffect.
 */
export function listenActiveCard(
  sessionId: string,
  callback:  (cardId: string | null) => void,
): () => void {
  const r = Refs.activeCardId(sessionId);
  const handler = onValue(r, snap => callback(snap.val() as string | null));
  return () => off(r, 'value', handler);
}

/**
 * Ouve mudanças nas respostas de um card específico.
 * O Telão usa este listener para atualizar o gráfico em tempo real.
 */
export function listenResponses(
  sessionId: string,
  cardId:    string,
  callback:  (responses: Record<string, Response>) => void,
): () => void {
  const r = Refs.responses(sessionId, cardId);
  const handler = onValue(r, snap => {
    callback((snap.val() ?? {}) as Record<string, Response>);
  });
  return () => off(r, 'value', handler);
}

/**
 * Ouve a sessão inteira (meta + activeCardId + cards).
 * Usado pelo Telão para carregar a estrutura inicial.
 */
export function listenSession(
  sessionId: string,
  callback:  (session: Session | null) => void,
): () => void {
  const r = Refs.session(sessionId);
  const handler = onValue(r, snap => callback(snap.val() as Session | null));
  return () => off(r, 'value', handler);
}
