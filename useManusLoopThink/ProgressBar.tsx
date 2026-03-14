import { Strategy } from "@/lib/strategies";

interface ProgressBarProps {
  strategies: Strategy[];
}

export default function ProgressBar({ strategies }: ProgressBarProps) {
  const completed = strategies.filter((s) => s.completed).length;
  const total = strategies.length;
  const percentage = (completed / total) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-bold text-foreground">
          학습 진행도
        </h2>
        <span className="text-sm font-semibold text-coral">
          {completed} / {total} 완료
        </span>
      </div>

      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            background:
              "linear-gradient(90deg, oklch(0.75 0.20 15) 0%, oklch(0.75 0.15 160) 100%)",
          }}
        />
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        {strategies.map((strategy) => (
          <div
            key={strategy.id}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-smooth"
            style={{
              backgroundColor: strategy.completed
                ? "oklch(0.75 0.15 160)"
                : "oklch(0.90 0.03 290)",
              color: strategy.completed ? "white" : "oklch(0.50 0.05 290)",
              fontSize: "12px",
              fontWeight: "bold",
            }}
            title={strategy.titleKo}
          >
            {strategy.id}
          </div>
        ))}
      </div>
    </div>
  );
}
