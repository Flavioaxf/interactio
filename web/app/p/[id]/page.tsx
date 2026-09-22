'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, set, remove, onDisconnect } from 'firebase/database';
import { db } from '../../../src/firebase'; 
import { ChevronLeft } from 'lucide-react'; 

export default function ParticipantSession() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params.id === 'string' ? params.id.toUpperCase() : '';

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [myResponse, setMyResponse] = useState<any>(null);
  
  const [wordInput, setWordInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');

  useEffect(() => {
    let id = sessionStorage.getItem('participantId');
    if (!id) {
      id = 'part_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('participantId', id);
    }
    setParticipantId(id);
  }, []);

  useEffect(() => {
    if (!sessionId || !participantId) return;
    
    // 🔥 CORRIGIDO: Voltamos para o caminho original que o seu Admin usa!
    const sessionRef = ref(db, `sessions/${sessionId}`);
    const presenceRef = ref(db, `sessions/${sessionId}/participants/${participantId}`);

    // ── LÓGICA DE PRESENÇA ──
    // ── LÓGICA DE PRESENÇA ──
    set(presenceRef, true);
    onDisconnect(presenceRef).remove();

    // Função que atira a remoção para o Firebase
    const forceCleanup = () => {
      remove(presenceRef);
    };

    // Ouve quando o navegador do celular tenta congelar ou fechar a aba
    window.addEventListener('beforeunload', forceCleanup);
    window.addEventListener('pagehide', forceCleanup);

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      setSessionData(data);
      
      if (data && data.interactions) {
        const currentIndex = data.currentInteraction ?? 0;
        const currentInteraction = data.interactions[currentIndex];
        
        if (currentInteraction) {
          const myData = data.responses?.[currentIndex]?.[participantId];
          setMyResponse(myData !== undefined ? myData : null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    // ── LÓGICA DE SAÍDA (CLEANUP) ──
    return () => {
      unsubscribe();
      forceCleanup(); // Dispara se o React conseguir destruir o componente
      window.removeEventListener('beforeunload', forceCleanup);
      window.removeEventListener('pagehide', forceCleanup);
    };
  }, [sessionId, participantId]);

  const handleExit = async () => {
    // Força a remoção manual no banco antes de mudar de tela
    if (sessionId && participantId) {
      const presenceRef = ref(db, `sessions/${sessionId}/participants/${participantId}`);
      await remove(presenceRef); 
    }
    router.replace('/');
  };

  const getOptionLetter = (index: number) => String.fromCharCode(65 + index);

  const Logo = () => (
    <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-[#e8e6f0]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      inter<span className="text-[#a78bfa]">actio</span>
    </h1>
  );

  const handleVoteMultipleChoice = async (optionIndex: number) => {
    if (!participantId) return;
    setMyResponse(optionIndex);
    const currentIndex = sessionData.currentInteraction ?? 0;
    // 🔥 CORRIGIDO
    await set(ref(db, `sessions/${sessionId}/responses/${currentIndex}/${participantId}`), optionIndex);
  };

  const handleSubmitWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = wordInput.trim().toUpperCase();
    if (!cleanWord || !participantId) return;

    const currentIndex = sessionData.currentInteraction ?? 0;
    const currentInteraction = sessionData.interactions[currentIndex];
    const limit = currentInteraction.limit || 3;
    const currentWords = Array.isArray(myResponse) ? myResponse : [];
    
    if (limit !== 'unlimited' && currentWords.length >= limit) return;

    const newWords = [...currentWords, cleanWord];
    setMyResponse(newWords);
    setWordInput(''); 
    // 🔥 CORRIGIDO
    await set(ref(db, `sessions/${sessionId}/responses/${currentIndex}/${participantId}`), newWords);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = questionInput.trim();
    if (!cleanQuestion || !participantId) return;

    const currentIndex = sessionData.currentInteraction ?? 0;
    const currentQuestions = Array.isArray(myResponse) ? myResponse : [];

    const newQuestions = [...currentQuestions, cleanQuestion];
    setMyResponse(newQuestions);
    setQuestionInput(''); 
    // 🔥 CORRIGIDO
    await set(ref(db, `sessions/${sessionId}/responses/${currentIndex}/${participantId}`), newQuestions);
  };

  if (loading || !participantId) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-[#a78bfa]/30 border-t-[#a78bfa] rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(167,139,250,0.5)]"></div>
        <p className="text-[#e8e6f0] text-lg font-semibold tracking-wide">A conectar...</p>
      </div>
    );
  }

  // ── 1. EXPULSA O ALUNO QUANDO A SESSÃO É ENCERRADA ──
  if (sessionData?.status === 'finished') {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-[#fbbf24] text-4xl">✓</span>
        </div>
        <p className="text-[#e8e6f0] text-2xl font-bold mb-2 tracking-tight">Sessão Encerrada</p>
        <p className="text-[#8b89a0] mb-8">Esta apresentação já foi finalizada pelo professor.</p>
        <button onClick={handleExit} className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[#e8e6f0] font-semibold hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} /> Voltar ao Início
        </button>
      </div>
    );
  }

  if (!sessionData || !sessionData.interactions) {
    return (
      <div className="min-h-screen bg-[#0f0e17] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-[#ef4444] text-4xl">✖</span>
        </div>
        <p className="text-[#e8e6f0] text-2xl font-bold mb-8 tracking-tight">Sessão Inativa</p>
        <button onClick={handleExit} className="flex items-center gap-2 bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-[#e8e6f0] font-semibold hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} /> Voltar ao Início
        </button>
      </div>
    );
  }

  const currentIndex = sessionData.currentInteraction ?? 0;
  const currentInteraction = sessionData.interactions[currentIndex];
  
  const rawType = currentInteraction?.type || 'multiple_choice';
  const typeWordCloud = rawType === 'word_cloud';
  const typeMultipleChoice = rawType === 'multiple_choice';
  const typeQnA = rawType === 'qna' || rawType === 'q_and_a'; 
  
  const isMultipleChoiceVoted = typeMultipleChoice && myResponse !== null;
  const wordLimit = currentInteraction?.limit || 3;
  const myAnswersCount = Array.isArray(myResponse) ? myResponse.length : 0;
  const isWordCloudFull = typeWordCloud && wordLimit !== 'unlimited' && myAnswersCount >= wordLimit;

  const getDisplayTitle = () => {
    if (currentInteraction?.question && currentInteraction.question.trim() !== '') {
      return currentInteraction.question;
    }
    if (typeQnA) return 'Espaço de Resposta Aberta';
    if (typeWordCloud) return 'Envie suas palavras';
    if (typeMultipleChoice) return 'Escolha uma opção';
    return 'Aguardando próxima etapa...';
  };

  return (
    <div className="min-h-screen bg-[#0f0e17] relative overflow-hidden flex flex-col font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-[#a78bfa] rounded-full mix-blend-screen filter blur-[100px] sm:blur-[150px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-[#38bdf8] rounded-full mix-blend-screen filter blur-[100px] sm:blur-[150px] opacity-[0.07] pointer-events-none"></div>

      <header className="flex justify-between items-center p-4 sm:p-6 sm:px-10 border-b border-white/5 bg-[#0f0e17]/60 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-3">
           <button onClick={handleExit} className="flex items-center justify-center bg-white/5 border border-white/10 w-10 h-10 sm:w-auto sm:px-4 sm:py-2 rounded-xl text-[#e8e6f0] active:scale-95 transition-transform hover:bg-white/10">
             <ChevronLeft size={20} className="text-[#a78bfa]" />
             <span className="hidden sm:inline font-semibold ml-1 text-sm sm:text-base">Sair</span>
           </button>
           <div className="hidden sm:block"><Logo /></div>
        </div>
        <div className="bg-[#a78bfa]/10 border border-[#a78bfa]/20 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse"></div>
          <span className="text-[#a78bfa] text-[10px] sm:text-sm font-black tracking-widest uppercase">Sessão: {sessionId}</span>
        </div>
      </header>

      <div className="sm:hidden flex justify-center mt-8 z-20 relative">
        <Logo />
      </div>

      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 relative z-10 w-full max-w-2xl mx-auto">
        <div className="w-full bg-[rgba(26,25,36,0.8)] backdrop-blur-2xl border border-white/5 rounded-2xl sm:rounded-[32px] p-5 sm:p-10 shadow-2xl">
          
          <h2 className="text-[#e8e6f0] text-xl sm:text-4xl font-black leading-snug mb-6 sm:mb-8 tracking-tight text-center">
            {getDisplayTitle()}
          </h2>

          {typeMultipleChoice && (
            isMultipleChoiceVoted ? (
              <div className="flex flex-col items-center text-center py-6 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
                  <span className="text-emerald-400 text-4xl">✓</span>
                </div>
                <h3 className="text-[#e8e6f0] text-xl font-bold mb-2">Voto Registrado!</h3>
                <p className="text-[#8b89a0] text-sm">Aguarde o apresentador revelar os resultados.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-8">
                {currentInteraction?.options?.map((option: string, index: number) => (
                  <button key={index} onClick={() => handleVoteMultipleChoice(index)} className="group relative w-full flex items-center text-left bg-[#0f0e17]/50 rounded-xl p-3 sm:p-4 border border-white/5 hover:border-[#38bdf8]/60 transition-all active:scale-[0.98]">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-[#1a1924] border border-white/10 flex items-center justify-center mr-3 group-hover:bg-[#38bdf8]/10 transition-colors">
                      <span className="text-[#38bdf8] text-base font-black">{getOptionLetter(index)}</span>
                    </div>
                    <span className="text-[#e8e6f0] text-sm sm:text-lg font-semibold">{option}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {typeWordCloud && (
            <div className="animate-in fade-in slide-in-from-bottom-8">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 px-1">
                <span className="text-[#f472b6] text-xs font-bold uppercase">Envie uma palavra</span>
                <span className="text-[#8b89a0] text-xs font-medium bg-white/5 px-3 py-1 rounded-full">{myAnswersCount} de {wordLimit === 'unlimited' ? '∞' : wordLimit} respostas</span>
              </div>
              {!isWordCloudFull ? (
                <form onSubmit={handleSubmitWord} className="flex flex-col sm:flex-row gap-3 mb-6">
                  <input type="text" value={wordInput} onChange={(e) => setWordInput(e.target.value)} placeholder="Ex: Inovação" className="w-full sm:flex-1 bg-[#0f0e17] text-[#e8e6f0] text-base rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-[#f472b6]/50 transition-colors" />
                  <button type="submit" disabled={!wordInput.trim()} className="w-full sm:w-auto py-3 bg-[#f472b6] text-[#0f0e17] font-black px-6 rounded-xl active:scale-95 transition-transform disabled:opacity-50">Enviar</button>
                </form>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center mb-6 text-center">
                  <span className="text-emerald-400 text-2xl mb-2">✓</span>
                  <p className="text-[#e8e6f0] font-bold">Limite atingido!</p>
                </div>
              )}
              {myAnswersCount > 0 && (
                <div className="flex flex-wrap justify-center gap-2 border-t border-white/5 pt-5 mt-2">
                  {(myResponse as string[]).map((word, idx) => (
                    <span key={idx} className="bg-[rgba(244,114,182,0.1)] text-[#f472b6] border border-[#f472b6]/20 px-3 py-1.5 rounded-lg font-semibold text-xs animate-in zoom-in">{word}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {typeQnA && (
            <div className="animate-in fade-in slide-in-from-bottom-8">
              <div className="flex justify-between items-center mb-4 px-1">
                <span className="text-[#38bdf8] text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
                  Deixe sua resposta
                </span>
                <span className="text-[#8b89a0] text-xs font-medium bg-white/5 px-3 py-1 rounded-full">
                  {myAnswersCount} envio{myAnswersCount !== 1 && 's'}
                </span>
              </div>
              
              <form onSubmit={handleSubmitQuestion} className="flex flex-col gap-3 mb-6">
                <textarea 
                  value={questionInput} 
                  onChange={(e) => setQuestionInput(e.target.value)} 
                  placeholder="Escreva sua resposta aqui..." 
                  className="w-full bg-[#0f0e17] text-[#e8e6f0] text-base rounded-xl px-4 py-4 border border-white/10 focus:outline-none focus:border-[#38bdf8]/50 transition-colors min-h-[120px] resize-none" 
                />
                <button 
                  type="submit" 
                  disabled={!questionInput.trim()} 
                  className="w-full py-4 bg-[#38bdf8] text-[#0f0e17] font-black px-6 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  Enviar Resposta
                </button>
              </form>

              {myAnswersCount > 0 && (
                <div className="flex flex-col gap-3 border-t border-white/5 pt-6 mt-2">
                  <span className="text-[#8b89a0] text-xs font-bold uppercase mb-2">Suas respostas enviadas:</span>
                  {(myResponse as string[]).map((q, idx) => (
                    <div key={idx} className="bg-[rgba(56,189,248,0.05)] border border-[#38bdf8]/20 p-4 rounded-xl flex items-start gap-3 animate-in fade-in">
                      <div className="w-6 h-6 rounded-full bg-[#38bdf8]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[#38bdf8] text-xs font-bold">✓</span>
                      </div>
                      <p className="text-[#e8e6f0] text-sm leading-relaxed">{q}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}