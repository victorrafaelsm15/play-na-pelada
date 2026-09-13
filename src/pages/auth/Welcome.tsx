import { Link } from 'react-router-dom';
import { InstallButton } from '@/components/app/InstallButton';
import { LogoMark } from '@/components/app/Logo';

export default function Welcome() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-turf-800 text-chalk">
      {/* Linhas do campo: o elemento marcante da identidade */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[.14]" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke="#F2F4F1" strokeWidth="2.5">
          <rect x="24" y="24" width="352" height="752" rx="4" />
          <line x1="24" y1="400" x2="376" y2="400" />
          <circle cx="200" cy="400" r="70" />
          <rect x="104" y="24" width="192" height="110" />
          <rect x="152" y="24" width="96" height="44" />
          <path d="M150 134 a60 60 0 0 0 100 0" />
          <rect x="104" y="666" width="192" height="110" />
          <rect x="152" y="732" width="96" height="44" />
          <path d="M150 666 a60 60 0 0 1 100 0" />
        </g>
        <circle cx="200" cy="400" r="5" fill="#F2F4F1" />
      </svg>
      <div className="absolute left-1/2 top-[38%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card blur-3xl opacity-40" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><LogoMark size={34} /><span className="font-display text-2xl font-extrabold">Racha</span></span>
          <InstallButton variant="dark" />
        </div>

        <div className="flex flex-1 flex-col justify-end pb-10 animate-rise">
          <h1 className="font-display text-[64px] font-extrabold leading-[.9] tracking-tight">
            Sua pelada,<br />do convite<br />ao apito final.
          </h1>
          <p className="mt-5 max-w-[34ch] text-lg leading-relaxed text-chalk/80">
            Crie, encontre e organize peladas. Lista, sorteio de times, cronômetro e placar no mesmo lugar.
          </p>
        </div>

        <div className="grid gap-3">
          <Link to="/criar-conta" className="flex h-14 items-center justify-center rounded-2xl bg-card text-lg font-bold text-card-ink transition hover:bg-card-deep active:scale-[.98]">Criar conta</Link>
          <Link to="/entrar" className="flex h-14 items-center justify-center rounded-2xl border-2 border-chalk/30 text-lg font-bold text-chalk transition hover:border-chalk/60 active:scale-[.98]">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
