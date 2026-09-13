import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Flag, Pause, Play, Plus, RotateCcw, Shuffle, Undo2, Volume2, VolumeX, X } from 'lucide-react';
import clsx from 'clsx';
import type { Game, PeladaEvent, PublicUser, Rotation, Team } from '@/types';
import { errorMessage, services } from '@/services';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';
import { invalidate } from '@/stores/refresh';
import { can } from '@/domain/permissions';
import { teamStyle } from '@/domain/teamDraw';
import { describeRotation, ROTATION_LABEL, winnerOf } from '@/domain/rotation';
import * as T from '@/domain/timer';
import { useTimer, useWakeLock, whistle } from '@/hooks/useTimer';
import { uid } from '@/lib/id';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { Stepper } from '@/components/ui/Controls';

interface Loaded {
  event: PeladaEvent;
  teams: Team[];
  rotation: Rotation | null;
  game: Game | null;
  finishedCount: number;
  players: Map<string, PublicUser>;
  canControl: boolean;
}

const PRESETS = [5, 10, 15, 20];

export default function LiveMatch() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const me = useSession((s) => s.user)!;
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [scorerFor, setScorerFor] = useState<{ goalId: string; teamId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<Game | null>(null);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const [event, teams, rotation, game, games, participants] = await Promise.all([
        services.events.getById(id, me.id),
        services.games.getTeams(id),
        services.games.getRotation(id),
        services.games.getCurrentGame(id),
        services.games.listGames(id),
        services.events.getParticipants(id)
      ]);
      const role = participants.find((p) => p.userId === me.id && p.status === 'confirmed')?.role;
      setData({ event, teams, rotation, game, finishedCount: games.filter((g) => g.status === 'finished').length, players: new Map(participants.map((p) => [p.userId, p.user])), canControl: can(role, 'games.control') });
      if (game && T.remaining(game.timer) <= 0 && game.timer.accumulatedMs > 0) setExpired(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const game = data?.game ?? null;
  const onExpire = useCallback(() => {
    setExpired(true);
    if (sound) whistle();
    else navigator.vibrate?.([300, 150, 600]);
  }, [sound]);
  const { remainingMs, running } = useTimer(game?.timer, onExpire);
  useWakeLock(running);

  // Ao expirar, congela o cronômetro no zero (persistido).
  useEffect(() => {
    if (expired && game && T.isRunning(game.timer)) persist({ ...game, timer: T.pause(game.timer), status: 'paused' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const teamsById = useMemo(() => new Map((data?.teams ?? []).map((t) => [t.id, t])), [data?.teams]);

  const persist = (next: Game) => {
    setData((d) => (d ? { ...d, game: next } : d));
    services.games.saveGame(me.id, next).catch((err) => toast.error(errorMessage(err)));
  };

  if (error) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="font-display text-3xl font-bold">Não foi possível abrir a partida</p>
          <p className="mt-2 text-chalk/70">{error}</p>
          <Button variant="chalk" className="mt-6" onClick={() => navigate(`/peladas/${id}`)}>Voltar para a pelada</Button>
        </div>
      </Shell>
    );
  }
  if (!data) return <Shell><div className="flex flex-1 items-center justify-center"><Spinner className="h-10 w-10 text-card" /></div></Shell>;

  const { event, teams, rotation } = data;
  const queue = rotation?.queue.filter((tid) => teamsById.has(tid)) ?? teams.map((t) => t.id);
  const view = describeRotation(queue, event.rotationRule);
  const chosenMin = durationMin ?? event.matchDurationMin;

  if (teams.length < 2) {
    return (
      <Shell onClose={() => navigate(`/peladas/${id}`)} title={event.name}>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <Shuffle size={42} className="text-card" />
          <p className="mt-4 font-display text-4xl font-extrabold">Sem times ainda</p>
          <p className="mt-2 max-w-xs text-chalk/75">Sorteie ou monte os times para começar as partidas.</p>
          {data.canControl && <Button size="lg" className="mt-6" onClick={() => navigate(`/peladas/${id}/sorteio`)}><Shuffle size={20} />Sortear times</Button>}
        </div>
      </Shell>
    );
  }

  const startGame = async () => {
    if (!view.now) return;
    setBusy(true);
    try {
      const created = await services.games.createGame(me.id, id, view.now[0], view.now[1], chosenMin * 60_000);
      const live: Game = { ...created, status: 'live', startedAt: new Date().toISOString(), timer: T.start(created.timer) };
      setExpired(false);
      setLastResult(null);
      persist(live);
      invalidate('events');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleTimer = () => {
    if (!game) return;
    if (T.isRunning(game.timer)) persist({ ...game, timer: T.pause(game.timer), status: 'paused' });
    else {
      if (T.remaining(game.timer) <= 0) return toast.info('Tempo esgotado. Reinicie ou encerre a partida.');
      persist({ ...game, timer: T.start(game.timer), status: 'live', startedAt: game.startedAt ?? new Date().toISOString() });
    }
  };

  const goal = (side: 'A' | 'B') => {
    if (!game) return;
    const teamId = side === 'A' ? game.teamAId : game.teamBId;
    const goalId = uid('goal');
    persist({
      ...game,
      scoreA: game.scoreA + (side === 'A' ? 1 : 0),
      scoreB: game.scoreB + (side === 'B' ? 1 : 0),
      events: [...game.events, { id: goalId, type: 'goal', teamId, atMs: T.elapsed(game.timer), createdAt: new Date().toISOString() }]
    });
    navigator.vibrate?.(40);
    setScorerFor({ goalId, teamId });
  };

  const undoGoal = () => {
    if (!game || !game.events.length) return;
    const last = game.events[game.events.length - 1];
    persist({
      ...game,
      scoreA: Math.max(0, game.scoreA - (last.teamId === game.teamAId ? 1 : 0)),
      scoreB: Math.max(0, game.scoreB - (last.teamId === game.teamBId ? 1 : 0)),
      events: game.events.slice(0, -1)
    });
    setScorerFor(null);
    toast.info('Último gol desfeito');
  };

  const setScorer = (playerId: string) => {
    if (!game || !scorerFor) return;
    persist({ ...game, events: game.events.map((ev) => (ev.id === scorerFor.goalId ? { ...ev, playerId } : ev)) });
    setScorerFor(null);
  };

  const finish = async () => {
    if (!game) return;
    setBusy(true);
    const done: Game = { ...game, timer: T.pause(game.timer), status: 'finished', finishedAt: new Date().toISOString(), winnerTeamId: winnerOf(game.scoreA, game.scoreB, game.teamAId, game.teamBId) };
    try {
      const res = await services.games.finishGame(me.id, done);
      setData((d) => (d ? { ...d, game: null, rotation: res.rotation, finishedCount: d.finishedCount + 1 } : d));
      setLastResult(done);
      setFinishOpen(false);
      setExpired(false);
      setDurationMin(null);
      invalidate('events');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const teamA = game ? teamsById.get(game.teamAId) : view.now ? teamsById.get(view.now[0]) : undefined;
  const teamB = game ? teamsById.get(game.teamBId) : view.now ? teamsById.get(view.now[1]) : undefined;
  const clock = game ? T.formatClock(remainingMs) : T.formatClock(chosenMin * 60_000);
  const lowTime = game && remainingMs <= 60_000 && remainingMs > 0 && running;

  return (
    <Shell
      onClose={() => navigate(`/peladas/${id}`)}
      title={game ? `Partida ${game.round}` : `Partida ${data.finishedCount + 1}`}
      subtitle={event.name}
      right={<button onClick={() => setSound(!sound)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label={sound ? 'Desativar som' : 'Ativar som'}>{sound ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Placar */}
        <section className="rounded-[28px] bg-turf-950/60 p-4" aria-live="polite">
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <TeamScore team={teamA} score={game?.scoreA ?? 0} />
            <span className="pt-10 font-display text-4xl font-bold text-chalk/40">×</span>
            <TeamScore team={teamB} score={game?.scoreB ?? 0} />
          </div>
          <div className={clsx('mt-3 rounded-2xl py-2 text-center', expired ? 'bg-whistle' : 'bg-black/25')}>
            <p className={clsx('font-display text-[76px] font-extrabold leading-none tabular', lowTime && 'text-card', expired && 'animate-flash')} role="timer">{clock}</p>
            <p className="pb-1 text-sm font-semibold text-chalk/75">{expired ? 'Tempo esgotado' : !game ? `${chosenMin} minutos` : running ? 'Rolando' : game.timer.accumulatedMs ? 'Pausado' : 'Pronto para começar'}</p>
          </div>
        </section>

        {game ? (
          <>
            {data.canControl ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <GoalButton team={teamA} onClick={() => goal('A')} />
                  <GoalButton team={teamB} onClick={() => goal('B')} />
                </div>

                {scorerFor && (
                  <div className="mt-3 rounded-2xl bg-chalk p-3 text-ink animate-rise">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Quem marcou? <span className="font-normal text-ink-muted">(opcional)</span></p>
                      <button onClick={() => setScorerFor(null)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Pular"><X size={18} /></button>
                    </div>
                    <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                      {(teamsById.get(scorerFor.teamId)?.playerIds ?? []).map((pid) => (
                        <button key={pid} onClick={() => setScorer(pid)} className="h-10 shrink-0 rounded-xl bg-white px-3 text-sm font-semibold shadow-sm">{data.players.get(pid)?.name.split(' ')[0] ?? '—'}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-[1fr_2fr_1fr] gap-2">
                  <Button variant="ghost" size="lg" className="!h-16 flex-col !gap-0.5 bg-white/10 !text-chalk" onClick={undoGoal} disabled={!game.events.length}><Undo2 size={20} /><span className="text-xs">Desfazer</span></Button>
                  <Button size="lg" variant={running ? 'chalk' : 'primary'} className="!h-16 text-lg" onClick={toggleTimer}>
                    {running ? <><Pause size={24} />Pausar</> : <><Play size={24} />{game.timer.accumulatedMs ? 'Continuar' : 'Iniciar'}</>}
                  </Button>
                  <Button variant="ghost" size="lg" className="!h-16 flex-col !gap-0.5 bg-white/10 !text-chalk" onClick={() => setResetOpen(true)}><RotateCcw size={20} /><span className="text-xs">Reiniciar</span></Button>
                </div>
                <Button variant="danger" size="lg" block className="mt-2" onClick={() => setFinishOpen(true)}><Flag size={20} />Encerrar partida</Button>
              </>
            ) : (
              <p className="mt-4 rounded-2xl bg-white/10 p-4 text-center text-chalk/80">Acompanhando. Só organizadores e moderadores controlam a partida.</p>
            )}
          </>
        ) : (
          <section className="mt-3 rounded-[28px] bg-white/[.07] p-4">
            {lastResult && (
              <p className="mb-3 rounded-2xl bg-card px-3 py-2 text-center font-semibold text-card-ink animate-rise">
                Fim: {teamsById.get(lastResult.teamAId)?.name} {lastResult.scoreA} × {lastResult.scoreB} {teamsById.get(lastResult.teamBId)?.name}.{' '}
                {lastResult.winnerTeamId ? `${teamsById.get(lastResult.winnerTeamId)?.name} venceu.` : 'Empate.'}
              </p>
            )}
            {data.canControl ? (
              <>
                <p className="text-sm font-semibold text-chalk/75">Duração</p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {PRESETS.map((m) => (
                    <button key={m} onClick={() => setDurationMin(m)} className={clsx('h-12 rounded-xl font-display text-2xl font-bold', chosenMin === m ? 'bg-chalk text-turf-900' : 'bg-white/10')}>{m}′</button>
                  ))}
                  <button onClick={() => setCustomOpen(true)} className={clsx('h-12 rounded-xl text-sm font-semibold', !PRESETS.includes(chosenMin) ? 'bg-chalk text-turf-900' : 'bg-white/10')}>{!PRESETS.includes(chosenMin) ? `${chosenMin}′` : 'Outro'}</button>
                </div>
                <Button size="xl" block className="mt-4" loading={busy} onClick={startGame} disabled={!view.now}><Play size={28} />Começar partida</Button>
                <Link to={`/peladas/${id}/sorteio`} className="mt-3 flex h-11 items-center justify-center gap-2 font-semibold text-chalk/80"><Shuffle size={18} />Sortear novamente</Link>
              </>
            ) : (
              <p className="text-center text-chalk/80">Aguardando o organizador iniciar a próxima partida.</p>
            )}
          </section>
        )}

        {/* Ordem das partidas */}
        <section className="mt-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-bold">Ordem</h2>
            <span className="text-sm text-chalk/60">{ROTATION_LABEL[event.rotationRule].title}</span>
          </div>
          <div className="mt-2 space-y-2">
            <RotationRow label="Agora" a={game ? teamsById.get(game.teamAId) : view.now && teamsById.get(view.now[0])} b={game ? teamsById.get(game.teamBId) : view.now && teamsById.get(view.now[1])} highlight />
            {view.next && <RotationRow label="Próximo" a={view.next.a === 'winner' ? 'Vencedor' : teamsById.get(view.next.a)} b={teamsById.get(view.next.b)} />}
            {view.waiting.length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/[.06] px-3 py-3">
                <span className="w-20 text-xs font-semibold text-chalk/60">Aguardando</span>
                <div className="flex flex-wrap gap-1.5">{view.waiting.map((tid) => <TeamPill key={tid} team={teamsById.get(tid)} />)}</div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Sheet open={customOpen} onClose={() => setCustomOpen(false)} title="Duração personalizada">
        <Stepper label="Minutos" value={chosenMin} min={1} max={90} onChange={setDurationMin} />
        <Button block size="lg" className="mt-4" onClick={() => setCustomOpen(false)}>Usar {chosenMin} minutos</Button>
      </Sheet>
      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} title="Reiniciar cronômetro?" message="O tempo volta ao início. O placar é mantido." confirmLabel="Reiniciar" onConfirm={() => { if (game) persist({ ...game, timer: T.reset(game.timer), status: 'paused' }); setExpired(false); setResetOpen(false); }} />
      <ConfirmDialog
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Encerrar partida?"
        message={game ? `${teamA?.name} ${game.scoreA} × ${game.scoreB} ${teamB?.name}. ${game.scoreA === game.scoreB ? 'Empate.' : `${(game.scoreA > game.scoreB ? teamA : teamB)?.name} vence.`} A ordem das próximas partidas será atualizada.` : ''}
        confirmLabel="Encerrar"
        danger
        loading={busy}
        onConfirm={finish}
      />
    </Shell>
  );
}

function Shell({ children, onClose, title, subtitle, right }: { children: React.ReactNode; onClose?: () => void; title?: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="pitch-lines flex min-h-dvh flex-col bg-turf-800 text-chalk">
      <header className="mx-auto flex w-full max-w-lg items-center gap-2 px-2 pb-2 pt-[max(.5rem,env(safe-area-inset-top))]">
        {onClose && <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Sair da partida"><X size={24} /></button>}
        <div className="min-w-0 flex-1">
          {title && <p className="truncate font-display text-2xl font-bold leading-tight">{title}</p>}
          {subtitle && <p className="truncate text-xs text-chalk/60">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </div>
  );
}

function TeamScore({ team, score }: { team?: Team; score: number }) {
  const s = team ? teamStyle(team.color) : null;
  return (
    <div className="flex flex-col items-center text-center">
      <span className="h-2 w-16 rounded-full" style={{ background: s?.hex ?? '#fff3' }} />
      <p className="mt-2 w-full truncate font-semibold">{team?.name ?? '—'}</p>
      <p key={score} className="font-display text-[88px] font-extrabold leading-[.95] tabular animate-pop">{score}</p>
    </div>
  );
}

function GoalButton({ team, onClick }: { team?: Team; onClick(): void }) {
  const s = team ? teamStyle(team.color) : { hex: '#FFC72C', text: '#2E2200' };
  return (
    <button onClick={onClick} className="flex h-28 flex-col items-center justify-center rounded-3xl font-display shadow-lg transition active:scale-95" style={{ background: s.hex, color: s.text }} aria-label={`Gol do ${team?.name ?? 'time'}`}>
      <span className="flex items-center gap-1 text-4xl font-extrabold"><Plus size={30} strokeWidth={3} />Gol</span>
      <span className="max-w-full truncate px-2 font-sans text-sm font-semibold opacity-80">{team?.name}</span>
    </button>
  );
}

function TeamPill({ team, label }: { team?: Team; label?: string }) {
  if (label) return <span className="rounded-full bg-card px-3 py-1 text-sm font-semibold text-card-ink">{label}</span>;
  const s = team ? teamStyle(team.color) : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
      <span className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: s?.hex }} />
      {team?.name.replace('Time ', '') ?? '—'}
    </span>
  );
}

function RotationRow({ label, a, b, highlight }: { label: string; a?: Team | 'Vencedor' | null; b?: Team | null; highlight?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-3 rounded-2xl px-3 py-3', highlight ? 'bg-chalk text-ink' : 'bg-white/[.06]')}>
      <span className={clsx('w-20 text-xs font-semibold', highlight ? 'text-turf-700' : 'text-chalk/60')}>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {a === 'Vencedor' ? <TeamPill label="Vencedor" /> : highlight ? <SolidPill team={a ?? undefined} /> : <TeamPill team={a ?? undefined} />}
        <span className={clsx('font-display text-lg font-bold', highlight ? 'text-ink-muted' : 'text-chalk/50')}>×</span>
        {highlight ? <SolidPill team={b ?? undefined} /> : <TeamPill team={b ?? undefined} />}
      </div>
    </div>
  );
}

function SolidPill({ team }: { team?: Team }) {
  const s = team ? teamStyle(team.color) : null;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-ink/[.06] px-3 py-1 text-sm font-semibold">
      <span className="h-3 w-3 rounded-full ring-1 ring-ink/20" style={{ background: s?.hex }} />
      {team?.name.replace('Time ', '') ?? '—'}
    </span>
  );
}
