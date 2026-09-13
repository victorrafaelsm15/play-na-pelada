import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Check, Hand, Play, RotateCcw, Shuffle } from 'lucide-react';
import clsx from 'clsx';
import type { PublicUser, Team } from '@/types';
import { errorMessage, services } from '@/services';
import { toast } from '@/stores/toast';
import { invalidate } from '@/stores/refresh';
import { useEvent } from '@/features/pelada/useEvent';
import { randomStrategy, secureShuffle, TEAM_PALETTE, teamStyle } from '@/domain/teamDraw';
import { uid } from '@/lib/id';
import { PageHeader } from '@/components/app/PageHeader';
import { Stepper } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, Skeleton } from '@/components/ui/States';

type Phase = 'setup' | 'drawing' | 'result';
const BENCH = 'bench';

export default function TeamDraw() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { me, event, participants, confirmed, allows } = useEvent(id);
  const [phase, setPhase] = useState<Phase>('setup');
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [teamsCount, setTeamsCount] = useState<number | null>(null);
  const [perTeam, setPerTeam] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bench, setBench] = useState<string[]>([]);
  const [picked, setPicked] = useState<{ id: string; from: string } | null>(null);
  const [flicker, setFlicker] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawNo, setDrawNo] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const e = event.data;
  const tc = teamsCount ?? e?.teamsCount ?? 2;
  const pt = perTeam ?? e?.playersPerTeam ?? 5;
  const sel = selected ?? new Set(confirmed.map((p) => p.userId));
  const users = useMemo(() => new Map<string, PublicUser>(confirmed.map((p) => [p.userId, p.user])), [confirmed]);
  const chosen = confirmed.filter((p) => sel.has(p.userId)).map((p) => p.user);

  if (event.loading || participants.loading) return <div className="space-y-3 pt-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-80" /></div>;
  if (!e) return <div><PageHeader title="Sorteio" back /><ErrorState message={event.error ?? 'Pelada não encontrada.'} /></div>;
  if (!allows('teams.draw')) return <div><PageHeader title="Sorteio" back /><ErrorState message="Seu papel não permite sortear times." /></div>;

  const capacity = tc * pt;
  const minNeeded = tc * 1;

  const draw = () => {
    if (chosen.length < minNeeded * 2 && chosen.length < 2) return toast.error('Selecione mais jogadores.');
    setPhase('drawing');
    setPicked(null);
    const names = chosen.map((u) => u.name.split(' ')[0]);
    const flick = window.setInterval(() => setFlicker(names[Math.floor(Math.random() * names.length)]), 70);
    const done = window.setTimeout(() => {
      clearInterval(flick);
      const result = randomStrategy.draw(secureShuffle(chosen), { eventId: e.id, teamsCount: tc, playersPerTeam: pt });
      setTeams(result.teams);
      setBench(result.bench);
      setDrawNo((n) => n + 1);
      setPhase('result');
      navigator.vibrate?.(60);
    }, 1700);
    timers.current.push(flick, done);
  };

  const manual = () => {
    setTeams(Array.from({ length: tc }, (_, i) => ({ id: uid('team'), eventId: e.id, name: `Time ${TEAM_PALETTE[i % TEAM_PALETTE.length].name}`, color: TEAM_PALETTE[i % TEAM_PALETTE.length].color, playerIds: [] })));
    setBench(chosen.map((u) => u.id));
    setDrawNo((n) => n + 1);
    setPhase('result');
  };

  /** Toque em um jogador para selecionar; toque em outro para trocar, ou em um time para mover. */
  const tapPlayer = (playerId: string, from: string) => {
    if (!picked) return setPicked({ id: playerId, from });
    if (picked.id === playerId) return setPicked(null);
    if (picked.from === from) return setPicked({ id: playerId, from });
    const swap = (list: string[], out: string, inn: string) => list.map((x) => (x === out ? inn : x));
    setTeams((ts) => ts.map((t) => (t.id === picked.from ? { ...t, playerIds: swap(t.playerIds, picked.id, playerId) } : t.id === from ? { ...t, playerIds: swap(t.playerIds, playerId, picked.id) } : t)));
    if (picked.from === BENCH) setBench((b) => swap(b, picked.id, playerId));
    if (from === BENCH) setBench((b) => swap(b, playerId, picked.id));
    setPicked(null);
  };

  const moveTo = (dest: string) => {
    if (!picked || picked.from === dest) return;
    setTeams((ts) => ts.map((t) => (t.id === picked.from ? { ...t, playerIds: t.playerIds.filter((x) => x !== picked.id) } : t.id === dest ? { ...t, playerIds: [...t.playerIds, picked.id] } : t)));
    if (picked.from === BENCH) setBench((b) => b.filter((x) => x !== picked.id));
    if (dest === BENCH) setBench((b) => [...b, picked.id]);
    setPicked(null);
  };

  const save = async () => {
    if (teams.filter((t) => t.playerIds.length).length < 2) return toast.error('Monte pelo menos dois times com jogadores.');
    setSaving(true);
    try {
      await services.games.saveTeams(me.id, e.id, teams.filter((t) => t.playerIds.length));
      invalidate('events');
      toast.success('Times definidos');
      navigate(`/peladas/${e.id}/partida`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'drawing') {
    return (
      <div className="pitch-lines fixed inset-0 z-50 flex flex-col items-center justify-center bg-turf-800 text-chalk" role="status" aria-live="assertive">
        <Shuffle size={40} className="animate-spin text-card [animation-duration:1.4s]" />
        <p className="mt-6 font-display text-6xl font-extrabold">Sorteando…</p>
        <p className="mt-3 h-10 font-display text-3xl font-bold text-card">{flicker}</p>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div>
        <PageHeader title="Sortear times" subtitle={e.name} back />
        <section className="rounded-3xl bg-white p-4 shadow-lift">
          <div className="divide-y divide-chalk-line">
            <Stepper label="Times" value={tc} min={2} max={8} onChange={setTeamsCount} />
            <Stepper label="Jogadores por time" value={pt} min={1} max={11} onChange={setPerTeam} />
          </div>
          <p className="mt-2 rounded-xl bg-chalk px-3 py-2 text-sm text-ink-muted">
            {chosen.length} selecionados para {capacity} vagas. {chosen.length > capacity ? `${chosen.length - capacity} ficam no banco.` : chosen.length < capacity ? `Faltam ${capacity - chosen.length} para completar todos os times.` : 'Times completos.'}
          </p>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Quem está no campo</h2>
            <button className="text-sm font-semibold text-turf-700" onClick={() => setSelected(sel.size === confirmed.length ? new Set() : new Set(confirmed.map((p) => p.userId)))}>
              {sel.size === confirmed.length ? 'Limpar' : 'Marcar todos'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {confirmed.map((p) => {
              const on = sel.has(p.userId);
              return (
                <button
                  key={p.userId}
                  onClick={() => { const n = new Set(sel); on ? n.delete(p.userId) : n.add(p.userId); setSelected(n); }}
                  aria-pressed={on}
                  className={clsx('flex min-h-[56px] items-center gap-2 rounded-2xl border-2 p-2 text-left transition', on ? 'border-turf-600 bg-white' : 'border-transparent bg-ink/[.04] opacity-60')}
                >
                  <Avatar name={p.user.name} src={p.user.avatarUrl} size={34} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.user.name.split(' ').slice(0, 2).join(' ')}</span>
                  {on && <Check size={18} className="shrink-0 text-turf-700" />}
                </button>
              );
            })}
          </div>
        </section>

        <div className="sticky bottom-20 mt-5 grid grid-cols-[1fr_auto] gap-2 lg:bottom-4">
          <Button size="xl" onClick={draw} disabled={chosen.length < 2} className="shadow-xl"><Shuffle size={26} />Sortear</Button>
          <Button size="xl" variant="dark" onClick={manual} disabled={chosen.length < 2} aria-label="Montar times manualmente"><Hand size={24} /></Button>
        </div>
      </div>
    );
  }

  const renderChip = (pid: string, from: string, dark?: boolean) => {
    const u = users.get(pid);
    if (!u) return null;
    const active = picked?.id === pid;
    return (
      <button
        key={pid}
        onClick={() => tapPlayer(pid, from)}
        className={clsx('flex min-h-[44px] items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-semibold transition', active ? 'bg-card text-card-ink ring-2 ring-card-deep' : dark ? 'bg-black/15' : 'bg-chalk')}
      >
        <Avatar name={u.name} src={u.avatarUrl} size={28} />
        <span className="truncate">{u.name.split(' ').slice(0, 2).join(' ')}</span>
      </button>
    );
  };

  return (
    <div>
      <PageHeader title="Times" subtitle={picked ? 'Toque em outro jogador para trocar, ou em “Mover para cá”.' : 'Toque em um jogador para trocar de time.'} back />
      <div className="grid gap-3 sm:grid-cols-2" key={drawNo}>
        {teams.map((t, i) => {
          const s = teamStyle(t.color);
          return (
            <section key={t.id} className="overflow-hidden rounded-3xl bg-white shadow-lift animate-rise" style={{ animationDelay: `${i * 140}ms` }}>
              <header className="flex items-center justify-between px-4 py-3" style={{ background: s.hex, color: s.text }}>
                <h3 className="font-display text-2xl font-extrabold">{t.name}</h3>
                <span className="font-display text-xl font-bold opacity-80">{t.playerIds.length}</span>
              </header>
              <div className="grid grid-cols-2 gap-1.5 p-3">
                {t.playerIds.map((pid) => renderChip(pid, t.id))}
                {picked && picked.from !== t.id && (
                  <button onClick={() => moveTo(t.id)} className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl border-2 border-dashed border-turf-600 text-sm font-semibold text-turf-700"><ArrowLeftRight size={15} />Mover para cá</button>
                )}
                {!t.playerIds.length && !picked && <p className="col-span-2 py-2 text-center text-sm text-ink-muted">Sem jogadores</p>}
              </div>
            </section>
          );
        })}
      </div>

      {(bench.length > 0 || picked) && (
        <section className="mt-3 rounded-3xl bg-ink/[.05] p-3">
          <h3 className="px-1 pb-2 font-semibold text-ink-soft">Banco {bench.length > 0 && `(${bench.length})`}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {bench.map((pid) => renderChip(pid, BENCH))}
            {picked && picked.from !== BENCH && <button onClick={() => moveTo(BENCH)} className="flex min-h-[44px] items-center justify-center rounded-xl border-2 border-dashed border-ink/30 text-sm font-semibold text-ink-muted">Mover para o banco</button>}
          </div>
        </section>
      )}

      <div className="sticky bottom-20 z-10 mt-5 grid grid-cols-2 gap-2 lg:bottom-4">
        <Button size="lg" variant="dark" onClick={draw} className="shadow-xl"><RotateCcw size={20} />Sortear novamente</Button>
        <Button size="lg" loading={saving} onClick={save} className="shadow-xl"><Play size={20} />Confirmar times</Button>
      </div>
      <button onClick={() => setPhase('setup')} className="mx-auto mt-3 block text-sm font-semibold text-ink-muted">Alterar jogadores ou quantidade</button>
    </div>
  );
}
