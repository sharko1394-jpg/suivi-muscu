import { ComingSoon, PageHeader } from '../ui/components';

// Page provisoire, remplacée à l'étape 5.

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
