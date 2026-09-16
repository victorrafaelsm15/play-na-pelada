import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Award, Instagram, Link2, Pencil, PlayCircle, Settings, UserCheck, UserPlus, Clock } from 'lucide-react';
import { WhatsAppIcon } from '@/components/app/WhatsAppIcon';
import type { PublicUser } from '@/types';
import { useMe } from '@/stores/session';
import { errorMessage, services } from '@/services';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/stores/toast';
import { invalidate } from '@/stores/refresh';
import { POSITION_LABEL } from '@/lib/format';
import { PageHeader } from '@/components/app/PageHeader';
import { EventCard, EventCardSkeleton } from '@/components/app/EventCard';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';

function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1];
}

export default function Profile() {
  const { username } = useParams();
  const me = useMe();
  const isMe = !username || username === me.username;
  const other = useAsync(() => (isMe ? Promise.resolve(null) : services.users.getByUsername(username!)), [username, isMe]);

  if (!isMe && other.loading) return <div className="space-y-4 pt-4"><Skeleton className="h-72 rounded-[28px]" /><Skeleton className="h-40" /></div>;
  if (!isMe && (other.error || !other.data)) return <div><PageHeader title="Jogador" back /><ErrorState message={other.error ?? 'Jogador não encontrado.'} /></div>;

  return <ProfileView user={isMe ? me : other.data!} isMe={isMe} />;
}

