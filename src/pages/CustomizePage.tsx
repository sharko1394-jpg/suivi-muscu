import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ACCENT_SWATCHES,
  ANIMATED_PRESETS,
  AppError,
  ANIMATED_PRESET_IDS,
  PATTERNS,
  type PatternDef,
  BACKGROUND_LIMITS,
  CORNERS,
  DEFAULT_HOME,
  DEFAULT_TABS,
  FONTS,
  LOCKED_TABS,
  LOOK_LIMITS,
  MAX_CUSTOM_BACKGROUNDS,
  TAB_LABEL_MAX,
  TEXT_SIZES,
  THEME_PRESETS,
  WIDGETS,
  addCustomBackground,
  applyLook,
  deleteCustomBackground,
  deleteSavedTheme,
  exportThemeFile,
  importThemeFile,
  listCustomBackgrounds,
  lookSignature,
  parseThemeFile,
  renameSavedTheme,
  resetAppearance,
  saveCurrentTheme,
  themeFileName,
  themeName,
  updateAppearance,
  useLive,
  useSettings,
  visibleTabs,
  widgetDef,
  type Appearance,
  type BackgroundSettings,
  type Corners,
  type CustomBackground,
  type FontChoice,
  type Look,
  type MotionChoice,
  type SavedTheme,
  type TabBarStyle,
  type TabId,
  type TabLabelMode,
  type TabsLayout,
  type TextSize,
  type ThemeFile,
  type WidgetSize,
  type WidgetSlot,
} from '../data';
import { SortableList } from '../ui/SortableList';
import { Button, Card, ConfirmDialog, LinkRow, PageHeader, Section } from '../ui/components';
import { ColorChoice, SegmentedControl, Slider, Switch, Toggle } from '../ui/controls';
import { formatNumber, messageOf, plural } from '../ui/format';
import { IconImage, IconLock, IconMinus, IconMore, IconPencil, IconPlus } from '../ui/icons';
import { dataUrlToFile, isImageFile, prepareBackgroundImage } from '../ui/imageTools';
import { ActionSheet, PromptDialog } from '../ui/overlays';
import { saveFile } from '../ui/platform';
import { TAB_DEFS, tabLabel } from '../ui/tabs';
import { FONT_STACKS, flatBackground, presetPreview, tintFor } from '../ui/theme';
import { useToast } from '../ui/toast';
import { HOME_EDITOR_PATH } from './TodayPage';

// Personnalisation (V2) : thème, couleur, fond, verre, texte, animations, onglets et accueil.
// Tout s'applique en direct : la page elle-même sert d'aperçu.

export const CUSTOMIZE_PATH = '/reglages/personnaliser';
export const TABS_EDITOR_PATH = '/reglages/personnaliser/onglets';

const CORNER_LABELS: Record<Corners, string> = { sharp: 'Nets', soft: 'Doux', round: 'Ronds', xl: 'Très ronds' };
const CORNER_SAMPLE: Record<Corners, string> = { sharp: '3px', soft: '6px', round: '9px', xl: '13px' };
const FONT_LABELS: Record<FontChoice, string> = {
  poppins: 'Poppins',
  system: 'Système',
  rounded: 'Arrondie',
  serif: 'Serif',
  mono: 'Mono',
};
const TEXT_SIZE_LABELS: Record<TextSize, { label: string; px: number }> = {
  small: { label: 'Petit', px: 14 },
  normal: { label: 'Normal', px: 17 },
  large: { label: 'Grand', px: 20 },
  xlarge: { label: 'Très grand', px: 23 },
};
const MOTION_OPTIONS: { value: MotionChoice; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'full', label: 'Toujours' },
  { value: 'reduced', label: 'Réduites' },
];
const LABEL_MODES: { value: TabLabelMode; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'always', label: 'Tous' },
  { value: 'never', label: 'Aucun' },
];
const BAR_STYLES: { value: TabBarStyle; label: string }[] = [
  { value: 'floating', label: 'Flottante' },
  { value: 'docked', label: 'Pleine largeur' },
];
/** Fonds unis proposés : sombres, pour que le texte reste lisible. */
const BACKGROUND_SWATCHES = [
  '#1c1417',
  '#2b0a10',
  '#3a1c0b',
  '#2e2608',
  '#0f2414',
  '#0b2230',
  '#0d1117',
  '#1d1030',
  '#26262b',
  '#000000',
];

