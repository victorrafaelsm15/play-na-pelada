import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { services, errorMessage } from '@/services';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { AuthShell } from './AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('loading');
    setError(null);
    try {
      await services.auth.requestPasswordReset(email);
      setState('sent');
    } catch (err) {
      setError(errorMessage(err));
      setState('idle');
    }
  };

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      {state === 'sent' ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-lift animate-rise">
          <MailCheck className="mx-auto text-turf-700" size={36} />
          <p className="mt-3 font-display text-2xl font-bold">Confira seu e-mail</p>
          <p className="mt-1 text-ink-muted">Se existir uma conta com {email}, o link chega em alguns minutos.</p>
          <Link to="/entrar" className="mt-5 inline-block font-semibold text-turf-700">Voltar para entrar</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="E-mail da conta" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" size="lg" block loading={state === 'loading'}>Enviar link</Button>
        </form>
      )}
    </AuthShell>
  );
}
