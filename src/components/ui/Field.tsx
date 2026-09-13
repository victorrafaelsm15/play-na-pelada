import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface WrapProps { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string }

export function FieldWrap({ label, hint, error, children, htmlFor, className }: WrapProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-soft">{label}</label>}
      {children}
      {error ? <p className="text-sm font-medium text-whistle" role="alert">{error}</p> : hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

const base = 'w-full rounded-xl border-2 bg-white px-3.5 text-ink placeholder:text-ink-muted/70 outline-none transition focus:border-turf-600';

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; error?: string | null; leading?: ReactNode; trailing?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, leading, trailing, className, id, ...rest }, ref) {
  const fid = id ?? rest.name;
  return (
    <FieldWrap label={label} hint={hint} error={error} htmlFor={fid} className={className}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">{leading}</span>}
        <input
          ref={ref}
          id={fid}
          aria-invalid={!!error}
          className={clsx(base, 'h-12', error ? 'border-whistle' : 'border-chalk-line', leading && 'pl-10', trailing && 'pr-11')}
          {...rest}
        />
        {trailing && <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode; error?: string | null };
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, ...rest }, ref) {
  const fid = id ?? rest.name;
  return (
    <FieldWrap label={label} hint={hint} error={error} htmlFor={fid} className={className}>
      <textarea ref={ref} id={fid} rows={3} className={clsx(base, 'py-3 leading-relaxed', error ? 'border-whistle' : 'border-chalk-line')} {...rest} />
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: ReactNode; error?: string | null };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, className, id, children, ...rest }, ref) {
  const fid = id ?? rest.name;
  return (
    <FieldWrap label={label} hint={hint} error={error} htmlFor={fid} className={className}>
      <select ref={ref} id={fid} className={clsx(base, 'h-12 appearance-none', error ? 'border-whistle' : 'border-chalk-line')} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
});
