import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, off, onValue, push, set, update, remove } from 'firebase/database';
import type { Card, Response, Session } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyB8ajCQBTRYqbk7QMJHrr7XBhOl2iJigq0",
  authDomain: "interactio-85336.firebaseapp.com",
  projectId: "interactio-85336",
  storageBucket: "interactio-85336.firebasestorage.app",
  messagingSenderId: "710301574624",
  appId: "1:710301574624:web:0589c17b26fca67d77b785",
  measurementId: "G-WKN6RJTZ04",
  databaseURL: "https://interactio-85336-default-rtdb.firebaseio.com" 
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db   = getDatabase(app);
export const auth = getAuth(app);

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

export async function signInAnon(): Promise<string> {
  const { user } = await signInAnonymously(auth);
  return user.uid;
}

export async function addCardToSession(sessionId: string, card: Card): Promise<string> {
  const cardsRef = Refs.cards(sessionId);
  const newCardRef = push(cardsRef);               // gera ID único
  await set(newCardRef, card);
  return newCardRef.key!;
}

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

export async function resolveSessionCode(code: string): Promise<string | null> {
  const db = getDatabase();
  const snap = await get(ref(db, `interactio/sessions/${code}`)); 
  return snap.exists() ? code : null;
}

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

export async function leaveSession(sessionId: string, uid: string) {
  const presenceRef = ref(db, `interactio/sessions/${sessionId}/participants/${uid}`);
  try {
    await remove(presenceRef);
    console.log("Participante removido com sucesso");
  } catch (error) {
    console.error("Erro ao remover participante:", error);
  }
}

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

export function listenActiveCard(
  sessionId: string,
  callback:  (cardId: string | null) => void,
): () => void {
  const r = Refs.activeCardId(sessionId);
  const handler = onValue(r, snap => callback(snap.val() as string | null));
  return () => off(r, 'value', handler);
}

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

export function listenSession(
  sessionId: string,
  callback:  (session: Session | null) => void,
): () => void {
  const r = Refs.session(sessionId);
  const handler = onValue(r, snap => callback(snap.val() as Session | null));
  return () => off(r, 'value', handler);
}
