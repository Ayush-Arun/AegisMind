import * as React from "react";
import { Chat } from "@/components/Chat";
import {
  MessageSquare,
  PanelLeft,
  Sun,
  Moon,
  Scale,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";
import {
  getAllConversations,
  clearThread,
  subscribeToStore,
  type ConvThread,
} from "@/lib/conversationStore";
import { format12HrDateTime } from "@/lib/utils";

export function App() {
  const [isDockExpanded, setIsDockExpanded] = React.useState(true);
  const [currentTenantId] = React.useState("corp-default");
  const [currentUserId] = React.useState("alice");
  const [chatKey, setChatKey] = React.useState<number>(Date.now());
  const [initialChatQuery, setInitialChatQuery] = React.useState<string | undefined>(undefined);
  const [conversations, setConversations] = React.useState<ConvThread[]>(() => getAllConversations());

  // Dark Mode State - Default to true
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(() => {
    const saved = localStorage.getItem("aegismind-theme");
    return saved ? saved === "dark" : true;
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("aegismind-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("aegismind-theme", "light");
    }
  }, [isDarkMode]);

  React.useEffect(() => {
    setConversations(getAllConversations());
    const unsubscribe = subscribeToStore(() => {
      setConversations(getAllConversations());
    });
    return unsubscribe;
  }, []);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const startNewChat = () => {
    setInitialChatQuery(undefined);
    setChatKey(Date.now());
  };

  const handleSelectConversation = (conv: ConvThread) => {
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

  // Keyboard shortcut to toggle docker menu (Cmd+B / Ctrl+B)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsDockExpanded((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className={`relative min-h-screen h-screen w-full overflow-hidden font-sans flex flex-col transition-colors duration-200 ${
        isDarkMode ? "dark bg-[#0e111a] text-white" : "bg-[#f6f8fb] text-slate-900"
      }`}
    >
      {/* ── Background Theme Gradient ── */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none transition-colors duration-200 ${
          isDarkMode
            ? "bg-gradient-to-b from-[#0e111a]/80 via-[#101422]/60 to-[#0e111a]/95"
            : "bg-gradient-to-b from-white/90 via-slate-50/60 to-white/90"
        }`}
      />

      {/* ─── Clean Header Section ─── */}
      <header
        className={`sticky top-0 z-40 h-14 border-b transition-colors duration-200 shrink-0 shadow-xs ${
          isDarkMode
            ? "border-white/10 bg-[#121622]/90 backdrop-blur-xl text-white"
            : "border-slate-200 bg-white/95 backdrop-blur-xl text-slate-900"
        }`}
      >
        <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          {/* Left: Docker Toggle + Minimalist Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsDockExpanded((prev) => !prev)}
              aria-label="Toggle sidebar"
              className={`h-9 px-2.5 rounded-lg flex items-center gap-1.5 transition-all border shadow-xs ${
                isDockExpanded
                  ? "bg-primary text-white border-primary shadow-primary/20"
                  : isDarkMode
                  ? "text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border-white/10"
                  : "text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-200"
              }`}
              title="Toggle Sidebar (Ctrl+B)"
            >
              <PanelLeft className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline-block">Menu</span>
            </button>

            <div className="flex items-center gap-2 select-none">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary">
                <Scale className="h-4.5 w-4.5" />
              </div>
              <span className="text-base font-bold tracking-tight">Legal AI</span>
            </div>
          </div>

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors border ${
                isDarkMode
                  ? "border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                  : "border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Body Layout ─── */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">
        {/* Left Sidebar: New Chat & Chat History */}
        <aside
          className={`shrink-0 transition-all duration-200 border-r flex flex-col z-30 ${
            isDockExpanded ? "w-64 sm:w-72" : "w-0 overflow-hidden border-none"
          } ${
            isDarkMode
              ? "bg-[#141826]/95 backdrop-blur-2xl border-white/10 text-white"
              : "bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-900"
          }`}
        >
          {/* New Chat Button */}
          <div className="p-3 border-b border-border/50">
            <button
              type="button"
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-xs shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* History Header */}
          <div className="px-3 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Chat History</span>
            </div>
            <span className="text-[10px] font-mono opacity-70">
              {conversations.length}
            </span>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No conversations yet. Start a new chat!
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.threadId}
                  onClick={() => handleSelectConversation(conv)}
                  className={`group flex items-center justify-between gap-2 p-2 rounded-lg text-xs cursor-pointer transition-all ${
                    isDarkMode
                      ? "hover:bg-white/8 text-white/80 hover:text-white"
                      : "hover:bg-slate-100 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary opacity-70 group-hover:opacity-100" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{conv.label || "Untitled Case"}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {format12HrDateTime(conv.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(e, conv.threadId)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/15 hover:text-rose-500 transition-all shrink-0"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ─── Main Content Canvas: Pure AI Chat ─── */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Chat
            key={chatKey}
            currentTenantId={currentTenantId}
            currentUserId={currentUserId}
            initialQuery={initialChatQuery}
            onClearInitialQuery={() => setInitialChatQuery(undefined)}
          />
        </main>
      </div>
    </div>
  );
}
