import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Brain,
  Search,
  Trash2,
  Clock,
  MessageSquare,
  Loader2,
  Home,
  Database,
  BookOpen,
  CornerDownRight,
  Send,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import {
  getAllConversations,
  getFlatMessages,
  clearAllConversations,
  clearThread,
  subscribeToStore,
  type ConvThread,
  type FlatMessage,
} from "@/lib/conversationStore";
import { streamChat, memorySearch, type MemoryEntry } from "@/lib/api";

interface MemoryProps {
  currentUserId: string;
  currentTenantId: string;
}

type SourceFilter = "all" | "home" | "dataset" | "notes";

interface MemoryChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SOURCE_LABELS: Record<string, string> = {
  home: "Main Chat",
  dataset: "Dataset",
  notes: "Notes/Study",
};

const SOURCE_COLORS: Record<string, string> = {
  home: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  dataset: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  notes: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  home: Home,
  dataset: Database,
  notes: BookOpen,
};

export function Memory({ currentUserId, currentTenantId }: MemoryProps) {
  // All conversations from the cross-chatbox store
  const [threads, setThreads] = React.useState<ConvThread[]>([]);
  const [flatMessages, setFlatMessages] = React.useState<FlatMessage[]>([]);

  // UI filters
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Expanded thread state
  const [expandedThreads, setExpandedThreads] = React.useState<Set<string>>(new Set());

  // Long-term memory search (backend)
  const [memoryResults, setMemoryResults] = React.useState<MemoryEntry[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Dedicated Memory Chatbox
  const [chatMessages, setChatMessages] = React.useState<MemoryChatMessage[]>([
    {
      id: "mem-welcome",
      role: "assistant",
      content:
        "Hello! I have access to all your past conversations across every chatbox. Ask me anything based on previous discussions.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = React.useState("");
  const [isChatStreaming, setIsChatStreaming] = React.useState(false);
  const abortRef = React.useRef<(() => void) | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Load from store and subscribe to updates
  const refresh = React.useCallback(() => {
    setThreads(getAllConversations());
    setFlatMessages(getFlatMessages(500));
  }, []);

  React.useEffect(() => {
    refresh();
    return subscribeToStore(refresh);
  }, [refresh]);

  // Auto-scroll memory chat
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatStreaming]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setMemoryResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await memorySearch(searchQuery, currentUserId, currentTenantId, 10);
      setMemoryResults(results);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearAll = () => {
    if (!confirm("Clear all cross-chatbox conversation history from memory?")) return;
    clearAllConversations();
  };

  const handleClearThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    clearThread(threadId);
  };

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  // Send a message in the dedicated memory chatbox
  const handleMemoryChatSend = async () => {
    if (!chatInput.trim() || isChatStreaming) return;

    const userMsgId = `mem-user-${Date.now()}`;
    const assistantMsgId = `mem-asst-${Date.now()}`;
    const query = chatInput.trim();

    // Build a context summary from stored conversations
    const contextSnippets = flatMessages
      .filter((m) => m.role === "user")
      .slice(0, 20)
      .map((m) => `[${m.threadLabel}] Q: ${m.content.slice(0, 200)}`)
      .join("\n");

    const fullQuery = contextSnippets
      ? `[CONTEXT FROM PAST CONVERSATIONS]\n${contextSnippets}\n\n[USER QUESTION]\n${query}`
      : query;

    setChatMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: query,
        timestamp: new Date().toISOString(),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);
    setChatInput("");
    setIsChatStreaming(true);

    const cancel = streamChat({
      query: fullQuery,
      tenant_id: currentTenantId,
      user_id: currentUserId,
      onThinking: () => {},
      onToken: (token) => {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: m.content + token } : m
          )
        );
      },
      onCitations: () => {},
      onDone: () => {
        setIsChatStreaming(false);
        abortRef.current = null;
      },
      onError: (err) => {
        setIsChatStreaming(false);
        abortRef.current = null;
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `Error: ${err.message}. Please ensure Ollama is running.`,
                }
              : m
          )
        );
      },
    });

    abortRef.current = cancel;
  };

  // Filtered threads
  const filteredThreads = React.useMemo(() => {
    return threads.filter((t) => {
      if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesLabel = t.label.toLowerCase().includes(q);
        const matchesMessages = t.messages.some((m) =>
          m.content.toLowerCase().includes(q)
        );
        return matchesLabel || matchesMessages;
      }
      return true;
    });
  }, [threads, sourceFilter, searchQuery]);

  // Stats
  const totalMessages = flatMessages.length;
  const homeCount = threads.filter((t) => t.source === "home").reduce((s, t) => s + t.messages.length, 0);
  const datasetCount = threads.filter((t) => t.source === "dataset").reduce((s, t) => s + t.messages.length, 0);
  const notesCount = threads.filter((t) => t.source === "notes").reduce((s, t) => s + t.messages.length, 0);

  return (
    <div className="p-4 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Cross-Chatbox Conversation Memory
              </h3>
              <p className="text-xs text-muted-foreground">
                {totalMessages} messages across {threads.length} threads (Home: {homeCount}, Datasets: {datasetCount}, Notes: {notesCount})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={threads.length === 0}
              className="h-8 text-xs gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Source Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "home", "dataset", "notes"] as SourceFilter[]).map((src) => {
          const count =
            src === "all"
              ? threads.length
              : threads.filter((t) => t.source === src).length;
          return (
            <button
              key={src}
              type="button"
              onClick={() => setSourceFilter(src)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                sourceFilter === src
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {src !== "all" && (() => {
                const Icon: React.ElementType = SOURCE_ICONS[src] ?? MessageSquare;
                return <Icon className="h-3.5 w-3.5" />;
              })()}
              <span className="capitalize">{src === "all" ? "All Sources" : SOURCE_LABELS[src]}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  sourceFilter === src
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search across all conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-8 h-8 text-xs bg-muted/30"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearch}
              disabled={isSearching}
              className="h-8 px-3 gap-1"
            >
              {isSearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              Search
            </Button>
          </div>
          {/* Backend memory search results */}
          {memoryResults.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                Long-Term Memory Search Results
              </p>
              {memoryResults.map((entry) => (
                <div
                  key={entry.id}
                  className="p-2.5 rounded-lg border border-border/70 bg-card/40 text-xs space-y-1"
                >
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-primary shrink-0">You:</span>
                    <span className="text-foreground">{entry.query}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-400 shrink-0">AI:</span>
                    <span className="text-muted-foreground line-clamp-2">{entry.response}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left: Conversation History */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              Conversation History
              {filteredThreads.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {filteredThreads.length} threads
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                <Clock className="h-8 w-8 mb-2 opacity-40 mx-auto" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-[11px] text-muted-foreground/80 mt-1">
                  Start chatting in any chatbox (Home, Datasets, Notes) and all
                  conversations will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredThreads.map((thread) => {
                  const isExpanded = expandedThreads.has(thread.threadId);
                  const SourceIcon: React.ElementType =
                    SOURCE_ICONS[thread.source] ?? MessageSquare;
                  const lastUserMsg = [...thread.messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  const lastAsstMsg = [...thread.messages]
                    .reverse()
                    .find((m) => m.role === "assistant");
                  return (
                    <div
                      key={thread.threadId}
                      className="border border-border/70 rounded-lg overflow-hidden"
                    >
                      {/* Thread Header */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 p-3 bg-card/40 hover:bg-card/80 transition-colors text-left"
                        onClick={() => toggleThread(thread.threadId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${SOURCE_COLORS[thread.source]}`}
                        >
                          <SourceIcon className="h-3 w-3" />
                          <span>{SOURCE_LABELS[thread.source] ?? thread.source}</span>
                        </div>
                        <span className="text-xs font-medium text-foreground flex-1 truncate">
                          {thread.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {thread.messages.length} msgs
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleClearThread(thread.threadId, e)}
                          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1 shrink-0"
                          title="Clear this thread"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </button>

                      {/* Preview when collapsed */}
                      {!isExpanded && (lastUserMsg || lastAsstMsg) && (
                        <div className="px-3 pb-2.5 space-y-1">
                          {lastUserMsg && (
                            <div className="flex items-start gap-2 text-xs">
                              <span className="font-semibold text-primary shrink-0">You:</span>
                              <span className="text-foreground/80 line-clamp-1">
                                {lastUserMsg.content}
                              </span>
                            </div>
                          )}
                          {lastAsstMsg && (
                            <div className="flex items-start gap-2 text-xs">
                              <span className="font-semibold text-emerald-400 shrink-0">AI:</span>
                              <span className="text-muted-foreground line-clamp-1">
                                {lastAsstMsg.content}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded full thread */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto border-t border-border/60">
                          {thread.messages.map((msg) => (
                            <div
                              key={msg.id}
                              className="flex items-start gap-2 text-xs pt-2"
                            >
                              <span
                                className={`font-semibold shrink-0 ${
                                  msg.role === "user"
                                    ? "text-primary"
                                    : "text-emerald-400"
                                }`}
                              >
                                {msg.role === "user" ? "You:" : "AI:"}
                              </span>
                              <span className="text-foreground whitespace-pre-wrap">
                                {msg.content}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Dedicated Memory Chatbox */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm flex flex-col">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base flex items-center gap-2">
              <CornerDownRight className="h-4 w-4 text-violet-500" />
              Memory Chatbox
              <Badge
                variant="outline"
                className="ml-auto text-[10px] bg-violet-500/10 text-violet-500 border-violet-500/30"
              >
                Context-Aware
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Ask questions grounded in all your past chatbox conversations.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col p-3 gap-3">
            {/* Messages */}
            <div className="flex-1 max-h-[420px] overflow-y-auto space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-500">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border/70 text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                      {msg.role === "assistant" && msg.content === "" && isChatStreaming && (
                        <span className="inline-block h-3.5 w-0.5 bg-current animate-pulse ml-0.5" />
                      )}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-secondary border border-border/60 flex items-center justify-center text-foreground">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMemoryChatSend();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Ask based on past conversations..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatStreaming}
                className="flex-1 h-9 text-xs bg-background/80"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!chatInput.trim() || isChatStreaming}
                className="h-9 gap-1.5"
              >
                {isChatStreaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </form>

            {/* Hint if no history yet */}
            {threads.length === 0 && (
              <div className="text-[11px] text-muted-foreground/70 text-center py-1">
                No conversation history yet. Chat in any section to populate memory.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}