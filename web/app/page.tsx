'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (cleanCode.length > 3) {
      setIsJoining(true);
      router.push(`/p/${cleanCode}`);
    }
  };

  // ── LOGO VERTICAL AJUSTADA (MAIS PRÓXIMA) ──
  const Logo = () => (
    <div className="flex flex-col items-center justify-center gap-0 mb-10">
      <img 
        src="/logo.png" 
        alt="Logo Interactio" 
        className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-[0_0_20px_rgba(167,139,250,0.3)]" 
      />
      <h1 
        // -mt-2 ou -mt-3 puxa o texto para cima para compensar o espaço da imagem
        className="text-4xl sm:text-5xl font-black tracking-tighter text-[#e8e6f0] leading-none -mt-2 sm:-mt-4" 
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        inter<span className="text-[#a78bfa]">actio</span>
      </h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0e17] relative overflow-hidden flex flex-col font-sans items-center justify-center p-6">
      
      {/* ── EFEITOS DE LUZ NO FUNDO ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#a78bfa] rounded-full mix-blend-screen filter blur-[150px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#38bdf8] rounded-full mix-blend-screen filter blur-[150px] opacity-[0.07] pointer-events-none"></div>

      <main className="relative z-10 w-full max-w-md flex flex-col items-center">
        
        <Logo />

        <div className="w-full bg-[#1a1924]/80 backdrop-blur-2xl border border-white/5 rounded-[32px] p-8 sm:p-10 shadow-2xl text-center">
          <h2 className="text-[#e8e6f0] text-2xl font-bold mb-2 tracking-tight">
            Entrar na Sessão
          </h2>
          <p className="text-[#8b89a0] mb-8">
            Digite o código que aparece no telão.
          </p>

          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Ex: AB-1234"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isJoining}
              className="w-full bg-[#0f0e17] border border-white/10 rounded-2xl p-5 text-center text-2xl font-black text-[#e8e6f0] tracking-[0.2em] uppercase placeholder:text-[#5a5872] focus:outline-none focus:border-[#a78bfa]/50 transition-all"
              autoComplete="off"
              maxLength={8}
            />

            <button
              type="submit"
              disabled={isJoining || code.trim().length < 4}
              className="w-full bg-[#a78bfa] text-[#0f0e17] text-lg font-black rounded-2xl p-5 shadow-[0_8px_20px_rgba(167,139,250,0.25)] hover:bg-[#b8a1fa] active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center h-[68px]"
            >
              {isJoining ? (
                <div className="w-6 h-6 border-4 border-[#0f0e17]/30 border-t-[#0f0e17] rounded-full animate-spin"></div>
              ) : (
                "Participar"
              )}
            </button>
          </form>
        </div>

        <p className="text-[#5a5872] text-sm mt-12 font-medium tracking-wide">
          Interactio OS • Plataforma para Estudantes
        </p>

      </main>
    </div>
  );
}