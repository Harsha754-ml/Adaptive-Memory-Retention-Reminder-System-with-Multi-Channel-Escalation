import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Activity, Brain, Server, RefreshCw, Layers, ShieldCheck, Zap, AlertTriangle, Terminal, Upload, Link, Type, Send, CheckCircle2, X as CloseIcon, Clock, Sparkles, User, Database, Globe, Cpu } from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws";

// HUMANLY HELPER COMPONENTS
const StatusCard = ({ label, value, icon, sub, urgency }) => (
  <div className={`bg-[#0f0f11] rounded-[2.5rem] p-8 border border-white/5 relative group hover:border-[#c5a059]/20 transition-all shadow-xl overflow-hidden`}>
     {urgency === 'critical' && <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-[40px] -mr-12 -mt-12" />}
     <div className="flex justify-between items-start mb-6">
        <div className="p-4 bg-white/[0.03] rounded-2xl group-hover:scale-110 transition-transform">
           {icon}
        </div>
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mt-2">{label}</span>
     </div>
     <div className="space-y-1">
        <p className={`text-4xl font-black tracking-tighter ${urgency === 'critical' ? 'text-rose-400' : 'text-[#f4f1ea]'}`}>{value}</p>
        <p className="text-[10px] font-serif italic text-slate-500">{sub}</p>
     </div>
  </div>
);

// HUMANLY MOCK DATA - THE "NEURAL SIMULATION" LAYER
const MOCK_FLASHCARDS = [
  { 
    id: "m1", topic_name: "Philosophy: Stocism", urgency_level: "safe", retention_score: 94, stability: 120, next_reminder_minutes: 480,
    question: "What is the 'Dichotomy of Control' as defined by Epictetus?",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 90 + Math.random() * 10 }))
  },
  { 
    id: "m2", topic_name: "Quantum Mechanics", urgency_level: "critical", retention_score: 38, stability: 12, next_reminder_minutes: 15,
    question: "Define the Heisenberg Uncertainty Principle in terms of position and momentum.",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 80 - (i * 12) }))
  },
  { 
    id: "m3", topic_name: "React: Performance", urgency_level: "warning", retention_score: 72, stability: 45, next_reminder_minutes: 120,
    question: "When should useMemo be favored over simple memoization?",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 95 - (i * 5) }))
  },
  { 
    id: "m4", topic_name: "Growth Strategy", urgency_level: "danger", retention_score: 55, stability: 24, next_reminder_minutes: 30,
    question: "Explain the AARRR (Pirate Metrics) framework for SaaS.",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 70 - (i * 8) }))
  },
  { 
    id: "m5", topic_name: "Neuroscience", urgency_level: "safe", retention_score: 88, stability: 96, next_reminder_minutes: 720,
    question: "What role does the hippocampus play in memory consolidation?",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 85 + Math.random() * 5 }))
  },
  { 
    id: "m6", topic_name: "Microservices", urgency_level: "warning", retention_score: 65, stability: 36, next_reminder_minutes: 90,
    question: "What is the Saga Pattern used for in distributed systems?",
    curve_points: Array.from({length: 10}, (_, i) => ({ day: i, score: 88 - (i * 6) }))
  }
];

