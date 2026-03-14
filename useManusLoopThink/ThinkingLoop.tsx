import { useState, useRef, useEffect, useCallback } from "react";

const STAGES = [
  { id: 1, name: "씨앗 심기", icon: "🌱", color: "#4ade80", method: "인용 작업 위임", desc: "핵심 아이디어 정착" },
  { id: 2, name: "빠른 탐색", icon: "⚡", color: "#facc15", method: "새로운 주제 파악", desc: "가능성의 지형 탐사" },
  { id: 3, name: "맥락 지도", icon: "🗺️", color: "#60a5fa", method: "관련 소스 로드맵", desc: "연결고리 발견" },
  { id: 4, name: "깊이 파기", icon: "🔍", color: "#f472b6", method: "구체적 질문", desc: "이해의 공백 채우기" },
  { id: 5, name: "흐름 점검", icon: "🌊", color: "#a78bfa", method: "개요 피드백", desc: "논리 흐름 개선" },
  { id: 6, name: "역방향 검증", icon: "🔄", color: "#fb923c", method: "역개요 테스트", desc: "논리 역주행으로 검증" },
  { id: 7, name: "소크라테스", icon: "🏛️", color: "#2dd4bf", method: "소크라테스식 대화", desc: "질문으로 아이디어 단련" },
  { id: 8, name: "압력 테스트", icon: "⚔️", color: "#f87171", method: "반론 요청", desc: "논문의 약점 발견" },
  { id: 9, name: "거인의 어깨", icon: "🧠", color: "#c084fc", method: "위대한 사상가 비교", desc: "역사적 맥락 속 위치 찾기" },
  { id: 10, name: "반복 정제", icon: "♾️", color: "#34d399", method: "반복적 피드백", desc: "계속 갈고 닦기" },
  { id: 11, name: "소리 내기", icon: "🎙️", color: "#fbbf24", method: "독서 동반자", desc: "말로 뱉어 구조화" },
  { id: 12, name: "완성 결정", icon: "✨", color: "#e879f9", method: "기술 연마", desc: "진짜 덩어리로 완성" },
];

interface Thought {
  id: string;
  stageId: number;
  question: string;
  answer: string;
  aiCommentary: string;
  followUpQuestions: string[];
  insight: string;
  timestamp: number;
}

interface WebNode {
  thoughtId: string;
  x: number;
  y: number;
  r: number;
  color: string;
}

const SYSTEM_PROMPT = `당신은 사용자의 생각을 키워주는 "사고 코치"입니다.
현재 단계와 지금까지의 대화를 바탕으로, 사용자의 아이디어를 더 풍부하게 만들 수 있는 
깊고 날카로운 질문 2~3개를 한국어로 해주세요.

규칙:
- 질문은 짧고 강렬하게 (한 줄 이내)
- 예/아니오로 답하기 어려운 열린 질문
- 사용자가 미처 생각 못한 각도에서 도전
- 단계의 성격에 맞게 (탐색/검증/비판/연결 등)
- 응답 형식: JSON {"questions": ["질문1", "질문2", "질문3"], "insight": "한 줄 통찰"}`;

const COMMENTARY_PROMPT = `당신은 사용자의 생각을 키워주는 "사고 코치"입니다.
사용자가 방금 제시한 답변을 읽고, 다음을 해주세요:

1. 그 답변에 대한 즉각적인 코멘트 (1-2문장, 격려 + 통찰)
2. 그 답변을 더 깊게 탐색할 수 있는 후속 질문 2-3개
3. 한 줄의 핵심 통찰

응답 형식: JSON {
  "commentary": "사용자 답변에 대한 코멘트",
  "followUpQuestions": ["후속 질문1", "후속 질문2", "후속 질문3"],
  "insight": "한 줄 통찰"
}`;

