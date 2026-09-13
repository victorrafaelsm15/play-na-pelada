import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import { router } from './app/router';
import { useSession } from './stores/session';
import { captureInstallPrompt } from './hooks/useInstallPrompt';
import { Toaster } from './components/ui/Toaster';

captureInstallPrompt();
registerSW({ immediate: true });
useSession.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>
);
