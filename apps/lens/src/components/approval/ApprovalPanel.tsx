import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPendingActions, decideAction, type PendingActionData } from "@/lib/api";
import {
  ShieldCheck,
  Clock,
  Check,
  X,
  RefreshCw,
  Terminal,
  FileText,
  Send,
} from "lucide-react";

export function ApprovalPanel() {
  const [pendingActions, setPendingActions] = React.useState<PendingActionData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchPending = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPendingActions();
      setPendingActions(data.pending_actions || []);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleDecision = async (proposalId: string, approved: boolean, reason: string) => {
    setProcessingId(proposalId);
    try {
      await decideAction({ proposal_id: proposalId, approved, reason, reviewed_by: "alice" });
      await fetchPending();
    } catch {
      // Ignore
    } finally {
      setProcessingId(null);
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      read: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "READ" },
      write: { bg: "bg-amber-500/10", text: "text-amber-400", label: "WRITE" },
      execute: { bg: "bg-orange-500/10", text: "text-orange-400", label: "EXECUTE" },
      dangerous: { bg: "bg-red-500/10", text: "text-red-400", label: "DANGEROUS" },
    };
    const style = styles[riskLevel as keyof typeof styles]!;
    return <Badge className={`${style.bg} ${style.text} text-[9px]`}>{style.label}</Badge>;
  };

  const getToolIcon = (toolName: string) => {
    if (toolName.includes("search")) return <FileText className="h-4 w-4 text-sky-400" />;
    if (toolName.includes("read")) return <Terminal className="h-4 w-4 text-emerald-400" />;
    if (toolName.includes("note")) return <Send className="h-4 w-4 text-amber-400" />;
    return <Terminal className="h-4 w-4 text-purple-400" />;
  };

  return (
    <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Approval Gate
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs">
              {pendingActions.length} Pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Agent actions requiring human approval before execution. Controlled and audited.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPending} disabled={isLoading} className="text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Card className="border-border/70 bg-card/40 flex-1">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{pendingActions.length}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/40 flex-1">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-emerald-400">Approved</div>
            <div className="text-[10px] text-muted-foreground">This Session</div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/40 flex-1">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-400">Rejected</div>
            <div className="text-[10px] text-muted-foreground">This Session</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Actions List */}
      <div className="space-y-3">
        {pendingActions.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/10 p-10 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No pending approvals</p>
            <p className="text-xs text-muted-foreground mt-1">
              All agent actions are either auto-approved (read risk) or waiting for your review.
            </p>
          </Card>
        ) : (
          pendingActions.map((action) => (
            <Card key={action.proposal.id} className="border-border/70 bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/80 border border-border/60">
                      {getToolIcon(action.proposal.tool_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{action.proposal.tool_name}</span>
                        {getRiskBadge(action.proposal.risk_level)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        Proposed by {action.proposal.id?.split("-")[0] ?? "unknown"} · {action.wait_seconds}s ago
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reasoning */}
                <div className="bg-muted/30 p-3 rounded-lg border border-border/40 text-xs text-foreground">
                  <div className="font-semibold text-muted-foreground mb-1">Agent Reasoning:</div>
                  {action.proposal.reasoning}
                </div>

                {/* Arguments */}
                {Object.keys(action.proposal.arguments).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-semibold self-center">Args:</span>
                    {Object.entries(action.proposal.arguments).map(([k, v]) => (
                      <code key={k} className="text-[10px] bg-background/80 px-2 py-0.5 rounded border border-border/40 font-mono text-foreground">
                        {k}={typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </code>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {action.summary && (
                  <div className="text-[10px] text-muted-foreground bg-background/50 p-2 rounded border border-border/30 font-mono">
                    {action.summary}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleDecision(action.proposal.id, true, "Approved by user")}
                    disabled={processingId === action.proposal.id}
                  >
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleDecision(action.proposal.id, false, "Denied by user")}
                    disabled={processingId === action.proposal.id}
                  >
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