function useRun() {
  const toast = useToast();
  return (task: () => Promise<unknown>, done?: string) => {
    task().then(
      () => done && toast(done),
      (error) => toast(messageOf(error), 'error'),
    );
  };
}

/** Retour à la page précédente, ou à `fallback` si on est arrivé directement ici. */
function useBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate(fallback);
  };
}

/** Couleurs de lignes proposées pour les fonds en lignes. */
const LINE_SWATCHES = ['#c9e265', '#5fb4ff', '#ff5c52', '#c084fc', '#ff6b4a', '#ffd60a', '#34d399', '#e4e4e7'];

/** Petite image fixe (en CSS) qui évoque un fond en lignes. */
function patternPreview(def: PatternDef, bg: string, line: string): string {
  switch (def.id) {
    case 'contours':
      return `repeating-radial-gradient(ellipse at 30% 40%, transparent 0 7px, ${line} 7px 8px), repeating-radial-gradient(ellipse at 85% 85%, transparent 0 9px, ${line}99 9px 10px), ${bg}`;
    case 'waves':
      return `repeating-linear-gradient(170deg, transparent 0 7px, ${line} 7px 8px), ${bg}`;
    case 'grid':
      return `linear-gradient(${line}88 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, ${line}88 1px, transparent 1px) 0 0 / 14px 14px, ${bg}`;
    case 'dots':
      return `radial-gradient(circle, ${line} 0 2px, transparent 2.5px) 0 0 / 9px 9px, ${bg}`;
    case 'fluted':
      return `repeating-linear-gradient(90deg, rgb(255 255 255 / 0.08) 0 2px, transparent 2px 9px), radial-gradient(circle at 40% 45%, ${line} 0%, transparent 60%), ${bg}`;
  }
}

// ---------- Vignettes ----------

function backgroundPreview(background: BackgroundSettings, images: CustomBackground[]): string {
  if (background.kind === 'animated') return presetPreview(ANIMATED_PRESETS[background.preset]);
  if (background.kind === 'pattern') {
    const def = PATTERNS.find((p) => p.id === background.pattern) ?? PATTERNS[0];
    return patternPreview(def, background.patternBg, background.patternLine);
  }
  if (background.kind === 'image') {
    const image = images.find((i) => i.id === background.imageId);
    return image ? `center / cover no-repeat url("${image.dataUrl}")` : presetPreview(ANIMATED_PRESETS.forge);
  }
  return flatBackground(background);
}

/** Miniature d'un thème : son fond, une carte en verre et un bouton de sa couleur. */
function LookThumb({ look, images }: { look: Look; images: CustomBackground[] }) {
  const [r, g, b] = tintFor(look.background).surface.map(Math.round);
  return (
    <span className="relative block h-28 w-full overflow-hidden rounded-2xl" style={{ background: backgroundPreview(look.background, images) }}>
      <span
        className="absolute inset-x-2 top-2 flex h-10 items-center border border-white/15 px-2 text-sm font-semibold text-white"
        style={{
          background: `rgb(${r} ${g} ${b} / ${Math.max(0.35, look.cardOpacity)})`,
          borderRadius: CORNER_SAMPLE[look.corners],
          fontFamily: FONT_STACKS[look.font],
        }}
      >
        Aa
      </span>
      <span
        className="absolute inset-x-3 bottom-2.5 h-6 rounded-full"
        style={{ background: look.accent, boxShadow: `0 4px 14px -4px ${look.accent}` }}
      />
    </span>
  );
}

function Tile({
  label,
  selected,
  onClick,
  onMore,
  children,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  onMore?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative w-24 shrink-0">
      <button type="button" onClick={onClick} aria-pressed={selected} aria-label={label} className="block w-full">
        <span
          className={`block rounded-2xl ${selected ? 'ring-2 ring-accent-bright ring-offset-2 ring-offset-bg' : ''}`}
        >
          {children}
        </span>
        <span
          className={`mt-2 block truncate text-center text-sm ${selected ? 'font-bold text-ink' : 'font-medium text-muted'}`}
        >
          {label}
        </span>
      </button>
      {onMore && (
        <button
          type="button"
          aria-label={`Options de ${label}`}
          onClick={onMore}
          className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/55 text-white"
        >
          <IconMore className="size-5" />
        </button>
      )}
    </div>
  );
}

function AddTile({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-24 shrink-0">
      <span className="flex h-28 items-center justify-center rounded-2xl border-2 border-dashed border-line text-muted">
        {icon}
      </span>
      <span className="mt-2 block truncate text-center text-sm font-medium text-muted">{label}</span>
    </button>
  );
}