const MOCK_TREND = [
  { day: 'Mon', load: 45, retention: 82 },
  { day: 'Tue', load: 52, retention: 85 },
  { day: 'Wed', load: 68, retention: 79 },
  { day: 'Thu', load: 75, retention: 74 },
  { day: 'Fri', load: 88, retention: 81 },
  { day: 'Sat', load: 92, retention: 88 },
  { day: 'Sun', load: 95, retention: 91 },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

function App() {
  const [data, setData] = useState({
    flashcards: [],
    events: [],
    dashboard: { total_cards: 0, critical_cards: 0, warning_cards: 0, active_plans: 0, demo_mode: false }
  });
  const [isConnected, setIsConnected] = useState(false);
  const [ingestType, setIngestType] = useState('text');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  
  // UI Form States
  const [topicName, setTopicName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let ws;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setIsConnected(true);
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
          setSimulationMode(parsed.flashcards.length === 0);
        } catch(e) {}
      };
      ws.onclose = () => {
        setIsConnected(false);
        setSimulationMode(true); // Default to simulation if server is down
        setTimeout(connect, 3000);
      };
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  // Determine which data to show
  const getPlanForTopic = (topicId) => {
     return (data.learning_plans || []).find(p => p.topic_id === topicId);
  };

  const playAudioSummary = (text) => {
     if (!text) return;
     const utter = new SpeechSynthesisUtterance(text);
     utter.rate = 0.9;
     utter.pitch = 1.0;
     window.speechSynthesis.speak(utter);
  };

  const activeCards = useMemo(() => {
    return simulationMode || data.flashcards.length === 0 ? MOCK_FLASHCARDS : data.flashcards;
  }, [simulationMode, data.flashcards]);

  const activeEvents = useMemo(() => {
    if (data.events.length > 0) return data.events;
    return [
      { text: "Neural Link Initialized", timestamp: Date.now()/1000 - 3600 },
      { text: "Cognitive Load Balancing...", timestamp: Date.now()/1000 - 1800 },
      { text: "Heuristic Search Optimized", timestamp: Date.now()/1000 - 600 }
    ];
  }, [data.events]);

  const stats = useMemo(() => {
    if (simulationMode) {
      return { total: 124, safe: 88, critical: 12 };
    }
    return { total: data.dashboard.total_cards, safe: data.dashboard.safe_cards, critical: data.dashboard.critical_cards };
  }, [simulationMode, data.dashboard]);

  const handleIngest = async (e) => {
    e.preventDefault();
    
    // Validation with User Feedback
    if (!topicName.trim()) {
      return alert("⚠️ Identification Required: Please enter a name for this Knowledge Cluster (Topic Name).");
    }
    
    if (ingestType === 'text' && !textContent.trim()) {
      return alert("⚠️ Content Empty: Please paste the text you wish to analyze.");
    }
    
    if (ingestType === 'youtube' && !youtubeUrl.trim()) {
      return alert("⚠️ URL Missing: Please provide a valid YouTube link.");
    }
    
    if (ingestType === 'file' && (!fileInputRef.current?.files || fileInputRef.current.files.length === 0)) {
      return alert("⚠️ File Missing: Please select a .pdf or .txt document to transmit.");
    }

    setIngestLoading(true);
    setIngestSuccess(false);

    try {
      let endpoint = ingestType === 'text' ? '/ingest/text' : ingestType === 'youtube' ? '/ingest/youtube' : '/ingest/file';
      let body;
      let headers = {};

      if (ingestType === 'file') {
        body = new FormData();
        body.append('topic_name', topicName);
        body.append('file', fileInputRef.current.files[0]);
        // Note: fetch automatically sets multipart/form-data boundary
      } else {
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ 
          topic_name: topicName, 
          [ingestType === 'text' ? 'text' : 'url']: ingestType === 'text' ? textContent : youtubeUrl 
        });
      }

      console.log(`Transmitting to ${API_BASE}${endpoint}...`);
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: headers,
        body: body
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log("Ingestion successful:", responseData);
        setIngestSuccess(true);
        // Clear inputs on success
        setTopicName('');
        setTextContent('');
        setYoutubeUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        // Disable simulation once real data is present
        setSimulationMode(false);
        
        setTimeout(() => setIngestSuccess(false), 5000);
      } else {
        console.error("Server Error:", responseData);
        alert(`❌ Neural Link Failure: ${responseData.detail || "The backend rejected the transmission."}`);
      }
    } catch (err) {
      console.error("Network Exception:", err);
      alert(`❌ Connection Timeout: Could not reach the MemoryForge server at ${API_BASE}. Ensure "uvicorn main:app" is running on your laptop.`);
    } finally {
      setIngestLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0b] text-[#f4f1ea] font-sans selection:bg-[#c5a059]/30">
      
      {/* SIDEBAR - NEURAL ARCHITECTURE */}
      <aside className="w-80 h-full flex flex-col bg-[#0f0f11] border-r border-white/5 z-20 shadow-[10px_0_30px_rgba(0,0,0,0.8)] glass-morphism">
        <div className="p-8 pb-4">
           <div className="flex items-center gap-4 mb-8 group cursor-pointer" onClick={() => setSimulationMode(!simulationMode)}>
              <div className="w-11 h-11 bg-[#c5a059] rounded-xl shadow-[0_0_25px_rgba(197,160,89,0.3)] flex items-center justify-center border border-white/5 group-hover:rotate-6 transition-transform">
                 <Brain className="w-6 h-6 text-black" />
              </div>
              <div>
                 <h1 className="text-2xl font-bold font-serif text-[#c5a059] tracking-tight">MemoryForge</h1>
                 <p className="text-[10px] font-black tracking-[0.3em] text-[#8da290] uppercase">Human_Synapse v2</p>
              </div>
           </div>

           <div className={`p-5 rounded-[2rem] border transition-all duration-700 mb-8 ${isConnected ? 'bg-[#8da290]/5 border-[#8da290]/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
              <div className="flex items-center justify-between mb-2">
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Synaptic Relay</span>
                 <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#8da290] shadow-[0_0_10px_#8da290]' : 'bg-rose-500 animate-pulse'}`} />
              </div>
              <p className={`text-xs font-serif italic tracking-wide ${isConnected ? 'text-[#8da290]' : 'text-rose-400'}`}>
                 {isConnected ? 'Relay Established' : 'Link Connection Pending'}
              </p>
           </div>
        </div>

        <div className="px-8 flex items-center gap-2 mb-4 group cursor-default">
           <Activity className="w-3 h-3 text-[#c5a059] group-hover:scale-110 transition-transform" />
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Synaptic Activity</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-8 custom-scrollbar mb-8">
           {activeEvents.map((evt, i) => (
             <div key={i} className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-1 h-1 bg-[#c5a059]/50 rounded-full shadow-[0_0_5px_#c5a059]" />
                <div className="absolute left-[1.5px] top-4 bottom-[-2.5rem] w-[1px] bg-white/5" />
                <p className="text-xs font-medium text-slate-400 leading-relaxed">{evt.text}</p>
                <time className="text-[9px] font-mono text-slate-600 uppercase mt-1 block">T-{Math.floor((Date.now()/1000 - evt.timestamp)/60)}M AGO</time>
             </div>
           ))}
        </div>

        <div className="p-8 bg-[#0a0c10] border-t border-white/5">
           <div className="flex items-center gap-3 text-slate-600 mb-4 opacity-50">
              <User className="w-4 h-4" />
              <span className="text-[10px] font-black tracking-widest uppercase">Operator: Harsha</span>
           </div>
           <p className="text-[10px] font-mono text-slate-700">NODE_UUID: MF-8000-WIN</p>
        </div>
      </aside>

      {/* MAIN VIEWPORT - HUMANLY & CLASSIC */}
      <main className="flex-1 h-full overflow-y-auto bg-[#0a0a0b] relative custom-scrollbar scroll-smooth">
        {/* ATMOSPHERIC LAYER */}
        <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-[#c5a059]/[0.02] rounded-full blur-[180px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#8da290]/[0.02] rounded-full blur-[140px] pointer-events-none" />

        <div className="p-10 lg:p-20 relative z-10">
           
           {/* HEADER SECTION */}
           <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-10 mb-12 gap-10">
              <div className="space-y-4">
                 <div className="flex items-center gap-3 text-[#c5a059]">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Cognitive Pulse</span>
                 </div>
                 <h2 className="text-7xl font-black text-[#f4f1ea] font-serif tracking-tighter leading-none">The Knowledge <br/><span className="text-[#8da290] italic">Canvas.</span></h2>
              </div>
              
              <div className="flex items-center gap-10">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">Memory Stability</span>
                    <span className="text-6xl font-black text-[#f4f1ea] tracking-tighter">84.2 <span className="text-xl text-[#8da290] ml-1">%</span></span>
                 </div>
                 <div className="w-48 h-20 bg-[#0f0f11] rounded-3xl border border-white/5 overflow-hidden shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={MOCK_TREND}>
                          <Area type="monotone" dataKey="load" stroke="#c5a059" strokeWidth={2} fill="#c5a059" fillOpacity={0.05} animationDuration={2500} />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </header>

           {/* STATUS CARDS */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
              <StatusCard 
                 label="Active Nodes" 
                 value={data.dashboard?.total_cards || 0} 
                 icon={<Layers className="text-[#c5a059]" />} 
                 sub="Total clusters in sync"
              />
              <StatusCard 
                 label="Critical Decay" 
                 value={data.dashboard?.critical_cards || 0} 
                 icon={<AlertTriangle className="text-rose-400" />} 
                 sub="Nodes requiring recall"
                 urgency="critical"
              />
              <StatusCard 
                 label="System Flow" 
                 value="Optimal" 
                 icon={<Zap className="text-[#8da290]" />} 
                 sub="Synaptic throughput"
              />
              <StatusCard 
                 label="Neural Link" 
                 value="Verified" 
                 icon={<ShieldCheck className="text-[#c5a059]" />} 
                 sub="Connection integrity"
              />
           </div>

           {/* PRIMARY ANALYTICS GRID */}
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 mb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
              
              {/* LARGE TREND CHART */}
              <div className="col-span-1 xl:col-span-2 bg-[#0a0a0b] rounded-[3.5rem] p-12 border border-white/5 relative group hover:shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all overflow-hidden">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-[#c5a059]/5 rounded-full blur-[100px] -mr-40 -mt-40" />
                 <div className="relative z-10">
                    <div className="flex items-center justify-between mb-12">
                       <h3 className="text-2xl font-black text-[#f4f1ea] font-serif flex items-center gap-5">
                          <Activity className="w-7 h-7 text-[#c5a059]" /> Synaptic Stability Trend
                       </h3>
                       <div className="flex gap-6">
                          <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-[#c5a059]" />
                             <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Load</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-[#8da290]" />
                             <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Score</span>
                          </div>
                       </div>
                    </div>
                    <div className="h-72 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={MOCK_TREND}>
                             <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                             <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} dy={15} />
                             <YAxis hide />
                             <Tooltip 
                                contentStyle={{ backgroundColor: '#0f0f11', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '15px' }}
                                itemStyle={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 900, color: '#f4f1ea' }}
                             />
                             <Line type="monotone" dataKey="load" stroke="#c5a059" strokeWidth={5} dot={{r: 6, fill: '#c5a059', strokeWidth: 3, stroke: '#0a0a0b'}} animationDuration={2500} />
                             <Line type="monotone" dataKey="retention" stroke="#8da290" strokeWidth={5} dot={{r: 6, fill: '#8da290', strokeWidth: 3, stroke: '#0a0a0b'}} animationDuration={3000} />
                          </LineChart>
                       </ResponsiveContainer>
                    </div>
                 </div>
              </div>

              {/* RETENTION METRICS PANEL */}
              <div className="bg-gradient-to-br from-[#1a1a1c] to-[#0f0f11] rounded-[3.5rem] p-12 border border-white/5 shadow-2xl flex flex-col justify-between group overflow-hidden relative">
                 <div className="absolute top-[-50px] left-[-50px] w-80 h-80 bg-[#c5a059]/5 rounded-full blur-[80px]" />
                 <div className="relative z-10 space-y-12">
                    <div>
                       <h3 className="text-[#c5a059]/60 font-black uppercase tracking-[0.3em] text-[10px] mb-3">System Integrity</h3>
                       <p className="text-8xl font-black text-[#f4f1ea] font-serif tracking-tighter leading-none">{data.dashboard?.total_cards || 0}</p>
                       <p className="text-[#8da290]/50 text-sm font-medium mt-4 tracking-wide font-serif italic">Verified synaptic clusters active</p>
                    </div>
                    
                    <div className="space-y-6">
                       <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex justify-between items-center group-hover:bg-white/[0.04] transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-2xl bg-[#8da290]/10 flex items-center justify-center border border-[#8da290]/20">
                                <ShieldCheck className="w-5 h-5 text-[#8da290]" />
                             </div>
                             <span className="text-xs font-black text-[#f4f1ea] uppercase tracking-widest">Stable</span>
                          </div>
                          <span className="text-2xl font-black text-[#8da290] tracking-tighter">82</span>
                       </div>
                       
                       <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex justify-between items-center group-hover:bg-white/[0.04] transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                                <Zap className="w-5 h-5 text-rose-400" />
                             </div>
                             <span className="text-xs font-black text-[#f4f1ea] uppercase tracking-widest">Decaying</span>
                          </div>
                          <span className="text-2xl font-black text-rose-400 tracking-tighter">04</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
           {/* NEURAL INGEST - THE ARCHIVE LINK */}
           <section className="mb-24 scroll-mt-20" id="ingest">
              <div className="bg-[#0f0f11] rounded-[3.5rem] p-1.5 border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-96 h-96 bg-[#c5a059]/5 rounded-full blur-[100px] -mr-48 -mt-48" />
                 
                 <div className="bg-[#0a0a0b] rounded-[3.3rem] p-12 lg:p-16 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                       <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-[#c5a059] rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_40px_rgba(197,160,89,0.2)]">
                             <Database className="w-10 h-10 text-black" />
                          </div>
                          <div>
                             <h3 className="text-4xl font-black text-[#f4f1ea] font-serif tracking-tight">Synaptic Ingestion</h3>
                             <p className="text-[#8da290] font-serif italic text-lg mt-1">Transcribe your world into the architecture of memory.</p>
                          </div>
                       </div>
                    </div>

                    <form onSubmit={handleIngest} className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                       <div className="space-y-12">
                          <div className="space-y-4">
                             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Context Cluster</label>
                             <input 
                                type="text" 
                                value={topicName}
                                onChange={(e) => setTopicName(e.target.value)}
                                placeholder="Identify your knowledge area..."
                                className="w-full bg-[#0f0f11] border border-white/5 rounded-[2.5rem] px-10 py-6 text-xl text-[#f4f1ea] placeholder-slate-700 focus:border-[#c5a059]/30 outline-none transition-all shadow-inner font-serif"
                             />
                          </div>

                          <div className="flex flex-wrap gap-4 p-2 bg-[#0f0f11] rounded-[2.5rem] border border-white/5 w-fit">
                             {[
                                { id: 'text', icon: Type, label: 'Textual' },
                                { id: 'file', icon: Upload, label: 'Document' },
                                { id: 'youtube', icon: Globe, label: 'Visual' }
                             ].map((type) => (
                                <button 
                                   key={type.id}
                                   type="button"
                                   onClick={() => setIngestType(type.id)}
                                   className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] text-xs font-black tracking-widest transition-all ${ingestType === type.id ? 'bg-[#c5a059] text-black shadow-2xl shadow-[#c5a059]/20 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                   <type.icon className="w-4 h-4" />
                                   {type.label.toUpperCase()}
                                </button>
                             ))}
                          </div>
                       </div>

                       <div className="space-y-8">
                           <div className="h-[300px] bg-[#0f0f11] border border-white/5 rounded-[3rem] p-10 relative overflow-hidden group focus-within:border-[#c5a059]/20 transition-all shadow-inner">
                              {ingestType === 'text' && (
                                 <textarea 
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="Pour your insights here..."
                                    className="w-full h-full bg-transparent border-none outline-none text-[#f4f1ea] resize-none placeholder-slate-700 font-serif text-lg leading-relaxed custom-scrollbar italic"
                                 />
                              )}
                              {ingestType === 'youtube' && (
                                 <div className="h-full flex flex-col justify-center gap-8">
                                    <div className="relative">
                                       <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 w-5 h-5" />
                                       <input 
                                          type="text" 
                                          value={youtubeUrl}
                                          onChange={(e) => setYoutubeUrl(e.target.value)}
                                          placeholder="https://youtube.com/watch?v=..."
                                          className="w-full bg-[#0a0a0b] border border-white/5 rounded-3xl pl-16 pr-8 py-5 text-[#f4f1ea] font-mono text-sm focus:border-red-500/20 outline-none transition-all"
                                       />
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed font-serif italic px-2">The system will distill visual stream data into structured neural nodes.</p>
                                 </div>
                              )}
                              {ingestType === 'file' && (
                                 <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-full flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[2.5rem] hover:border-[#c5a059]/30 hover:bg-white/[0.01] cursor-pointer transition-all gap-6"
                                 >
                                    <input type="file" hidden ref={fileInputRef} accept=".pdf,.txt" />
                                    <div className="p-8 bg-[#c5a059]/10 rounded-full border border-[#c5a059]/20 group-hover:scale-110 transition-transform shadow-2xl">
                                       <Upload className="w-10 h-10 text-[#c5a059]" />
                                    </div>
                                    <div className="text-center">
                                       <p className="text-[#f4f1ea] font-black text-sm tracking-widest uppercase">Select Source Document</p>
                                       <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mt-3 font-mono">Payload Limit: 10MB</p>
                                    </div>
                                 </div>
                              )}
                           </div>
                           
                           <button 
                             disabled={ingestLoading || !topicName}
                             className={`w-full flex items-center justify-center gap-6 px-12 py-7 rounded-[3rem] font-black text-xl tracking-[0.2em] transition-all ${ingestLoading ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : 'bg-[#c5a059] text-black hover:bg-[#d8b577] hover:shadow-[0_25px_50px_rgba(197,160,89,0.3)] hover:-translate-y-1 active:scale-95'}`}
                           >
                             {ingestLoading ? (
                                <RefreshCw className="w-7 h-7 animate-spin" />
                             ) : (
                                <>
                                   INITIATE LINK
                                   <Send className="w-7 h-7" />
                                </>
                             )}
                           </button>
                       </div>
                    </form>
                 </div>
              </div>
           </section>

           {/* KNOWLEDGE CLUSTERS */}
           <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-16">
              {activeCards.map((fc) => (
                <div key={fc.id} className="relative group">
                   <div className="absolute inset-0 bg-[#c5a059]/0 group-hover:bg-[#c5a059]/[0.02] rounded-[4rem] transition-all duration-700 -m-8 z-0" />
                   
                   <div className="relative bg-[#0f0f11] rounded-[4rem] p-12 border border-white/5 shadow-2xl hover:border-[#c5a059]/20 transition-all duration-700 flex flex-col min-h-[600px] group-hover:-translate-y-3 z-10 overflow-hidden">
                      {/* CARD BACKGROUND ART */}
                      <div className="absolute top-0 right-0 w-40 h-40 bg-[#c5a059]/5 rounded-full blur-[80px] -mr-20 -mt-20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex justify-between items-start mb-12 relative z-10">
                         <div className="flex-1 min-w-0">
                            <h3 className="text-3xl font-black text-[#f4f1ea] font-serif hover:text-[#c5a059] transition-colors duration-500 leading-tight pr-6">{fc.topic_name}</h3>
                            <div className="flex items-center gap-4 mt-5">
                                <Clock className="w-4 h-4 text-[#8da290]" />
                                <span className="text-[10px] font-black text-[#8da290] uppercase tracking-[0.2em]">
                                   Next Synchrony: {fc.next_reminder_minutes}m
                                </span>
                            </div>
                         </div>
                         <div className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] border shadow-2xl backdrop-blur-md ${
                            fc.urgency_level === 'critical' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                            fc.urgency_level === 'danger' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                            'bg-[#8da290]/10 text-[#8da290] border-[#8da290]/20'
                         }`}>
                            {fc.urgency_level}
                         </div>
                      </div>
                      
                      <p className="text-slate-400 text-xl leading-relaxed mb-12 font-serif italic opacity-70 group-hover:opacity-100 transition-opacity flex-1 line-clamp-5">
                         "{fc.question}"
                      </p>

                      {/* CHRONOS PLAN PROGRESS */}
                      <div className="mb-12 bg-[#0a0a0b] rounded-3xl p-6 border border-white/5">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Chronos Plan</span>
                            <span className="text-[9px] font-bold text-[#c5a059] uppercase tracking-widest">Active</span>
                         </div>
                         <div className="flex gap-3">
                            <div className="flex-1 h-1.5 bg-[#8da290] rounded-full shadow-[0_0_10px_#8da290]" title="Audio Summary - Complete" />
                            <div className="flex-1 h-1.5 bg-[#8da290]/30 rounded-full overflow-hidden relative">
                               <div className="absolute inset-0 bg-[#c5a059] w-1/2 animate-pulse" />
                            </div>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full" />
                         </div>
                         <div className="flex justify-between mt-3 px-1">
                            <span className="text-[8px] font-black text-[#8da290] uppercase">Summary</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase">Recap</span>
                            <span className="text-[8px] font-black text-slate-700 uppercase">Final Quiz</span>
                         </div>
                      </div>
                      
                      <div className="pt-10 border-t border-white/5 flex flex-col gap-10 relative z-10">
                          <div className="flex justify-between items-end">
                             <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Memory Strength</span>
                                <span className={`text-6xl font-black font-serif tracking-tighter ${fc.retention_score < 50 ? 'text-rose-500' : 'text-[#8da290]'}`}>
                                   {fc.retention_score}<span className="text-lg opacity-40 ml-1">%</span>
                                </span>
                             </div>
                             <div className={`w-16 h-16 rounded-[1.5rem] bg-[#0f0f11] border-2 flex items-center justify-center transition-colors shadow-inner ${fc.retention_score < 50 ? 'border-rose-500/20' : 'border-[#8da290]/20'}`}>
                                <Activity className={`w-7 h-7 ${fc.retention_score < 50 ? 'text-rose-500 animate-pulse' : 'text-[#8da290] opacity-50'}`} />
                             </div>
                          </div>
                      </div>
                   </div>
                </div>
              ))}
           </div>
           
           {/* EMPTY STATE */}
           {activeCards.length === 0 && (
               <div className="mt-20 py-48 border-2 border-dashed border-white/5 rounded-[4.5rem] flex flex-col items-center justify-center gap-10 bg-white/[0.01] backdrop-blur-sm">
                   <div className="w-28 h-28 bg-[#0f0f11] rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl relative">
                      <div className="absolute inset-0 bg-[#c5a059]/5 rounded-full blur-[40px] animate-pulse" />
                      <Brain className="w-12 h-12 text-slate-800 relative z-10" />
                   </div>
                   <div className="text-center space-y-3">
                      <h3 className="text-4xl font-black text-[#f4f1ea] font-serif">Awaiting Synaptic Data</h3>
                      <p className="text-[#8da290] font-serif italic text-lg opacity-50">Upload a resource to begin the architecture of your memory.</p>
                   </div>
                   <button 
                      onClick={() => setSimulationMode(true)} 
                      className="px-12 py-5 bg-[#c5a059] text-black font-black uppercase text-xs tracking-[0.3em] rounded-full hover:bg-white transition-all scale-110"
                   >
                      Ignite Simulation
                   </button>
               </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;
