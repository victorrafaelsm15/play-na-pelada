import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useSession } from '@/stores/session';
import { errorMessage } from '@/services';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { toast } from '@/stores/toast';
import { AuthShell } from './AuthShell';

export default function Login() {
  const login = useSession((s) => s.login);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/inicio';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return setError('Preencha e-mail ou usuário e a senha.');
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password, remember);
      toast.success('Bem-vindo de volta');
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Acesse suas peladas, convites e partidas.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="E-mail, @usuário ou ID" name="identifier" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="voce@email.com" />
        <Input
          label="Senha"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={<button type="button" onClick={() => setShow(!show)} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-5 w-5 accent-turf-700" />
            Manter conectado
          </label>
          <Link to="/recuperar-senha" className="text-sm font-semibold text-turf-700">Esqueci a senha</Link>
        </div>
        {error && <p role="alert" className="rounded-xl bg-whistle-soft px-3 py-2.5 text-sm font-semibold text-whistle">{error}</p>}
        <Button type="submit" size="lg" block loading={loading}>Entrar</Button>
      </form>
      <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-lift">
        <p className="font-semibold text-ink">Conta de demonstração</p>
        <p>demo@racha.app, senha racha123</p>
        <button className="mt-2 font-semibold text-turf-700" onClick={() => { setIdentifier('demo@racha.app'); setPassword('racha123'); }}>Preencher</button>
      </div>
      <p className="mt-6 text-center text-ink-muted">Ainda não tem conta? <Link to="/criar-conta" className="font-semibold text-turf-700">Criar conta</Link></p>
    </AuthShell>
  );
}
