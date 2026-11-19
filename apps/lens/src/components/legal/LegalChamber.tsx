import React, { useState, useEffect } from "react";
import {
  Scale,
  ShieldAlert,
  FileText,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ChevronRight,
  Copy,
  Check,
  Search,
  Sparkles,
  Gavel,
  RefreshCw,
  FileCode,
  Sliders,
  HelpCircle,
} from "lucide-react";
import {
  LegalCaseInput,
  LegalAuditReport,
  WeaknessItem,
  SampleCase,
  uploadCaseFile,
  getLegalSampleCases,
  getLegalPrecedents,
  streamLegalAnalysis,
} from "@/lib/api";

export function LegalChamber() {
  const [caseTitle, setCaseTitle] = useState("");
  const [caseText, setCaseText] = useState("");
  const [caseType, setCaseType] = useState<
    "Criminal" | "Civil" | "Commercial" | "Constitutional" | "Corporate/IBC" | "Family/Matrimonial" | "Consumer" | "Other"
  >("Criminal");
  const [courtForum, setCourtForum] = useState("High Court / Sessions Court");
  const [clientPosture, setClientPosture] = useState<
    "Petitioner/Complainant" | "Defendant/Accused" | "Appellant" | "Respondent" | "Neutral Review"
  >("Defendant/Accused");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sample Cases & Ingested Precedents
  const [sampleCases, setSampleCases] = useState<SampleCase[]>([]);
  const [precedents, setPrecedents] = useState<any[]>([]);
  const [precedentSearch, setPrecedentSearch] = useState("");
  const [showPrecedentDrawer, setShowPrecedentDrawer] = useState(false);

  // Multi-Agent Deliberation Status
  const [agentStatuses, setAgentStatuses] = useState<{ [agent: string]: "pending" | "running" | "completed" }>({
    "Fact & Timeline Extractor": "pending",
    "Adversarial Weakness Hunter": "pending",
    "Precedent & Authority Researcher": "pending",
    "Tactical Strategy Advisor": "pending",
    "Lead Legal Synthesizer": "pending",
  });
  const [activeAgentMessage, setActiveAgentMessage] = useState("");

  // Analysis Report & Active Tab
  const [report, setReport] = useState<LegalAuditReport | null>(null);
  const [activeTab, setActiveTab] = useState<"weaknesses" | "strategy" | "precedents" | "facts" | "opinion">("weaknesses");
  const [selectedWeakness, setSelectedWeakness] = useState<WeaknessItem | null>(null);

  useEffect(() => {
    getLegalSampleCases().then(setSampleCases);
    getLegalPrecedents().then((res) => setPrecedents(res.precedents || []));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadCaseFile(file);
      setCaseTitle(res.title || file.name);
      setCaseText(res.extracted_text);
    } catch (err: any) {
      alert(`File upload failed: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSample = (sample: SampleCase) => {
    setCaseTitle(sample.title);
    setCaseText(sample.text);
    setCaseType(sample.case_type as any);
    setCourtForum(sample.court_forum);
    setClientPosture(sample.client_posture as any);
    setReport(null);
  };

  const handleStartAudit = () => {
    if (!caseText.trim()) {
      alert("Please enter case details or upload a case document first.");
      return;
    }

    setIsAnalyzing(true);
    setReport(null);
    setAgentStatuses({
      "Fact & Timeline Extractor": "pending",
      "Adversarial Weakness Hunter": "pending",
      "Precedent & Authority Researcher": "pending",
      "Tactical Strategy Advisor": "pending",
      "Lead Legal Synthesizer": "pending",
    });

    const input: LegalCaseInput = {
      case_title: caseTitle || "Indian Court Matter",
      case_text: caseText,
      case_type: caseType,
      court_forum: courtForum,
      client_posture: clientPosture,
    };

    streamLegalAnalysis(
      input,
      (event) => {
        if (event.type === "agent_start") {
          setActiveAgentMessage(event.message || "");
          setAgentStatuses((prev) => ({ ...prev, [event.agent]: "running" }));
        } else if (event.type === "agent_complete") {
          setAgentStatuses((prev) => ({ ...prev, [event.agent]: "completed" }));
        } else if (event.type === "final_report") {
          setReport(event.report);
          setSelectedWeakness(event.report.weaknesses?.[0] || null);
          setAgentStatuses({
            "Fact & Timeline Extractor": "completed",
            "Adversarial Weakness Hunter": "completed",
            "Precedent & Authority Researcher": "completed",
            "Tactical Strategy Advisor": "completed",
            "Lead Legal Synthesizer": "completed",
          });
        }
      },
      () => {
        setIsAnalyzing(false);
      },
      (err) => {
        setIsAnalyzing(false);
        alert(`Analysis Error: ${err.message}`);
      }
    );
  };

  const handleCopyMemo = () => {
    if (!report?.full_legal_opinion) return;
    navigator.clipboard.writeText(report.full_legal_opinion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "MODERATE":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0B0D13] text-slate-800 dark:text-slate-200">
      {/* Top Banner Header */}
      <div className="border-b border-slate-200 dark:border-white/10 px-6 py-4 bg-white/70 dark:bg-slate-900/40 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Legal Chamber</h1>
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Indian Law Swarm
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-Agent Case Dossier Analysis &bull; Adversarial Weakness Hunter &bull; Strategic Battle Plan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrecedentDrawer(!showPrecedentDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Precedents Library (50 SCR Cases)</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Case Dossier Input & Setup */}
        <div className="w-[420px] border-r border-slate-200 dark:border-white/10 flex flex-col bg-white dark:bg-slate-900/30 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" /> Case Dossier Input
            </h2>
            {/* Sample Selector */}
            {sampleCases.length > 0 && (
              <div className="relative group">
                <button className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Load Sample
                </button>
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl p-1 hidden group-hover:block z-50">
                  {sampleCases.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleLoadSample(s)}
                      className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-xs truncate"
                      title={s.title}
                    >
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="text-[10px] text-slate-400">{s.court_forum}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <label className="border-2 border-dashed border-slate-300 dark:border-white/15 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition bg-slate-50/50 dark:bg-white/[0.02]">
            <Upload className="w-6 h-6 text-indigo-500 mb-1" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {isUploading ? "Extracting Text from Case PDF..." : "Upload Petition, FIR, or Plaint PDF"}
            </span>
            <span className="text-[10px] text-slate-400">Extracts text and auto-fills case dossier</span>
            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Case Title / Cause Title</label>
              <input
                type="text"
                placeholder="e.g. State v. Rakesh Sharma, or XYZ Ltd v. ABC LLP"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Branch of Law</label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Criminal">Criminal (IPC/CrPC/BNSS)</option>
                  <option value="Commercial">Commercial (Contracts/Arbitration)</option>
                  <option value="Civil">Civil (CPC/Specific Relief)</option>
                  <option value="Constitutional">Constitutional / Writ</option>
                  <option value="Corporate/IBC">Corporate &amp; IBC</option>
                  <option value="Family/Matrimonial">Family / Matrimonial</option>
                  <option value="Consumer">Consumer Protection</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Client Posture</label>
                <select
                  value={clientPosture}
                  onChange={(e) => setClientPosture(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Defendant/Accused">Defendant / Accused</option>
                  <option value="Petitioner/Complainant">Petitioner / Complainant</option>
                  <option value="Appellant">Appellant</option>
                  <option value="Respondent">Respondent</option>
                  <option value="Neutral Review">Neutral Assessment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Forum / Jurisdiction</label>
              <input
                type="text"
                placeholder="e.g. High Court of Delhi, JMFC Tis Hazari"
                value={courtForum}
                onChange={(e) => setCourtForum(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Case Pleadings &amp; Facts Text</label>
                <span className="text-[10px] text-slate-400">{caseText.length} characters</span>
              </div>
              <textarea
                rows={10}
                placeholder="Paste FIR, Chargesheet, Plaint, Legal Notice, or arguments here..."
                value={caseText}
                onChange={(e) => setCaseText(e.target.value)}
                className="w-full mt-1 p-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleStartAudit}
            disabled={isAnalyzing || !caseText.trim()}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-500 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Multi-Agent Swarm Deliberating...</span>
              </>
            ) : (
              <>
                <Gavel className="w-4 h-4" />
                <span>Execute Multi-Agent Case Audit</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Deliberation & Results */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/50 dark:bg-transparent">
          {/* Deliberation Status Tracker */}
          {isAnalyzing && (
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span>Autonomous Multi-Agent Deliberation in Progress</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono italic">
                  {activeAgentMessage}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Object.entries(agentStatuses).map(([agent, status]) => (
                  <div
                    key={agent}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between transition ${
                      status === "running"
                        ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : status === "completed"
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <div className="font-semibold text-[11px] truncate">{agent}</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      {status === "running" && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                      <span className="capitalize">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Results View */}
          {report ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Score Header & Navigation Bar */}
              <div className="px-6 py-4 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Case Strength Meter */}
                  <div className="flex items-center gap-2">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <svg className="w-12 h-12 transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" className="text-slate-200 dark:text-white/10" fill="transparent" />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="4"
                          className={`${
                            report.overall_strength_score > 70
                              ? "text-emerald-500"
                              : report.overall_strength_score > 40
                              ? "text-amber-500"
                              : "text-rose-500"
                          } transition-all duration-1000`}
                          fill="transparent"
                          strokeDasharray={125.6}
                          strokeDashoffset={125.6 - (125.6 * report.overall_strength_score) / 100}
                        />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono">{report.overall_strength_score}%</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Viability Score</div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            report.overall_strength_score > 70
                              ? "bg-emerald-500"
                              : report.overall_strength_score > 40
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                        />
                        <span>{report.risk_level.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />

                  {/* High level stats */}
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
                      {report.case_title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {report.weaknesses.length} vulnerabilities identified &bull; {report.strategic_approach.length} tactical maneuvers
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => setActiveTab("weaknesses")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      activeTab === "weaknesses"
                        ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Weakness Matrix ({report.weaknesses.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("strategy")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      activeTab === "strategy"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Battle Plan ({report.strategic_approach.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("precedents")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      activeTab === "precedents"
                        ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Precedents ({report.precedents.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("opinion")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      activeTab === "opinion"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Legal Memo</span>
                  </button>
                </div>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* 1. Weakness Matrix Tab */}
                {activeTab === "weaknesses" && (
                  <div className="grid grid-cols-12 gap-6">
                    {/* Left List of Weaknesses */}
                    <div className="col-span-5 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Identified Vulnerabilities
                      </div>
                      {report.weaknesses.map((w) => (
                        <div
                          key={w.id}
                          onClick={() => setSelectedWeakness(w)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            selectedWeakness?.id === w.id
                              ? "border-rose-500 bg-rose-50/50 dark:bg-rose-500/10 shadow-sm"
                              : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/40 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityBadge(w.severity)}`}>
                              {w.severity}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{w.category}</span>
                          </div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-white mb-1">
                            {w.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {w.description}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right Detailed Inspector */}
                    <div className="col-span-7">
                      {selectedWeakness ? (
                        <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getSeverityBadge(selectedWeakness.severity)}`}>
                              {selectedWeakness.severity} RISK
                            </span>
                            <span className="text-xs text-slate-400 font-mono">{selectedWeakness.category}</span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {selectedWeakness.title}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                              {selectedWeakness.description}
                            </p>
                          </div>

                          {selectedWeakness.statutory_basis && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10">
                              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Statutory Ground / Legal Section
                              </div>
                              <div className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {selectedWeakness.statutory_basis}
                              </div>
                            </div>
                          )}

                          <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                            <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" /> Impact on Judicial Adjudication
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                              {selectedWeakness.impact_on_case}
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                            <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                              <Flame className="w-3.5 h-3.5" /> Opposing Counsel Attack Line
                            </div>
                            <div className="text-slate-700 dark:text-slate-300 italic">
                              "{selectedWeakness.opposing_counsel_angle}"
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed rounded-2xl p-8">
                          Select a weakness from the list to view legal analysis and counter-attack lines.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Tactical Strategy Tab */}
                {activeTab === "strategy" && (
                  <div className="space-y-4 max-w-4xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Litigation Battle Plan &amp; Tactical Counter-Measures
                    </div>
                    {report.strategic_approach.map((strat, idx) => (
                      <div
                        key={strat.id || idx}
                        className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                            {strat.phase.replace("_", " ")}
                          </span>
                          <span className="text-xs text-slate-400 font-mono font-medium">{strat.procedural_mechanism}</span>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {strat.remedy_title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {strat.strategic_rationale}
                          </p>
                        </div>

                        {strat.actionable_steps?.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              Actionable Steps for Counsel
                            </div>
                            <ul className="space-y-1">
                              {strat.actionable_steps.map((step, sIdx) => (
                                <li key={sIdx} className="text-xs flex items-start gap-2 text-slate-700 dark:text-slate-300">
                                  <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {strat.key_cross_examination_questions?.length > 0 && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-1.5">
                            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5" /> Target Cross-Examination Questions
                            </div>
                            <ul className="space-y-1">
                              {strat.key_cross_examination_questions.map((q, qIdx) => (
                                <li key={qIdx} className="text-xs text-slate-800 dark:text-slate-200 font-mono italic">
                                  Q{qIdx + 1}: "{q}"
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Precedents Tab */}
                {activeTab === "precedents" && (
                  <div className="space-y-4 max-w-4xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Binding Indian Supreme Court Precedents &amp; Legal Authorities
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {report.precedents.map((p, idx) => (
                        <div
                          key={idx}
                          className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                              {p.citation || "Supreme Court Reports"}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {p.stance}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {p.case_name}
                          </h3>

                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-xs">
                            <span className="font-bold text-slate-500">Ratio Decidendi: </span>
                            <span className="text-slate-800 dark:text-slate-200">{p.applicable_ratio}</span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Relevance: </span>
                            {p.relevance_summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Full Legal Opinion Tab */}
                {activeTab === "opinion" && (
                  <div className="max-w-4xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Formal Legal Opinion &amp; Case Audit Memorandum
                      </span>
                      <button
                        onClick={handleCopyMemo}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/15 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "Copied to Clipboard!" : "Copy Full Memorandum"}</span>
                      </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-2xl p-8 font-serif leading-relaxed text-slate-800 dark:text-slate-200 text-sm shadow-sm whitespace-pre-wrap">
                      {report.full_legal_opinion}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-4">
                <Gavel className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Ready for Multi-Agent Legal Case Audit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                Upload an Indian court petition, FIR, chargesheet, or plaint (PDF), or load one of our built-in test matters.
                The autonomous legal chamber will dissect weaknesses, statutory loopholes, and tactical counter-measures.
              </p>

              <div className="flex items-center gap-3">
                {sampleCases.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 transition flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Test: {s.title.split("(")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Precedent Drawer */}
      {showPrecedentDrawer && (
        <div className="absolute inset-y-0 right-0 w-[480px] bg-white dark:bg-[#0E1118] border-l border-slate-200 dark:border-white/10 shadow-2xl z-50 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                50 Ingested Supreme Court Cases
              </h3>
            </div>
            <button
              onClick={() => setShowPrecedentDrawer(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="p-3 border-b border-slate-200 dark:border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search case title, act, or citation..."
                value={precedentSearch}
                onChange={(e) => {
                  setPrecedentSearch(e.target.value);
                  getLegalPrecedents(e.target.value).then((res) => setPrecedents(res.precedents || []));
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {precedents.map((p, idx) => (
              <div
                key={p.id || idx}
                className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5"
              >
                <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                  {p.citation}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">{p.title}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {p.summary}
                </div>
                {p.subject && (
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Acts: {p.subject}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
