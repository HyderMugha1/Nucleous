import { useMemo, useState } from "react";

interface MultiSelectChipsProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  allowSelectAll?: boolean;
  searchable?: boolean;
}

export function MultiSelectChips({
  label,
  options,
  selected,
  onChange,
  allowSelectAll = true,
  searchable = false,
}: MultiSelectChipsProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => options.filter((o) => o.toLowerCase().includes(query.toLowerCase())), [options, query]);

  const toggle = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };

  const selectAll = () => onChange([...options]);
  const clear = () => onChange([]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 min-w-[220px] items-center justify-between gap-3 rounded-[1.2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,241,234,0.9))] px-4 text-sm text-soft shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:text-foreground"
      >
        <span className="text-left">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
          <span className="block text-sm font-medium text-foreground">{selected.length === 0 ? "All selected" : `${selected.length} selected`}</span>
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{open ? "Close" : "Filter"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[320px] space-y-3 rounded-[1.35rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,242,236,0.95))] p-3 shadow-[0_28px_70px_-38px_rgba(15,23,42,0.34)] backdrop-blur-xl">
          {searchable && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-10 w-full rounded-xl border border-border/60 bg-white/80 px-3 text-sm text-foreground"
            />
          )}
          <div className="flex items-center gap-2">
            {allowSelectAll && (
              <button onClick={selectAll} className="text-[11px] font-semibold text-primary hover:underline">Select All</button>
            )}
            <button onClick={clear} className="text-[11px] font-medium text-muted-foreground hover:underline">Clear</button>
          </div>
          <div className="max-h-56 overflow-auto space-y-1">
            {filtered.map((opt) => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                  selected.includes(opt) ? "bg-primary/12 text-primary border border-primary/12" : "text-soft hover:bg-white/90"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="rounded-full border border-primary/18 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
