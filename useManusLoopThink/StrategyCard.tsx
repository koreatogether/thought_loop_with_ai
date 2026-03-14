import { useState } from "react";
import { ChevronDown, CheckCircle2, Circle } from "lucide-react";
import { Strategy, colors } from "@/lib/strategies";

interface StrategyCardProps {
  strategy: Strategy;
  onToggleComplete: (id: number) => void;
}

export default function StrategyCard({
  strategy,
  onToggleComplete,
}: StrategyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorValue =
    colors[strategy.color as keyof typeof colors] || colors.coral;

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(strategy.id);
  };

  return (
    <div
      className="transition-smooth cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div
        className="rounded-lg p-6 card-shadow hover:shadow-lg transition-smooth border border-border"
        style={{
          backgroundColor: strategy.completed
            ? "oklch(0.95 0.01 290)"
            : "oklch(1 0 0)",
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{strategy.icon}</span>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-foreground">
                  {strategy.titleKo}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {strategy.descriptionKo}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={handleToggleComplete}
              className="transition-smooth hover:scale-110 flex-shrink-0"
            >
              {strategy.completed ? (
                <CheckCircle2
                  size={24}
                  className="text-mint"
                  fill="currentColor"
                />
              ) : (
                <Circle size={24} className="text-muted-foreground" />
              )}
            </button>
            <ChevronDown
              size={20}
              className={`transition-smooth flex-shrink-0 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border animate-in fade-in duration-300">
            <div
              className="rounded-md p-4 mb-4"
              style={{
                backgroundColor: `${colorValue}15`,
                borderLeft: `4px solid ${colorValue}`,
              }}
            >
              <p className="text-sm leading-relaxed text-foreground">
                {strategy.detailsKo}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleToggleComplete}
                className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-smooth ${
                  strategy.completed
                    ? "bg-mint text-white hover:opacity-90"
                    : "bg-coral text-white hover:opacity-90"
                }`}
              >
                {strategy.completed ? "✓ 완료됨" : "완료 표시"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
