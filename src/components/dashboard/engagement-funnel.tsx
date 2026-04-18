interface FunnelStep {
  label: string;
  value: number;
}

export function EngagementFunnel({ steps }: { steps: FunnelStep[] }) {
  if (steps.length === 0 || steps[0].value === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas encore assez d&apos;emails envoyes pour afficher le tunnel.
      </p>
    );
  }

  const first = steps[0].value;

  return (
    <div className="space-y-4">
      {steps.map((s) => {
        const pct = first > 0 ? (s.value / first) * 100 : 0;
        return (
          <div key={s.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">
                {s.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({pct.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, Math.max(pct < 100 ? 2 : 0, pct))}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
