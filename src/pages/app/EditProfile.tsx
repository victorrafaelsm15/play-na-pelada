import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, Trash2 } from 'lucide-react';
import type { PlayerPosition, Title, User, VideoLink, SocialLink } from '@/types';
import { useMe, useSession } from '@/stores/session';
import { AppError, errorMessage, services } from '@/services';
import { toast } from '@/stores/toast';
import { uid } from '@/lib/id';
import { POSITION_LABEL } from '@/lib/format';
import { USERNAME_RE } from '@/pages/auth/Register';
import { PageHeader } from '@/components/app/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export default function EditProfile() {
  const me = useMe();
  const setUser = useSession((s) => s.setUser);
  const navigate = useNavigate();
  const [f, setF] = useState<User>(() => structuredClone(me));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const up = <K extends keyof User>(k: K, v: User[K]) => setF((x) => ({ ...x, [k]: v }));
  const upSocial = (k: 'instagram' | 'whatsapp', v: string) => setF((x) => ({ ...x, socialLinks: { ...x.socialLinks, [k]: v } }));
  const upList = <K extends 'titles' | 'videos'>(k: K, idx: number, patch: Partial<User[K][number]>) =>
    setF((x) => ({ ...x, [k]: (x[k] as (Title | VideoLink)[]).map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  const upOther = (idx: number, patch: Partial<SocialLink>) => setF((x) => ({ ...x, socialLinks: { ...x.socialLinks, others: x.socialLinks.others.map((o, i) => (i === idx ? { ...o, ...patch } : o)) } }));

  const onAvatar = async (file?: File) => {
    if (!file) return;
    try {
      up('avatarUrl', await services.storage.uploadImage(file, 'avatars'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Informe seu nome.';
    if (!USERNAME_RE.test(f.username)) errs.username = 'De 3 a 20 caracteres: letras minúsculas, números, ponto ou _.';
    if (!/^\d{4,6}$/.test(f.publicId)) errs.publicId = 'O ID deve ter de 4 a 6 números.';
    f.videos.forEach((v, i) => { if (v.url && !/^https?:\/\//.test(v.url)) errs[`video${i}`] = 'O link deve começar com https://'; });
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Revise os campos destacados.');
    setSaving(true);
    try {
      const saved = await services.users.updateProfile(me.id, {
        name: f.name.trim(), username: f.username, publicId: f.publicId, bio: f.bio?.trim() || undefined, position: f.position, dominantFoot: f.dominantFoot, avatarUrl: f.avatarUrl,
        titles: f.titles.filter((t) => t.name.trim()),
        videos: f.videos.filter((v) => v.url.trim()).map((v) => ({ ...v, title: v.title.trim() || 'Vídeo' })),
        socialLinks: { instagram: f.socialLinks.instagram?.trim() || undefined, whatsapp: f.socialLinks.whatsapp?.trim() || undefined, others: f.socialLinks.others.filter((o) => o.url.trim()) }
      });
      setUser(saved);
      toast.success('Perfil salvo');
      navigate('/perfil', { replace: true });
    } catch (err) {
      if (err instanceof AppError && err.field) setErrors({ [err.field]: err.message });
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const card = 'rounded-3xl bg-white p-4 shadow-lift space-y-4';
  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title="Editar perfil" back="/perfil" />
      <div className="space-y-4">
        <section className={card}>
          <label className="flex cursor-pointer items-center gap-4">
            <span className="relative">
              <Avatar name={f.name || '?'} src={f.avatarUrl} size={76} />
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-card text-card-ink ring-2 ring-white"><Camera size={16} /></span>
            </span>
            <span className="font-semibold text-turf-700">Trocar foto</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
          </label>
          <Input label="Nome" value={f.name} onChange={(e) => up('name', e.target.value)} error={errors.name} />
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <Input label="Usuário" leading={<span className="font-semibold">@</span>} value={f.username} autoCapitalize="none" onChange={(e) => up('username', e.target.value.toLowerCase().replace(/^@/, ''))} error={errors.username} />
            <Input label="ID" inputMode="numeric" value={f.publicId} onChange={(e) => up('publicId', e.target.value.replace(/\D/g, '').slice(0, 6))} error={errors.publicId} />
          </div>
          <Textarea label="Bio" value={f.bio ?? ''} onChange={(e) => up('bio', e.target.value)} maxLength={160} placeholder="Como você joga, onde bate sua bola…" hint={`${(f.bio ?? '').length}/160`} />
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl font-bold">Em campo</h2>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Posição" value={f.position ?? ''} onChange={(e) => up('position', (e.target.value || undefined) as PlayerPosition | undefined)}>
              <option value="">Não informar</option>
              {Object.entries(POSITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select label="Pé preferido" value={f.dominantFoot ?? ''} onChange={(e) => up('dominantFoot', (e.target.value || undefined) as User['dominantFoot'])}>
              <option value="">Não informar</option>
              <option value="direito">Direito</option>
              <option value="esquerdo">Esquerdo</option>
              <option value="ambos">Ambos</option>
            </Select>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Títulos</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => up('titles', [...f.titles, { id: uid('t'), name: '' }])}><Plus size={16} />Adicionar</Button>
          </div>
          {f.titles.length === 0 && <p className="text-sm text-ink-muted">Campeão, artilheiro, melhor jogador…</p>}
          {f.titles.map((t, i) => (
            <div key={t.id} className="space-y-2 rounded-2xl bg-chalk p-3">
              <div className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
                <Input label="Título" value={t.name} onChange={(e) => upList('titles', i, { name: e.target.value })} placeholder="Artilheiro da Copa" />
                <Input label="Ano" inputMode="numeric" value={t.year ?? ''} onChange={(e) => upList('titles', i, { year: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || undefined })} />
                <button type="button" onClick={() => up('titles', f.titles.filter((_, j) => j !== i))} className="flex h-12 w-12 items-center justify-center rounded-xl text-whistle hover:bg-whistle-soft" aria-label="Remover título"><Trash2 size={18} /></button>
              </div>
              <Input value={t.description ?? ''} onChange={(e) => upList('titles', i, { description: e.target.value })} placeholder="Detalhe (opcional)" aria-label="Detalhe do título" />
            </div>
          ))}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Vídeos</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => up('videos', [...f.videos, { id: uid('v'), title: '', url: '' }])}><Plus size={16} />Adicionar</Button>
          </div>
          {f.videos.map((v, i) => (
            <div key={v.id} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-2xl bg-chalk p-3">
              <div className="space-y-2">
                <Input value={v.title} onChange={(e) => upList('videos', i, { title: e.target.value })} placeholder="Título do lance" aria-label="Título do vídeo" />
                <Input type="url" inputMode="url" value={v.url} onChange={(e) => upList('videos', i, { url: e.target.value })} placeholder="https://youtube.com/…" aria-label="Link do vídeo" error={errors[`video${i}`]} />
              </div>
              <button type="button" onClick={() => up('videos', f.videos.filter((_, j) => j !== i))} className="flex h-12 w-12 items-center justify-center rounded-xl text-whistle hover:bg-whistle-soft" aria-label="Remover vídeo"><Trash2 size={18} /></button>
            </div>
          ))}
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl font-bold">Redes e contato</h2>
          <Input label="Instagram" leading={<span className="font-semibold">@</span>} value={f.socialLinks.instagram ?? ''} autoCapitalize="none" onChange={(e) => upSocial('instagram', e.target.value.replace(/^@/, ''))} />
          <Input label="WhatsApp" type="tel" inputMode="tel" value={f.socialLinks.whatsapp ?? ''} onChange={(e) => upSocial('whatsapp', e.target.value)} placeholder="+55 DDD número" hint="Visível para quem abrir seu perfil." />
          {f.socialLinks.others.map((o, i) => (
            <div key={o.id} className="grid grid-cols-[7rem_1fr_auto] items-end gap-2">
              <Input value={o.label} onChange={(e) => upOther(i, { label: e.target.value })} placeholder="Nome" aria-label="Nome do link" />
              <Input type="url" value={o.url} onChange={(e) => upOther(i, { url: e.target.value })} placeholder="https://" aria-label="Endereço do link" />
              <button type="button" onClick={() => setF((x) => ({ ...x, socialLinks: { ...x.socialLinks, others: x.socialLinks.others.filter((_, j) => j !== i) } }))} className="flex h-12 w-12 items-center justify-center rounded-xl text-whistle hover:bg-whistle-soft" aria-label="Remover link"><Trash2 size={18} /></button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => setF((x) => ({ ...x, socialLinks: { ...x.socialLinks, others: [...x.socialLinks.others, { id: uid('l'), label: '', url: '' }] } }))}><Plus size={16} />Outro link</Button>
        </section>
      </div>
      <div className="sticky bottom-20 mt-5 lg:bottom-4">
        <Button type="submit" size="lg" block loading={saving} className="shadow-xl">Salvar perfil</Button>
      </div>
    </form>
  );
}
