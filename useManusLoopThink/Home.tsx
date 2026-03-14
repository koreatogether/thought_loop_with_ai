import { useState, useEffect } from "react";
import { Link } from "wouter";
import StrategyCard from "@/components/StrategyCard";
import ProgressBar from "@/components/ProgressBar";
import { strategies as initialStrategies } from "@/lib/strategies";

export default function Home() {
  const [strategies, setStrategies] = useState(initialStrategies);

  // Load saved progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("learning-mastery-progress");
    if (saved) {
      try {
        const savedStrategies = JSON.parse(saved);
        setStrategies(savedStrategies);
      } catch (e) {
        console.error("Failed to load saved progress:", e);
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem("learning-mastery-progress", JSON.stringify(strategies));
  }, [strategies]);

  const handleToggleComplete = (id: number) => {
    setStrategies(
      strategies.map((s) =>
        s.id === id ? { ...s, completed: !s.completed } : s
      )
    );
  };

  const completed = strategies.filter((s) => s.completed).length;
  const total = strategies.length;

  return (
    <div className="min-h-screen gradient-lavender">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="z-10">
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
                학습 고도화
              </h1>
              <h2 className="font-display text-2xl md:text-3xl font-semibold text-coral mb-6">
                11가지 깊이 있는 이해 전략
              </h2>
              <p className="text-lg text-foreground leading-relaxed mb-6">
                효과적인 학습과 깊이 있는 이해를 위한 검증된 전략들을 직접 체험해보세요.
                각 전략을 단계별로 실천하면서 자신의 학습 여정을 추적할 수 있습니다.
              </p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <span className="text-foreground">신뢰할 수 있는 정보</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  <span className="text-foreground">체계적 학습</span>
                </div>
              </div>
            </div>
            <div className="relative h-96 md:h-full">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663430228567/V8qmLnCmtgowDWyg6xvN6X/hero-learning-journey-LJLx3PTzXjjJh9kiaSWJax.webp"
                alt="Learning Journey"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      <section className="py-12 md:py-16 bg-white bg-opacity-50">
        <div className="container mx-auto px-4">
          <ProgressBar strategies={strategies} />
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground mb-2">
              11가지 학습 전략
            </h2>
            <p className="text-lg text-muted-foreground">
              각 전략을 클릭하여 상세 설명을 확인하고, 완료 상태를 추적하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>

          {/* Summary Section */}
          <div className="bg-white rounded-lg p-8 card-shadow border border-border">
            <h3 className="font-display text-2xl font-bold text-foreground mb-4">
              학습 여정 요약
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-coral mb-2">
                  {completed}
                </div>
                <p className="text-muted-foreground">완료한 전략</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-mint mb-2">
                  {total - completed}
                </div>
                <p className="text-muted-foreground">남은 전략</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple mb-2">
                  {Math.round((completed / total) * 100)}%
                </div>
                <p className="text-muted-foreground">진행률</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 bg-gradient-to-r from-coral to-mint bg-opacity-10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground mb-4">
            AI와 함께 생각을 성장시키고 싶으신가요?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            12단계 질문 루프를 통해 아이디어를 깊이 있는 생각으로 발전시키세요.
            AI가 당신의 답변에 즉각 반응하며 후속 질문으로 사고를 자극합니다.
          </p>
          <Link href="/thinking-loop">
            <button className="px-8 py-3 bg-coral text-white font-bold rounded-lg hover:bg-opacity-90 transition">
              생각 성장 엔진 시작하기 →
            </button>
          </Link>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 md:py-16 bg-white bg-opacity-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                데이터 직관적 탐색
              </h3>
              <p className="text-muted-foreground">
                진행도 시각화와 상세 분석을 통해 학습 데이터를 직관적으로 탐색하세요.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                트렌드 이해
              </h3>
              <p className="text-muted-foreground">
                각 전략의 완료 패턴과 학습 진행 추이를 통해 트렌드를 더 잘 이해합니다.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💾</div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                저장 및 공유
              </h3>
              <p className="text-muted-foreground">
                진행 상황이 자동으로 저장되며, 언제든 확인하고 공유할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-white bg-opacity-30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2026 Learning Mastery. 깊이 있는 이해를 위한 11가지 전략.
          </p>
        </div>
      </footer>
    </div>
  );
}