function ProfileView({ user, isMe }: { user: PublicUser; isMe: boolean }) {
  const me = useMe();
  const [tab, setTab] = useState<'organizo' | 'participo'>('organizo');
  const events = useAsync(() => services.events.listForUser(user.id), [user.id]);
  const rel = useAsync(() => services.users.relationship(me.id, user.id), [me.id, user.id]);
  const [busy, setBusy] = useState(false);

  const addFriend = async () => {
    setBusy(true);
    try {
      await services.users.sendFriendRequest(me.id, user.id);
      toast.success('Pedido de amizade enviado');
      invalidate('friends');
      rel.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const organized = events.data?.organized ?? [];
  const participating = events.data?.participating ?? [];
  const list = tab === 'organizo' ? organized : participating;
  const hasSocial = user.socialLinks.instagram || user.socialLinks.whatsapp || user.socialLinks.others.length;

  return (
    <div>
      <PageHeader
        title={isMe ? 'Perfil' : ''}
        back={!isMe}
        actions={isMe ? <Link to="/configuracoes" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Configurações"><Settings size={22} /></Link> : undefined}
        className="pb-2"
      />

      {/* Cartão esportivo */}
      <section className="pitch-lines relative overflow-hidden rounded-[28px] bg-turf-800 p-5 text-chalk">
        <span className="pointer-events-none absolute -right-3 -top-6 font-display text-[150px] font-extrabold leading-none text-white/[.06]" aria-hidden>{user.publicId.slice(-2)}</span>
        <div className="relative flex items-end gap-4">
          <Avatar name={user.name} src={user.avatarUrl} size={92} className="ring-4 ring-card" />
          <div className="min-w-0 pb-1">
            {user.position && <span className="rounded-md bg-card px-2 py-0.5 text-xs font-bold text-card-ink">{POSITION_LABEL[user.position]}</span>}
            <h1 className="mt-1.5 font-display text-[34px] font-extrabold leading-[.95]">{user.name}</h1>
            <p className="text-chalk/75">@{user.username} <span className="text-chalk/50">ID {user.publicId}</span></p>
          </div>
        </div>
        {user.bio && <p className="relative mt-4 leading-relaxed text-chalk/90">{user.bio}</p>}
        <dl className="relative mt-5 grid grid-cols-3 divide-x divide-white/15 rounded-2xl bg-black/20 py-3 text-center">
          {[
            [organized.length, 'organiza'],
            [participating.length, 'participa'],
            [user.titles.length, user.titles.length === 1 ? 'título' : 'títulos']
          ].map(([v, l]) => (
            <div key={l as string}><dt className="sr-only">{l}</dt><dd className="font-display text-3xl font-extrabold leading-none">{events.loading && l !== 'títulos' && l !== 'título' ? '–' : v}</dd><dd className="text-xs text-chalk/65">{l}</dd></div>
          ))}
        </dl>
      </section>

      <div className="mt-3">
        {isMe ? (
          <Link to="/perfil/editar" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-semibold shadow-lift"><Pencil size={18} />Editar perfil</Link>
        ) : rel.data === 'friend' ? (
          <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-turf-600/10 font-semibold text-turf-700"><UserCheck size={18} />Vocês são amigos</div>
        ) : rel.data === 'outgoing' ? (
          <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-chalk-soft font-semibold text-ink-muted"><Clock size={18} />Pedido enviado</div>
        ) : rel.data === 'incoming' ? (
          <Link to="/amigos" className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-card font-semibold text-card-ink">Responder pedido de amizade</Link>
        ) : (
          <Button size="lg" block loading={busy} onClick={addFriend}><UserPlus size={20} />Adicionar amigo</Button>
        )}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 font-display text-2xl font-bold">Títulos</h2>
        {user.titles.length ? (
          <ul className="space-y-2">
            {user.titles.map((t) => (
              <li key={t.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-lift">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-card-ink"><Award size={22} /></span>
                <span className="min-w-0">
                  <span className="block font-semibold">{t.name}{t.year ? <span className="font-normal text-ink-muted">, {t.year}</span> : null}</span>
                  {t.description && <span className="block text-sm text-ink-muted">{t.description}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Award />} title="Nenhum título ainda" description={isMe ? 'Artilharia, campeonatos, melhor em campo: registre suas conquistas.' : undefined} action={isMe ? <Link to="/perfil/editar" className="font-semibold text-turf-700">Adicionar título</Link> : undefined} />
        )}
      </section>

      {(user.videos.length > 0 || isMe) && (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-2xl font-bold">Vídeos</h2>
          {user.videos.length ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {user.videos.map((v) => {
                const yt = youtubeId(v.url);
                return (
                  <a key={v.id} href={v.url} target="_blank" rel="noreferrer" className="w-60 shrink-0 overflow-hidden rounded-2xl bg-white shadow-lift">
                    <div className="relative flex aspect-video items-center justify-center bg-turf-900">
                      {yt && <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" loading="lazy" />}
                      <PlayCircle size={42} className="relative text-chalk drop-shadow" />
                    </div>
                    <p className="truncate p-3 text-sm font-semibold">{v.title}</p>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-lift">Adicione links de lances do YouTube, Instagram ou outra plataforma. <Link to="/perfil/editar" className="font-semibold text-turf-700">Adicionar vídeo</Link></p>
          )}
        </section>
      )}

      {hasSocial ? (
        <section className="mt-6">
          <h2 className="mb-2 font-display text-2xl font-bold">Contato</h2>
          <div className="flex flex-wrap gap-2">
            {user.socialLinks.instagram && (
              <a
                href={`https://instagram.com/${user.socialLinks.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white shadow-lift transition hover:brightness-110 hover:shadow-xl active:scale-[.97]"
                style={{ background: 'linear-gradient(135deg,#4f5bd5,#962fbf,#d62976,#fa7e1e,#feda75)' }}
              >
                <Instagram size={19} />@{user.socialLinks.instagram.replace(/^@/, '')}
              </a>
            )}
            {user.socialLinks.whatsapp && (
              <a
                href={`https://wa.me/${user.socialLinks.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center gap-2 rounded-xl bg-[#25D366] px-4 font-semibold text-white shadow-lift transition hover:brightness-105 hover:shadow-xl active:scale-[.97]"
              >
                <WhatsAppIcon size={19} />WhatsApp
              </a>
            )}
            {user.socialLinks.others.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="flex h-12 items-center gap-2 rounded-xl bg-white px-4 font-semibold shadow-lift transition hover:shadow-xl active:scale-[.97]"><Link2 size={18} />{l.label}</a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'organizo', label: isMe ? 'Minhas peladas' : 'Organiza', count: organized.length }, { value: 'participo', label: isMe ? 'Participo' : 'Participa', count: participating.length }]} />
        <div className="mt-3 space-y-3">
          {events.loading ? <EventCardSkeleton /> : list.length ? list.map((e) => <EventCard key={e.id} event={e} compact />) : (
            <p className="rounded-2xl bg-white p-4 text-center text-sm text-ink-muted shadow-lift">{tab === 'organizo' ? 'Nenhuma pelada organizada.' : 'Nenhuma participação no momento.'}</p>
          )}
        </div>
      </section>
    </div>
  );
}
