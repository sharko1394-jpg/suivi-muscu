import { ComingSoon, PageHeader } from '../ui/components';

// Pages provisoires, remplacées au fil des étapes de construction.

export function ProgramPage() {
  return (
    <>
      <PageHeader title="Programme" />
      <ComingSoon step={2}>
        Ici, tu créeras tes programmes et leurs séances : exercices, séries, répétitions, temps de
        repos.
      </ComingSoon>
    </>
  );
}

export function HistoryPage() {
  return (
    <>
      <PageHeader title="Historique" />
      <ComingSoon step={4}>
        Ici, tu retrouveras toutes tes séances passées, en calendrier ou en liste.
      </ComingSoon>
    </>
  );
}

export function StatsPage() {
  return (
    <>
      <PageHeader title="Stats" />
      <ComingSoon step={5}>
        Ici, tu suivras ta progression : graphiques par exercice, records, assiduité, poids de
        corps.
      </ComingSoon>
    </>
  );
}
