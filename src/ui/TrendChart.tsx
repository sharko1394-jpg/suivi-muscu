import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Couleurs du thème, reprises de index.css (les graphiques ne lisent pas les classes Tailwind).
const ACCENT = '#c6f135';
const GRID = '#2c3643';
const MUTED = '#a3aebb';

export interface TrendPoint {
  /** Texte sous l'axe (ex. « 12 nov. »). */
  label: string;
  value: number;
  /** Texte de l'infobulle (ex. « 82,5 kg × 8 »). */
  detail: string;
}

/**
 * Courbe ou barres d'une seule mesure dans le temps.
 * Une seule série, un seul axe : la couleur d'accent suffit, sans légende.
 */
export function TrendChart({
  points,
  kind = 'line',
  title,
  formatValue,
}: {
  points: TrendPoint[];
  kind?: 'line' | 'bar';
  /** Description lue par les lecteurs d'écran. */
  title: string;
  formatValue: (value: number) => string;
}) {
  const data = points.map((point, index) => ({ ...point, index }));
  const axis = { stroke: GRID, tick: { fill: MUTED, fontSize: 12 }, tickLine: false };
  const xAxis = (
    <XAxis
      dataKey="index"
      type="category"
      tickFormatter={(index: number) => data[index]?.label ?? ''}
      interval="preserveStartEnd"
      minTickGap={24}
      {...axis}
    />
  );
  const tooltip = (
    <Tooltip
      cursor={kind === 'bar' ? { fill: GRID, opacity: 0.5 } : { stroke: MUTED, strokeDasharray: '3 3' }}
      content={({ active, payload }) => {
        const point = active ? (payload?.[0]?.payload as TrendPoint | undefined) : undefined;
        if (!point) return null;
        return (
          <div className="rounded-xl border border-line bg-raised px-3 py-2 text-sm shadow-xl shadow-black/60">
            <p className="text-muted">{point.label}</p>
            <p className="font-semibold text-ink">{point.detail}</p>
          </div>
        );
      }}
    />
  );

  return (
    <div role="img" aria-label={title} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            {xAxis}
            <YAxis allowDecimals={false} axisLine={false} width={40} {...axis} />
            {tooltip}
            <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            {xAxis}
            <YAxis
              domain={['auto', 'auto']}
              axisLine={false}
              width={52}
              tickFormatter={(value: number) => formatValue(value)}
              {...axis}
            />
            {tooltip}
            <Line
              dataKey="value"
              type="monotone"
              stroke={ACCENT}
              strokeWidth={2}
              dot={data.length <= 40 ? { r: 4, fill: ACCENT, stroke: '#141920', strokeWidth: 2 } : false}
              activeDot={{ r: 6, fill: ACCENT, stroke: '#141920', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
