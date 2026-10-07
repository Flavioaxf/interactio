import { NextResponse } from 'next/server';

let GoogleGenerativeAI: any;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  console.warn('⚠️ SDK @google/generative-ai não encontrado. Usando mock estruturado. Execute: npm install @google/generative-ai');
}

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcript ausente ou inválido' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Use mock se SDK não estiver presente ou chave ausente
    if (!GoogleGenerativeAI || !apiKey) {
      console.warn('⚠️ Usando mock para IA WordCloud (SDK ausente ou GEMINI_API_KEY não configurada)');
      
      // Delay simulado de 2 segundos para o efeito visual da Fase 2
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult = [
        { text: "INOVAÇÃO E IA", count: 12 },
        { text: "TECNOLOGIA CLOUD", count: 9 },
        { text: "FUTURO DO TRABALHO", count: 7 },
        { text: "DESAFIOS", count: 6 },
        { text: "PRODUTIVIDADE", count: 5 },
        { text: "EDUCAÇÃO", count: 4 }
      ];
      
      return NextResponse.json({ words: mockResult });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Analise o seguinte transcript bruto (possivelmente com ruídos da transcrição) de um debate ou palestra e extraia os temas e palavras-chave mais relevantes discutidos.
Sintetize sinônimos e agrupe conceitos semanticamente semelhantes em temas unificados.

Regras rigorosas para a saída:
1. Retorne EXATAMENTE UM JSON ARRAY. Nenhuma palavra a mais ou a menos.
2. Cada objeto no array deve ter o formato {"text": "TEMA", "count": numero_importancia}.
3. O "count" é um número inteiro de 1 a 15 representando a relevância/frequência temática (15 = extremamente central).
4. Limite-se a no máximo 20 temas de maior impacto.
5. Os temas (text) devem estar em letras MAIÚSCULAS e ser curtos (1 a 3 palavras no máximo).
6. Não adicione marcação markdown, como \`\`\`json. Apenas o texto bruto do array pronto para JSON.parse().

Transcript:
"${transcript}"
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Limpeza de possíveis formatações markdown que a IA possa incluir por teimosia
    responseText = responseText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    
    let words = [];
    try {
      words = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON da IA:', responseText);
      throw new Error('Formato de resposta da IA inválido');
    }

    return NextResponse.json({ words });
  } catch (error) {
    console.error('Erro na API ai-wordcloud:', error);
    return NextResponse.json({ error: 'Falha ao processar transcript com IA' }, { status: 500 });
  }
}
