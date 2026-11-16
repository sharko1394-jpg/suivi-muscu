import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router';
import { getActiveSession, initData } from './data';
import { ExerciseFormPage } from './pages/ExerciseFormPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { EditSessionPage } from './pages/EditSessionPage';
import { HistoryPage } from './pages/HistoryPage';

// Les graphiques sont lourds : ils ne sont chargés qu'à l'ouverture de l'onglet Stats
// (et restent disponibles hors ligne, comme le reste).
const StatsPage = lazy(() => import('./pages/StatsPage'));
import { ProgramHome, ProgramListPage } from './pages/ProgramListPage';
import { ProgramPage } from './pages/ProgramPage';
import { SESSION_PATH, SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SummaryPage } from './pages/SummaryPage';
import { TodayPage } from './pages/TodayPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { AppShell } from './ui/AppShell';
import { Button } from './ui/components';
import { ToastProvider } from './ui/toast';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: unknown };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });
  const navigate = useNavigate();

  const start = useCallback(() => {
    setBoot({ status: 'loading' });
    initData()
      .then(async () => {
        // Appli rouverte en pleine séance : on revient directement dessus.
        const openedAtHome = ['', '#', '#/'].includes(window.location.hash);
        if (openedAtHome && (await getActiveSession())) navigate(SESSION_PATH, { replace: true });
      })
      .then(
        () => setBoot({ status: 'ready' }),
        (error) => setBoot({ status: 'error', error }),
      );
    // `navigate` est stable : le démarrage ne doit se faire qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(start, [start]);

  if (boot.status === 'loading') return <div className="h-dvh" aria-busy="true" />;
  if (boot.status === 'error') return <AppErrorScreen error={boot.error} onRetry={start} />;

  return (
    <ToastProvider>
      <Routes>
        {/* L'écran de séance occupe tout l'écran, sans la barre d'onglets. */}
        <Route path="seance" element={<SessionPage />} />
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="bilan/:sessionId" element={<SummaryPage />} />
          <Route path="bilan/:sessionId/corriger" element={<EditSessionPage />} />
          <Route path="programme" element={<ProgramHome />} />
          <Route path="programme/tous" element={<ProgramListPage />} />
          <Route path="programme/p/:programId" element={<ProgramPage />} />
          <Route path="programme/p/:programId/s/:workoutId" element={<WorkoutPage />} />
          <Route path="historique" element={<HistoryPage />} />
          <Route
            path="stats"
            element={
              <Suspense fallback={null}>
                <StatsPage />
              </Suspense>
            }
          />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="reglages/exercices" element={<ExercisesPage />} />
          <Route path="reglages/exercices/nouveau" element={<ExerciseFormPage />} />
          <Route path="reglages/exercices/:id" element={<ExerciseFormPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

/**
 * Affiché si la base ne s'ouvre pas (migration en échec, appli plus ancienne que les données…).
 * On ne propose JAMAIS d'effacer ou de réinitialiser : les données restent sur le téléphone.
 */
function AppErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const detail = error instanceof Error ? `${error.name} : ${error.message}` : String(error);
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Impossible d’ouvrir tes données</h1>
      <p className="text-muted">
        Rien n’a été effacé : tes données sont toujours sur ce téléphone. Ferme complètement
        l’appli, rouvre-la, puis réessaie. Ne supprime pas l’appli de l’écran d’accueil : cela
        effacerait les données.
      </p>
      <Button variant="primary" onClick={onRetry}>
        Réessayer
      </Button>
      <p className="break-words rounded-2xl border border-line bg-surface p-3 font-mono text-sm text-muted">
        {detail}
      </p>
    </div>
  );
}
