/** Minimal SVG bar chart. */
export function BarChart({ data, height = 180, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(1, data.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4 - 2);
          return (
            <rect key={i} x={i * barW + barW * 0.15} y={height / 4 - h} width={barW * 0.7} height={h} rx={0.4} fill={d.value === max ? '#f59e0b' : '#22d3ee'}>
              <title>{`${d.label}: ${d.value}${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        {data.filter((_, i) => i % Math.ceil(data.length / 8 || 1) === 0).map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