export default function ThinkingLoop() {
  const [phase, setPhase] = useState<"intro" | "active" | "complete">("intro");
  const [seedIdea, setSeedIdea] = useState("");
  const [currentStage, setCurrentStage] = useState(0);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiInsight, setAiInsight] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentaryLoading, setCommentaryLoading] = useState(false);
  const [webNodes, setWebNodes] = useState<WebNode[]>([]);
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | null>(null);
  const [showThoughtDetail, setShowThoughtDetail] = useState(false);
  const [recommendedNextStages, setRecommendedNextStages] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const stage = STAGES[currentStage];
  const stageThoughts = thoughts.filter((t) => t.stageId === stage?.id);
  const selectedThought = thoughts.find((t) => t.id === selectedThoughtId);

  // Draw thought web on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const W = (canvas.width = canvas.offsetWidth);
    const H = (canvas.height = canvas.offsetHeight);
    ctx.clearRect(0, 0, W, H);

    if (webNodes.length === 0) return;

    const cx = W / 2,
      cy = H / 2;

    // Draw connections
    webNodes.forEach((node, i) => {
      if (i === 0) return;
      const prev = webNodes[i - 1];
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(node.x, node.y);
      ctx.strokeStyle = `${node.color}44`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Connect to center
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(node.x, node.y);
      ctx.strokeStyle = `${node.color}22`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw center node
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    grad.addColorStop(0, "#f59e0b88");
    grad.addColorStop(1, "#f59e0b00");
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();

    // Draw nodes
    webNodes.forEach((node) => {
      const isSelected = node.thoughtId === selectedThoughtId;
      const g = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r);
      g.addColorStop(0, isSelected ? `${node.color}ff` : `${node.color}cc`);
      g.addColorStop(1, `${node.color}00`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Draw selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `${node.color}66`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [webNodes, selectedThoughtId]);

  const addWebNode = (thoughtId: string, stageIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth,
      H = canvas.offsetHeight;
    const cx = W / 2,
      cy = H / 2;
    const angle = (stageIdx / 12) * Math.PI * 2 - Math.PI / 2;
    const dist = 80 + Math.random() * 60;
    const jitter = () => (Math.random() - 0.5) * 30;
    const node: WebNode = {
      thoughtId: thoughtId,
      x: cx + Math.cos(angle) * dist + jitter(),
      y: cy + Math.sin(angle) * dist + jitter(),
      r: 20 + Math.random() * 15,
      color: STAGES[stageIdx].color,
    };
    setWebNodes((prev) => [...prev, node]);
  };

  const fetchQuestions = useCallback(
    async (stageIdx: number, history: Thought[]) => {
      setLoading(true);
      setAiQuestions([]);
      setAiInsight("");
      const s = STAGES[stageIdx];
      const historyText = history
        .map(
          (t) =>
            `[${STAGES[t.stageId - 1]?.name}] Q: ${t.question}\nA: ${t.answer}`
        )
        .join("\n\n");

      const userMsg = `씨앗 아이디어: "${seedIdea}"

지금까지의 생각:
${historyText || "(아직 없음)"}

현재 단계: ${s.name} (${s.method})
단계 목표: ${s.desc}

이 단계에 맞는 질문 2~3개와 통찰을 주세요.`;

      try {
        const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
        if (!apiKey) {
          throw new Error("Claude API key not configured. Please set VITE_CLAUDE_API_KEY environment variable.");
        }
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
        const data = await res.json();
        const text = data.content?.find((b: any) => b.type === "text")?.text || "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAiQuestions(parsed.questions || []);
        setAiInsight(parsed.insight || "");
      } catch (e) {
        console.error("Failed to fetch questions:", e);
        setAiQuestions([
          "이 아이디어가 실제로 중요한 이유가 무엇인가요?",
          "지금 가장 불확실한 부분은 어디인가요?",
          "5년 후 이 생각이 어떻게 변해 있을까요?",
        ]);
        setAiInsight("아이디어는 저항을 만날 때 성장한다.");
      }
      setLoading(false);
    },
    [seedIdea]
  );

  const fetchAICommentary = useCallback(
    async (answer: string, stageIdx: number, history: Thought[], selectedQuestion: string) => {
      const s = STAGES[stageIdx];
      const historyText = history
        .map(
          (t) =>
            `[${STAGES[t.stageId - 1]?.name}] Q: ${t.question}\nA: ${t.answer}`
        )
        .join("\n\n");

      const userMsg = `씨앗 아이디어: "${seedIdea}"

현재 단계: ${s.name} (${s.method})
질문: ${selectedQuestion}

사용자의 답변:
"${answer}"

이 답변에 대한:
1. 즉각적인 코멘트 (격려 + 통찰)
2. 더 깊게 탐색할 후속 질문 2-3개
3. 한 줄의 핵심 통찰

을 JSON 형식으로 주세요.`;

      try {
        const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
        if (!apiKey) {
          throw new Error("Claude API key not configured. Please set VITE_CLAUDE_API_KEY environment variable.");
        }
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: COMMENTARY_PROMPT,
            messages: [{ role: "user", content: userMsg }],
          }),
        });
        const data = await res.json();
        const text = data.content?.find((b: any) => b.type === "text")?.text || "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        return {
          commentary: parsed.commentary || "",
          followUpQuestions: parsed.followUpQuestions || [],
          insight: parsed.insight || "",
        };
      } catch (e) {
        console.error("Failed to fetch commentary:", e);
        return {
          commentary: "흥미로운 관점이네요. 이 생각을 더 깊게 파고들어보세요.",
          followUpQuestions: [
            "이 답변에서 가장 중요한 부분은 무엇인가요?",
            "이것이 당신의 원래 아이디어와 어떻게 연결되나요?",
            "이 생각을 반대로 뒤집으면 어떻게 될까요?",
          ],
          insight: "깊이 있는 답변은 새로운 질문을 낳는다.",
        };
      }
    },
    [seedIdea]
  );

  const getRecommendedNextStages = useCallback((currentIdx: number, allThoughts: Thought[]) => {
    const completedStages = new Set(allThoughts.map((t) => t.stageId));
    const recommendations: number[] = [];

    // 다음 단계 (아직 안 한 경우)
    if (currentIdx + 1 < STAGES.length && !completedStages.has(STAGES[currentIdx + 1].id)) {
      recommendations.push(currentIdx + 1);
    }

    // 이전 단계로 돌아가기 (선택적)
    if (currentIdx > 0) {
      recommendations.push(currentIdx - 1);
    }

    // 관련 단계 제안
    const relatedIdx = STAGES.findIndex(
      (s, i) => i !== currentIdx && !completedStages.has(s.id) && Math.random() > 0.5
    );
    if (relatedIdx !== -1 && recommendations.length < 3) {
      recommendations.push(relatedIdx);
    }

    return recommendations.slice(0, 3);
  }, []);

  const startLoop = async () => {
    if (!seedIdea.trim()) return;
    setPhase("active");
    setCurrentStage(0);
    setThoughts([]);
    setWebNodes([]);
    setRecommendedNextStages([]);
    await fetchQuestions(0, []);
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim() || selectedQ === null) return;

    setCommentaryLoading(true);
    const thoughtId = `thought-${Date.now()}`;

    // AI 코멘트 생성
    const commentary = await fetchAICommentary(
      currentAnswer.trim(),
      currentStage,
      thoughts,
      aiQuestions[selectedQ]
    );

    const newThought: Thought = {
      id: thoughtId,
      stageId: stage.id,
      question: aiQuestions[selectedQ],
      answer: currentAnswer.trim(),
      aiCommentary: commentary.commentary,
      followUpQuestions: commentary.followUpQuestions,
      insight: commentary.insight,
      timestamp: Date.now(),
    };

    const newThoughts = [...thoughts, newThought];
    setThoughts(newThoughts);
    setCurrentAnswer("");
    setSelectedQ(null);
    addWebNode(thoughtId, currentStage);

    // 추천 다음 단계 업데이트
    setRecommendedNextStages(getRecommendedNextStages(currentStage, newThoughts));
    setCommentaryLoading(false);

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleThoughtNodeClick = (thoughtId: string) => {
    setSelectedThoughtId(thoughtId);
    setShowThoughtDetail(true);
  };

  const jumpToStage = async (stageIdx: number) => {
    setCurrentStage(stageIdx);
    await fetchQuestions(stageIdx, thoughts);
    setShowThoughtDetail(false);
  };

  const nextStage = async () => {
    const recommendations = getRecommendedNextStages(currentStage, thoughts);
    if (recommendations.length > 0) {
      setRecommendedNextStages(recommendations);
    } else {
      if (currentStage + 1 >= STAGES.length) {
        setPhase("complete");
        return;
      }
      setCurrentStage(currentStage + 1);
      await fetchQuestions(currentStage + 1, thoughts);
    }
  };

  const loopBack = async (idx: number) => {
    setCurrentStage(idx);
    await fetchQuestions(idx, thoughts);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e8e0d0", fontFamily: "'Nanum Myeongjo', 'Georgia', serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        textarea { resize: none; }
        .stage-pill:hover { opacity: 1 !important; transform: translateY(-2px); }
        .q-card:hover { border-color: #f59e0b88 !important; }
        .thought-node { cursor: pointer; transition: all 0.2s; }
        .thought-node:hover { transform: scale(1.05); }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 #f59e0b44; }
          50% { box-shadow: 0 0 0 8px #f59e0b00; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .loading-shimmer {
          background: linear-gradient(90deg, #1a1a2e 25%, #2a2a3e 50%, #1a1a2e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
          height: 20px;
          margin: 6px 0;
        }
        .commentary-box {
          background: #111827;
          border-left: 3px solid;
          padding: 14px;
          border-radius: 8px;
          margin: 12px 0;
          animation: fadeIn 0.4s ease;
        }
      `}</style>

      {/* Header */}
      <header style={{ padding: "20px 32px", borderBottom: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d0d18" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#f59e0b", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>
            思考 · 成長 · 循環
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f0e8d0", marginTop: 2 }}>
            생각 성장 엔진
          </div>
        </div>
        {phase === "active" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#888", background: "#111", padding: "4px 12px", borderRadius: 20 }}>
              {thoughts.length} 생각 쌓임
            </div>
            <div style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: stage?.color, background: "#111", padding: "4px 12px", borderRadius: 20, border: `1px solid ${stage?.color}44` }}>
              {stage?.icon} {stage?.name}
            </div>
          </div>
        )}
      </header>

      {/* INTRO */}
      {phase === "intro" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, maxWidth: 640, margin: "0 auto", width: "100%" }}>
          <div style={{ fontSize: 48, marginBottom: 16, textAlign: "center" }}>💡</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, textAlign: "center", color: "#f0e8d0", marginBottom: 8 }}>
            씨앗 아이디어를 심으세요
          </h1>
          <p style={{ color: "#666", textAlign: "center", lineHeight: 1.8, marginBottom: 32, fontSize: 15 }}>
            단순한 생각 하나에서 시작합니다.<br />
            12단계의 질문 루프가 아이디어를 <strong style={{ color: "#f59e0b" }}>살아있는 덩어리</strong>로 키워냅니다.<br />
            <span style={{ fontSize: 12, color: "#555", marginTop: 8 }}>✨ 이제 AI가 당신의 답변에 즉각 반응합니다!</span>
          </p>
          <textarea
            value={seedIdea}
            onChange={(e) => setSeedIdea(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) startLoop(); }}
            placeholder="예: AI가 창의성을 대체할 수 있을까? / 도시를 숲으로 만들고 싶다 / 일을 놀이처럼 만드는 방법..."
            style={{
              width: "100%", minHeight: 120, background: "#111827", border: "1px solid #2a2a3e", borderRadius: 12, padding: 20,
              color: "#e8e0d0", fontSize: 16, fontFamily: "Nanum Myeongjo, serif", outline: "none", lineHeight: 1.7,
              boxShadow: "0 0 0 0 #f59e0b", transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#f59e0b88"; e.currentTarget.style.boxShadow = "0 0 0 3px #f59e0b22"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3e"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <div style={{ display: "flex", gap: 12, marginTop: 20, width: "100%" }}>
            <button
              onClick={startLoop}
              disabled={!seedIdea.trim()}
              style={{
                flex: 1, padding: "14px 32px", borderRadius: 10, border: "none",
                background: seedIdea.trim() ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#222",
                color: seedIdea.trim() ? "#000" : "#555",
                fontFamily: "Nanum Myeongjo, serif", fontSize: 16, fontWeight: 700,
                cursor: seedIdea.trim() ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                animation: seedIdea.trim() ? "pulse-glow 2s infinite" : "none",
              }}
            >
              생각 키우기 시작 →
            </button>
          </div>
          {/* Stage preview */}
          <div style={{ marginTop: 48, width: "100%" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: "#444", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", marginBottom: 16, textAlign: "center" }}>
              12단계 여정
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {STAGES.map((s) => (
                <div key={s.id} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: `1px solid ${s.color}33`, color: s.color, fontFamily: "JetBrains Mono, monospace" }}>
                  {s.icon} {s.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE - Main Layout */}
      {phase === "active" && (
        <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden", height: "calc(100vh - 65px)" }}>
          {/* Left: Stage Nav */}
          <div style={{ width: 220, flexShrink: 0, background: "#0d0d18", borderRight: "1px solid #1e1e2e", padding: "16px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#444", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", marginBottom: 10, paddingLeft: 8 }}>
              12단계 루프
            </div>
            {STAGES.map((s, i) => {
              const done = thoughts.some((t) => t.stageId === s.id);
              const active = i === currentStage;
              const isRecommended = recommendedNextStages.includes(i);
              return (
                <button
                  key={s.id}
                  className="stage-pill"
                  onClick={() => loopBack(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none",
                    background: active ? `${s.color}18` : "transparent",
                    borderLeft: active ? `3px solid ${s.color}` : "3px solid transparent",
                    cursor: "pointer", textAlign: "left", width: "100%",
                    opacity: i > currentStage && !done ? 0.35 : 1,
                    transition: "all 0.15s", position: "relative",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? s.color : done ? "#aaa" : "#555", fontFamily: "Nanum Myeongjo, serif" }}>
                      {s.name}
                      {done && <span style={{ marginLeft: 4, fontSize: 10, color: s.color }}>●</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>
                      {s.method.slice(0, 8)}…
                    </div>
                  </div>
                  {isRecommended && (
                    <div style={{ fontSize: 8, background: s.color, color: "#000", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>
                      추천
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Center: Main interaction */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Stage header */}
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #1e1e2e", background: "#0d0d18", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${stage.color}22`, border: `1px solid ${stage.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                {stage.icon}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f0e8d0" }}>{stage.name}</div>
                <div style={{ fontSize: 12, color: "#666", fontFamily: "JetBrains Mono, monospace" }}>
                  {stage.method} · {stage.desc}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#444", fontFamily: "JetBrains Mono, monospace" }}>
                💡 "{seedIdea.slice(0, 30)}{seedIdea.length > 30 ? "…" : ""}"
              </div>
            </div>

            {/* Scroll area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
              {/* Previous thoughts in this stage */}
              {stageThoughts.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {stageThoughts.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: 16, animation: "fadeIn 0.4s ease", background: "#111827", borderRadius: 10, padding: 16,
                        borderLeft: `3px solid ${stage.color}88`, cursor: "pointer", transition: "all 0.2s",
                      }}
                      onClick={() => handleThoughtNodeClick(t.id)}
                    >
                      <div style={{ fontSize: 12, color: "#555", fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
                        AI 질문
                      </div>
                      <div style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>{t.question}</div>
                      <div style={{ fontSize: 13, color: "#e8e0d0", lineHeight: 1.7, marginBottom: 12 }}>
                        <span style={{ color: stage.color, marginRight: 8 }}>→</span>
                        {t.answer}
                      </div>

                      {/* AI 코멘트 */}
                      {t.aiCommentary && (
                        <div className="commentary-box" style={{ borderLeftColor: stage.color }}>
                          <div style={{ fontSize: 11, color: stage.color, fontFamily: "JetBrains Mono, monospace", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                            ✦ AI 코멘트
                          </div>
                          <div style={{ fontSize: 13, color: "#d0c8b8", lineHeight: 1.6 }}>
                            {t.aiCommentary}
                          </div>
                          {t.insight && (
                            <div style={{ fontSize: 11, color: stage.color, marginTop: 8, fontStyle: "italic" }}>
                              💡 {t.insight}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 후속 질문들 */}
                      {t.followUpQuestions && t.followUpQuestions.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 11, color: "#555", fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
                            후속 질문들
                          </div>
                          {t.followUpQuestions.map((fq, j) => (
                            <div key={j} style={{ fontSize: 12, color: "#777", marginBottom: 4, paddingLeft: 12, borderLeft: `1px solid ${stage.color}44` }}>
                              • {fq}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* AI Questions */}
              {loading ? (
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 12, color: "#444", fontFamily: "JetBrains Mono, monospace", marginBottom: 12 }}>
                    AI가 질문을 만들고 있습니다…
                  </div>
                  <div className="loading-shimmer" style={{ width: "80%" }} />
                  <div className="loading-shimmer" style={{ width: "65%" }} />
                  <div className="loading-shimmer" style={{ width: "70%" }} />
                </div>
              ) : (
                <>
                  {aiInsight && (
                    <div style={{ marginBottom: 20, padding: "10px 16px", background: `${stage.color}0f`, border: `1px solid ${stage.color}22`, borderRadius: 8, fontSize: 13, color: stage.color, fontStyle: "italic", animation: "fadeIn 0.5s ease" }}>
                      ✦ {aiInsight}
                    </div>
                  )}
                  <div style={{ marginBottom: 8, fontSize: 12, color: "#555", fontFamily: "JetBrains Mono, monospace" }}>
                    질문을 선택하고 답하세요 — 여러 번 반복할 수 있습니다
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {aiQuestions.map((q, i) => (
                      <button
                        key={i}
                        className="q-card"
                        onClick={() => { setSelectedQ(i); textareaRef.current?.focus(); }}
                        style={{
                          padding: "14px 16px", borderRadius: 10, border: `1px solid ${selectedQ === i ? stage.color + "88" : "#2a2a3e"}`,
                          background: selectedQ === i ? `${stage.color}11` : "#111827",
                          color: selectedQ === i ? "#f0e8d0" : "#888",
                          textAlign: "left", fontSize: 14, cursor: "pointer",
                          fontFamily: "Nanum Myeongjo, serif", lineHeight: 1.6,
                          transition: "all 0.15s", animation: `fadeIn ${0.3 + i * 0.1}s ease`,
                        }}
                      >
                        <span style={{ color: stage.color, marginRight: 8, fontSize: 12 }}>Q{i + 1}</span>
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Answer input */}
                  <div style={{ background: "#111827", borderRadius: 12, padding: 16, border: `1px solid ${selectedQ !== null ? stage.color + "44" : "#1e1e2e"}`, transition: "border-color 0.2s" }}>
                    <textarea
                      ref={textareaRef}
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      placeholder={selectedQ !== null ? "자유롭게 생각을 쏟아내세요. 완벽하지 않아도 됩니다." : "먼저 위 질문을 선택하세요"}
                      disabled={selectedQ === null}
                      style={{
                        width: "100%", minHeight: 100, background: "transparent", border: "none", outline: "none",
                        color: "#e8e0d0", fontSize: 14, fontFamily: "Nanum Myeongjo, serif", lineHeight: 1.8,
                        opacity: selectedQ === null ? 0.5 : 1,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#333", fontFamily: "JetBrains Mono, monospace" }}>
                        {currentAnswer.length}자
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={submitAnswer}
                          disabled={!currentAnswer.trim() || selectedQ === null || commentaryLoading}
                          style={{
                            padding: "8px 20px", borderRadius: 8, border: "none",
                            background: currentAnswer.trim() && selectedQ !== null ? `linear-gradient(135deg, ${stage.color}, ${stage.color}aa)` : "#222",
                            color: currentAnswer.trim() && selectedQ !== null ? "#000" : "#444",
                            fontFamily: "Nanum Myeongjo, serif", fontSize: 13, fontWeight: 700,
                            cursor: currentAnswer.trim() && selectedQ !== null ? "pointer" : "not-allowed",
                          }}
                        >
                          {commentaryLoading ? "AI가 반응 중..." : "생각 추가 +"}
                        </button>
                        <button
                          onClick={nextStage}
                          style={{
                            padding: "8px 20px", borderRadius: 8, border: `1px solid ${stage.color}44`,
                            background: "transparent", color: stage.color,
                            fontFamily: "Nanum Myeongjo, serif", fontSize: 13, cursor: "pointer",
                          }}
                        >
                          {currentStage === 11 ? "완성 ✨" : "다음 단계 →"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Right: Thought Web */}
          <div style={{ width: 260, flexShrink: 0, background: "#0d0d18", borderLeft: "1px solid #1e1e2e", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e2e" }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#444", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace" }}>
                생각 웹 (클릭 가능)
              </div>
            </div>
            <canvas
              ref={canvasRef}
              style={{ flex: 1, width: "100%", opacity: 0.9, cursor: "pointer" }}
              onClick={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (!rect) return;
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                webNodes.forEach((node) => {
                  const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
                  if (dist < node.r + 10) {
                    handleThoughtNodeClick(node.thoughtId);
                  }
                });
              }}
            />
            {/* Thought count per stage */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #1e1e2e" }}>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
                쌓인 생각들
              </div>
              {STAGES.filter((s) => thoughts.some((t) => t.stageId === s.id)).map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                  <div style={{ fontSize: 11, color: "#666", flex: 1, fontFamily: "JetBrains Mono, monospace" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: s.color }}>
                    {thoughts.filter((t) => t.stageId === s.id).length}
                  </div>
                </div>
              ))}
              {thoughts.length === 0 && (
                <div style={{ fontSize: 11, color: "#333", fontFamily: "JetBrains Mono, monospace" }}>
                  아직 아무것도 없습니다
                </div>
              )}
            </div>
          </div>

          {/* Thought Detail Modal */}
          {showThoughtDetail && selectedThought && (
            <div
              style={{
                position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
                justifyContent: "center", zIndex: 1000,
              }}
              onClick={() => setShowThoughtDetail(false)}
            >
              <div
                style={{
                  background: "#111827", borderRadius: 12, padding: 24, maxWidth: 600,
                  maxHeight: "80vh", overflowY: "auto",
                  border: `2px solid ${STAGES[selectedThought.stageId - 1]?.color}`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: 12, color: STAGES[selectedThought.stageId - 1]?.color, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
                  {STAGES[selectedThought.stageId - 1]?.icon} {STAGES[selectedThought.stageId - 1]?.name}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f0e8d0", marginBottom: 16 }}>
                  {selectedThought.question}
                </h2>
                <div style={{ background: "#0d0d18", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>당신의 답변</div>
                  <div style={{ fontSize: 14, color: "#e8e0d0", lineHeight: 1.8 }}>
                    {selectedThought.answer}
                  </div>
                </div>
                {selectedThought.aiCommentary && (
                  <div style={{ background: `${STAGES[selectedThought.stageId - 1]?.color}11`, padding: 16, borderRadius: 8, borderLeft: `3px solid ${STAGES[selectedThought.stageId - 1]?.color}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: STAGES[selectedThought.stageId - 1]?.color, fontFamily: "JetBrains Mono, monospace", marginBottom: 8 }}>
                      ✦ AI 코멘트
                    </div>
                    <div style={{ fontSize: 14, color: "#d0c8b8", lineHeight: 1.7 }}>
                      {selectedThought.aiCommentary}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  <button
                    onClick={() => setShowThoughtDetail(false)}
                    style={{
                      flex: 1, padding: "10px 20px", borderRadius: 8, border: "1px solid #333",
                      background: "transparent", color: "#888",
                      fontFamily: "Nanum Myeongjo, serif", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => jumpToStage(selectedThought.stageId - 1)}
                    style={{
                      flex: 1, padding: "10px 20px", borderRadius: 8, border: "none",
                      background: STAGES[selectedThought.stageId - 1]?.color,
                      color: "#000", fontFamily: "Nanum Myeongjo, serif",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    이 단계로 이동
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPLETE */}
      {phase === "complete" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: 40, maxWidth: 760, margin: "0 auto", width: "100%", overflowY: "auto" }}>
          <div style={{ fontSize: 48, marginBottom: 8, textAlign: "center" }}>✨</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, textAlign: "center", color: "#f0e8d0", marginBottom: 8 }}>
            생각 덩어리 완성
          </h1>
          <p style={{ color: "#f59e0b", textAlign: "center", marginBottom: 8, fontSize: 15 }}>
            "{seedIdea}"
          </p>
          <p style={{ color: "#555", textAlign: "center", marginBottom: 40, fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>
            {thoughts.length}개의 생각 · {STAGES.filter((s) => thoughts.some((t) => t.stageId === s.id)).length}개 단계 통과
          </p>

          {/* Full thought map */}
          {STAGES.map((s) => {
            const ts = thoughts.filter((t) => t.stageId === s.id);
            if (ts.length === 0) return null;
            return (
              <div key={s.id} style={{ width: "100%", marginBottom: 24, background: "#111827", borderRadius: 12, overflow: "hidden", animation: "fadeIn 0.5s ease" }}>
                <div style={{ padding: "12px 20px", background: `${s.color}11`, borderBottom: `1px solid ${s.color}22`, display: "flex", alignItems: "center", gap: 10 }}>
                  <span>{s.icon}</span>
                  <span style={{ fontWeight: 700, color: s.color, fontSize: 14 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: "#555", fontFamily: "JetBrains Mono, monospace" }}>
                    {s.method}
                  </span>
                </div>
                {ts.map((t, i) => (
                  <div key={i} style={{ padding: "14px 20px", borderBottom: i < ts.length - 1 ? "1px solid #1a1a2e" : "none" }}>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>{t.question}</div>
                    <div style={{ fontSize: 14, color: "#e8e0d0", lineHeight: 1.8, marginBottom: 12 }}>
                      <span style={{ color: s.color }}>→ </span>{t.answer}
                    </div>
                    {t.aiCommentary && (
                      <div style={{ fontSize: 12, color: s.color, fontStyle: "italic", paddingLeft: 12, borderLeft: `2px solid ${s.color}44` }}>
                        ✦ {t.aiCommentary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={() => { setPhase("intro"); setSeedIdea(""); setThoughts([]); setWebNodes([]); }}
              style={{
                padding: "12px 28px", borderRadius: 10, border: "1px solid #333",
                background: "transparent", color: "#888",
                fontFamily: "Nanum Myeongjo, serif", fontSize: 14, cursor: "pointer",
              }}
            >
              새 아이디어 시작
            </button>
            <button
              onClick={() => { setPhase("active"); setCurrentStage(0); fetchQuestions(0, thoughts); }}
              style={{
                padding: "12px 28px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000",
                fontFamily: "Nanum Myeongjo, serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              루프 다시 돌기 ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
