import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'chalk';
type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-card text-card-ink hover:bg-card-deep active:bg-card-deep',
  dark: 'bg-turf-800 text-chalk hover:bg-turf-700',
  outline: 'border-2 border-ink/15 text-ink hover:border-ink/35 bg-white',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-whistle text-white hover:brightness-95',
  chalk: 'bg-chalk text-turf-900 hover:bg-white'
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-5 text-base rounded-2xl gap-2',
  xl: 'h-20 px-6 text-lg rounded-3xl gap-3'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-5 w-5" /> : children}
    </button>
  );
});
