import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  listNotes,
  getNoteDetail,
  parseFile,
  studyDocument,
  createVaultNote,
  type NoteSummary,
  type NoteDetail,
} from "@/lib/api";
import {
  FileText,
  Tag,
  Calendar,
  Search,
  RefreshCw,
  Sparkles,
  BookOpen,
  Terminal,
  GraduationCap,
  UploadCloud,
  Send,
  CheckCircle2,
  FileCheck,
  Layers,
  ArrowRight,
  Bot,
  User,
  PlusCircle,
  FileQuestion,
  Lightbulb,
} from "lucide-react";

interface NotesProps {
  currentUserId?: string;
  currentTenantId?: string;
  onNavigateToChat?: (query: string) => void;
}

interface StudyDoc {
  id: string;
  filename: string;
  title: string;
  content: string;
  file_type: string;
  char_count: number;
  page_count: number;
  uploaded_at: string;
}

interface StudyMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "qa" | "quiz" | "summary" | "explain";
  timestamp: string;
}

export function Notes({
  currentUserId = "alice",
  currentTenantId = "corp-default",
  onNavigateToChat,
}: NotesProps) {
  // Navigation between Vault and Study Hub
  const [activeSection, setActiveSection] = React.useState<"study" | "vault">("study");

  // --- Local Vault State ---
  const [notes, setNotes] = React.useState<NoteSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [selectedNote, setSelectedNote] = React.useState<NoteDetail | null>(null);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // --- Study & Learning Hub State ---
  const [studyDocs, setStudyDocs] = React.useState<StudyDoc[]>([]);
  const [activeDocId, setActiveDocId] = React.useState<string | null>(null);
  const [isParsingDoc, setIsParsingDoc] = React.useState(false);
  const [studyMessages, setStudyMessages] = React.useState<StudyMessage[]>([]);
  const [studyQuery, setStudyQuery] = React.useState("");
  const [isStudying, setIsStudying] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);
  const [showDocPreview, setShowDocPreview] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll study messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [studyMessages, isStudying]);

  // Fetch local notes
  const fetchNotes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listNotes(selectedTag || undefined);
      setNotes(data);
      if (data.length > 0 && !selectedSlug && data[0]) {
        setSelectedSlug(data[0].slug);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  }, [selectedTag, selectedSlug]);

  React.useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  React.useEffect(() => {
    if (!selectedSlug) {
      setSelectedNote(null);
      return;
    }
    setIsLoadingDetail(true);
    getNoteDetail(selectedSlug)
      .then((detail) => setSelectedNote(detail))
      .catch(() => setSelectedNote(null))
      .finally(() => setIsLoadingDetail(false));
  }, [selectedSlug]);

  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [notes]);

  const filteredNotes = React.useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.preview.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  // Selected Study Document
  const activeDoc = React.useMemo(() => {
    return studyDocs.find((d) => d.id === activeDocId) || null;
  }, [studyDocs, activeDocId]);

  // Handle Study File Upload (PDF, PPT, DOCX, etc.)
  const handleStudyFileUpload = async (file: File) => {
    setIsParsingDoc(true);
    setSaveStatus(null);
    try {
      const parsed = await parseFile(file);
      const newDoc: StudyDoc = {
        id: `doc-${Date.now()}`,
        filename: parsed.filename,
        title: parsed.title,
        content: parsed.content,
        file_type: parsed.file_type,
        char_count: parsed.char_count,
        page_count: parsed.page_count,
        uploaded_at: new Date().toLocaleTimeString(),
      };

      setStudyDocs((prev) => [newDoc, ...prev]);
      setActiveDocId(newDoc.id);

      // Add welcoming assistant message tailored to the document
      const countLabel =
        parsed.page_count > 1
          ? `${parsed.page_count} ${parsed.file_type.includes("presentation") || parsed.filename.match(/\.(ppt|pptx)$/i) ? "slides" : "pages"}`
          : "1 document";

      setStudyMessages([
        {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `I have extracted **${newDoc.title}** (${countLabel}, ${parsed.char_count.toLocaleString()} characters). I am ready to be your interactive study partner! You can ask questions about the contents, click **Quiz Me** to test your knowledge, or ask me to explain key slides.`,
          mode: "qa",
          timestamp: "Just now",
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse document";
      setSaveStatus(`Extraction failed: ${msg}`);
    } finally {
      setIsParsingDoc(false);
    }
  };

  // Run a study interaction (Q&A, Quiz, Summary, Explanation)
  const executeStudyAction = async (queryText: string, mode: "qa" | "quiz" | "summary" | "explain" = "qa") => {
    if (!activeDoc || isStudying) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: StudyMessage = {
      id: userMsgId,
      role: "user",
      content: queryText,
      mode,
      timestamp: "Just now",
    };

    setStudyMessages((prev) => [...prev, userMsg]);
    setStudyQuery("");
    setIsStudying(true);

    try {
      const res = await studyDocument({
        title: activeDoc.title,
        content: activeDoc.content,
        query: queryText,
        mode,
        user_id: currentUserId,
        tenant_id: currentTenantId,
      });

      const assistantMsg: StudyMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        mode,
        timestamp: "Just now",
      };

      setStudyMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Study request failed";
      setStudyMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error generating response: ${msg}. Please try again or rephrase your question.`,
          timestamp: "Just now",
        },
      ]);
    } finally {
      setIsStudying(false);
    }
  };

  // Save current study session into Sovereign Notes Vault
  const handleSaveToVault = async () => {
    if (!activeDoc || studyMessages.length === 0) return;
    try {
      const conversationText = studyMessages
        .map((m) => `### ${m.role === "user" ? "User Question" : "Study Partner"}\n\n${m.content}`)
        .join("\n\n---\n\n");

      const noteContent = `# Study Guide: ${activeDoc.title}\n\n**Source File:** \`${activeDoc.filename}\` (${activeDoc.char_count} chars)\n**Study Date:** ${new Date().toLocaleDateString()}\n\n---\n\n${conversationText}`;

      await createVaultNote({
        title: `Study: ${activeDoc.title}`,
        content: noteContent,
        tags: ["study", "learning", activeDoc.file_type || "document"],
        source_query: `Study session for ${activeDoc.title}`,
      });

      setSaveStatus(`Saved study guide for "${activeDoc.title}" to local notes vault!`);
      await fetchNotes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save note";
      setSaveStatus(`Could not save note: ${msg}`);
    }
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              Notes & Learning Hub
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              Sovereign AI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Personal offline knowledge vault and interactive LLM study partner for PDFs, presentations, slides, and documents.
          </p>
        </div>

        {/* Section Tabs: Study Hub vs Vault Notes */}
        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setActiveSection("study")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSection === "study"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Study Hub (PDF / Slides)</span>
            <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 bg-background/20 text-inherit">
              AI Q&A
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("vault")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSection === "vault"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Vault Notes ({notes.length})</span>
          </button>
        </div>
      </div>

      {/* --- SECTION 1: STUDY & LEARNING HUB --- */}
      {activeSection === "study" && (
        <div className="space-y-6">
          {/* Document Upload & Selector Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 4 Cols: Document Management & Actions */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              {/* File Upload Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleStudyFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/40 hover:border-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  {isParsingDoc ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    {isParsingDoc ? "Extracting Slides / Pages..." : "Upload Study Material"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Drop PDF, PowerPoint (.ppt, .pptx), Word (.docx), or slides here
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  Any Document Format Supported
                </Badge>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="*/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleStudyFileUpload(file);
                  }}
                  className="hidden"
                />
              </div>

              {/* Loaded Study Documents List */}
              <Card className="border-border/80 bg-card/40 flex-1 flex flex-col">
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      Active Study Materials ({studyDocs.length})
                    </CardTitle>
                    {studyDocs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        <PlusCircle className="h-3 w-3" /> Add More
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-1.5 max-h-[220px] overflow-y-auto">
                  {studyDocs.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground">
                      <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground/40 mb-1.5" />
                      <p className="text-xs font-medium text-foreground">No documents loaded yet</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Upload your lecture slides or technical documents to start studying.
                      </p>
                    </div>
                  ) : (
                    studyDocs.map((doc) => {
                      const isSelected = activeDocId === doc.id;
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setActiveDocId(doc.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-secondary border-primary/50 shadow-xs"
                              : "bg-card/30 border-border/50 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {doc.title}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase shrink-0 border-border">
                              {doc.file_type}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                            <span>
                              {doc.page_count > 1 ? `${doc.page_count} slides/pages` : "1 doc"} • {doc.char_count.toLocaleString()} chars
                            </span>
                            <span>{doc.uploaded_at}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Document Overview & Quick Study Actions */}
              {activeDoc && (
                <Card className="border-border/80 bg-card/60 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate">
                      Study Actions: {activeDoc.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDocPreview(!showDocPreview)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {showDocPreview ? "Hide Preview" : "View Text"}
                    </button>
                  </div>

                  {showDocPreview && (
                    <div className="p-2.5 rounded-md bg-muted/40 border border-border/60 text-[11px] font-mono max-h-40 overflow-y-auto whitespace-pre-wrap text-foreground/80">
                      {activeDoc.content.slice(0, 2000)}
                      {activeDoc.content.length > 2000 && "\n\n... [Truncated for display]"}
                    </div>
                  )}

                  {/* High-yield action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeStudyAction("Generate an interactive study quiz on key concepts.", "quiz")}
                      disabled={isStudying}
                      className="text-[11px] h-8 flex items-center justify-center gap-1.5 border-primary/30 hover:bg-primary/10 text-primary font-medium"
                    >
                      <FileQuestion className="h-3.5 w-3.5" />
                      <span>Quiz Me</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeStudyAction("Explain the core concepts and mental models in simple terms.", "explain")}
                      disabled={isStudying}
                      className="text-[11px] h-8 flex items-center justify-center gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400 font-medium"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      <span>Explain Concepts</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeStudyAction("Summarize the key takeaways and main points by slide/page.", "summary")}
                      disabled={isStudying}
                      className="text-[11px] h-8 flex items-center justify-center gap-1.5 border-blue-500/30 hover:bg-blue-500/10 text-blue-400 font-medium"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      <span>Summary</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveToVault}
                      disabled={studyMessages.length === 0}
                      className="text-[11px] h-8 flex items-center justify-center gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-400 font-medium"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Save to Vault</span>
                    </Button>
                  </div>

                  {saveStatus && (
                    <div className="p-2 rounded-md bg-primary/10 border border-primary/30 text-[11px] text-primary flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{saveStatus}</span>
                    </div>
                  )}

                  {onNavigateToChat && (
                    <button
                      type="button"
                      onClick={() => onNavigateToChat(`Regarding my study document "${activeDoc.title}": `)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 w-full justify-center pt-1"
                    >
                      <span>Continue discussion in Enterprise Chat</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </Card>
              )}
            </div>

            {/* Right 8 Cols: Interactive LLM Study Chat Session */}
            <div className="lg:col-span-8 flex flex-col">
              <Card className="flex-1 flex flex-col border-border/80 bg-card/50 overflow-hidden min-h-[580px]">
                {/* Chat Session Header */}
                <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span className="font-bold text-xs text-foreground">
                      {activeDoc ? `Study Session: ${activeDoc.title}` : "Interactive Study Partner"}
                    </span>
                    {activeDoc && (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                        {activeDoc.page_count > 1 ? `${activeDoc.page_count} slides/pages` : "1 doc"}
                      </Badge>
                    )}
                  </div>
                  {studyMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setStudyMessages([])}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Clear Session
                    </button>
                  )}
                </CardHeader>

                {/* Conversation Body */}
                <CardContent className="flex-1 p-4 overflow-y-auto space-y-4 max-h-[calc(100vh-24rem)]">
                  {studyMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground min-h-[300px]">
                      <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Ready for Learning & Examination
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        Upload or select a PDF, presentation slide deck, or document from the left.
                        You and the AI will interactively quiz, explain, and study the material together.
                      </p>
                    </div>
                  ) : (
                    studyMessages.map((msg) => {
                      const isUser = msg.role === "user";
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-start gap-3 text-xs leading-relaxed ${
                            isUser ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                              isUser
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "bg-primary/20 border border-primary/40 text-primary"
                            }`}
                          >
                            {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          </div>

                          <div
                            className={`rounded-xl p-3.5 max-w-[85%] space-y-2 ${
                              isUser
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-secondary/70 border border-border/80 text-foreground"
                            }`}
                          >
                            <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap font-sans">
                              {msg.content}
                            </div>
                            <div
                              className={`text-[10px] flex items-center justify-between gap-2 pt-1 border-t ${
                                isUser ? "border-primary-foreground/20 text-primary-foreground/70" : "border-border/40 text-muted-foreground"
                              }`}
                            >
                              <span>{msg.role === "assistant" ? "AegisMind Study Partner" : "You"}</span>
                              <span>{msg.timestamp}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isStudying && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Synthesizing response and evaluating document context...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Question Input Footer */}
                <div className="p-3 border-t border-border/60 bg-card/60 space-y-2">
                  {/* Suggested Study Queries */}
                  {activeDoc && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" /> Suggested:
                      </span>
                      <button
                        type="button"
                        onClick={() => executeStudyAction("What are the key points in this document?", "qa")}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground border border-border/60 transition-colors"
                      >
                        Key points?
                      </button>
                      <button
                        type="button"
                        onClick={() => executeStudyAction("Test my knowledge with 3 difficult questions", "quiz")}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground border border-border/60 transition-colors"
                      >
                        Quiz me on 3 questions
                      </button>
                      <button
                        type="button"
                        onClick={() => executeStudyAction("Explain the main formulas or technical requirements", "explain")}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground border border-border/60 transition-colors"
                      >
                        Technical requirements
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (studyQuery.trim()) {
                        executeStudyAction(studyQuery.trim(), "qa");
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      placeholder={
                        activeDoc
                          ? `Ask a question about ${activeDoc.title} or type your answer to the quiz...`
                          : "Upload a document or slide deck to start asking questions..."
                      }
                      value={studyQuery}
                      onChange={(e) => setStudyQuery(e.target.value)}
                      disabled={!activeDoc || isStudying}
                      className="h-9 text-xs"
                    />
                    <Button
                      type="submit"
                      disabled={!activeDoc || !studyQuery.trim() || isStudying}
                      className="h-9 px-4 text-xs font-semibold gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Ask</span>
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* --- SECTION 2: LOCAL VAULT NOTES --- */}
      {activeSection === "vault" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Showing markdown notes maintained locally in the Sovereign Vault.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotes}
              disabled={isLoading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
            {/* Left Column: Note List & Filters */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* Search & Tag Filter Bar */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search local notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                {/* Tag Pills */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
                      <Tag className="h-3 w-3" /> Tags:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTag(null)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        selectedTag === null
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      All ({notes.length})
                    </button>
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                          selectedTag === tag
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes Scrollable List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[calc(100vh-20rem)]">
                {filteredNotes.length === 0 ? (
                  <Card className="border-dashed border-border/80 bg-muted/10 p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                    <p className="text-xs font-medium text-foreground">No notes found</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Save a study guide from the Study Hub or ask the Sovereign Agent to create one.
                    </p>
                  </Card>
                ) : (
                  filteredNotes.map((note) => {
                    const isSelected = selectedSlug === note.slug;
                    return (
                      <button
                        key={note.slug}
                        type="button"
                        onClick={() => setSelectedSlug(note.slug)}
                        className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-secondary border-primary/50 shadow-xs"
                            : "bg-card/40 border-border/70 hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-xs text-foreground line-clamp-1">
                            {note.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                          {note.preview}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {note.tags.map((t) => (
                              <span key={t} className="text-primary font-medium">
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Note Preview & Detail */}
            <div className="lg:col-span-7 flex flex-col">
              <Card className="flex-1 flex flex-col border-border/80 bg-card/50 overflow-hidden">
                {isLoadingDetail ? (
                  <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground text-xs">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary mr-2" />
                    Loading note content...
                  </div>
                ) : selectedNote ? (
                  <div className="flex-1 flex flex-col">
                    <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg font-bold text-foreground">
                          {selectedNote.title}
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          {selectedNote.slug}
                        </Badge>
                      </div>
                      {selectedNote.created_at && (
                        <CardDescription className="text-xs flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(selectedNote.created_at).toLocaleString()}
                          </span>
                          {selectedNote.source_query && (
                            <span className="flex items-center gap-1 text-primary">
                              <Sparkles className="h-3 w-3" /> Query: {selectedNote.source_query}
                            </span>
                          )}
                        </CardDescription>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedNote.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[10px] bg-secondary/80 border-border text-foreground"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-22rem)]">
                      <div className="prose prose-invert prose-xs max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">
                        {selectedNote.content}
                      </div>
                    </CardContent>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <Terminal className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <h3 className="text-xs font-semibold text-foreground">Select a note to inspect</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
                      Select a note from the vault sidebar to review frontmatter metadata and markdown content.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
