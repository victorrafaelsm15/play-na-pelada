import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Database, LogOut, Smartphone } from 'lucide-react';
import { useSession } from '@/stores/session';
import { env } from '@/config/env';
import { resetMockData } from '@/services/mock/services';
import { toast } from '@/stores/toast';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { PageHeader } from '@/components/app/PageHeader';
import { InstallButton } from '@/components/app/InstallButton';
import { Switch } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Sheet';

const PREFS_KEY = 'racha:prefs';
type Prefs = { invites: boolean; requests: boolean; reminders: boolean; changes: boolean };
const loadPrefs = (): Prefs => {
  try {
    return { invites: true, requests: true, reminders: true, changes: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return { invites: true, requests: true, reminders: true, changes: true };
  }
};

export default function Settings() {
  const logout = useSession((s) => s.logout);
  const navigate = useNavigate();
  const { installed } = useInstallPrompt();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [resetOpen, setResetOpen] = useState(false);
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  const set = (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const askPush = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === 'granted') toast.success('Notificações do dispositivo ativadas');
  };

  const card = 'rounded-3xl bg-white p-4 shadow-lift';
  return (
    <div>
      <PageHeader title="Configurações" back />
      <div className="space-y-4">
        <section className={card}>
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold"><Bell size={20} />Notificações</h2>
          <div className="divide-y divide-chalk-line">
            <Switch checked={prefs.invites} onChange={(v) => set('invites', v)} label="Convites para peladas" />
            <Switch checked={prefs.requests} onChange={(v) => set('requests', v)} label="Pedidos de participação" description="Nas peladas que você gerencia" />
            <Switch checked={prefs.reminders} onChange={(v) => set('reminders', v)} label="Lembrete antes da pelada" />
            <Switch checked={prefs.changes} onChange={(v) => set('changes', v)} label="Alterações de data, local ou lista" />
          </div>
          {permission !== 'unsupported' && permission !== 'granted' && (
            <Button variant="outline" block className="mt-3" onClick={askPush} disabled={permission === 'denied'}>
              {permission === 'denied' ? 'Notificações bloqueadas no navegador' : 'Receber no celular'}
            </Button>
          )}
        </section>

        <section className={card}>
          <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-bold"><Smartphone size={20} />Aplicativo</h2>
          {installed ? <p className="text-sm text-ink-muted">O Racha já está instalado neste dispositivo.</p> : (
            <>
              <p className="text-sm text-ink-muted">Instale para abrir em tela cheia e usar no campo sem o navegador.</p>
              <InstallButton className="mt-2 -ml-3" />
            </>
          )}
        </section>

        {env.dataSource === 'mock' && (
          <section className={card}>
            <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold"><Database size={20} />Dados de demonstração</h2>
            <p className="text-sm text-ink-muted">Os dados ficam salvos neste navegador até o backend ser conectado.</p>
            <Button variant="outline" block className="mt-3" onClick={() => setResetOpen(true)}>Restaurar dados de demonstração</Button>
          </section>
        )}

        <Button variant="outline" size="lg" block className="!text-whistle" onClick={async () => { await logout(); navigate('/', { replace: true }); }}><LogOut size={20} />Sair da conta</Button>
        <p className="text-center text-xs text-ink-muted">Racha v0.1.0</p>
      </div>

      <ConfirmDialog open={resetOpen} onClose={() => setResetOpen(false)} title="Restaurar demonstração?" message="Peladas, times e partidas criados neste navegador serão apagados." confirmLabel="Restaurar" danger
        onConfirm={async () => { resetMockData(); await logout(); navigate('/entrar', { replace: true }); }} />
    </div>
  );
}
