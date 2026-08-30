"use client";

import { useRouter } from "next/navigation";

import { HORIZON_LABELS, HORIZONS } from "@/config/challenge";
import { formatDate } from "@/lib/dates";

export interface PickFilterState {
  student: string;
  stock: string;
  deadline: string;
  horizon: string;
}

export function PickFilters({
  students,
  tickers,
  deadlines,
  current,
}: {
  students: Array<{ id: string; name: string }>;
  tickers: string[];
  deadlines: string[];
  current: PickFilterState;
}) {
  const router = useRouter();

  const apply = (key: keyof PickFilterState, value: string) => {
    const next: PickFilterState = { ...current, [key]: value };
    const params = new URLSearchParams();
    if (next.student) params.set("student", next.student);
    if (next.stock) params.set("stock", next.stock);
    if (next.deadline) params.set("deadline", next.deadline);
    if (next.horizon && next.horizon !== "OVERALL") params.set("horizon", next.horizon);
    const query = params.toString();
    router.push(query ? `/leaderboard?${query}` : "/leaderboard", { scroll: false });
  };

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <FilterSelect
        label="Student"
        value={current.student}
        onChange={(value) => apply("student", value)}
        options={[
          { value: "", label: "All students" },
          ...students.map((student) => ({ value: student.id, label: student.name })),
        ]}
      />
      <FilterSelect
        label="Stock"
        value={current.stock}
        onChange={(value) => apply("stock", value)}
        options={[
          { value: "", label: "All stocks" },
          ...tickers.map((ticker) => ({ value: ticker, label: ticker })),
        ]}
      />
      <FilterSelect
        label="Deadline"
        value={current.deadline}
        onChange={(value) => apply("deadline", value)}
        options={[
          { value: "", label: "All deadlines" },
          ...deadlines.map((date) => ({ value: date, label: formatDate(date) })),
        ]}
      />
      <FilterSelect
        label="Horizon"
        value={current.horizon}
        onChange={(value) => apply("horizon", value)}
        options={[
          { value: "OVERALL", label: "All horizons" },
          ...HORIZONS.map((horizon) => ({ value: horizon, label: HORIZON_LABELS[horizon] })),
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-xs text-fg outline-none transition-colors hover:border-border-strong focus:border-accent"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
