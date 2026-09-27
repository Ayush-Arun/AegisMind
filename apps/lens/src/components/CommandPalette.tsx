import * as React from "react";
import { Command } from "cmdk";
import {
  Search,
  MessageSquare,
  Network,
  Share2,
  FolderPlus,
  ShieldCheck,
  Laptop,
  Database,
  BookOpen,
  GitBranch,
  CheckCircle,
  Brain,
  Terminal,
} from "lucide-react";

export type NavView =
  | "chat"
  | "search"
  | "connectors"
  | "access"
  | "datasets"
  | "notes"
  | "tools"
  | "graph"
  | "approval"
  | "memory";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: NavView) => void;
  onOpenResourcePicker: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  onOpenResourcePicker,
}: CommandPaletteProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Cmd+K / Ctrl+K
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      // Close immediately on Escape
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in-0 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
      >
        <Command
          className="w-full"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search tools, docs & views..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2 text-sm text-foreground">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              <Command.Item
                onSelect={() => {
                  onNavigate("chat");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Conversational AI Chat</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("connectors");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Share2 className="h-4 w-4 text-primary" />
                <span>Enterprise Connectors</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("datasets");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Database className="h-4 w-4 text-primary" />
                <span>Datasets & Study Hub</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("notes");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Notes & Canvas</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("search");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Search className="h-4 w-4 text-primary" />
                <span>Hybrid RRF Search</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("graph");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <GitBranch className="h-4 w-4 text-primary" />
                <span>Knowledge Graph</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("approval");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Approvals Gate</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("access");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Network className="h-4 w-4 text-primary" />
                <span>Zanzibar Access Graph</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("memory");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Brain className="h-4 w-4 text-primary" />
                <span>Long-Term Memory</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("tools");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Terminal className="h-4 w-4 text-primary" />
                <span>Local CLI Tools</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Actions" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2 border-t border-border/50 pt-2">
              <Command.Item
                onSelect={() => {
                  onOpenChange(false);
                  onOpenResourcePicker();
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <FolderPlus className="h-4 w-4 text-emerald-500" />
                <span>Ingest Documents & Data Sources...</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onNavigate("access");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Inspect Permission Revocations</span>
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  window.open("https://github.com/eMohan07/AegisMind", "_blank");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
              >
                <Laptop className="h-4 w-4 text-muted-foreground" />
                <span>Open Documentation</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground bg-muted/20">
            <span>Navigate with ↑↓, Enter to select</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono border border-border/60">ESC to close</kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}
