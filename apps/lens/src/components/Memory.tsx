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
  Brain,
  Search,
  Trash2,
  Clock,
  MessageSquare,
  Loader2,
} from "lucide-react";
import {
  memorySearch,
  memoryHistory,
  memoryClear,
  memoryStats,
  type MemoryEntry,
} from "@/lib/api";

interface MemoryProps {
  currentUserId: string;
  currentTenantId: string;
}

export function Memory({ currentUserId, currentTenantId }: MemoryProps) {
  const [entries, setEntries] = React.useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [stats, setStats] = React.useState<{ total: number; today: number }>({ total: 0, today: 0 });

  const fetchHistory = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const history = await memoryHistory(currentUserId, currentTenantId, 50);
      setEntries(history);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, currentTenantId]);

  const fetchStats = React.useCallback(async () => {
    try {
      const s = await memoryStats(currentUserId, currentTenantId);
      setStats(s);
    } catch {
      // ignore
    }
  }, [currentUserId, currentTenantId]);

  React.useEffect(() => {
    fetchHistory();
    fetchStats();
  }, [fetchHistory, fetchStats]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const results = await memorySearch(searchQuery, currentUserId, currentTenantId, 10);
      setEntries(results);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all conversation memory for this user?")) return;
    setIsDeleting(true);
    try {
      await memoryClear(currentUserId, currentTenantId);
      setEntries([]);
      await fetchStats();
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Long-Term Conversation Memory
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.total} conversations stored ({stats.today} today).
                The agent remembers past Q&A and retrieves them when relevant.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isDeleting || stats.total === 0}
              className="h-8 text-xs gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear Memory
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search past conversations..."
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
              disabled={isLoading}
              className="h-8 px-3 gap-1"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversation List */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            Conversation History
          </CardTitle>
          <CardDescription className="text-xs">
            All past questions and answers stored as long-term memory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              Loading conversation memory...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              <Clock className="h-8 w-8 mb-2 opacity-40 mx-auto" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Start chatting to build your conversation memory. The agent will
                automatically remember and retrieve past Q&A.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg border border-border/70 bg-card/40 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(entry.created_at).toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-primary shrink-0">You:</span>
                      <span className="text-foreground">{entry.query}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-emerald-400 shrink-0">AI:</span>
                      <span className="text-foreground line-clamp-2">{entry.response}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}