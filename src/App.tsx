import { useState, useRef, useEffect, useCallback, FC } from "react";

interface Stage {
  id: number;
  name: string;
  icon: string;
  color: string;
  method: string;
  desc: string;
}

const STAGES: Stage[] = [
  { id: 1,  name: "씨앗 심기",   icon: "🌱", color: "#4ade80", method: "인용 작업 위임",      desc: "핵심 아이디어 정착" },
  { id: 2,  name: "빠른 탐색",   icon: "⚡", color: "#facc15", method: "새로운 주제 파악",    desc: "가능성의 지형 탐사" },
  { id: 3,  name: "맥락 지도",   icon: "🗺️", color: "#60a5fa", method: "관련 소스 로드맵",   desc: "연결고리 발견" },
  { id: 4,  name: "깊이 파기",   icon: "🔍", color: "#f472b6", method: "구체적 질문",         desc: "이해의 공백 채우기" },
  { id: 5,  name: "흐름 점검",   icon: "🌊", color: "#a78bfa", method: "개요 피드백",         desc: "논리 흐름 개선" },
  { id: 6,  name: "역방향 검증", icon: "🔄", color: "#fb923c", method: "역개요 테스트",       desc: "논리 역주행 검증" },
  { id: 7,  name: "소크라테스",  icon: "🏛️", color: "#2dd4bf", method: "소크라테스식 대화",  desc: "질문으로 아이디어 단련" },
  { id: 8,  name: "압력 테스트", icon: "⚔️", color: "#f87171", method: "반론 요청",           desc: "논문의 약점 발견" },
  { id: 9,  name: "거인의 어깨", icon: "🧠", color: "#c084fc", method: "위대한 사상가 비교", desc: "역사적 맥락 위치 찾기" },
  { id: 10, name: "반복 정제",   icon: "♾️", color: "#34d399", method: "반복적 피드백",       desc: "계속 갈고 닦기" },
  { id: 11, name: "소리 내기",   icon: "🎙️", color: "#fbbf24", method: "독서 동반자",         desc: "말로 뱉어 구조화" },
  { id: 12, name: "완성 결정",   icon: "✨", color: "#e879f9", method: "기술 연마",            desc: "진짜 덩어리로 완성" },
];

interface ChatEntry {
  role: "user" | "assistant" | "system" | "ai-questions" | "user-answer" | "ai-reply" | "ai-consolidation";
  stageId: number;
  content: any; // Can be more specific if needed
  question?: string;
}

interface WebNode {
  x: number;
  y: number;
  r: number;
  color: string;
  label: string;
  stageIdx: number;
}

interface AIParams {
  provider: string;
  geminiKey: string;
  messages: { role: string; content: string }[];
  system: string;
}

async function callAI({ provider, geminiKey, messages, system }: AIParams): Promise<string> {
  // Try local proxy first if running on localhost
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    try {
      const proxyRes = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, system }),
      });
      if (proxyRes.ok) {
          const data = await proxyRes.json();
          return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      }
    } catch (e) {
      console.log("Local API not detected or failed, falling back to direct mode.");
    }
  }

  if (provider === "gemini" && geminiKey) {
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.find((b: { type: string; text: string }) => b.type === "text")?.text || "{}";
}

function parseJSON(raw: string) {
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

interface ThoughtWebProps {
  nodes: WebNode[];
  onNodeClick: (idx: number) => void;
  activeIdx: number | null;
}

const ThoughtWeb: FC<ThoughtWebProps> = ({ nodes, onNodeClick, activeIdx }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rW = canvas.offsetWidth, rH = canvas.offsetHeight;
    canvas.width = rW * dpr; canvas.height = rH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rW, rH);
    const cx = rW / 2, cy = rH / 2;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
    cg.addColorStop(0, "#f59e0baa"); cg.addColorStop(1, "#f59e0b00");
    ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.fillStyle = cg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = "#f59e0b"; ctx.fill();
    nodes.forEach((node, i) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(node.x, node.y);
      ctx.strokeStyle = `${node.color}25`; ctx.lineWidth = 1; ctx.stroke();
      if (i > 0) {
        ctx.beginPath(); ctx.moveTo(nodes[i-1].x, nodes[i-1].y); ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = `${node.color}35`; ctx.lineWidth = 1.2; ctx.stroke();
      }
      const ng = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r);
      ng.addColorStop(0, `${node.color}${i === activeIdx ? "cc" : "55"}`);
      ng.addColorStop(1, `${node.color}00`);
      ctx.beginPath(); ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
      ctx.beginPath(); ctx.arc(node.x, node.y, i === activeIdx ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = node.color; ctx.fill();
      ctx.fillStyle = `${node.color}bb`; ctx.font = "10px JetBrains Mono, monospace";
      ctx.textAlign = "center"; ctx.fillText(node.label, node.x, node.y + node.r + 11);
    });
  }, [nodes, activeIdx]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    nodes.forEach((n, i) => { if (Math.hypot(n.x - mx, n.y - my) < n.r + 8) onNodeClick(i); });
  };

  return <canvas ref={canvasRef} onClick={handleClick} style={{ width:"100%", flex:1, cursor:"crosshair", display:"block" }} />;
}

