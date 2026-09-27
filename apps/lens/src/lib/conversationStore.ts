/**
 * AegisMind Cross-Chatbox Conversation Store
 *
 * Centralised, localStorage-backed store for every chatbox conversation
 * across Home (Chat), Datasets, and Notes/Study pages.
 *
 * Other components call `recordMessage()` to persist a message pair, and
 * `getAllConversations()` to read the unified timeline in Memory.
 *
 * A native CustomEvent ("aegismind-conv-update") is dispatched on `window`
 * so the Memory component can re-render reactively without polling.
 */

export type ConvSource = "home" | "dataset" | "notes";

export interface ConvMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ConvThread {
  /** Unique thread key: e.g. "home", "doc-123", "study-abc.pdf" */
  threadId: string;
  /** Human-readable label shown in Memory */
  label: string;
  source: ConvSource;
  /** ISO-8601 timestamp of last message */
  updatedAt: string;
  messages: ConvMessage[];
}

const STORE_KEY = "aegismind_all_conversations";
const STORE_EVENT = "aegismind-conv-update";

function readStore(): Record<string, ConvThread> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ConvThread>) : {};
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, ConvThread>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(STORE_EVENT));
  } catch {
    // Storage full or unavailable - silently ignore
  }
}

/**
 * Append a user+assistant exchange to a thread.
 * Creates the thread on first call.
 */
export function recordExchange(opts: {
  threadId: string;
  label: string;
  source: ConvSource;
  userMessage: { id: string; content: string; timestamp: string };
  assistantMessage: { id: string; content: string; timestamp: string };
}): void {
  const store = readStore();
  const thread: ConvThread = store[opts.threadId] ?? {
    threadId: opts.threadId,
    label: opts.label,
    source: opts.source,
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  // Update label in case it changed (e.g. document renamed)
  thread.label = opts.label;
  thread.source = opts.source;
  thread.updatedAt = new Date().toISOString();

  thread.messages.push(
    {
      id: opts.userMessage.id,
      role: "user",
      content: opts.userMessage.content,
      timestamp: opts.userMessage.timestamp,
    },
    {
      id: opts.assistantMessage.id,
      role: "assistant",
      content: opts.assistantMessage.content,
      timestamp: opts.assistantMessage.timestamp,
    }
  );

  // Cap each thread at 200 messages to avoid unbounded growth
  if (thread.messages.length > 200) {
    thread.messages = thread.messages.slice(thread.messages.length - 200);
  }

  store[opts.threadId] = thread;
  writeStore(store);
}

/**
 * Return all threads sorted by most-recently-updated first.
 */
export function getAllConversations(): ConvThread[] {
  const store = readStore();
  return Object.values(store).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Return a flat, time-sorted list of ALL messages across every thread,
 * enriched with their thread label and source for display in Memory.
 */
export interface FlatMessage extends ConvMessage {
  threadId: string;
  threadLabel: string;
  source: ConvSource;
}

export function getFlatMessages(limit = 500): FlatMessage[] {
  const store = readStore();
  const flat: FlatMessage[] = [];
  for (const thread of Object.values(store)) {
    for (const msg of thread.messages) {
      flat.push({
        ...msg,
        threadId: thread.threadId,
        threadLabel: thread.label,
        source: thread.source,
      });
    }
  }
  // Sort by timestamp descending (newest first)
  flat.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    // Fallback for non-ISO timestamps like "Just now" or "Now"
    return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
  });
  return flat.slice(0, limit);
}

/**
 * Clear all stored conversations.
 */
export function clearAllConversations(): void {
  try {
    localStorage.removeItem(STORE_KEY);
    window.dispatchEvent(new CustomEvent(STORE_EVENT));
  } catch {
    // Ignore
  }
}

/**
 * Clear a single thread.
 */
export function clearThread(threadId: string): void {
  const store = readStore();
  delete store[threadId];
  writeStore(store);
}

/**
 * Subscribe to store updates. Returns an unsubscribe function.
 */
export function subscribeToStore(cb: () => void): () => void {
  window.addEventListener(STORE_EVENT, cb);
  return () => window.removeEventListener(STORE_EVENT, cb);
}
