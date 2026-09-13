import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Globe, Lock, ShieldCheck, Zap } from 'lucide-react';
import type { EventInput } from '@/types';
import { useMe } from '@/stores/session';
import { errorMessage, services } from '@/services';
import { useDebounced } from '@/hooks/useDebounced';
import { invalidate } from '@/stores/refresh';
import { toast } from '@/stores/toast';
import { isGoogleMapsUrl } from '@/domain/maps';
import { ROTATION_LABEL } from '@/domain/rotation';
import { todayISO } from '@/lib/format';
import { PageHeader } from '@/components/app/PageHeader';
import { MapPreview } from '@/components/app/MapPreview';
import { Input, Textarea } from '@/components/ui/Field';
import { ChoiceCards, Stepper } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/States';

const DURATIONS = [5, 8, 10, 15, 20, 25, 30];

const empty = (): EventInput => ({
  name: '', description: '', date: todayISO(1), time: '20:00',
  location: { name: '', address: '', court: '', mapsUrl: '' },
  privacy: 'public', joinPolicy: 'auto', maxPlayers: 18, playersPerTeam: 5, teamsCount: 3, matchDurationMin: 10,
  priceCents: undefined, notes: '', rotationRule: 'winner-stays'
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-lift sm:p-5">
      <h2 className="mb-3 font-display text-2xl font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function EventForm() {
  const { id } = useParams();
  const editing = !!id;
  const me = useMe();
  const navigate = useNavigate();
  const [form, setForm] = useState<EventInput>(empty);
  const [price, setPrice] = useState('');
  const [customDuration, setCustomDuration] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | string>(editing ? 'loading' : 'ready');

  useEffect(() => {
    if (!id) return;
    services.events.getById(id, me.id).then((e) => {
      const { name, description, date, time, location, privacy, joinPolicy, maxPlayers, playersPerTeam, teamsCount, matchDurationMin, priceCents, notes, rotationRule } = e;
      setForm({ name, description, date, time, location: { court: '', mapsUrl: '', ...location }, privacy, joinPolicy, maxPlayers, playersPerTeam, teamsCount, matchDurationMin, priceCents, notes, rotationRule });
      setPrice(priceCents ? (priceCents / 100).toFixed(2).replace('.', ',') : '');
      setCustomDuration(!DURATIONS.includes(matchDurationMin));
      setLoadState('ready');
    }).catch((err) => setLoadState(errorMessage(err)));
  }, [id, me.id]);

  const up = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const upLoc = (k: keyof EventInput['location'], v: string) => setForm((f) => ({ ...f, location: { ...f.location, [k]: v } }));

  const mapLoc = useDebounced(form.location, 700);
  const showMap = !!(mapLoc.mapsUrl?.trim() || mapLoc.address.trim().length > 6);
  const capacity = form.teamsCount * form.playersPerTeam;

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e.name = 'Dê um nome com pelo menos 3 letras.';
    if (!form.date) e.date = 'Escolha a data.';
    else if (!editing && form.date < todayISO()) e.date = 'A data já passou.';
    if (!form.time) e.time = 'Escolha o horário.';
    if (!form.location.name.trim()) e.locName = 'Informe o nome do local.';
    if (!form.location.address.trim()) e.address = 'Informe o endereço.';
    if (form.location.mapsUrl && !isGoogleMapsUrl(form.location.mapsUrl)) e.mapsUrl = 'Cole um link do Google Maps (google.com/maps ou maps.app.goo.gl).';
    if (form.maxPlayers < form.playersPerTeam * 2) e.capacity = `Para ${form.playersPerTeam} por time, a lista precisa de ao menos ${form.playersPerTeam * 2} jogadores.`;
    if (price && isNaN(Number(price.replace(',', '.')))) e.price = 'Valor inválido.';
    setErrors(e);
    if (Object.keys(e).length) toast.error('Revise os campos destacados.');
    return !Object.keys(e).length;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload: EventInput = {
      ...form,
      name: form.name.trim(),
      priceCents: price ? Math.round(Number(price.replace(',', '.')) * 100) : undefined,
      location: { ...form.location, court: form.location.court || undefined, mapsUrl: form.location.mapsUrl || undefined }
    };
    try {
      const saved = editing ? await services.events.update(me.id, id!, payload) : await services.events.create(me.id, payload);
      invalidate('events');
      toast.success(editing ? 'Pelada atualizada' : 'Pelada criada. Agora é convidar a galera.');
      navigate(`/peladas/${saved.id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadState === 'loading') return <div className="space-y-4 pt-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (loadState !== 'ready') return <div className="pt-4"><PageHeader title="Editar pelada" back /><ErrorState message={loadState} /></div>;

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title={editing ? 'Editar pelada' : 'Nova pelada'} subtitle={editing ? undefined : 'Leva menos de um minuto.'} back />
      <div className="space-y-4">
        <Section title="Informações">
          <Input label="Nome da pelada" name="name" value={form.name} onChange={(e) => up('name', e.target.value)} placeholder="Racha de quinta" error={errors.name} maxLength={40} />
          <Textarea label="Descrição" name="description" value={form.description} onChange={(e) => up('description', e.target.value)} placeholder="Nível, regras, o que levar…" maxLength={280} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Data" type="date" name="date" value={form.date} min={editing ? undefined : todayISO()} onChange={(e) => up('date', e.target.value)} error={errors.date} />
            <Input label="Horário" type="time" name="time" value={form.time} onChange={(e) => up('time', e.target.value)} error={errors.time} />
          </div>
        </Section>

        <Section title="Local">
          <Input label="Nome do local" name="locName" value={form.location.name} onChange={(e) => upLoc('name', e.target.value)} placeholder="Arena Society" error={errors.locName} />
          <Input label="Endereço" name="address" value={form.location.address} onChange={(e) => upLoc('address', e.target.value)} placeholder="Rua, número, bairro" error={errors.address} />
          <Input label="Campo ou quadra" name="court" value={form.location.court} onChange={(e) => upLoc('court', e.target.value)} placeholder="Campo 2 (opcional)" />
          <Input label="Link do Google Maps" name="mapsUrl" type="url" inputMode="url" value={form.location.mapsUrl} onChange={(e) => upLoc('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" error={errors.mapsUrl} hint="Opcional. Com o link, o mapa fica mais preciso." />
          {showMap && <MapPreview location={mapLoc} height={160} />}
        </Section>

        <Section title="Formato">
          <div className="divide-y divide-chalk-line">
            <Stepper label="Times" value={form.teamsCount} min={2} max={8} onChange={(v) => up('teamsCount', v)} />
            <Stepper label="Jogadores por time" value={form.playersPerTeam} min={2} max={11} onChange={(v) => up('playersPerTeam', v)} />
            <Stepper label="Máximo na lista" value={form.maxPlayers} min={4} max={60} onChange={(v) => up('maxPlayers', v)} />
          </div>
          <p className={`rounded-xl px-3 py-2 text-sm ${errors.capacity ? 'bg-whistle-soft font-semibold text-whistle' : 'bg-chalk text-ink-muted'}`}>
            {errors.capacity ?? (form.maxPlayers > capacity ? `${capacity} jogam por rodada; ${form.maxPlayers - capacity} ficam de reserva.` : form.maxPlayers < capacity ? `Com ${form.maxPlayers} na lista, nem todos os ${form.teamsCount} times ficam completos.` : `${capacity} jogadores, times completos.`)}
          </p>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Duração de cada partida</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button type="button" key={d} onClick={() => { up('matchDurationMin', d); setCustomDuration(false); }} className={`h-11 min-w-[3.5rem] rounded-xl px-3 font-display text-xl font-bold ${!customDuration && form.matchDurationMin === d ? 'bg-turf-800 text-chalk' : 'bg-chalk text-ink'}`}>{d}′</button>
              ))}
              <button type="button" onClick={() => setCustomDuration(true)} className={`h-11 rounded-xl px-3 text-sm font-semibold ${customDuration ? 'bg-turf-800 text-chalk' : 'bg-chalk text-ink'}`}>Personalizado</button>
            </div>
            {customDuration && <div className="mt-2"><Stepper label="Minutos" value={form.matchDurationMin} min={1} max={90} onChange={(v) => up('matchDurationMin', v)} /></div>}
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">Ordem das partidas</p>
            <ChoiceCards value={form.rotationRule} onChange={(v) => up('rotationRule', v)} options={(['winner-stays', 'round-robin'] as const).map((r) => ({ value: r, title: ROTATION_LABEL[r].title, description: ROTATION_LABEL[r].hint }))} />
          </div>

          <Input label="Valor por jogador" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,]/g, ''))} placeholder="0,00 (deixe vazio se for gratuita)" leading={<span className="text-sm font-semibold">R$</span>} error={errors.price} />
          <Textarea label="Observações" name="notes" value={form.notes} onChange={(e) => up('notes', e.target.value)} placeholder="Pix, colete, bola…" maxLength={200} />
        </Section>

        <Section title="Quem pode entrar">
          <ChoiceCards
            value={form.privacy}
            onChange={(v) => up('privacy', v)}
            options={[
              { value: 'public', title: 'Pública', description: 'Aparece na busca; qualquer pessoa pode pedir para entrar.', icon: <Globe size={20} /> },
              { value: 'private', title: 'Privada', description: 'Fora da busca; só entra quem for convidado.', icon: <Lock size={20} /> }
            ]}
          />
          {form.privacy === 'public' && (
            <ChoiceCards
              value={form.joinPolicy}
              onChange={(v) => up('joinPolicy', v)}
              options={[
                { value: 'auto', title: 'Entrada direta', description: 'Quem pedir já entra na lista, até lotar.', icon: <Zap size={20} /> },
                { value: 'approval', title: 'Com aprovação', description: 'Você aprova cada pedido antes.', icon: <ShieldCheck size={20} /> }
              ]}
            />
          )}
        </Section>
      </div>

      <div className="sticky bottom-20 z-10 mt-5 lg:bottom-4">
        <Button type="submit" size="lg" block loading={saving} className="shadow-xl">{editing ? 'Salvar alterações' : 'Criar pelada'}</Button>
      </div>
    </form>
  );
}
