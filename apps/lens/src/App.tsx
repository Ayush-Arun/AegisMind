import * as React from "react";
import { Chat } from "@/components/Chat";
import {
  Plus,
  Trash2,
  Settings,
  ChevronDown,
  X,
  Shield,
} from "lucide-react";
import {
  getAllConversations,
  clearThread,
  subscribeToStore,
  type ConvThread,
} from "@/lib/conversationStore";
import { listModels, type ModelInfo } from "@/lib/api";

export function App() {
  const [currentTenantId] = React.useState("corp-default");
  const [currentUserId] = React.useState("alice");
  const [chatKey, setChatKey] = React.useState<number>(Date.now());
  const [initialChatQuery, setInitialChatQuery] = React.useState<string | undefined>(undefined);
  const [activeTitle, setActiveTitle] = React.useState<string>("Legal Consultation");
  const [conversations, setConversations] = React.useState<ConvThread[]>(() => getAllConversations());
  const [selectedModel, setSelectedModel] = React.useState<string>("qwen3.5:9b");
  const [modelInfo, setModelInfo] = React.useState<ModelInfo | null>(null);
  const [showSettings, setShowSettings] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Ensure dark mode is active per user design
    document.documentElement.classList.add("dark");
  }, []);

  React.useEffect(() => {
    setConversations(getAllConversations());
    const unsubscribe = subscribeToStore(() => {
      setConversations(getAllConversations());
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    listModels()
      .then((info) => {
        setModelInfo(info);
        if (info.active_model) {
          setSelectedModel(info.active_model);
        }
      })
      .catch(() => {});
  }, []);

  const startNewChat = () => {
    setInitialChatQuery(undefined);
    setActiveTitle("Legal Consultation");
    setChatKey(Date.now());
  };

  const handleSelectConversation = (conv: ConvThread) => {
    setActiveTitle(conv.label || "Legal Consultation");
    const firstUserMsg = conv.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      setInitialChatQuery(firstUserMsg.content);
      setChatKey(Date.now());
    }
  };

  const handleDeleteConversation = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    clearThread(threadId);
    setConversations(getAllConversations());
  };

  const formatDateDisplay = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mon = months[d.getMonth()];
      const day = d.getDate();
      let hours = d.getHours();
      const mins = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${mon} ${day} · ${hours}:${mins} ${ampm}`;
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="relative min-h-screen h-screen w-full overflow-hidden font-sans flex bg-[#0c0d12] text-white">
      {/* ─── Left Sidebar ─── */}
      <aside className="w-64 sm:w-72 shrink-0 border-r border-[#1e1f26] bg-[#0e0f14] flex flex-col z-20">
        {/* New Chat Button */}
        <div className="p-3.5">
          <button
            type="button"
            onClick={startNewChat}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#16171e] hover:bg-[#1f2029] border border-[#262732] text-white text-xs font-medium transition-colors shadow-xs"
          >
            <span>New chat</span>
            <Plus className="h-4 w-4 text-white/70" />
          </button>
        </div>

        {/* History Header */}
        <div className="px-4 pt-3 pb-2 text-[10px] font-semibold text-white/35 uppercase tracking-widest">
          HISTORY
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-white/30">
              No previous cases
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.threadId}
                onClick={() => handleSelectConversation(conv)}
                className="group flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer hover:bg-[#181922] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white/90 text-xs">
                    {conv.label || "Untitled Case"}
                  </p>
                  <span className="text-[10px] text-white/35 mt-0.5 block font-mono">
                    {formatDateDisplay(conv.updatedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteConversation(e, conv.threadId)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-400 text-white/40 transition-all shrink-0 mt-0.5"
                  title="Delete case history"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ─── Main Content Canvas ─── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#0c0d12]">
        {/* Top Header */}
        <header className="h-13 border-b border-[#1c1d25] px-6 flex items-center justify-between shrink-0 bg-[#0c0d12] z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-white truncate max-w-md">
              {activeTitle}
            </span>
            <span className="text-xs text-white/40 shrink-0">
              · Secure session
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Model Selector Pill */}
            <div className="relative flex items-center">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="appearance-none bg-[#16171e] hover:bg-[#1f2029] border border-[#262732] rounded-md px-3 py-1 pr-6 text-xs text-white/80 font-mono focus:outline-none cursor-pointer transition-colors"
              >
                {modelInfo?.models && modelInfo.models.length > 0 ? (
                  modelInfo.models.map((m) => (
                    <option key={m} value={m} className="bg-[#121318] text-white">
                      {m}
                    </option>
                  ))
                ) : (
                  <option value="qwen3.5:9b" className="bg-[#121318] text-white">
                    qwen3.5:9b
                  </option>
                )}
              </select>
              <ChevronDown className="h-3 w-3 text-white/40 absolute right-2 pointer-events-none" />
            </div>

            {/* Settings Gear */}
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white transition-colors"
              title="System Configuration"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Chat Component */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <Chat
            key={chatKey}
            currentTenantId={currentTenantId}
            currentUserId={currentUserId}
            initialQuery={initialChatQuery}
            selectedModel={selectedModel}
            onUpdateActiveTitle={(title) => setActiveTitle(title)}
            onClearInitialQuery={() => setInitialChatQuery(undefined)}
          />

          {/* Simple Settings Modal */}
          {showSettings && (
            <div className="absolute top-3 right-6 z-50 w-72 rounded-xl bg-[#14151c] border border-[#242530] shadow-2xl p-4 text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5 font-medium text-white">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Sovereign Session Settings
                </span>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 text-white/70 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-white/40">Inference Engine:</span>
                  <span className="font-mono text-emerald-400">Ollama (Local CPU)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Model:</span>
                  <span className="font-mono text-white">{selectedModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Jurisdiction:</span>
                  <span className="text-white">Indian Law (BNS/BNSS/BSA)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Data Privacy:</span>
                  <span className="text-emerald-400">Air-Gapped / Zero Stored Data</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
