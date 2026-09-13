import type { ReactNode } from 'react';
import { PageHeader } from '@/components/app/PageHeader';
import { LogoMark } from '@/components/app/Logo';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-chalk lg:grid lg:grid-cols-[1fr_1.1fr]">
      <div className="pitch-lines relative hidden bg-turf-800 p-12 text-chalk lg:flex lg:flex-col lg:justify-end">
        <LogoMark size={56} className="mb-6" />
        <p className="max-w-sm font-display text-5xl font-extrabold leading-[.95]">Criar, convidar, sortear, jogar.</p>
      </div>
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-[max(.5rem,env(safe-area-inset-top))] lg:flex lg:flex-col lg:justify-center">
        <PageHeader title="" back="/" className="lg:hidden" />
        <h1 className="font-display text-[40px] font-extrabold leading-none">{title}</h1>
        <p className="mb-7 mt-2 text-ink-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