export default function ThinkingLoop() {
  const [phase, setPhase] = useState<"intro" | "active" | "complete">("intro");
  const [seedIdea, setSeedIdea] = useState("");
  const [currentStage, setCurrentStage] = useState(0);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedQ, setSelectedQ] = useState<number | "final" | null>(null);
  const [loading, setLoading] = useState(false);
  const [webNodes, setWebNodes] = useState<WebNode[]>([]);
  const [activeNodeIdx, setActiveNodeIdx] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState("claude");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [apiError, setApiError] = useState("");
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionList, setSessionList] = useState<any[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stage = STAGES[currentStage];

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [chat, loading]);

  const buildNode = useCallback((stageIdx: number, rW = 200, rH = 260): WebNode => {
    const cx = rW / 2, cy = rH / 2;
    const angle = (stageIdx / 12) * Math.PI * 2 - Math.PI / 2;
    const dist = 65 + (stageIdx % 4) * 12;
    return {
      x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 14,
      y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 14,
      r: 16 + (stageIdx % 3) * 5,
      color: STAGES[stageIdx].color,
      label: STAGES[stageIdx].icon,
      stageIdx,
    };
  }, []);

  const fetchQuestions = useCallback(async (stageIdx: number, history: ChatEntry[]) => {
    setLoading(true); setApiError("");
    const s = STAGES[stageIdx];
    const histText = history.filter(c => c.role === "user-answer")
      .map(c => `[${STAGES.find(x=>x.id===c.stageId)?.name}] Q: ${c.question}\nA: ${c.content}`).join("\n\n");
    const system = `당신은 사용자의 생각을 키워주는 사고 코치입니다.
단계 성격에 맞는 날카롭고 열린 질문 3개와 한 줄 통찰을 한국어로 주세요.
JSON만 출력: {"questions":["q1","q2","q3"],"insight":"통찰"}`;
    const userMsg = `씨앗: "${seedIdea}"\n\n지금까지:\n${histText||"(없음)"}\n\n현재 단계: ${s.name}(${s.method}) — ${s.desc}`;
    try {
      const raw = await callAI({ provider, geminiKey, system, messages: [{ role:"user", content:userMsg }] });
      const parsed = parseJSON(raw);
      setChat(prev => [...prev, { role:"ai-questions", stageId:s.id, content: parsed || fallbackQ() }]);
    } catch(e: any) {
      setApiError(e.message || "API 오류");
      setChat(prev => [...prev, { role:"ai-questions", stageId:s.id, content: fallbackQ() }]);
    }
    setLoading(false);
  }, [seedIdea, provider, geminiKey]);

  const fallbackQ = () => ({
    questions: ["이 아이디어의 핵심 가정은 무엇인가요?", "가장 불확실한 부분은 어디인가요?", "반대하는 사람은 무엇이라 할까요?"],
    insight: "저항이 생각을 단련시킨다."
  });

  const fetchReply = useCallback(async (question: string, answer: string, stageId: number) => {
    setLoading(true); setApiError("");
    const s = STAGES.find(x=>x.id===stageId)!;
    const system = `당신은 사고 코치입니다. 사용자의 답변에 깊이 공감하고 긍정적으로 호응해주세요.
질문을 새로 던지지 말고, 사용자가 답변한 내용의 가치를 요약하거나 '멋진 생각입니다'와 같은 격려의 코멘트를 주세요.
JSON만 출력: {"comment":"...","followup":""}`;
    const userMsg = `단계: ${s.name}\n질문: ${question}\n사용자 답변: "${answer}"`;
    try {
      const raw = await callAI({ provider, geminiKey, system, messages: [{ role:"user", content:userMsg }] });
      const parsed = parseJSON(raw);
      setChat(prev => [...prev, { role:"ai-reply", stageId, content: parsed || { comment:"멋진 생각입니다. 대화의 흐름이 아주 좋아요!", followup:"" } }]);
    } catch(e: any) {
      setApiError(e.message || "API 오류");
      setChat(prev => [...prev, { role:"ai-reply", stageId, content: { comment:"흥미로운 관점이네요. 계속해서 다른 질문도 탐색해보세요.", followup:"" } }]);
    }
    setLoading(false);
  }, [provider, geminiKey]);

  const fetchConsolidation = useCallback(async (stageIdx: number, history: ChatEntry[]) => {
    setLoading(true); setApiError("");
    const s = STAGES[stageIdx];
    const stageAnswers = history.filter(c => c.role === "user-answer" && c.stageId === s.id);
    const answersText = stageAnswers.map(c => `Q: ${c.question}\nA: ${c.content}`).join("\n\n");
    
    const system = `당신은 사고 코치입니다. 현재 단계(${s.name})에서 사용자가 내놓은 답변들을 종합하여 깊이 있는 통찰 한 줄과, 다음 단계로 넘어가기 전 마지막으로 던지는 '임팩트 있는 질문' 하나를 주세요.
질문은 매우 날카롭고 본질적이어야 합니다.
JSON만 출력: {"summary":"종합 통찰","finalQuestion":"심화 질문"}`;
    const userMsg = `씨앗 아이디어: "${seedIdea}"\n\n현재 단계: ${s.name}\n그동안의 답변들:\n${answersText}`;
    
    try {
      const raw = await callAI({ provider, geminiKey, system, messages: [{ role:"user", content:userMsg }] });
      const parsed = parseJSON(raw);
      setChat(prev => [...prev, { role:"ai-consolidation", stageId:s.id, content: parsed || { summary: "생각의 기반이 단단해졌습니다.", finalQuestion: "이 모든 논의를 관통하는 단 하나의 핵심은 무엇인가요?" } }]);
    } catch(e: any) {
      setApiError(e.message || "API 오류");
      setChat(prev => [...prev, { role:"ai-consolidation", stageId:s.id, content: { summary: "충분한 탐색이 이루어졌습니다.", finalQuestion: "다음 단계에서 이 생각을 어떻게 더 발전시키고 싶으신가요?" } }]);
    }
    setLoading(false);
  }, [seedIdea, provider, geminiKey]);

  const startLoop = async () => {
    if (!seedIdea.trim()) return;
    setPhase("active"); setCurrentStage(0); setChat([]); setWebNodes([]); setApiError("");
    setSessionId(null);
    await fetchQuestions(0, []);
  };

  const saveSession = async () => {
    if (phase !== "active" || !seedIdea.trim()) return;
    setSaveLoading(true);

    // AI summary generation for the list
    let summary = "";
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        const lastThree = chat.filter(c => c.role === "user-answer").slice(-3).map(c => c.content).join(" ");
        const system = "사용자의 최근 답변들을 바탕으로 이 사고 성장의 핵심 주제를 5~10자 이내의 짧은 명사형으로 요약해주세요.";
        const userMsg = `씨앗: ${seedIdea}\n최근 답변: ${lastThree}`;
        try {
            const rawSummary = await callAI({ provider, geminiKey, system, messages: [{ role: "user", content: userMsg }] });
            summary = rawSummary.replace(/["{}]/g, "").trim();
        } catch (e) {}
    }

    const payload = {
      id: sessionId,
      seedIdea,
      summary: summary || seedIdea.slice(0, 15),
      chat,
      currentStage,
      webNodes,
      lastStage: STAGES[currentStage].name,
      activeNodeIdx
    };

    try {
      const res = await fetch("http://localhost:3001/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.id) setSessionId(data.id);
    } catch (e) {
      alert("세션 저장 실패 (로컬 서버 확인 필요)");
    }
    setSaveLoading(false);
  };

  const loadSession = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/sessions/${id}`);
      const data = await res.json();
      setSeedIdea(data.seedIdea);
      setChat(data.chat);
      setCurrentStage(data.currentStage);
      setWebNodes(data.webNodes);
      setActiveNodeIdx(data.activeNodeIdx);
      setSessionId(data.id);
      setPhase("active");
    } catch (e) {
      alert("세션 불러오기 실패");
    }
    setLoading(false);
  };

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3001/api/sessions");
      const list = await res.json();
      setSessionList(list.sort((a:any, b:any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (phase === "intro") refreshSessions();
  }, [phase, refreshSessions]);

  const submitAnswer = async () => {
    if (!currentAnswer.trim() || selectedQ === null) return;
    let question = "";
    if (selectedQ === "final") {
      const consolidation = chat.filter(c => c.role === "ai-consolidation" && c.stageId === stage.id).at(-1);
      question = consolidation?.content?.finalQuestion || "";
    } else {
      const lastQ = chat.filter(c=>c.role==="ai-questions"&&c.stageId===stage.id).at(-1);
      question = lastQ?.content?.questions?.[selectedQ] || "";
    }
    
    const answer = currentAnswer.trim();
    setChat(prev => [...prev, { role:"user-answer", stageId:stage.id, question, content:answer }]);
    setCurrentAnswer(""); setSelectedQ(null);
    const node = buildNode(currentStage);
    setWebNodes(prev => { const n=[...prev,node]; setActiveNodeIdx(n.length-1); return n; });
    await fetchReply(question, answer, stage.id);
  };

  const nextStage = async () => {
    // Check if we already have a consolidation for the current stage
    const hasConsolidation = chat.some(c => c.role === "ai-consolidation" && c.stageId === stage.id);
    const answersInStage = chat.filter(c => c.role === "user-answer" && c.stageId === stage.id).length;

    if (!hasConsolidation && answersInStage > 0) {
      // First, get the final synthesis/deepening question
      await fetchConsolidation(currentStage, chat);
      return;
    }

    const next = currentStage + 1;
    if (next >= STAGES.length) { setPhase("complete"); return; }
    setCurrentStage(next); setSelectedQ(null);
    await fetchQuestions(next, chat);
  };

  const jumpToStage = async (idx: number) => {
    setCurrentStage(idx); setSelectedQ(null);
    const hasQ = chat.some(c=>c.role==="ai-questions"&&c.stageId===STAGES[idx].id);
    if (!hasQ) await fetchQuestions(idx, chat);
  };

  const jumpToNode = (nodeIdx: number) => {
    const node = webNodes[nodeIdx]; if (!node) return;
    setActiveNodeIdx(nodeIdx); jumpToStage(node.stageIdx);
  };

  const currentQBlock = chat.filter(c=>c.role==="ai-questions"&&c.stageId===stage.id).at(-1);
  const questions = currentQBlock?.content?.questions || [];
  const insight = currentQBlock?.content?.insight || "";
  console.log("Current Page Insight:", insight); // Use to avoid lint warning
  const totalAnswers = chat.filter(c=>c.role==="user-answer").length;

  return (
    <div style={{ height:"100vh", overflow:"hidden", background:"#090910", color:"#e8e0d0", fontFamily:"'Nanum Myeongjo',Georgia,serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:2px}
        textarea{resize:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        .stbtn:hover{background:rgba(255,255,255,0.03)!important}
        .qopt:hover{border-color:rgba(255,255,255,0.12)!important}
      `}</style>

      {/* HEADER */}
      <header style={{ padding:"12px 22px", borderBottom:"1px solid #181828", background:"#0c0c18", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:4, color:"#f59e0b", textTransform:"uppercase", fontFamily:"JetBrains Mono,monospace" }}>思考成長循環</div>
            <div style={{ fontSize:17, fontWeight:800, color:"#f0e8d0" }}>생각 성장 엔진</div>
          </div>
          {phase==="active" && (
            <div style={{ display:"flex", gap:5 }}>
              <span style={{ fontSize:10, fontFamily:"JetBrains Mono,monospace", color:"#555", background:"#111", padding:"3px 9px", borderRadius:20 }}>{totalAnswers}개</span>
              <span style={{ fontSize:10, fontFamily:"JetBrains Mono,monospace", color:stage.color, background:"#111", padding:"3px 9px", borderRadius:20, border:`1px solid ${stage.color}33` }}>{stage.icon} {stage.name}</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {(phase==="active" || phase==="complete") && (
            <button onClick={async () => { 
                if(confirm("현재까지의 진행 상황을 저장하고 목록으로 이동할까요?")) {
                  await saveSession();
                  setPhase("intro");
                } 
              }} 
              style={{ padding:"5px 10px", borderRadius:7, border:"1px solid #1e1e2e", background:"transparent", color:"#777", fontFamily:"Nanum Myeongjo,serif", fontSize:10, cursor:"pointer", marginRight:8 }}>
              🏠 저장 후 목록으로
            </button>
          )}
          {phase==="active" && (
             <button onClick={saveSession} disabled={saveLoading} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #1e1e2e", background:saveLoading?"#1e1e2e":"#22c55e22", color:"#22c55e", fontFamily:"JetBrains Mono,monospace", fontSize:10, cursor:"pointer" }}>
               {saveLoading ? "Saving…" : (sessionId ? "💾 업데이트" : "💾 저장")}
             </button>
          )}
          <button onClick={()=>setShowSettings(s=>!s)} style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${showSettings?"#f59e0b44":"#1e1e2e"}`, background:showSettings?"#f59e0b0f":"transparent", color:"#777", fontFamily:"JetBrains Mono,monospace", fontSize:10, cursor:"pointer" }}>
            ⚙ {provider==="gemini" ? (geminiKey ? "Gemini ✓" : "Gemini !") : "Claude"}
          </button>
        </div>
      </header>

      {/* SETTINGS */}
      {showSettings && (
        <div style={{ background:"#0d0d1a", borderBottom:"1px solid #181828", padding:"14px 22px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <span style={{ fontSize:10, color:"#444", fontFamily:"JetBrains Mono,monospace" }}>AI 엔진</span>
          {[["claude","⚡ Claude (기본)"],["gemini","♊ Gemini Flash Lite"]].map(([p,label])=>(
            <button key={p} onClick={()=>setProvider(p)} style={{ padding:"5px 14px", borderRadius:7, border:`1px solid ${provider===p?"#f59e0b":"#2a2a3e"}`, background:provider===p?"#f59e0b15":"transparent", color:provider===p?"#f59e0b":"#555", fontFamily:"JetBrains Mono,monospace", fontSize:10, cursor:"pointer" }}>{label}</button>
          ))}
          {provider==="gemini" && (
            <div style={{ display:"flex", gap:7, flex:1, minWidth:260 }}>
              <input type="password" placeholder="Gemini API Key…" value={geminiKeyInput} onChange={e=>setGeminiKeyInput(e.target.value)}
                style={{ flex:1, padding:"5px 11px", borderRadius:7, border:"1px solid #2a2a3e", background:"#111827", color:"#e8e0d0", fontFamily:"JetBrains Mono,monospace", fontSize:10, outline:"none" }} />
              <button onClick={()=>{setGeminiKey(geminiKeyInput);setShowSettings(false);}} style={{ padding:"5px 12px", borderRadius:7, border:"none", background:"#4ade8022", color:"#4ade80", fontFamily:"JetBrains Mono,monospace", fontSize:10, cursor:"pointer" }}>저장</button>
            </div>
          )}
          {provider==="gemini"&&geminiKey&&<span style={{ fontSize:10, color:"#4ade80", fontFamily:"JetBrains Mono,monospace" }}>✓ 키 설정됨</span>}
          {provider==="gemini"&&!geminiKey&&<span style={{ fontSize:10, color:"#f87171", fontFamily:"JetBrains Mono,monospace" }}>! API 키 필요</span>}
        </div>
      )}

      {apiError && (
        <div style={{ background:"#f8717118", borderBottom:"1px solid #f8717133", padding:"8px 22px", fontSize:10, color:"#f87171", fontFamily:"JetBrains Mono,monospace" }}>
          ⚠ {apiError} — 기본 질문으로 대체됩니다
        </div>
      )}

      {/* INTRO */}
      {phase==="intro" && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40, maxWidth:580, margin:"0 auto", width:"100%" }}>
          <div style={{ fontSize:42, marginBottom:10 }}>💡</div>
          <h1 style={{ fontSize:24, fontWeight:800, textAlign:"center", color:"#f0e8d0", marginBottom:8 }}>씨앗 아이디어를 심으세요</h1>
          <p style={{ color:"#555", textAlign:"center", lineHeight:1.9, marginBottom:24, fontSize:13 }}>
            단순한 생각 하나에서 시작합니다.<br/>
            AI가 각 단계마다 질문하고, 당신의 답변에 <strong style={{ color:"#f59e0b" }}>즉각 반응</strong>하며<br/>
            생각 덩어리로 키워냅니다. 지칠 때까지 루프.
          </p>
          <textarea value={seedIdea} onChange={e=>setSeedIdea(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))startLoop();}}
            placeholder="예: AI가 창의성을 대체할 수 있을까? / 도시를 숲으로 만들고 싶다 / 일을 놀이처럼…"
            style={{ width:"100%", minHeight:100, background:"#111827", border:"1px solid #1e1e2e", borderRadius:10, padding:16, color:"#e8e0d0", fontSize:14, fontFamily:"Nanum Myeongjo,serif", outline:"none", lineHeight:1.7, transition:"border-color 0.2s" }}
            onFocus={e=>(e.target as HTMLTextAreaElement).style.borderColor="#f59e0b55"}
            onBlur={e=>(e.target as HTMLTextAreaElement).style.borderColor="#1e1e2e"} />
          <button onClick={startLoop} disabled={!seedIdea.trim()} style={{ marginTop:12, width:"100%", padding:"12px 0", borderRadius:9, border:"none", background:seedIdea.trim()?"linear-gradient(135deg,#f59e0b,#d97706)":"#1a1a28", color:seedIdea.trim()?"#000":"#444", fontFamily:"Nanum Myeongjo,serif", fontSize:14, fontWeight:700, cursor:seedIdea.trim()?"pointer":"not-allowed", transition:"all 0.2s" }}>
            생각 키우기 시작 →
          </button>
          <div style={{ marginTop:36, display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
            {STAGES.map(s=>(
              <span key={s.id} style={{ fontSize:10, padding:"2px 8px", borderRadius:20, border:`1px solid ${s.color}33`, color:s.color, fontFamily:"JetBrains Mono,monospace" }}>{s.icon} {s.name}</span>
            ))}
          </div>

          <div style={{ marginTop:40, width:"100%", background:"#0c0c18", border:"1px solid #181828", borderRadius:12, padding:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#444", fontFamily:"JetBrains Mono,monospace", letterSpacing:2 }}>과거의 생각들 불러오기</div>
              <button onClick={refreshSessions} style={{ background:"transparent", border:"none", color:"#555", fontSize:9, cursor:"pointer", fontFamily:"JetBrains Mono,monospace" }}>↻ 새로고침</button>
            </div>
            {sessionList.length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:10 }}>
                {sessionList.map(s => (
                  <button key={s.id} onClick={() => loadSession(s.id)} style={{ padding:12, background:"#111827", border:"1px solid #1e1e2e", borderRadius:8, textAlign:"left", cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "#f59e0b55")} onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e1e2e")}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#f59e0b", marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.summary}</div>
                    <div style={{ fontSize:9, color:"#666", marginBottom:6 }}>{s.lastStage}까지</div>
                    <div style={{ fontSize:8, color:"#3a3a4a", fontFamily:"JetBrains Mono,monospace" }}>{new Date(s.updatedAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:10, color:"#222", fontStyle:"italic", textAlign:"center", padding:"20px 0" }}>아직 저장된 생각이 없습니다. 첫 생각을 시작해 보세요!</div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVE */}
      {phase==="active" && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* Stage nav */}
          <div style={{ width:188, flexShrink:0, background:"#0c0c18", borderRight:"1px solid #181828", overflowY:"auto", padding:"10px 7px" }}>
            <div style={{ fontSize:8, letterSpacing:3, color:"#2a2a3a", textTransform:"uppercase", fontFamily:"JetBrains Mono,monospace", padding:"0 7px", marginBottom:8 }}>자유롭게 이동</div>
            {STAGES.map((s,i)=>{
              const done=chat.some(c=>c.role==="user-answer"&&c.stageId===s.id);
              const active=i===currentStage;
              return (
                <button key={s.id} className="stbtn" onClick={()=>jumpToStage(i)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"6px 8px", borderRadius:6, border:"none", background:active?`${s.color}14`:"transparent", borderLeft:active?`3px solid ${s.color}`:"3px solid transparent", cursor:"pointer", textAlign:"left", transition:"all 0.1s" }}>
                  <span style={{ fontSize:12 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize:10, fontWeight:active?700:400, color:active?s.color:done?"#777":"#3a3a4a", fontFamily:"Nanum Myeongjo,serif" }}>{s.name}{done&&<span style={{ marginLeft:3, fontSize:8, color:s.color }}>●</span>}</div>
                    <div style={{ fontSize:8, color:"#2a2a3a", fontFamily:"JetBrains Mono,monospace" }}>{s.method.slice(0,9)}…</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"9px 18px", borderBottom:"1px solid #181828", background:"#0c0c18", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
              <div style={{ width:32, height:32, borderRadius:7, background:`${stage.color}18`, border:`1px solid ${stage.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{stage.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#f0e8d0" }}>{stage.name}</div>
                <div style={{ fontSize:9, color:"#444", fontFamily:"JetBrains Mono,monospace" }}>{stage.method} · {stage.desc}</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:9, color:"#2a2a3a", fontFamily:"JetBrains Mono,monospace", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                💡 "{seedIdea.slice(0,24)}{seedIdea.length>24?"…":""}"
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"18px 20px", display:"flex", flexDirection:"column", gap:10 }}>
              {chat.map((entry, i) => {
                const s = STAGES.find(x=>x.id===entry.stageId)!;
                const isLatestQForCurrentStage = entry.role==="ai-questions" && entry.stageId===stage.id &&
                  i === chat.map((c,j)=>c.role==="ai-questions"&&c.stageId===stage.id?j:-1).filter(x=>x>=0).at(-1);

                if (entry.role==="ai-questions") {
                  const qs=entry.content?.questions||[];
                  const ins=entry.content?.insight||"";
                  return (
                    <div key={i} style={{ animation:"fadeUp 0.35s ease" }}>
                      {ins&&<div style={{ fontSize:11, color:s.color, fontStyle:"italic", marginBottom:8, padding:"7px 12px", background:`${s.color}0c`, borderRadius:7, border:`1px solid ${s.color}18` }}>✦ {ins}</div>}
                      <div style={{ fontSize:9, color:"#3a3a4a", fontFamily:"JetBrains Mono,monospace", marginBottom:6 }}>{s.icon} {s.name}</div>
                      {qs.map((q: string, qi: number)=>{
                        const isAnswered = chat.some(c => c.role === "user-answer" && c.stageId === s.id && c.question === q);
                        return (
                          <button key={qi} className="qopt" 
                            onClick={()=>{if(isLatestQForCurrentStage){setSelectedQ(qi);textareaRef.current?.focus();}}} 
                            style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 13px", marginBottom:5, borderRadius:8, border:`1px solid ${isLatestQForCurrentStage&&selectedQ===qi?s.color+"77":"#181828"}`, background:isLatestQForCurrentStage&&selectedQ===qi?`${s.color}0e`:"#0f1020", color:isLatestQForCurrentStage?(selectedQ===qi?"#e0d8c8": (isAnswered ? "#4b5563" : "#666")):"#3a3a4a", fontFamily:"Nanum Myeongjo,serif", fontSize:12, lineHeight:1.65, cursor:isLatestQForCurrentStage?"pointer":"default", transition:"all 0.1s", opacity: isAnswered ? 0.7 : 1 }}>
                            <span style={{ color:isAnswered ? "#4ade80" : s.color, marginRight:6, fontSize:9 }}>{isAnswered ? "✓" : `Q${qi+1}`}</span>
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                if (entry.role==="user-answer") return (
                  <div key={i} style={{ animation:"fadeUp 0.3s ease", alignSelf:"flex-end", maxWidth:"72%" }}>
                    <div style={{ fontSize:9, color:"#3a3a4a", fontFamily:"JetBrains Mono,monospace", marginBottom:4, textAlign:"right" }}>{s.icon} 내 생각</div>
                    <div style={{ background:`${s.color}18`, border:`1px solid ${s.color}33`, borderRadius:"10px 10px 3px 10px", padding:"10px 14px", fontSize:12, lineHeight:1.85, color:"#e0d8c8" }}>{entry.content}</div>
                  </div>
                );
                if (entry.role==="ai-reply") {
                  const r=entry.content;
                  return (
                    <div key={i} style={{ animation:"fadeUp 0.35s ease", maxWidth:"72%" }}>
                      <div style={{ fontSize:9, color:"#3a3a4a", fontFamily:"JetBrains Mono,monospace", marginBottom:4 }}>{s.icon} AI 반응</div>
                      <div style={{ background:"#0f1020", border:`1px solid ${s.color}20`, borderRadius:"3px 10px 10px 10px", padding:"10px 14px" }}>
                        <div style={{ fontSize:12, color:"#b0a898", lineHeight:1.85, marginBottom:r.followup?8:0 }}>{r.comment}</div>
                        {r.followup&&<div style={{ fontSize:11, color:s.color, borderTop:`1px solid ${s.color}20`, paddingTop:7, fontStyle:"italic" }}>→ {r.followup}</div>}
                      </div>
                    </div>
                  );
                }
                if (entry.role==="ai-consolidation") {
                  const r=entry.content;
                  const isAnswered = chat.some(c => c.role === "user-answer" && c.stageId === s.id && c.question === r.finalQuestion);
                  const isLatest = i === chat.map((c,j)=>c.role==="ai-consolidation"&&c.stageId===stage.id?j:-1).filter(x=>x>=0).at(-1);
                  return (
                    <div key={i} style={{ animation:"fadeUp 0.4s ease", padding:"16px", background:"#0f1020", border:`2px solid ${s.color}44`, borderRadius:12, marginBottom:16 }}>
                      <div style={{ fontSize:10, color:s.color, marginBottom:8, fontWeight:700 }}>✨ 단계의 마무리: {s.name}</div>
                      <div style={{ fontSize:13, color:"#e0d8c8", lineHeight:1.8, marginBottom:12 }}>{r.summary}</div>
                      <div 
                        onClick={() => { if(isLatest && !isAnswered) { setSelectedQ("final"); textareaRef.current?.focus(); } }}
                        style={{ padding:"12px", background:selectedQ === "final" ? `${s.color}15` : `${s.color}0a`, borderRadius:8, borderLeft:`4px solid ${isAnswered ? "#4ade80" : s.color}`, cursor: (isLatest && !isAnswered) ? "pointer" : "default", transition: "all 0.2s", border: selectedQ === "final" ? `1px solid ${s.color}55` : "none", borderLeftWidth:4 }}>
                        <div style={{ fontSize:9, color:isAnswered ? "#4ade80" : s.color, marginBottom:4 }}>{isAnswered ? "✓ 답변 완료" : "마지막 심화 질문 (클릭하여 답변)"}</div>
                        <div style={{ fontSize:13, color:isAnswered ? "#666" : "#f59e0b", fontWeight:700 }}>{r.finalQuestion}</div>
                      </div>
                      {!isAnswered && <div style={{ fontSize:9, color:"#444", marginTop:10 }}>위 질문을 선택하여 답변하거나, '다음 단계로' 버튼을 눌러 이동하세요.</div>}
                    </div>
                  );
                }
                return null;
              })}

              {loading && (
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  {[0,1,2].map(n=><div key={n} style={{ width:5, height:5, borderRadius:"50%", background:stage.color, animation:`blink 1.2s ${n*0.2}s infinite` }} />)}
                  <span style={{ fontSize:10, color:"#333", fontFamily:"JetBrains Mono,monospace", marginLeft:4 }}>생각하는 중…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {!loading && questions.length>0 && (
              <div style={{ padding:"12px 18px", borderTop:"1px solid #181828", background:"#0c0c18", flexShrink:0 }}>
                <div style={{ background:"#0f1020", borderRadius:10, border:`1px solid ${selectedQ!==null?stage.color+"44":"#181828"}`, padding:"10px 13px", transition:"border-color 0.2s" }}>
                  <textarea ref={textareaRef} value={currentAnswer} onChange={e=>setCurrentAnswer(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))submitAnswer();}}
                    placeholder={selectedQ!==null?"자유롭게 쏟아내세요… (Ctrl+Enter 제출)":"위 질문 하나를 먼저 선택하세요"}
                    disabled={selectedQ===null} rows={3}
                    style={{ width:"100%", background:"transparent", border:"none", outline:"none", color:"#e0d8c8", fontSize:12, fontFamily:"Nanum Myeongjo,serif", lineHeight:1.8, opacity:selectedQ===null?0.3:1 }} />
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                    <span style={{ fontSize:9, color:"#2a2a3a", fontFamily:"JetBrains Mono,monospace" }}>{currentAnswer.length}자</span>
                    <div style={{ display:"flex", gap:7 }}>
                      <button onClick={nextStage} style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${stage.color}33`, background:"transparent", color:stage.color, fontFamily:"Nanum Myeongjo,serif", fontSize:11, cursor:"pointer" }}>
                        {currentStage===11?"완성 ✨":"다음 단계로 →"}
                      </button>
                      <button onClick={submitAnswer} disabled={!currentAnswer.trim()||selectedQ===null} style={{ padding:"6px 16px", borderRadius:7, border:"none", background:currentAnswer.trim()&&selectedQ!==null?`linear-gradient(135deg,${stage.color},${stage.color}99)`:"#181828", color:currentAnswer.trim()&&selectedQ!==null?"#000":"#333", fontFamily:"Nanum Myeongjo,serif", fontSize:11, fontWeight:700, cursor:currentAnswer.trim()&&selectedQ!==null?"pointer":"not-allowed" }}>
                        답변 완료 +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thought web */}
          <div style={{ width:230, flexShrink:0, background:"#0c0c18", borderLeft:"1px solid #181828", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"9px 13px", borderBottom:"1px solid #181828", fontSize:8, letterSpacing:3, color:"#2a2a3a", textTransform:"uppercase", fontFamily:"JetBrains Mono,monospace" }}>
              생각 웹 — 클릭 이동
            </div>
            <ThoughtWeb nodes={webNodes} onNodeClick={jumpToNode} activeIdx={activeNodeIdx} />
            <div style={{ padding:"10px 13px", borderTop:"1px solid #181828", maxHeight:130, overflowY:"auto" }}>
              {chat.filter(c=>c.role==="user-answer").slice(-5).map((c,i)=>{
                const s = STAGES.find(x=>x.id===c.stageId)!;
                return (
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:8, color:s.color, fontFamily:"JetBrains Mono,monospace", marginBottom:2 }}>{s.icon} {s.name}</div>
                    <div style={{ fontSize:9, color:"#555", lineHeight:1.5 }}>{c.content.slice(0,45)}{c.content.length>45?"…":""}</div>
                  </div>
                );
              })}
              {totalAnswers===0&&<div style={{ fontSize:9, color:"#222", fontFamily:"JetBrains Mono,monospace" }}>아직 비어있음</div>}
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE */}
      {phase==="complete" && (
        <div style={{ flex:1, overflowY:"auto", padding:"36px 22px", maxWidth:700, margin:"0 auto", width:"100%" }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ fontSize:38, marginBottom:6 }}>✨</div>
            <h1 style={{ fontSize:22, fontWeight:800, color:"#f0e8d0", marginBottom:5 }}>생각 덩어리 완성</h1>
            <div style={{ fontSize:13, color:"#f59e0b" }}>"{seedIdea}"</div>
            <div style={{ fontSize:10, color:"#333", fontFamily:"JetBrains Mono,monospace", marginTop:5 }}>{totalAnswers}개 생각 · {STAGES.filter(s=>chat.some(c=>c.role==="user-answer"&&c.stageId===s.id)).length}개 단계</div>
          </div>
          {STAGES.map(s=>{
            const answers=chat.filter(c=>c.role==="user-answer"&&c.stageId===s.id);
            if(!answers.length) return null;
            return (
              <div key={s.id} style={{ marginBottom:18, background:"#0f1020", borderRadius:10, overflow:"hidden", animation:"fadeUp 0.5s ease" }}>
                <div style={{ padding:"9px 16px", background:`${s.color}0e`, borderBottom:`1px solid ${s.color}18`, display:"flex", gap:9, alignItems:"center" }}>
                  <span>{s.icon}</span>
                  <span style={{ fontWeight:700, color:s.color, fontSize:12 }}>{s.name}</span>
                  <span style={{ fontSize:9, color:"#333", fontFamily:"JetBrains Mono,monospace" }}>{s.method}</span>
                </div>
                {answers.map((a,i)=>(
                  <div key={i} style={{ padding:"11px 16px", borderBottom:i<answers.length-1?"1px solid #181828":"none" }}>
                    <div style={{ fontSize:10, color:"#3a3a4a", marginBottom:4 }}>{a.question}</div>
                    <div style={{ fontSize:12, color:"#c8c0b0", lineHeight:1.8 }}><span style={{ color:s.color }}>→ </span>{a.content}</div>
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ display:"flex", gap:9, justifyContent:"center", marginTop:14, paddingBottom:36 }}>
            <button onClick={()=>{setPhase("intro");setSeedIdea("");setChat([]);setWebNodes([]);}} style={{ padding:"9px 22px", borderRadius:8, border:"1px solid #2a2a3e", background:"transparent", color:"#555", fontFamily:"Nanum Myeongjo,serif", fontSize:12, cursor:"pointer" }}>새 아이디어</button>
            <button onClick={()=>{setPhase("active");setPhase("active");setCurrentStage(0);setSelectedQ(null);fetchQuestions(0,chat);}} style={{ padding:"9px 22px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#000", fontFamily:"Nanum Myeongjo,serif", fontSize:12, fontWeight:700, cursor:"pointer" }}>루프 다시 돌기 ↺</button>
          </div>
        </div>
      )}
    </div>
  );
}
