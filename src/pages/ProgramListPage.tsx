import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import {
  createProgram,
  getActiveProgram,
  listPrograms,
  useLive,
  type ProgramSummary,
} from '../data';
import { Button, Card, PageHeader, Section } from '../ui/components';
import { HeaderButton } from '../ui/controls';
import { plural } from '../ui/format';
import { IconChevronRight, IconPlus } from '../ui/icons';
import { PromptDialog } from '../ui/overlays';

export const programPath = (programId: string) => `/programme/p/${programId}`;
export const workoutPath = (programId: string, workoutId: string) =>
  `${programPath(programId)}/s/${workoutId}`;
export const PROGRAM_LIST = '/programme/tous';

/** Onglet « Programme » : mène droit au programme actif, sinon à la liste. */
export function ProgramHome() {
  const loaded = useLive(async () => ({ active: (await getActiveProgram()) ?? null }), []);
  if (loaded === undefined) return <PageHeader title="Programme" />;
  return <Navigate to={loaded.active ? programPath(loaded.active.id) : PROGRAM_LIST} replace />;
}

export function ProgramListPage() {
  const navigate = useNavigate();
  const programs = useLive(() => listPrograms(), []);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = programs?.filter((p) => p.status === 'active') ?? [];
  const others = programs?.filter((p) => p.status === 'inactive') ?? [];
  const archived = programs?.filter((p) => p.status === 'archived') ?? [];

  return (
    <>
      <PageHeader
        title="Programmes"
        action={
          <HeaderButton label="Nouveau programme" primary onClick={() => setCreating(true)}>
            <IconPlus />
          </HeaderButton>
        }
      />

      <div className="space-y-8 p-4 pb-8">
        {programs !== undefined && programs.length === 0 && (
          <Card className="space-y-3">
            <p className="text-lg font-semibold">Aucun programme pour l’instant</p>
            <Button variant="primary" onClick={() => setCreating(true)}>
              Créer mon programme
            </Button>
          </Card>
        )}

        {active.length > 0 && (
          <Section title="Programme actif">
            <ProgramRows programs={active} />
          </Section>
        )}

        {programs !== undefined && programs.length > 0 && active.length === 0 && (
          <Card className="border-gold/50">
            <p className="font-semibold">Aucun programme actif</p>
          </Card>
        )}

        {others.length > 0 && (
          <Section title="Autres programmes">
            <ProgramRows programs={others} />
          </Section>
        )}

        {archived.length > 0 && (
          <Section title="Archivés">
            {showArchived && <ProgramRows programs={archived} />}
            <Button variant="ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived
                ? 'Cacher les programmes archivés'
                : `Afficher ${plural(archived.length, 'programme archivé', 'programmes archivés')}`}
            </Button>
          </Section>
        )}
      </div>

      <PromptDialog
        open={creating}
        title="Nouveau programme"
        label="Nom du programme"
        placeholder="Ex. Upper / Lower"
        confirmLabel="Créer"
        onCancel={() => setCreating(false)}
        onConfirm={async (name) => {
          const program = await createProgram(name);
          navigate(programPath(program.id));
        }}
      />
    </>
  );
}

function ProgramRows({ programs }: { programs: ProgramSummary[] }) {
  return (
    <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
      {programs.map((program) => (
        <li key={program.id} className="border-b border-line/60 last:border-b-0">
          <Link
            to={programPath(program.id)}
            className="flex min-h-18 items-center gap-3 px-4 py-3 active:bg-raised"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{program.name}</p>
              <p className="text-sm text-muted">
                {program.scheduleMode === 'rotation' ? 'Rotation' : 'Jours fixes'} ·{' '}
                {plural(program.workoutCount, 'séance')}
              </p>
            </div>
            {program.status === 'active' && (
              <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-ink">
                Actif
              </span>
            )}
            <IconChevronRight className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
