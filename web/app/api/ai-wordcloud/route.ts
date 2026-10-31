import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

// Lê a chave do .env.local e remove espaços/aspas que possam ter vindo junto
const apiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

// O modelo vem do .env.local (GEMINI_MODEL). Se não existir, usa este,
// que foi o que passou no teste.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
  try {
    // Agora recebemos também o 'title' (título da apresentação) enviado pelo frontend
    const { transcript, title } = await req.json();

    // Prompt: pede as palavras mais importantes usando o título como âncora de contexto,
    // sem inventar temas e usando a escala de importância inteira (1 a 10).
    const prompt = `Você é um algoritmo de extração de palavras-chave de uma conversa transcrita por reconhecimento de voz.
O título/tema desta apresentação é: "${title || 'Tema Geral'}".

REGRAS:
1. Use o título da apresentação APENAS como uma métrica de contexto para dar mais peso (maior 'count') às palavras que têm forte ligação com ele.
2. NÃO INVENTE temas ou palavras. Use APENAS termos que aparecem efetivamente na conversa transcrita. O título serve para filtrar, não para criar.
3. Corrija erros óbvios de reconhecimento de voz (ex: "robática" -> "Robótica").
4. Ignore palavras de ligação. Se dois termos tiverem o mesmo sentido, escolha só o mais importante.
5. Retorne NO MÁXIMO 15 termos, de 1 a 3 palavras cada.
6. 'count' é a importância de 1 a 10. Use a escala toda: o tema central recebe 10, os temas secundários entre 4 e 7, e os detalhes entre 1 e 3.
7. Retorne APENAS este JSON: { "words": [ { "word": "termo", "count": 5 } ] }
8. Não repita temas: se vários termos tratam da mesma ideia (ex: "escolas", "ensino", "educação"), mantenha só o mais representativo e use as vagas para outras ideias do texto.
9. Prefira conceitos e ações (ex: "personalização das aulas") a palavras genéricas. Não complete termos que não foram ditos.

Texto da conversa: "${transcript}"`;

    // responseMimeType faz o Gemini devolver JSON puro (sem ```json em volta)
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    // Se vier vazio, devolve uma lista vazia em vez de quebrar
    return NextResponse.json(JSON.parse(response.text || '{"words":[]}'));
  } catch (error: any) {
    // Mostra o motivo real do erro no terminal
    console.error('Erro na IA (modelo: ' + MODEL_NAME + '):', error?.message || error);
    return NextResponse.json({ error: 'Falha ao gerar nuvem' }, { status: 500 });
  }
}