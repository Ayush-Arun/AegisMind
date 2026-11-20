import * as React from "react";
import { streamChat, parseFile } from "@/lib/api";
import { recordExchange } from "@/lib/conversationStore";
import { format12HrDateTime } from "@/lib/utils";
import {
  FileText,
  Paperclip,
  X,
  Lock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  ArrowUp,
  Copy,
  Check,
} from "lucide-react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  previewUrl?: string;
  file: File;
}

interface MessageAttachment {
  name: string;
  isImage: boolean;
  previewUrl?: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp: string;
  attachments?: MessageAttachment[];
}

interface ChatProps {
  currentTenantId: string;
  currentUserId: string;
  initialQuery?: string;
  selectedModel?: string;
  onUpdateActiveTitle?: (title: string) => void;
  onClearInitialQuery?: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/\u200b/g, "")
    .replace(/\u200c/g, "")
    .replace(/\u200d/g, "");
}

interface ParsedCaseDetails {
  isCase: boolean;
  caseTitle?: string;
  branch?: string;
  posture?: string;
  forum?: string;
  pleadings?: string;
}

function parseCaseDetails(text: string): ParsedCaseDetails {
  const titleMatch =
    text.match(/(?:Case Title|Case)\s*[:\t]\s*([^\n\r]+)/i) ||
    text.match(/(?:State of|Union of)[^\n\r]+/i) ||
    text.match(/([A-Z][a-zA-Z\s\(\)]+v\.\s+[A-Z][a-zA-Z\s\(\)]+)/i);

  const branchMatch = text.match(/(?:Branch of Law|Branch)\s*[:\t]\s*([^\n\r]+)/i);
  const postureMatch = text.match(/(?:Client Posture|Posture)\s*[:\t]\s*([^\n\r]+)/i);
  const forumMatch =
    text.match(/Forum\s*[:\t]\s*([^\n\r]+)/i) ||
    text.match(/IN THE COURT OF\s+([^\n\r,]+(?:,\s*[^\n\r]+)?)/i);

  const hasCaseIndicators = Boolean(
    titleMatch ||
    branchMatch ||
    postureMatch ||
    forumMatch ||
    text.includes("IN THE COURT OF") ||
    text.includes("CHARGES:") ||
    text.includes("Pleadings text")
  );

  let pleadings = text;
  const pleadingsMatch = text.match(/(?:Pleadings(?:\s+text)?(?:\s*\(paste this\))?\s*[:\t]?\s*)([\s\S]+)/i);
  if (pleadingsMatch && pleadingsMatch[1]) {
    pleadings = pleadingsMatch[1].trim();
  } else if (hasCaseIndicators) {
    const courtIdx = text.search(/IN THE COURT OF/i);
    if (courtIdx !== -1) {
      pleadings = text.slice(courtIdx).trim();
    }
  }

  let caseTitle = titleMatch ? titleMatch[1]?.trim() || titleMatch[0]?.trim() : undefined;
  if (caseTitle) {
    caseTitle = caseTitle.replace(/\.\.\..*$/, "").trim();
  }

  return {
    isCase: hasCaseIndicators,
    caseTitle: caseTitle || "Case Submission",
    branch: branchMatch?.[1] ? branchMatch[1].trim() : "Criminal (IPC / CrPC / BNSS)",
    posture: postureMatch?.[1] ? postureMatch[1].trim() : "Defendant / Accused",
    forum: forumMatch ? forumMatch[1]?.trim() || forumMatch[0]?.trim() : "Sessions / Special Court",
    pleadings,
  };
}

