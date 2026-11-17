import { useState } from 'react';
import {
  JOB_LABELS,
  PROFILE_LIMITS,
  ageOn,
  basalMetabolism,
  listBodyweights,
  localDate,
  saveBodyweight,
  saveProfile,
  useLive,
  useSettings,
  type JobActivity,
  type Profile,
  type Sex,
} from '../data';
import { Card, PageHeader, Section } from '../ui/components';
import { SegmentedControl, Stepper, WeightField } from '../ui/controls';
import { formatKg, messageOf } from '../ui/format';
import { useToast } from '../ui/toast';

const field =
  'h-14 w-full min-w-0 rounded-2xl border border-line bg-raised px-4 text-ink outline-none focus:border-accent';

/** Réglages → Profil : ce qu'il faut pour estimer la dépense d'énergie. Tout est enregistré aussitôt. */
export default function ProfilePage() {
  const toast = useToast();
  const settings = useSettings();
  const weighIns = useLive(() => listBodyweights(), []);
  const today = localDate(Date.now());
  const [weightError, setWeightError] = useState<string | null>(null);
  // Poids tapé : gardé ici pendant la saisie, la pesée enregistrée arrive juste après.
  const [typedWeight, setTypedWeight] = useState<number | null>(null);

  if (!settings) return <PageHeader title="Profil" backTo="/reglages" />;
  const { profile } = settings;
  const save = (patch: Partial<Profile> | ((current: Profile) => Partial<Profile>)) =>
    void saveProfile(patch).catch((error) => toast(messageOf(error), 'error'));
  // Une pesée illisible (fichier abîmé) est ignorée.
  const valid = (weighIns ?? []).filter((w) => Number.isFinite(w.weightKg));
  const latest = valid.length > 0 ? valid[valid.length - 1] : null;
  const todayWeight = latest?.date === today ? latest.weightKg : null;
  const complete = profile.sex && profile.birthDate && profile.heightCm && latest;

  return (
    <>
      <PageHeader title="Profil" backTo="/reglages" />
      <div className="space-y-6 p-4 pb-8">
        <Section title="Toi">
          <Card className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Sexe</p>
              <SegmentedControl<Sex | ''>
                label="Sexe"
                value={profile.sex ?? ''}
                options={[
                  { value: 'male', label: 'Homme' },
                  { value: 'female', label: 'Femme' },
                ]}
                onChange={(sex) => sex && save({ sex })}
              />
            </div>
            <label className="block space-y-2">
              <span className="block text-sm font-medium text-muted">Date de naissance</span>
              <input
                type="date"
                value={profile.birthDate ?? ''}
                max={today}
                onChange={(event) => event.target.value && save({ birthDate: event.target.value })}
                className={field}
              />
            </label>
            <Stepper
              label="Taille"
              value={profile.heightCm ? `${profile.heightCm} cm` : '—'}
              onDecrement={() => save((p) => ({ heightCm: Math.max(PROFILE_LIMITS.height.min, (p.heightCm ?? 176) - 1) }))}
              onIncrement={() => save((p) => ({ heightCm: Math.min(PROFILE_LIMITS.height.max, (p.heightCm ?? 174) + 1) }))}
            />
            <div className="space-y-1.5">
              <WeightField
                label="Poids aujourd’hui"
                value={typedWeight ?? todayWeight}
                step={0.5}
                onChange={(value) => {
                  setTypedWeight(value);
                  if (value === null || value < 20) return;
                  void saveBodyweight(today, value).then(
                    () => setWeightError(null),
                    (error) => setWeightError(messageOf(error)),
                  );
                }}
              />
              {weightError ? (
                <p role="alert" className="text-sm text-danger">
                  {weightError}
                </p>
              ) : (
                latest &&
                latest.date !== today && (
                  <p className="text-sm text-muted">Dernière pesée : {formatKg(latest.weightKg)}</p>
                )
              )}
            </div>
          </Card>
        </Section>

        <Section title="Ton activité">
          <Card className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Ton travail, la plupart du temps</p>
              <SegmentedControl<JobActivity>
                label="Travail"
                value={profile.job}
                options={(Object.keys(JOB_LABELS) as JobActivity[]).map((job) => ({ value: job, label: JOB_LABELS[job] }))}
                onChange={(job) => save({ job })}
              />
            </div>
            <Stepper
              label="Pas par jour, en moyenne"
              value={profile.stepsPerDay.toLocaleString('fr-FR')}
              onDecrement={() => save((p) => ({ stepsPerDay: Math.max(0, p.stepsPerDay - 500) }))}
              onIncrement={() => save((p) => ({ stepsPerDay: Math.min(PROFILE_LIMITS.steps.max, p.stepsPerDay + 500) }))}
              canDecrement={profile.stepsPerDay > 0}
            />
          </Card>
        </Section>

        {complete && (
          <p className="px-1 text-sm text-muted">
            Métabolisme de base :{' '}
            <span className="font-semibold text-ink">
              {basalMetabolism({
                sex: profile.sex!,
                age: ageOn(profile.birthDate!, today),
                heightCm: profile.heightCm!,
                weightKg: latest!.weightKg,
              }).toLocaleString('fr-FR')}{' '}
              kcal par jour
            </span>
          </p>
        )}
      </div>
    </>
  );
}
