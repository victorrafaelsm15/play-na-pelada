import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Check, RefreshCw, X } from 'lucide-react';
import { useSession } from '@/stores/session';
import { AppError, errorMessage, services } from '@/services';
import { useDebounced } from '@/hooks/useDebounced';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/toast';
import { AuthShell } from './AuthShell';

const randomPublicId = () => String(10000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000));
type Check = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

function useAvailability(value: string, validate: (v: string) => boolean, check: (v: string) => Promise<boolean>): Check {
  const dv = useDebounced(value, 400);
  const [state, setState] = useState<Check>('idle');
  useEffect(() => {
    if (!dv) return setState('idle');
    if (!validate(dv)) return setState('invalid');
    let alive = true;
    setState('checking');
    check(dv).then((ok) => alive && setState(ok ? 'ok' : 'taken'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dv]);
  return value !== dv && value ? 'checking' : state;
}

const statusIcon = (s: Check) =>
  s === 'checking' ? <Spinner className="mr-1.5 h-5 w-5 text-ink-muted" /> : s === 'ok' ? <Check className="mr-1.5 text-turf-600" /> : s === 'taken' || s === 'invalid' ? <X className="mr-1.5 text-whistle" /> : null;

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

export default function Register() {
  const register = useSession((s) => s.register);
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', username: '', publicId: randomPublicId(), email: '', password: '', confirm: '' });
  const [avatar, setAvatar] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'username' ? e.target.value.toLowerCase().replace(/^@/, '') : k === 'publicId' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value });

  const userCheck = useAvailability(f.username, (v) => USERNAME_RE.test(v), (v) => services.auth.isUsernameAvailable(v));
  const idCheck = useAvailability(f.publicId, (v) => /^\d{4,6}$/.test(v), (v) => services.auth.isPublicIdAvailable(v));

  const onAvatar = async (file?: File) => {
    if (!file) return;
    try {
      setAvatar(await services.storage.uploadImage(file, 'avatars'));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Informe seu nome.';
    if (!USERNAME_RE.test(f.username)) e.username = 'De 3 a 20 caracteres: letras minúsculas, números, ponto ou _.';
    else if (userCheck === 'taken') e.username = 'Este nome de usuário já está em uso.';
    if (!/^\d{4,6}$/.test(f.publicId)) e.publicId = 'O ID deve ter de 4 a 6 números.';
    else if (idCheck === 'taken') e.publicId = 'Este ID já está em uso.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Informe um e-mail válido.';
    if (f.password.length < 8) e.password = 'A senha precisa de pelo menos 8 caracteres.';
    if (f.confirm !== f.password) e.confirm = 'As senhas não coincidem.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register({ name: f.name, username: f.username, publicId: f.publicId, email: f.email, password: f.password, avatarUrl: avatar });
      toast.success('Conta criada. Bora pro jogo!');
      navigate('/inicio', { replace: true });
    } catch (err) {
      if (err instanceof AppError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Seu perfil de jogador para entrar em qualquer pelada.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="flex cursor-pointer items-center gap-4 rounded-2xl bg-white p-3 shadow-lift">
          <span className="relative">
            <Avatar name={f.name || '?'} src={avatar} size={64} />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card text-card-ink ring-2 ring-white"><Camera size={14} /></span>
          </span>
          <span><span className="block font-semibold">Foto de perfil</span><span className="text-sm text-ink-muted">Opcional</span></span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatar(e.target.files?.[0])} />
        </label>

        <Input label="Nome" name="name" autoComplete="name" value={f.name} onChange={set('name')} error={errors.name} />
        <Input
          label="Nome de usuário"
          name="username"
          autoCapitalize="none"
          autoComplete="username"
          value={f.username}
          onChange={set('username')}
          leading={<span className="font-semibold">@</span>}
          trailing={statusIcon(userCheck)}
          error={errors.username ?? (userCheck === 'taken' ? 'Este nome de usuário já está em uso.' : null)}
          hint={userCheck === 'ok' ? 'Disponível' : 'Seus amigos vão encontrar você por ele.'}
        />
        <Input
          label="ID de jogador"
          name="publicId"
          inputMode="numeric"
          value={f.publicId}
          onChange={set('publicId')}
          error={errors.publicId ?? (idCheck === 'taken' ? 'Este ID já está em uso.' : null)}
          hint="Número único para busca rápida. Você pode escolher outro."
          trailing={
            <span className="flex items-center">
              {statusIcon(idCheck)}
              <button type="button" onClick={() => setF({ ...f, publicId: randomPublicId() })} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-chalk" aria-label="Gerar outro ID"><RefreshCw size={16} /></button>
            </span>
          }
        />
        <Input label="E-mail" type="email" name="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} />
        <Input label="Senha" type="password" name="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={errors.password} hint="Mínimo de 8 caracteres." />
        <Input label="Confirmar senha" type="password" name="confirm" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" size="lg" block loading={loading}>Criar conta</Button>
      </form>
      <p className="mt-6 text-center text-ink-muted">Já tem conta? <Link to="/entrar" className="font-semibold text-turf-700">Entrar</Link></p>
    </AuthShell>
  );
}