export function Chat({
  currentTenantId,
  currentUserId,
  initialQuery,
  selectedModel = "qwen3.5:9b",
  onUpdateActiveTitle,
  onClearInitialQuery,
}: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputQuery, setInputQuery] = React.useState("");
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedFile[]>([]);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [currentThinking, setCurrentThinking] = React.useState<string | null>(null);
  const [convId] = React.useState<string>(() => `chat-${Date.now()}`);
  const [convTitle, setConvTitle] = React.useState<string>("");
  const [speakingMsgId, setSpeakingMsgId] = React.useState<string | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);
  const [expandedPleadings, setExpandedPleadings] = React.useState<Record<string, boolean>>({});

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const baselineTextRef = React.useRef("");
  const abortStreamRef = React.useRef<(() => void) | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Dynamic time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Sync speech transcript
  React.useEffect(() => {
    if (listening) {
      const newQuery = `${baselineTextRef.current} ${transcript}`.trim();
      setInputQuery(newQuery);
    }
  }, [transcript, listening]);

  React.useEffect(() => {
    return () => {
      if (listening) {
        SpeechRecognition.stopListening();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [listening]);

  // Handle Initial Query from history
  React.useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setInputQuery(initialQuery);
      if (onClearInitialQuery) {
        onClearInitialQuery();
      }
    }
  }, [initialQuery, onClearInitialQuery]);

  // Auto-scroll on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentThinking]);

  // Speech Recognition Control
  const startMicrophone = () => {
    if (!browserSupportsSpeechRecognition) {
      return;
    }
    baselineTextRef.current = inputQuery;
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: "en-IN" });
  };

  const stopMicrophone = () => {
    SpeechRecognition.stopListening();
  };

  // Text-To-Speech Read Aloud
  const speakMessage = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`>]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Copy latest assistant answer or full session
  const handleCopyLatest = () => {
    const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
    const textToCopy = lastAsst?.content || "No generated advice to copy yet.";
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleListenLatest = () => {
    const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAsst) {
      speakMessage(lastAsst.id, lastAsst.content);
    }
  };

  // File Attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttached: AttachedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file) continue;
      const isImg = file.type.startsWith("image/");
      const preview = isImg ? URL.createObjectURL(file) : undefined;
      newAttached.push({
        id: `file-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage: isImg,
        previewUrl: preview,
        file,
      });
    }
    setAttachedFiles((prev) => [...prev, ...newAttached]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Stop Generation
  const handleStop = () => {
    if (abortStreamRef.current) {
      abortStreamRef.current();
      abortStreamRef.current = null;
    }
    setIsStreaming(false);
    setCurrentThinking(null);
  };

  // Send Message
  const handleSend = async () => {
    if ((!inputQuery.trim() && attachedFiles.length === 0) || isStreaming) return;

    if (listening) {
      stopMicrophone();
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;
    const rawQuery = inputQuery.trim() || "Please analyze the attached case file(s).";

    // Extract dynamic title
    const parsed = parseCaseDetails(rawQuery);
    const activeLabel = parsed.isCase && parsed.caseTitle ? parsed.caseTitle : (rawQuery.length > 40 ? rawQuery.slice(0, 40) + "..." : rawQuery);
    
    if (!convTitle) {
      setConvTitle(activeLabel);
      if (onUpdateActiveTitle) {
        onUpdateActiveTitle(activeLabel);
      }
    }

    const currentAttachments = [...attachedFiles];

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        content: rawQuery,
        timestamp: new Date().toISOString(),
        attachments: currentAttachments.map((f) => ({
          name: f.name,
          isImage: f.isImage,
          previewUrl: f.previewUrl,
          size: f.size,
        })),
      },
      {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      },
    ]);

    setInputQuery("");
    setAttachedFiles([]);
    setIsStreaming(true);
    setCurrentThinking("Preparing defence strategy and cross-examination questions");

    // Augment with attached documents if present
    let fullQuery = rawQuery;
    if (currentAttachments.length > 0) {
      try {
        const textSnippets: string[] = [];
        for (const att of currentAttachments) {
          if (!att.isImage) {
            try {
              setCurrentThinking(`Reading attached document: ${att.name}...`);
              const res = await parseFile(att.file);
              if (res.content) {
                textSnippets.push(`--- Attached File: ${att.name} ---\n${res.content.slice(0, 120000)}`);
              }
            } catch {
              // fallback
            }
          }
        }
        if (textSnippets.length > 0) {
          fullQuery = `${textSnippets.join("\n\n")}\n\n${rawQuery}`;
        }
      } catch {
        // proceed
      }
    }

    let accumulatedResponse = "";

    const cancel = streamChat({
      query: fullQuery,
      tenant_id: currentTenantId,
      user_id: currentUserId,
      model: selectedModel || "qwen3.5:9b",

      onThinking: (status) => {
        setCurrentThinking(status.replace(/^•••\s*/, ""));
      },
      onToken: (token) => {
        accumulatedResponse += token;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + token }
              : msg
          )
        );
      },
      onCitations: () => {},
      onDone: () => {
        setIsStreaming(false);
        setCurrentThinking(null);
        abortStreamRef.current = null;
        if (accumulatedResponse.trim()) {
          recordExchange({
            threadId: convId,
            label: activeLabel,
            source: "home",
            userMessage: {
              id: userMsgId,
              content: rawQuery,
              timestamp: new Date().toISOString(),
            },
            assistantMessage: {
              id: assistantMsgId,
              content: accumulatedResponse,
              timestamp: new Date().toISOString(),
            },
          });
        }
      },
      onError: (err) => {
        setIsStreaming(false);
        setCurrentThinking(null);
        abortStreamRef.current = null;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    `Analysis failed: ${err.message}. Please verify Ollama is running.`,
                }
              : msg
          )
        );
      },
    });

    abortStreamRef.current = cancel;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpandPleadings = (msgId: string) => {
    setExpandedPleadings((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  return (
    <div className="flex h-full flex-col relative w-full overflow-hidden bg-[#0c0d12]">
      {/* ─── Scrollable Conversation Canvas ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto w-full space-y-6 pb-28">
          {/* Greeting Hero Section */}
          <div className="pt-2 pb-4">
            <h1 className="text-3xl font-serif font-normal text-white tracking-tight mb-2">
              {getGreeting()}.
            </h1>
            <p className="text-xs text-white/50 leading-relaxed max-w-xl">
              Ask anything about your case. Answers are drawn only from sources you have access to, checked at the moment they&apos;re retrieved.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={handleListenLatest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16171e] hover:bg-[#1f2029] border border-[#262732] text-xs text-white/70 hover:text-white transition-colors"
              >
                {speakingMsgId ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                <span>Listen</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLatest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16171e] hover:bg-[#1f2029] border border-[#262732] text-xs text-white/70 hover:text-white transition-colors"
              >
                {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{isCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const caseDetails = isUser ? parseCaseDetails(msg.content) : null;
            const isExpanded = expandedPleadings[msg.id] ?? false;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
              >
                {/* User Message Rendering */}
                {isUser && caseDetails?.isCase ? (
                  /* Case Details Card */
                  <div className="rounded-xl bg-[#14151c] border border-[#242530] p-4 text-xs space-y-2 max-w-2xl w-full text-white/90 shadow-md">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-white/40">
                      <Lock className="h-3 w-3 text-white/40" />
                      <span>CASE DETAILS</span>
                    </div>

                    <div>
                      <span className="text-white/40 font-mono">Case: </span>
                      <span className="font-semibold text-white">{caseDetails.caseTitle}</span>
                    </div>

                    <div>
                      <span className="text-white/40 font-mono">Branch: </span>
                      <span className="text-white/90">{caseDetails.branch}</span>
                    </div>

                    <div>
                      <span className="text-white/40 font-mono">Client posture: </span>
                      <span className="text-white/90">{caseDetails.posture}</span>
                    </div>

                    <div>
                      <span className="text-white/40 font-mono">Forum: </span>
                      <span className="text-white/90">{caseDetails.forum}</span>
                    </div>

                    {caseDetails.pleadings && (
                      <div className="pt-2 border-t border-white/5 mt-2">
                        <div
                          className={`whitespace-pre-wrap text-[11px] text-white/60 leading-relaxed font-mono ${
                            isExpanded ? "" : "max-h-20 overflow-hidden line-clamp-3"
                          }`}
                        >
                          {caseDetails.pleadings}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpandPleadings(msg.id)}
                          className="text-[11px] text-primary hover:underline mt-1 font-medium block"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                    )}

                    <div className="text-right text-[10px] text-white/30 pt-1 font-mono">
                      {format12HrDateTime(msg.timestamp)}
                    </div>
                  </div>
                ) : isUser ? (
                  /* Standard User Question Bubble */
                  <div className="max-w-xl rounded-xl bg-[#181922] border border-[#262734] px-4 py-2.5 text-xs text-white shadow-sm">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-[10px]">
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto pr-1">
                      {escapeHtml(msg.content)}
                    </div>
                    <div className="text-right text-[10px] text-white/30 mt-1 font-mono">
                      {format12HrDateTime(msg.timestamp)}
                    </div>
                  </div>
                ) : (
                  /* Assistant Response Body */
                  <div className="w-full text-xs text-white/90 leading-relaxed space-y-3 pt-2">
                    {msg.content ? (
                      <div className="whitespace-pre-wrap space-y-2 leading-relaxed selection:bg-primary/30">
                        {escapeHtml(msg.content)}
                      </div>
                    ) : null}

                    {msg.content && (
                      <div className="pt-2 flex items-center justify-between text-white/30 text-[10px]">
                        <span>{format12HrDateTime(msg.timestamp)}</span>
                        <button
                          type="button"
                          onClick={() => speakMessage(msg.id, msg.content)}
                          className="hover:text-white transition-colors"
                          title="Read advice aloud"
                        >
                          <Volume2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Thinking / Streaming Status Indicator */}
          {currentThinking && (
            <div className="flex items-center gap-2 text-xs text-white/50 animate-pulse pt-2">
              <span className="text-white/40 font-mono tracking-widest text-sm">•••</span>
              <span className="font-sans">{currentThinking}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Floating Bottom Input Bar ─── */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0c0d12] via-[#0c0d12]/95 to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto">
          {/* Attached Files Preview Tray */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachedFiles.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#16171e] border border-[#262732] text-xs text-white shadow-xs"
                >
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="max-w-[140px] truncate text-[11px] font-medium">
                    {att.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(att.id)}
                    className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Box Container */}
          <div className="bg-[#14151c] border border-[#242530] rounded-xl p-3 shadow-2xl flex flex-col gap-2 transition-all focus-within:border-white/20">
            {/* Multiline Draft Textarea (max 3 lines with scrollbar) */}
            <textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask anything about your case..."
              className="w-full bg-transparent text-xs text-white placeholder-white/30 resize-none max-h-[72px] overflow-y-auto focus:outline-none scrollbar-thin leading-relaxed"
            />

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <div className="flex items-center gap-1">
                {/* Paperclip File Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept=".txt,.pdf,.docx,.json,.csv"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  title="Attach case file or PDF"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Voice Input Mic */}
                <button
                  type="button"
                  onClick={listening ? stopMicrophone : startMicrophone}
                  className={`p-1.5 rounded-lg transition-colors ${
                    listening
                      ? "text-rose-400 bg-rose-500/20 animate-pulse"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  }`}
                  title={listening ? "Stop voice listening" : "Speak case facts"}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </div>

              {/* Action Button: Stop or Send */}
              <div>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputQuery.trim() && attachedFiles.length === 0}
                    className="p-1.5 rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                    title="Send query"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
