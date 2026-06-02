type DeckCard =
  | {
      kind: "line";
      title: string;
      value: string;
      subtitle?: string;
      footer?: string;
      color?: string;
      fill?: string;
      values: number[];
    }
  | {
      kind: "bar";
      title: string;
      value: string;
      subtitle?: string;
      footer?: string;
      color?: string;
      values: number[];
    }
  | {
      kind: "radial";
      title: string;
      value: string;
      subtitle?: string;
      footer?: string;
      color?: string;
      progress: number;
    };

function linePath(values: number[], width: number, height: number) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function areaPath(values: number[], width: number, height: number) {
  return `${linePath(values, width, height)} L ${width} ${height} L 0 ${height} Z`;
}

function DeckLineCard({
  title,
  value,
  subtitle,
  footer,
  color = "#24c7d9",
  fill = "rgba(36, 199, 217, 0.14)",
  values,
}: Extract<DeckCard, { kind: "line" }>) {
  const width = 220;
  const height = 84;

  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-24 w-full">
        <defs>
          <linearGradient id={`line-fill-${title}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={areaPath(values, width, height)} fill={`url(#line-fill-${title})`} />
        <path d={linePath(values, width, height)} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {footer && <p className="text-xs font-medium text-slate-400">{footer}</p>}
    </div>
  );
}

function DeckBarCard({
  title,
  value,
  subtitle,
  footer,
  color = "#8b5cf6",
  values,
}: Extract<DeckCard, { kind: "bar" }>) {
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-5 flex h-24 items-end gap-2">
        {values.map((item, index) => (
          <div key={`${title}-${index}`} className="flex-1 rounded-lg bg-gradient-to-b from-slate-100/80 to-slate-50/60 p-[2px] backdrop-blur-sm">
            <div
              className="rounded-md transition-all duration-300 cursor-pointer"
              style={{
                height: `${Math.max(16, (item / max) * 88)}px`,
                background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                boxShadow: `0 0 12px ${color}40, inset 0 1px 2px rgba(255,255,255,0.5)`,
              }}
            />
          </div>
        ))}
      </div>
      {footer && <p className="mt-3 text-xs font-medium text-slate-400">{footer}</p>}
    </div>
  );
}

function DeckRadialCard({
  title,
  value,
  subtitle,
  footer,
  color = "#f97360",
  progress,
}: Extract<DeckCard, { kind: "radial" }>) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{title}</p>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${progress}%, rgba(226,232,240,0.95) ${progress}% 100%)`,
          }}
        >
          <div className="flex h-[4.1rem] w-[4.1rem] items-center justify-center rounded-full bg-[#fffaf6] text-sm font-semibold text-slate-950">
            {progress}%
          </div>
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-950">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {footer && <p className="mt-3 text-xs font-medium text-slate-400">{footer}</p>}
    </div>
  );
}

export function PageVisualDeck({
  eyebrow,
  title,
  description,
  cards,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  cards: DeckCard[];
}) {
  return (
    <section className="rounded-[1.9rem] border border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(247,241,234,0.9))] p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.36)]">
      {(eyebrow || title || description) && (
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h2>}
          </div>
          {description && <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          if (card.kind === "line") return <DeckLineCard key={`${card.title}-${card.kind}`} {...card} />;
          if (card.kind === "bar") return <DeckBarCard key={`${card.title}-${card.kind}`} {...card} />;
          return <DeckRadialCard key={`${card.title}-${card.kind}`} {...card} />;
        })}
      </div>
    </section>
  );
}
