import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import clsx from 'clsx';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { toast } from '@/stores/toast';
import { Sheet } from '@/components/ui/Sheet';

/** Aparece apenas quando o navegador permite instalar (ou no iOS, com instrução manual). */
export function InstallButton({ className, variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const { canInstall, showIOSHint, install } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  if (!canInstall && !showIOSHint) return null;

  const onClick = async () => {
    if (showIOSHint) return setIosOpen(true);
    const outcome = await install();
    if (outcome === 'accepted') toast.success('Aplicativo instalado');
  };

  return (
    <>
      <button onClick={onClick} className={clsx('inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold', variant === 'dark' ? 'text-chalk hover:bg-white/10' : 'text-turf-700 hover:bg-turf-600/10', className)}>
        <Download size={18} /> Instalar aplicativo
      </button>
      <Sheet open={iosOpen} onClose={() => setIosOpen(false)} title="Instalar no iPhone">
        <ol className="space-y-3 text-ink-soft">
          <li className="flex gap-3"><span className="font-display text-xl font-bold text-turf-700">1</span>Toque em <Share size={18} className="inline" /> Compartilhar, na barra do Safari.</li>
          <li className="flex gap-3"><span className="font-display text-xl font-bold text-turf-700">2</span>Escolha “Adicionar à Tela de Início”.</li>
          <li className="flex gap-3"><span className="font-display text-xl font-bold text-turf-700">3</span>Confirme em “Adicionar”. O Racha abre como aplicativo.</li>
        </ol>
      </Sheet>
    </>
  );
}
