import { Link } from 'react-router-dom';
export default function NotFound() {
  return (
    <div className="pitch-lines flex min-h-dvh flex-col items-center justify-center bg-turf-800 p-6 text-center text-chalk">
      <p className="font-display text-[120px] font-extrabold leading-none">404</p>
      <p className="mt-2 font-display text-3xl font-bold">Bola fora</p>
      <p className="mt-1 text-chalk/75">Esta página não existe ou foi removida.</p>
      <Link to="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-card px-5 font-semibold text-card-ink">Voltar ao início</Link>
    </div>
  );
}
