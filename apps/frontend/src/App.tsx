import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { WeekPage } from './pages/WeekPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { ProjectBoardPage } from './pages/ProjectBoardPage.js';
import { ClientsPage } from './pages/ClientsPage.js';
import { ObjectivesPage } from './pages/ObjectivesPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AppLayout } from './components/AppLayout.js';
import { AssistantPanel } from './components/assistant/AssistantPanel.js';
import { useAssistantPanel } from './components/assistant/assistantPanel.js';

export function App() {
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);
  const openAssistant = useAssistantPanel((s) => s.open);
  const { pathname } = useLocation();

  useEffect(() => {
    void restore();
  }, [restore]);

  // "N" abre el creador de tareas, salvo mientras se escribe en un campo.
  useEffect(() => {
    if (status !== 'authenticated') return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      event.preventDefault();
      // Estando en un tablero, la tarea nace en ese proyecto sin preguntarlo.
      openAssistant(pathname.match(/^\/proyectos\/([0-9a-f-]{36})/)?.[1]);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, openAssistant, pathname]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <Loader2 size={20} className="animate-spin text-jade" />
      </div>
    );
  }

  if (status === 'anonymous') return <LoginPage />;

  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/semana" element={<WeekPage />} />
          <Route path="/proyectos" element={<ProjectsPage />} />
          <Route path="/proyectos/:projectId" element={<ProjectBoardPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/objetivos" element={<ObjectivesPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <AssistantPanel />
    </>
  );
}
