import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/literata';
import '@fontsource-variable/literata/wght-italic.css';
import './styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ApiError } from './api';
import { AppLayout } from './components/Layout';
import { ToastProvider, useToast } from './lib/toast';
import { Login, Register } from './pages/Auth';
import { Discover } from './pages/Discover';
import { Home } from './pages/Home';
import { Drafts, Journal, Saved, Search } from './pages/Lists';
import { Notifications } from './pages/Notifications';
import { PostPage } from './pages/PostPage';
import { ProfileRoute } from './pages/Profile';
import { Prompts } from './pages/Prompts';
import { RoomPage } from './pages/RoomPage';
import { Rooms } from './pages/Rooms';
import { Settings } from './pages/Settings';
import { About, Imprint, NotFound, Privacy, Terms } from './pages/Static';
import { Welcome } from './pages/Welcome';
import { Write } from './pages/Write';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 30 * 60_000,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/entdecken', element: <Discover /> },
      { path: '/impulse', element: <Prompts /> },
      { path: '/impulse/:day', element: <Prompts /> },
      { path: '/raeume', element: <Rooms /> },
      { path: '/raum/:slug', element: <RoomPage /> },
      { path: '/text/:id', element: <PostPage /> },
      { path: '/tagebuch', element: <Journal /> },
      { path: '/gemerkt', element: <Saved /> },
      { path: '/entwuerfe', element: <Drafts /> },
      { path: '/mitteilungen', element: <Notifications /> },
      { path: '/einstellungen', element: <Settings /> },
      { path: '/willkommen', element: <Welcome /> },
      { path: '/suche', element: <Search /> },
      { path: '/ueber', element: <About /> },
      { path: '/datenschutz', element: <Privacy /> },
      { path: '/nutzungsbedingungen', element: <Terms /> },
      { path: '/impressum', element: <Imprint /> },
      { path: '/:handle', element: <ProfileRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/schreiben', element: <Write /> },
  { path: '/schreiben/:id', element: <Write /> },
  { path: '/anmelden', element: <Login /> },
  { path: '/registrieren', element: <Register /> },
]);

function UpdatePrompt() {
  const toast = useToast();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Stündlich nach Updates sehen – PWAs bleiben oft tagelang offen.
      if (reg) setInterval(() => reg.update().catch(() => {}), 3600_000);
    },
  });
  useEffect(() => {
    if (needRefresh) toast({ msg: 'Eine neue Version von Lapis ist da.', action: { label: 'Neu laden', run: () => updateServiceWorker(true) }, ms: 60_000 });
  }, [needRefresh]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
        {import.meta.env.PROD && <UpdatePrompt />}
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