/** Rangée de vignettes qu'on fait glisser ; les bords s'estompent pour montrer la suite. */
function TileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 py-1.5 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1.5rem),transparent)]"
    >
      {children}
    </div>
  );
}

// ---------- Page principale ----------

export default function CustomizePage() {
  const settings = useSettings();
  const images = useLive(() => listCustomBackgrounds(), []) ?? [];
  const toast = useToast();
  const run = useRun();
  const photoInput = useRef<HTMLInputElement>(null);
  const themeInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState(false);
  const [themeMenu, setThemeMenu] = useState<SavedTheme | null>(null);
  const [renamingTheme, setRenamingTheme] = useState<SavedTheme | null>(null);
  const [deletingTheme, setDeletingTheme] = useState<SavedTheme | null>(null);
  const [photoMenu, setPhotoMenu] = useState<CustomBackground | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<CustomBackground | null>(null);
  const [pendingImport, setPendingImport] = useState<ThemeFile | null>(null);
  const [waitingTap, setWaitingTap] = useState<File | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!settings) return <PageHeader title="Personnaliser" backTo="/reglages" />;
  const appearance = settings.appearance;
  const background = appearance.background;
  const signature = lookSignature(appearance);
  const currentName = themeName(appearance, settings.savedThemes);

  const set = (patch: Partial<Appearance>) => run(() => updateAppearance(patch));
  const setBackground = (patch: Partial<BackgroundSettings>) =>
    run(() => updateAppearance((current) => ({ background: { ...current.background, ...patch } })));

  async function deliver(file: File, done: string) {
    const result = await saveFile(file);
    if (result === 'needs-gesture') {
      setWaitingTap(file);
      return;
    }
    setWaitingTap(null);
    if (result === 'saved') toast(done);
  }

  const exportTheme = () =>
    run(async () => {
      const file = await exportThemeFile(currentName);
      await deliver(
        new File([JSON.stringify(file)], themeFileName(), { type: 'application/json' }),
        'Personnalisation exportée',
      );
    });

  const photosFull = () => {
    if (images.length < MAX_CUSTOM_BACKGROUNDS) return false;
    toast(`Tu as déjà ${MAX_CUSTOM_BACKGROUNDS} photos de fond : supprimes-en une d’abord.`, 'error');
    return true;
  };

  /** Photo choisie dans la galerie : réduite sur le téléphone, puis mise en fond. */
  const importPhoto = (file: File) => {
    if (photosFull()) return;
    setBusy(true);
    run(async () => {
      try {
        const image = await prepareBackgroundImage(file);
        await addCustomBackground({ name: `Photo ${images.length + 1}`, ...image });
      } finally {
        setBusy(false);
      }
    }, 'Photo ajoutée en fond');
  };

  const onPhotoChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) importPhoto(file);
  };

  // « Importer » accepte une photo de la galerie (elle devient le fond) ou un fichier de thème.
  const onImportChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (isImageFile(file)) importPhoto(file);
    else run(async () => setPendingImport(parseThemeFile(await file.text())));
  };

  const addPhoto = () => {
    if (!photosFull()) photoInput.current?.click();
  };

  return (
    <>
      <PageHeader title="Personnaliser" subtitle={`Thème : ${currentName}`} backTo="/reglages" />
      <div className="space-y-8 p-4 pb-8">
        <Preview />

        <Section title="Thèmes">
          <TileRow label="Thèmes">
            {THEME_PRESETS.map((theme) => (
              <Tile
                key={theme.id}
                label={theme.label}
                selected={lookSignature(theme.look) === signature}
                onClick={() => run(() => applyLook(theme.look))}
              >
                <LookThumb look={theme.look} images={images} />
              </Tile>
            ))}
            {settings.savedThemes.map((theme) => (
              <Tile
                key={theme.id}
                label={theme.name}
                selected={lookSignature(theme.look) === signature}
                onClick={() => run(() => applyLook(theme.look))}
                onMore={() => setThemeMenu(theme)}
              >
                <LookThumb look={theme.look} images={images} />
              </Tile>
            ))}
            <AddTile label="Enregistrer" icon={<IconPlus className="size-7" />} onClick={() => setNaming(true)} />
          </TileRow>
        </Section>

        <Section title="Couleur principale">
          <Card>
            <ColorChoice
              label="Couleur principale"
              value={appearance.accent}
              swatches={ACCENT_SWATCHES}
              onChange={(accent) => set({ accent })}
            />
          </Card>
        </Section>

        <Section title="Fond">
          <TileRow label="Fond">
            {/* En premier, pour être vu tout de suite : une photo de la galerie du téléphone. */}
            <AddTile
              label={busy ? 'Import…' : 'Galerie'}
              icon={<IconImage className="size-7" />}
              onClick={busy ? () => {} : addPhoto}
            />
            {images.map((image) => (
              <Tile
                key={image.id}
                label={image.name}
                selected={background.kind === 'image' && background.imageId === image.id}
                onClick={() => setBackground({ kind: 'image', imageId: image.id })}
                onMore={() => setPhotoMenu(image)}
              >
                <span
                  className="block h-28 rounded-2xl bg-cover bg-center"
                  style={{ backgroundImage: `url("${image.dataUrl}")` }}
                />
              </Tile>
            ))}
            {ANIMATED_PRESET_IDS.map((id) => (
              <Tile
                key={id}
                label={ANIMATED_PRESETS[id].label}
                selected={background.kind === 'animated' && background.preset === id}
                onClick={() => setBackground({ kind: 'animated', preset: id })}
              >
                <span
                  className="block h-28 rounded-2xl"
                  style={{ background: presetPreview(ANIMATED_PRESETS[id]) }}
                />
              </Tile>
            ))}
            {PATTERNS.map((def) => {
              const selected = background.kind === 'pattern' && background.pattern === def.id;
              return (
                <Tile
                  key={def.id}
                  label={def.label}
                  selected={selected}
                  onClick={() =>
                    setBackground(
                      selected ? {} : { kind: 'pattern', pattern: def.id, patternBg: def.bg, patternLine: def.line },
                    )
                  }
                >
                  <span
                    className="block h-28 rounded-2xl border border-white/10"
                    style={{
                      background: selected
                        ? patternPreview(def, background.patternBg, background.patternLine)
                        : patternPreview(def, def.bg, def.line),
                    }}
                  />
                </Tile>
              );
            })}
            <Tile label="Uni" selected={background.kind === 'solid'} onClick={() => setBackground({ kind: 'solid' })}>
              <span className="block h-28 rounded-2xl border border-white/10" style={{ background: background.color }} />
            </Tile>
            <Tile
              label="Dégradé"
              selected={background.kind === 'gradient'}
              onClick={() => setBackground({ kind: 'gradient' })}
            >
              <span
                className="block h-28 rounded-2xl border border-white/10"
                style={{ background: flatBackground({ ...background, kind: 'gradient' }) }}
              />
            </Tile>
          </TileRow>

          <Card className="space-y-5">
            {(background.kind === 'animated' || background.kind === 'pattern') && (
              <>
                <Slider
                  label="Vitesse"
                  value={background.speed}
                  min={BACKGROUND_LIMITS.speed.min}
                  max={BACKGROUND_LIMITS.speed.max}
                  step={0.05}
                  format={(v) => `× ${formatNumber(Math.round(v * 100) / 100)}`}
                  onChange={(speed) => setBackground({ speed })}
                />
                <Slider
                  label="Luminosité"
                  value={background.intensity}
                  min={BACKGROUND_LIMITS.intensity.min}
                  max={BACKGROUND_LIMITS.intensity.max}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)} %`}
                  onChange={(intensity) => setBackground({ intensity })}
                />
              </>
            )}
            {background.kind === 'pattern' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted">Lignes</p>
                  <ColorChoice
                    label="Couleur des lignes"
                    value={background.patternLine}
                    swatches={LINE_SWATCHES}
                    onChange={(patternLine) => setBackground({ patternLine })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted">Fond</p>
                  <ColorChoice
                    label="Couleur du fond"
                    value={background.patternBg}
                    swatches={BACKGROUND_SWATCHES}
                    onChange={(patternBg) => setBackground({ patternBg })}
                  />
                </div>
              </>
            )}
            {background.kind === 'solid' && (
              <ColorChoice
                label="Couleur du fond"
                value={background.color}
                swatches={BACKGROUND_SWATCHES}
                onChange={(color) => setBackground({ color })}
              />
            )}
            {background.kind === 'gradient' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted">Haut</p>
                  <ColorChoice
                    label="Haut du dégradé"
                    value={background.color}
                    swatches={BACKGROUND_SWATCHES}
                    onChange={(color) => setBackground({ color })}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted">Bas</p>
                  <ColorChoice
                    label="Bas du dégradé"
                    value={background.color2}
                    swatches={BACKGROUND_SWATCHES}
                    onChange={(color2) => setBackground({ color2 })}
                  />
                </div>
              </>
            )}
            {background.kind === 'image' && (
              <>
                <Slider
                  label="Flou"
                  value={background.imageBlur}
                  min={BACKGROUND_LIMITS.imageBlur.min}
                  max={BACKGROUND_LIMITS.imageBlur.max}
                  step={1}
                  format={(v) => `${v} px`}
                  onChange={(imageBlur) => setBackground({ imageBlur })}
                />
                <Slider
                  label="Assombrir"
                  value={background.imageDim}
                  min={BACKGROUND_LIMITS.imageDim.min}
                  max={BACKGROUND_LIMITS.imageDim.max}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)} %`}
                  onChange={(imageDim) => setBackground({ imageDim })}
                />
              </>
            )}
          </Card>
        </Section>

        <Section title="Cartes">
          <Card className="space-y-5">
            <Slider
              label="Opacité"
              value={appearance.cardOpacity}
              min={LOOK_LIMITS.cardOpacity.min}
              max={LOOK_LIMITS.cardOpacity.max}
              step={0.02}
              format={(v) => `${Math.round(v * 100)} %`}
              onChange={(cardOpacity) => set({ cardOpacity })}
            />
            <Slider
              label="Flou du verre"
              value={appearance.blur}
              min={LOOK_LIMITS.blur.min}
              max={LOOK_LIMITS.blur.max}
              step={1}
              format={(v) => `${v} px`}
              onChange={(blur) => set({ blur })}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Coins</p>
              <div role="group" aria-label="Coins" className="grid grid-cols-4 gap-2">
                {CORNERS.map((corners) => (
                  <button
                    key={corners}
                    type="button"
                    aria-pressed={appearance.corners === corners}
                    onClick={() => set({ corners })}
                    className={`flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold ${
                      appearance.corners === corners
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-raised text-muted active:bg-line'
                    }`}
                  >
                    <span className="size-6 border-2 border-current" style={{ borderRadius: CORNER_SAMPLE[corners] }} />
                    {CORNER_LABELS[corners]}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Texte">
          <Card className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Police</p>
              <div role="group" aria-label="Police" className="flex flex-wrap gap-2">
                {FONTS.map((font) => (
                  <button
                    key={font}
                    type="button"
                    aria-pressed={appearance.font === font}
                    onClick={() => set({ font })}
                    style={{ fontFamily: FONT_STACKS[font] }}
                    className={`min-h-11 rounded-full border px-4 text-base font-semibold select-none ${
                      appearance.font === font
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-raised text-ink active:bg-line'
                    }`}
                  >
                    {FONT_LABELS[font]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted">Taille</p>
              <div role="group" aria-label="Taille du texte" className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-black/30 p-1">
                {TEXT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-label={TEXT_SIZE_LABELS[size].label}
                    aria-pressed={appearance.textSize === size}
                    onClick={() => set({ textSize: size })}
                    className={`flex min-h-12 items-center justify-center rounded-xl font-bold select-none ${
                      appearance.textSize === size ? 'bg-accent text-accent-ink' : 'text-muted active:bg-raised'
                    }`}
                    style={{ fontSize: `${TEXT_SIZE_LABELS[size].px}px` }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Animations">
          <Card className="space-y-3">
            <SegmentedControl<MotionChoice>
              label="Animations"
              value={appearance.motion}
              options={MOTION_OPTIONS}
              onChange={(motion) => set({ motion })}
            />
            <div>
              <Switch
                label="Onde au toucher"
                checked={appearance.effects.ripples}
                onChange={(ripples) => set({ effects: { ...appearance.effects, ripples } })}
              />
              <Switch
                label="Onde des records"
                checked={appearance.effects.recordWave}
                onChange={(recordWave) => set({ effects: { ...appearance.effects, recordWave } })}
              />
              <Switch
                label="Respiration pendant le repos"
                checked={appearance.effects.restBreath}
                onChange={(restBreath) => set({ effects: { ...appearance.effects, restBreath } })}
              />
            </div>
          </Card>
        </Section>

        <Section title="Organisation">
          <div className="space-y-2">
            <LinkRow
              to={TABS_EDITOR_PATH}
              title="Onglets"
              detail={`${plural(visibleTabs(appearance.tabs).length, 'onglet')} · ordre, noms, barre`}
            />
            <LinkRow
              to={HOME_EDITOR_PATH}
              title="Accueil"
              detail={`${plural(appearance.home.length, 'widget')} · emplacements et tailles`}
            />
          </div>
        </Section>

        <Section title="Partager ma personnalisation">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={exportTheme} className="min-h-12 px-3 text-base">
              Exporter
            </Button>
            <Button onClick={() => themeInput.current?.click()} className="min-h-12 px-3 text-base">
              Importer
            </Button>
          </div>
        </Section>

        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          Tout remettre par défaut
        </Button>
      </div>

      {/* Sur iPhone, « image/* » propose la Photothèque (la galerie) en premier choix. */}
      <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoChosen} />
      <input
        ref={themeInput}
        type="file"
        accept="image/*,application/json,.json"
        className="hidden"
        onChange={onImportChosen}
      />

      <PromptDialog
        open={naming}
        title="Enregistrer ce thème"
        label="Nom du thème"
        placeholder="Ex. Rouge et or"
        confirmLabel="Enregistrer"
        onConfirm={async (name) => {
          await saveCurrentTheme(name);
          setNaming(false);
          toast('Thème enregistré');
        }}
        onCancel={() => setNaming(false)}
      />

      <ActionSheet
        open={themeMenu !== null}
        title={themeMenu?.name ?? ''}
        actions={
          themeMenu
            ? [
                { label: 'Renommer', onSelect: () => setRenamingTheme(themeMenu) },
                { label: 'Supprimer ce thème', danger: true, onSelect: () => setDeletingTheme(themeMenu) },
              ]
            : []
        }
        onClose={() => setThemeMenu(null)}
      />

      {renamingTheme && (
        <PromptDialog
          open
          title="Renommer le thème"
          label="Nom du thème"
          initialValue={renamingTheme.name}
          confirmLabel="Renommer"
          onConfirm={async (name) => {
            await renameSavedTheme(renamingTheme.id, name);
            setRenamingTheme(null);
          }}
          onCancel={() => setRenamingTheme(null)}
        />
      )}

      <ConfirmDialog
        open={deletingTheme !== null}
        title={`Supprimer « ${deletingTheme?.name ?? ''} » ?`}
        confirmLabel="Supprimer le thème"
        danger
        onCancel={() => setDeletingTheme(null)}
        onConfirm={() => {
          const theme = deletingTheme;
          setDeletingTheme(null);
          if (theme) run(() => deleteSavedTheme(theme.id), 'Thème supprimé');
        }}
      />

      <ActionSheet
        open={photoMenu !== null}
        title={photoMenu?.name ?? ''}
        actions={
          photoMenu
            ? [
                {
                  label: 'Exporter la photo',
                  onSelect: () =>
                    run(async () => deliver(await dataUrlToFile(photoMenu.dataUrl, photoMenu.name), 'Photo exportée')),
                },
                { label: 'Supprimer la photo', danger: true, onSelect: () => setDeletingPhoto(photoMenu) },
              ]
            : []
        }
        onClose={() => setPhotoMenu(null)}
      />

      <ConfirmDialog
        open={deletingPhoto !== null}
        title="Supprimer cette photo ?"
        confirmLabel="Supprimer la photo"
        danger
        onCancel={() => setDeletingPhoto(null)}
        onConfirm={() => {
          const photo = deletingPhoto;
          setDeletingPhoto(null);
          if (photo) run(() => deleteCustomBackground(photo.id), 'Photo supprimée');
        }}
      >
        <p>Elle sera retirée de tes fonds.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingImport !== null}
        title={`Appliquer « ${pendingImport?.name ?? ''} » ?`}
        confirmLabel="Appliquer"
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          const file = pendingImport;
          setPendingImport(null);
          if (file) run(() => importThemeFile(file), 'Personnalisation appliquée');
        }}
      >
        <p>Ta personnalisation actuelle sera remplacée. Ce thème rejoint « Mes thèmes ».</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={waitingTap !== null}
        title="Fichier prêt"
        confirmLabel="Enregistrer le fichier"
        onCancel={() => setWaitingTap(null)}
        onConfirm={() => {
          const file = waitingTap;
          if (file) run(() => deliver(file, 'Fichier enregistré'));
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Tout remettre par défaut ?"
        confirmLabel="Remettre par défaut"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          run(() => resetAppearance(), 'Apparence par défaut');
        }}
      >
        <p>Couleurs, fond, onglets et accueil reviennent comme à l’origine. Tes photos et tes thèmes enregistrés sont gardés.</p>
      </ConfirmDialog>
    </>
  );
}

/** Aperçu en direct : une carte de séance comme sur l'accueil. */
function Preview() {
  return (
    <div aria-hidden="true" className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-muted">Aperçu</p>
          <p className="truncate text-2xl font-bold leading-tight">Push</p>
        </div>
        <span className="shrink-0 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
          Prochaine
        </span>
      </div>
      <p className="text-sm text-muted">Développé couché · 4 × 6–10 · repos 2 min</p>
      <div className="flex min-h-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-ink">
        Démarrer
      </div>
    </div>
  );
}

// ---------- Onglets ----------

export function CustomizeTabsPage() {
  const settings = useSettings();
  const run = useRun();
  const back = useBack(CUSTOMIZE_PATH);
  const [renaming, setRenaming] = useState<TabId | null>(null);

  if (!settings) return <PageHeader title="Onglets" onBack={back} />;
  const tabs = settings.appearance.tabs;
  const setTabs = (patch: Partial<TabsLayout>) =>
    run(() => updateAppearance((current) => ({ tabs: { ...current.tabs, ...patch } })));
  const visible = visibleTabs(tabs);

  return (
    <>
      <PageHeader title="Onglets" onBack={back} />
      <div className="space-y-8 p-4 pb-8">
        <Section title="Ordre et affichage">
          <SortableList
            items={tabs.order.map((id) => ({ id }))}
            onReorder={(ids) => setTabs({ order: ids as TabId[] })}
            className="overflow-hidden rounded-3xl border border-line bg-surface"
          >
            {({ id }, handle) => {
              const tabId = id as TabId;
              const { icon: TabIcon } = TAB_DEFS[tabId];
              const locked = LOCKED_TABS.includes(tabId);
              const hidden = tabs.hidden.includes(tabId);
              return (
                <div className="flex min-h-16 items-center gap-2 pr-4">
                  {handle}
                  <TabIcon className={`shrink-0 ${hidden ? 'text-muted/50' : 'text-muted'}`} />
                  <button
                    type="button"
                    onClick={() => setRenaming(tabId)}
                    aria-label={`Renommer ${tabLabel(tabs, tabId)}`}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-1 text-left"
                  >
                    <span className={`truncate font-semibold ${hidden ? 'text-muted' : ''}`}>{tabLabel(tabs, tabId)}</span>
                    <IconPencil className="size-4 shrink-0 text-muted" />
                  </button>
                  {locked ? (
                    <IconLock className="size-5 shrink-0 text-muted" aria-label="Toujours affiché" />
                  ) : (
                    <Toggle
                      label={`Afficher ${tabLabel(tabs, tabId)}`}
                      checked={!hidden}
                      onChange={(show) =>
                        setTabs({ hidden: show ? tabs.hidden.filter((t) => t !== tabId) : [...tabs.hidden, tabId] })
                      }
                    />
                  )}
                </div>
              );
            }}
          </SortableList>
        </Section>

        <Section title="Noms des onglets">
          <SegmentedControl<TabLabelMode>
            label="Noms des onglets"
            value={tabs.labelMode}
            options={LABEL_MODES}
            onChange={(labelMode) => setTabs({ labelMode })}
          />
        </Section>

        <Section title="Barre d’onglets">
          <SegmentedControl<TabBarStyle>
            label="Barre d’onglets"
            value={tabs.style}
            options={BAR_STYLES}
            onChange={(style) => setTabs({ style })}
          />
        </Section>

        <Section title="À l’ouverture de l’appli">
          <div role="group" aria-label="Onglet à l’ouverture" className="flex flex-wrap gap-2">
            {visible.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={tabs.start === id}
                onClick={() => setTabs({ start: id })}
                className={`min-h-11 rounded-full border px-4 text-base font-medium select-none ${
                  tabs.start === id
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-raised text-ink active:bg-line'
                }`}
              >
                {tabLabel(tabs, id)}
              </button>
            ))}
          </div>
        </Section>

        <Button variant="ghost" onClick={() => setTabs(DEFAULT_TABS)}>
          Remettre les onglets par défaut
        </Button>
      </div>

      {renaming && (
        <PromptDialog
          open
          title="Renommer l’onglet"
          label="Nom de l’onglet"
          initialValue={tabLabel(tabs, renaming)}
          placeholder={TAB_DEFS[renaming].label}
          confirmLabel="Renommer"
          onConfirm={async (value) => {
            const name = value.trim().replace(/\s+/g, ' ');
            if (name.length > TAB_LABEL_MAX) throw new AppError(`Nom trop long (${TAB_LABEL_MAX} caractères au plus).`);
            const labels = { ...tabs.labels };
            // Vide, ou le nom d'origine : on revient au nom d'origine.
            if (name === '' || name === TAB_DEFS[renaming].label) delete labels[renaming];
            else labels[renaming] = name;
            await updateAppearance((current) => ({ tabs: { ...current.tabs, labels } }));
            setRenaming(null);
          }}
          onCancel={() => setRenaming(null)}
        />
      )}
    </>
  );
}

// ---------- Accueil ----------

const SIZE_LABELS: Record<WidgetSize, string> = { small: 'Petit', large: 'Grand' };

export function CustomizeHomePage() {
  const settings = useSettings();
  const run = useRun();
  const back = useBack('/');

  if (!settings) return <PageHeader title="Accueil" onBack={back} />;
  const home = settings.appearance.home;
  const setHome = (next: WidgetSlot[]) => run(() => updateAppearance({ home: next }));
  const available = WIDGETS.filter((w) => !home.some((slot) => slot.id === w.id));

  return (
    <>
      <PageHeader title="Accueil" subtitle={plural(home.length, 'widget')} onBack={back} />
      <div className="space-y-8 p-4 pb-8">
        {/* Plan de l'accueil : chaque bloc à sa place, petit (demi-largeur) ou grand. */}
        <div aria-hidden="true" className="grid grid-cols-2 gap-2 rounded-3xl border border-line bg-black/25 p-3">
          {home.map((slot) => (
            <div
              key={slot.id}
              className={`flex items-center justify-center rounded-xl border px-2 text-center text-xs font-semibold leading-tight ${
                slot.size === 'large' ? 'col-span-2' : ''
              } ${slot.id === 'plan' ? 'h-16 border-accent/60 bg-accent/15 text-ink' : 'h-12 border-white/10 bg-surface text-muted'}`}
            >
              {widgetDef(slot.id).label}
            </div>
          ))}
        </div>

        <Section title="Sur l’accueil">
          <SortableList
            items={home}
            onReorder={(ids) => setHome(ids.flatMap((id) => home.find((slot) => slot.id === id) ?? []))}
            className="overflow-hidden rounded-3xl border border-line bg-surface"
          >
            {(slot, handle) => {
              const def = widgetDef(slot.id);
              return (
                <div className="flex min-h-16 items-center gap-2 pr-3">
                  {handle}
                  <span className="min-w-0 flex-1 font-semibold leading-tight">{def.label}</span>
                  {def.sizes.length > 1 && (
                    <div role="group" aria-label={`Taille de ${def.label}`} className="flex shrink-0 rounded-full border border-line bg-black/30 p-0.5">
                      {def.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={slot.size === size}
                          onClick={() => setHome(home.map((s) => (s.id === slot.id ? { ...s, size } : s)))}
                          className={`h-8 rounded-full px-2.5 text-xs font-semibold select-none ${
                            slot.size === size ? 'bg-accent text-accent-ink' : 'text-muted'
                          }`}
                        >
                          {SIZE_LABELS[size]}
                        </button>
                      ))}
                    </div>
                  )}
                  {def.locked ? (
                    <IconLock className="size-5 shrink-0 text-muted" aria-label="Toujours sur l’accueil" />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Retirer ${def.label}`}
                      onClick={() => setHome(home.filter((s) => s.id !== slot.id))}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger active:bg-danger/25"
                    >
                      <IconMinus className="size-5" />
                    </button>
                  )}
                </div>
              );
            }}
          </SortableList>
        </Section>

        {available.length > 0 && (
          <Section title="Ajouter">
            <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
              {available.map((widget) => (
                <li key={widget.id} className="border-b border-line/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setHome([...home, { id: widget.id, size: widget.sizes[0] }])}
                    className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-raised"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <IconPlus className="size-5" />
                    </span>
                    <span className="font-semibold">{widget.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Button variant="ghost" onClick={() => setHome(DEFAULT_HOME)}>
          Remettre l’accueil par défaut
        </Button>
      </div>
    </>
  );
}
