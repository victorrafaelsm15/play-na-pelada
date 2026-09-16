import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, UserMinus, X } from 'lucide-react';
import type { PublicUser, Team } from '@/types';
import type { ParticipantView } from '@/services';
import { errorMessage, services } from '@/services';
import { useMe } from '@/stores/session';
import { toast } from '@/stores/toast';
import { teamStyle } from '@/domain/teamDraw';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState } from '@/components/ui/States';

/** Times sorteados: reordenar, renomear e ajustar escalação sem precisar sortear de novo. */
export function TeamsPanel({ teams, confirmed, canEdit, canManageRoster, onChanged }: { teams: Team[]; confirmed: ParticipantView[]; canEdit: boolean; canManageRoster: boolean; onChanged(): void }) {
  const me = useMe();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [movingPlayer, setMovingPlayer] = useState<{ teamId: string; userId: string } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const usersById = new Map<string, PublicUser>(confirmed.map((p) => [p.userId, p.user]));
  const assigned = new Set(teams.flatMap((t) => t.playerIds));
  const bench = confirmed.filter((p) => !assigned.has(p.userId));
  const eventId = teams[0]?.eventId ?? '';

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const saveRename = async (team: Team) => {
    const trimmed = nameDraft.trim();
    setRenaming(null);
    if (!trimmed || trimmed === team.name) return;
    await run(`name-${team.id}`, () => services.games.renameTeam(me.id, team.id, trimmed));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...teams];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    await run('reorder', () => services.games.reorderTeams(me.id, eventId, next.map((t) => t.id)));
  };

  const removePlayer = async (team: Team, userId: string) => {
    await run(`roster-${team.id}`, () => services.games.updateTeamRoster(me.id, team.id, team.playerIds.filter((id) => id !== userId)));
  };

  const addPlayer = async (team: Team, userId: string) => {
    setAddingTo(null);
    await run(`roster-${team.id}`, () => services.games.updateTeamRoster(me.id, team.id, [...team.playerIds, userId]));
  };

  const moveTo = async (destTeamId: string) => {
    if (!movingPlayer) return;
    const { teamId, userId } = movingPlayer;
    setMovingPlayer(null);
    const source = teams.find((t) => t.id === teamId);
    const dest = teams.find((t) => t.id === destTeamId);
    if (!source || !dest) return;
    setBusy(`move-${userId}`);
    try {
      await services.games.updateTeamRoster(me.id, source.id, source.playerIds.filter((id) => id !== userId));
      await services.games.updateTeamRoster(me.id, dest.id, [...dest.playerIds, userId]);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h3 className="mb-2 font-display text-xl font-bold">Times da pelada</h3>
      <div className="space-y-3">
        {teams.map((t, i) => {
          const s = teamStyle(t.color);
          return (
            <div key={t.id} className="overflow-hidden rounded-2xl bg-white shadow-lift">
              <header className="flex items-center gap-2 px-3 py-2.5" style={{ background: s.hex, color: s.text }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/15 font-display text-sm font-extrabold">{i + 1}</span>
                {renaming === t.id ? (
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => saveRename(t)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename(t)}
                    className="h-9 flex-1 !text-ink"
                    aria-label="Nome do time"
                  />
                ) : (
                  <button
                    className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left font-display text-lg font-extrabold disabled:cursor-default"
                    disabled={!canEdit}
                    onClick={() => { setRenaming(t.id); setNameDraft(t.name); }}
                  >
                    <span className="truncate">{t.name}</span>
                    {canEdit && <Pencil size={14} className="shrink-0 opacity-70" />}
                  </button>
                )}
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0 || !!busy} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-30" aria-label={`Mover ${t.name} para cima`}><ChevronUp size={18} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === teams.length - 1 || !!busy} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-30" aria-label={`Mover ${t.name} para baixo`}><ChevronDown size={18} /></button>
                  </div>
                )}
              </header>
              <div className="flex flex-wrap gap-1.5 p-3">
                {t.playerIds.map((pid) => {
                  const u = usersById.get(pid);
                  return (
                    <button
                      key={pid}
                      onClick={() => canManageRoster && setMovingPlayer({ teamId: t.id, userId: pid })}
                      disabled={!canManageRoster}
                      className="flex items-center gap-1.5 rounded-full bg-chalk py-1 pl-1 pr-2.5 text-sm font-semibold disabled:opacity-90"
                    >
                      <Avatar name={u?.name ?? '?'} src={u?.avatarUrl} size={22} />
                      {u?.name.split(' ')[0] ?? '—'}
                    </button>
                  );
                })}
                {!t.playerIds.length && <p className="text-sm text-ink-muted">Sem jogadores</p>}
                {canManageRoster && (
                  <button onClick={() => setAddingTo(t.id)} className="flex items-center gap-1 rounded-full border-2 border-dashed border-turf-600 py-1 pl-1.5 pr-2.5 text-sm font-semibold text-turf-700"><Plus size={16} />Adicionar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {bench.length > 0 && (
        <div className="mt-3 rounded-2xl bg-ink/[.05] p-3">
          <h4 className="mb-1.5 px-1 text-sm font-semibold text-ink-soft">Sem time ({bench.length})</h4>
          <div className="flex flex-wrap gap-1.5">
            {bench.map((p) => (
              <span key={p.userId} className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-2.5 text-sm font-semibold shadow-sm"><Avatar name={p.user.name} src={p.user.avatarUrl} size={22} />{p.user.name.split(' ')[0]}</span>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!movingPlayer} onClose={() => setMovingPlayer(null)} title={movingPlayer ? usersById.get(movingPlayer.userId)?.name : undefined}>
        {movingPlayer && (
          <div className="space-y-2">
            {teams.filter((t) => t.id !== movingPlayer.teamId).map((t) => (
              <button key={t.id} onClick={() => moveTo(t.id)} className="flex w-full items-center gap-2 rounded-2xl border-2 border-chalk-line p-3 text-left font-semibold">
                <span className="h-4 w-4 rounded-full ring-1 ring-ink/15" style={{ background: teamStyle(t.color).hex }} />
                Mover para {t.name}
              </button>
            ))}
            <button onClick={() => { const t = movingPlayer; setMovingPlayer(null); if (t) removePlayer(teams.find((x) => x.id === t.teamId)!, t.userId); }} className="flex w-full items-center gap-2 rounded-2xl border-2 border-whistle/30 p-3 text-left font-semibold text-whistle">
              <UserMinus size={18} />Tirar do time (banco)
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!addingTo} onClose={() => setAddingTo(null)} title="Adicionar ao time">
        {bench.length ? (
          <div className="divide-y divide-chalk-line">
            {bench.map((p) => (
              <button key={p.userId} onClick={() => addPlayer(teams.find((t) => t.id === addingTo)!, p.userId)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <Avatar name={p.user.name} src={p.user.avatarUrl} size={36} />
                <span className="font-semibold">{p.user.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState icon={<X />} title="Ninguém no banco" description="Todos os confirmados já estão em algum time." />
        )}
      </Sheet>
    </section>
  );
}
