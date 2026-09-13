import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { AppLayout } from '@/layouts/AppLayout';
import { Spinner } from '@/components/ui/Spinner';

const Welcome = lazy(() => import('@/pages/auth/Welcome'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const Home = lazy(() => import('@/pages/app/Home'));
const Peladas = lazy(() => import('@/pages/app/Peladas'));
const EventForm = lazy(() => import('@/pages/app/EventForm'));
const EventDetail = lazy(() => import('@/pages/app/EventDetail'));
const ManageEvent = lazy(() => import('@/pages/app/ManageEvent'));
const TeamDraw = lazy(() => import('@/pages/app/TeamDraw'));
const LiveMatch = lazy(() => import('@/pages/app/LiveMatch'));
const Profile = lazy(() => import('@/pages/app/Profile'));
const EditProfile = lazy(() => import('@/pages/app/EditProfile'));
const Friends = lazy(() => import('@/pages/app/Friends'));
const Invites = lazy(() => import('@/pages/app/Invites'));
const Settings = lazy(() => import('@/pages/app/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export function FullScreenLoader() {
  return <div className="flex min-h-dvh items-center justify-center bg-chalk"><Spinner className="h-8 w-8 text-turf-700" /></div>;
}

const page = (node: ReactNode) => <Suspense fallback={<div className="flex justify-center py-20"><Spinner className="h-7 w-7 text-turf-700" /></div>}>{node}</Suspense>;

function RequireAuth() {
  const status = useSession((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'guest') return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function GuestOnly() {
  const status = useSession((s) => s.status);
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authed') return <Navigate to="/inicio" replace />;
  return <Suspense fallback={<FullScreenLoader />}><Outlet /></Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: '/', element: <Welcome /> },
      { path: '/entrar', element: <Login /> },
      { path: '/criar-conta', element: <Register /> },
      { path: '/recuperar-senha', element: <ForgotPassword /> }
    ]
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/inicio', element: page(<Home />) },
          { path: '/peladas', element: page(<Peladas />) },
          { path: '/peladas/nova', element: page(<EventForm />) },
          { path: '/peladas/:id', element: page(<EventDetail />) },
          { path: '/peladas/:id/editar', element: page(<EventForm />) },
          { path: '/peladas/:id/gerenciar', element: page(<ManageEvent />) },
          { path: '/peladas/:id/sorteio', element: page(<TeamDraw />) },
          { path: '/peladas/:id/partida', element: page(<LiveMatch />) },
          { path: '/amigos', element: page(<Friends />) },
          { path: '/convites', element: page(<Invites />) },
          { path: '/perfil', element: page(<Profile />) },
          { path: '/perfil/editar', element: page(<EditProfile />) },
          { path: '/jogador/:username', element: page(<Profile />) },
          { path: '/configuracoes', element: page(<Settings />) }
        ]
      }
    ]
  },
  { path: '*', element: <Suspense fallback={<FullScreenLoader />}><NotFound /></Suspense> }
]);
