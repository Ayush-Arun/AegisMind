/**
 * AegisMind API client.
 * Connects to the aegismind-core backend service.
 * Does not expose any master encryption keys or server-side secrets.
 */

export interface Principal {
  id: string;
  type: "user" | "group" | "service";
  tenant_id: string;
  attributes?: Record<string, unknown>;
}

export interface Citation {
  chunk_id: string;
  document_id: string;
  title: string;
  uri: string;
  snippet: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  title: string;
  uri: string;
  snippet: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface ConnectorSpec {
  name: string;
  description: string;
  version: string;
  network_required: boolean;
  requires_auth: boolean;
  auth_schema?: Record<string, any>;
}

export interface ConnectorRegistration {
  connector_id: string;
  status: "registered" | "connected" | "error";
  last_sync_at?: string;
  indexed_documents: number;
  indexed_chunks: number;
  sync_status?: any;
}

export interface ConnectorInfo {
  name: string;
  title: string;
  description: string;
  version: string;
  status: "registered" | "connected" | "error" | "syncing" | "disconnected";
  lastSync?: string;
  recordCount?: number;
  configSchema?: Record<string, unknown>;
  spec?: ConnectorSpec;
  registration?: ConnectorRegistration;
}

export interface SystemMode {
  air_gapped: boolean;
  mode_label: string;
  external_connectors_enabled: boolean;
}

export interface AccessRelation {
  resource: string;
  relation: string;
  subject: string;
  allowed: boolean;
  path?: string[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: string;
  principal_id: string;
  resource_id?: string;
  action: string;
  status: "allowed" | "denied" | "success" | "failure";
}

export interface ModelInfo {
  models: string[];
  active_model: string;
  provider: string;
}

export interface IngestDocumentParams {
  title: string;
  content: string;
  tenant_id?: string;
  allowed_users?: string[];
  document_id?: string;
  uri?: string;
}

export interface IngestDocumentResponse {
  status: string;
  document_id: string;
  title: string;
  chunk_count?: number;
  chunks_count?: number;
  content?: string;
  allowed_users: string[];
}

export interface ParseFileResponse {
  filename: string;
  title: string;
  content: string;
  file_type: string;
  char_count: number;
  page_count: number;
}

export interface StudyParams {
  title: string;
  content: string;
  query: string;
  mode?: "qa" | "quiz" | "summary" | "explain";
  user_id?: string;
  tenant_id?: string;
}

export interface StudyResponse {
  title: string;
  answer: string;
  mode: string;
  memory_saved?: boolean;
}

export interface DatasetChatParams {
  document_id?: string;
  title?: string;
  content?: string;
  query: string;
  user_id?: string;
  tenant_id?: string;
}

export interface DatasetChatResponse {
  document_id: string;
  title: string;
  answer: string;
  memory_saved?: boolean;
}

export interface ResourceItem {
  id: string;
  title: string;
  type?: string;
  connector?: string;
  last_indexed?: string;
  chunk_count?: number;
  chunks_count?: number;
  content?: string;
  file_type?: string;
  page_count?: number;
  char_count?: number;
  allowed_users?: string[];
  uri?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export async function search(params: {
  query: string;
  tenant_id: string;
  user_id: string;
  limit?: number;
  filters?: Record<string, unknown>;
}): Promise<{ results: SearchResult[]; total: number }> {
  const response = await fetch(`${API_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-ID": params.tenant_id,
      "X-User-ID": params.user_id,
    },
    body: JSON.stringify({
      query: params.query,
      tenant_id: params.tenant_id,
      user_id: params.user_id,
      principal_id: params.user_id,
      limit: params.limit ?? 10,
      top_k: params.limit ?? 10,
      filters: params.filters,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }
  return response.json();
}

export async function listConnectors(): Promise<{ connectors: ConnectorInfo[]; total: number; mode: string }> {
  try {
    const response = await fetch(`${API_BASE}/connectors`);
    if (!response.ok) {
      return { connectors: [], total: 0, mode: "UNKNOWN" };
    }
    const data = await response.json();
    const rawList = data.connectors;
    if (!Array.isArray(rawList)) {
      return { connectors: [], total: 0, mode: "UNKNOWN" };
    }

    const mapped = rawList.map((item: any) => {
      const spec = item.spec || {};
      const reg = item.registration || {};
      const name = spec.name || item.name || "connector";

      const formattedTitle = name
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase());

      return {
        name: item.connector_id || name,
        title: spec.title || spec.display_name || formattedTitle,
        description: spec.description || "Connector",
        version: spec.version || "0.1.0",
        status: reg.status || "registered",
        lastSync: reg.last_sync_at || null,
        recordCount: reg.indexed_documents || 0,
        spec,
        registration: reg,
      };
    });

    return {
      connectors: mapped,
      total: data.total || mapped.length,
      mode: data.mode || "CONNECTED",
    };
  } catch {
    return { connectors: [], total: 0, mode: "UNKNOWN" };
  }
}

export async function getConnectorDetail(connectorId: string): Promise<ConnectorInfo | null> {
  try {
    const response = await fetch(`${API_BASE}/connectors/${connectorId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function triggerSync(connectorId: string): Promise<{ status: string; report?: any }> {
  try {
    const response = await fetch(`${API_BASE}/connectors/${connectorId}/sync`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    throw error;
  }
}

export async function connectConnector(connectorId: string, token?: string, config?: Record<string, any>): Promise<any> {
  const response = await fetch(`${API_BASE}/connectors/${connectorId}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, config }),
  });
  if (!response.ok) {
    throw new Error(`Connect failed: ${response.statusText}`);
  }
  return response.json();
}

export async function getSystemMode(): Promise<SystemMode> {
  const response = await fetch(`${API_BASE}/system/mode`);
  if (!response.ok) {
    throw new Error("Failed to get system mode");
  }
  return response.json();
}

export async function setSystemMode(air_gapped: boolean): Promise<SystemMode> {
  const response = await fetch(`${API_BASE}/system/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ air_gapped }),
  });
  if (!response.ok) {
    throw new Error("Failed to set system mode");
  }
  return response.json();
}

export type OAuthProviderName = "github" | "google";

export interface OAuthProviderStatus {
  configured: boolean;
}

export interface OAuthStatus {
  github: OAuthProviderStatus;
  google: OAuthProviderStatus;
}

export function getOAuthStartUrl(provider: OAuthProviderName): string {
  return `${API_BASE}/oauth/${provider}/start`;
}

export async function getOAuthStatus(): Promise<OAuthStatus> {
  try {
    const response = await fetch(`${API_BASE}/oauth/status`);
    if (!response.ok) {
      return { github: { configured: false }, google: { configured: false } };
    }
    return response.json();
  } catch {
    return { github: { configured: false }, google: { configured: false } };
  }
}

export async function checkAccessGraph(user_id: string, tenant_id: string): Promise<AccessRelation[]> {
  try {
    const response = await fetch(`${API_BASE}/access/graph?user_id=${encodeURIComponent(user_id)}&tenant_id=${encodeURIComponent(tenant_id)}`);
    if (!response.ok) {
      return getSampleAccessGraph(user_id);
    }
    return response.json();
  } catch {
    return getSampleAccessGraph(user_id);
  }
}

export function streamChat(params: {
  query: string;
  tenant_id: string;
  user_id: string;
  model?: string;
  sources?: string[];
  active_document?: string;
  chat_history?: Array<{ role: string; content: string }>;
  onToken: (token: string) => void;
  onThinking: (status: string) => void;
  onCitations: (citations: Citation[]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: params.query,
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          principal_id: params.user_id,
          model: params.model,
          sources: params.sources?.join(","),
          active_document: params.active_document,
          chat_history: params.chat_history,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        params.onError(new Error(`Server error ${response.status}: ${errText}`));
        return;
      }

      if (!response.body) {
        params.onDone();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6);
            }
          }

          if (eventType === "thinking") {
            params.onThinking(dataStr);
          } else if (eventType === "token") {
            try {
              const parsed = JSON.parse(dataStr);
              if (typeof parsed === "object" && parsed !== null && "token" in parsed) {
                params.onToken(String(parsed.token));
              } else {
                params.onToken(dataStr);
              }
            } catch {
              params.onToken(dataStr);
            }
          } else if (eventType === "citations") {
            try {
              const citations = JSON.parse(dataStr);
              if (Array.isArray(citations)) {
                params.onCitations(citations);
              }
            } catch {
              // ignore
            }
          } else if (eventType === "done") {
            params.onDone();
            return;
          }
        }
      }
      params.onDone();
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      params.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => {
    controller.abort();
  };
}

export async function listModels(): Promise<ModelInfo> {
  try {
    const response = await fetch(`${API_BASE}/models`);
    if (!response.ok) {
      return {
        models: ["qwen3.5:9b", "qwen3.5:2b"],
        active_model: "qwen3.5:9b",
        provider: "ollama",
      };
    }
    return response.json();
  } catch {
    return {
      models: ["qwen3.5:9b", "qwen3.5:2b"],
      active_model: "qwen3.5:9b",
      provider: "ollama",
    };
  }
}

export async function listIndexedResources(): Promise<ResourceItem[]> {
  try {
    const response = await fetch(`${API_BASE}/resources`);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.resources ?? [];
  } catch {
    return [];
  }
}

export async function ingestDocument(params: IngestDocumentParams): Promise<IngestDocumentResponse> {
  const response = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ingest failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function deleteDocument(documentId: string): Promise<{ status: string; document_id: string }> {
  const response = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Delete failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function parseFile(file: File): Promise<ParseFileResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/documents/parse-file`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Parse failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function uploadDocumentFile(
  file: File,
  params?: {
    title?: string;
    allowed_users?: string[];
    tenant_id?: string;
  }
): Promise<IngestDocumentResponse & { char_count: number; file_type: string; page_count: number }> {
  const formData = new FormData();
  formData.append("file", file);
  if (params?.title) formData.append("title", params.title);
  if (params?.tenant_id) formData.append("tenant_id", params.tenant_id);
  if (params?.allowed_users && params.allowed_users.length > 0) {
    formData.append("allowed_users", params.allowed_users.join(","));
  }

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function studyDocument(params: StudyParams): Promise<StudyResponse> {
  const response = await fetch(`${API_BASE}/study/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title,
      content: params.content,
      query: params.query,
      mode: params.mode || "qa",
      user_id: params.user_id || "alice",
      tenant_id: params.tenant_id || "corp-default",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Study query failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function chatWithDataset(params: DatasetChatParams): Promise<DatasetChatResponse> {
  const docId = params.document_id || "default";
  const response = await fetch(`${API_BASE}/datasets/${encodeURIComponent(docId)}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.query,
      document_id: params.document_id,
      title: params.title,
      content: params.content,
      user_id: params.user_id || "alice",
      tenant_id: params.tenant_id || "corp-default",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Dataset chat query failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export async function createVaultNote(params: {
  title: string;
  content: string;
  tags?: string[];
  source_query?: string;
}): Promise<{ status: string; message: string; title: string }> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: params.title,
      content: params.content,
      tags: params.tags || ["study", "learning"],
      source_query: params.source_query,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Save note failed: ${response.statusText} (${errText})`);
  }
  return response.json();
}

export function getFallbackConnectors(): ConnectorInfo[] {
  return [
    {
      name: "confluence",
      title: "Confluence",
      description: "Sync spaces, pages, blog posts, and space/page restrictions with sovereign access policies.",
      version: "0.1.0",
      status: "connected",
      lastSync: "10 minutes ago",
      recordCount: 1420,
    },
    {
      name: "google_drive",
      title: "Google Drive",
      description: "Index files, folders, and shared drives with fine-grained domain and user permissions.",
      version: "0.1.0",
      status: "connected",
      lastSync: "1 hour ago",
      recordCount: 5210,
    },
    {
      name: "jira",
      title: "Jira",
      description: "Ingest projects, issues, comments, and issue security schemes.",
      version: "0.1.0",
      status: "connected",
      lastSync: "3 hours ago",
      recordCount: 3840,
    },
    {
      name: "github",
      title: "GitHub",
      description: "Index repositories, markdown documentation, issues, pull requests, and team access lists.",
      version: "0.1.0",
      status: "connected",
      lastSync: "Just now",
      recordCount: 890,
    },
    {
      name: "slack",
      title: "Slack",
      description: "Public and private channels with thread context and member channel authorizations.",
      version: "0.1.0",
      status: "disconnected",
      recordCount: 0,
    },
    {
      name: "notion",
      title: "Notion",
      description: "Workspaces, databases, and hierarchical page trees with page-level restrictions.",
      version: "0.1.0",
      status: "connected",
      lastSync: "Yesterday",
      recordCount: 650,
    },
    {
      name: "salesforce",
      title: "Salesforce",
      description: "Knowledge articles, accounts, opportunities, and role hierarchy access controls.",
      version: "0.1.0",
      status: "disconnected",
      recordCount: 0,
    },
    {
      name: "sharepoint",
      title: "SharePoint",
      description: "Sites, document libraries, item-level permissions, and Microsoft 365 group mappings.",
      version: "0.1.0",
      status: "connected",
      lastSync: "4 hours ago",
      recordCount: 4120,
    },
  ];
}

function getSampleAccessGraph(userId: string): AccessRelation[] {
  return [
    {
      resource: "doc:arch-overview",
      relation: "viewer",
      subject: `user:${userId}`,
      allowed: true,
      path: [`user:${userId}`, "group:engineering#member", "doc:arch-overview#viewer"],
    },
    {
      resource: "doc:q3-roadmap",
      relation: "editor",
      subject: `user:${userId}`,
      allowed: true,
      path: [`user:${userId}`, "doc:q3-roadmap#editor"],
    },
    {
      resource: "doc:executive-salaries",
      relation: "viewer",
      subject: `user:${userId}`,
      allowed: false,
      path: [`user:${userId}`, "denied by policy (no path)"],
    },
    {
      resource: "folder:infrastructure",
      relation: "owner",
      subject: `user:${userId}`,
      allowed: true,
      path: [`user:${userId}`, "group:devops#member", "folder:infrastructure#owner"],
    },
    {
      resource: "doc:board-deck-2026",
      relation: "viewer",
      subject: `user:${userId}`,
      allowed: false,
      path: [`user:${userId}`, "denied by policy (restricted)"],
    },
  ];
}

export interface NoteSummary {
  slug: string;
  title: string;
  tags: string[];
  created_at: string;
  source_query?: string | null;
  preview: string;
  path: string;
}

export interface NoteDetail {
  slug: string;
  title: string;
  tags: string[];
  created_at?: string;
  source_query?: string | null;
  content: string;
  raw: string;
}

export interface LocalToolActivityEvent {
  event_id: string;
  timestamp: string;
  tool_name: string;
  category: "filesystem" | "knowledge" | "sandbox" | "notes" | "system";
  parameters: Record<string, unknown>;
  status: "running" | "success" | "failed";
  duration_ms: number;
  agent_id: string;
  source: string;
  approval_required: boolean;
  error?: string | null;
  result_summary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AgentToolEvent {
  id: string;
  timestamp: string;
  event_type: string;
  principal_id: string;
  action: string;
  metadata: {
    command?: string;
    argv?: string[];
    arguments?: Record<string, unknown>;
    working_directory?: string;
    exit_code?: number;
    success?: boolean;
    result_summary?: string;
    reason?: string;
    output_excerpt?: string;
  };
}

export async function listNotes(tag?: string): Promise<NoteSummary[]> {
  try {
    const url = tag ? `${API_BASE}/notes?tag=${encodeURIComponent(tag)}` : `${API_BASE}/notes`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as NoteSummary[];
  } catch {
    return [];
  }
}

export async function getNoteDetail(slug: string): Promise<NoteDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return (await res.json()) as NoteDetail;
  } catch {
    return null;
  }
}

export async function deleteNote(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/notes/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}


export async function getLocalToolActivity(
  category?: string,
  status?: string,
  limit = 50,
): Promise<LocalToolActivityEvent[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== "All") params.set("category", category.toLowerCase());
    if (status && status !== "All") params.set("status", status.toLowerCase());
    params.set("limit", String(limit));
    const qs = params.toString();

    let res = await fetch(`${API_BASE}/local-tools/activity${qs ? `?${qs}` : ""}`);
    if (!res.ok) {
      res = await fetch(`/api/local-tools/activity${qs ? `?${qs}` : ""}`);
    }
    if (!res.ok) {
      res = await fetch(`${API_BASE}/agent/tools`);
    }
    if (!res.ok) return [];

    const raw = (await res.json()) as Array<Record<string, unknown>>;
    return raw.map((item) => {
      const eventId = String(item.event_id || item.id || `evt-${Math.random()}`);
      const rawTool = String(item.tool_name || item.action || "unknown").replace("invoke_", "");
      const cat = (item.category as LocalToolActivityEvent["category"]) || "system";
      const meta = (item.metadata as Record<string, unknown>) || {};
      const paramsObj = (item.parameters as Record<string, unknown>) || (meta.arguments as Record<string, unknown>) || (meta.command ? { cmd: meta.command } : {});
      const stat: "running" | "success" | "failed" =
        item.status === "running"
          ? "running"
          : item.status === "failed" || meta.success === false
            ? "failed"
            : "success";
      const dur = typeof item.duration_ms === "number" ? item.duration_ms : typeof meta.duration_ms === "number" ? meta.duration_ms : 0;
      const resSum = (item.result_summary as string) || (meta.result_summary as string) || (meta.output_excerpt as string) || null;
      const err = (item.error as string) || (meta.reason as string) || null;

      return {
        event_id: eventId,
        timestamp: String(item.timestamp || new Date().toISOString()),
        tool_name: rawTool,
        category: cat,
        parameters: paramsObj,
        status: stat,
        duration_ms: dur,
        agent_id: String(item.agent_id || item.principal_id || "local_agent"),
        source: String(item.source || "local"),
        approval_required: Boolean(item.approval_required),
        error: err,
        result_summary: resSum,
        metadata: meta,
      };
    });
  } catch {
    return [];
  }
}

export async function clearLocalToolActivity(): Promise<boolean> {
  try {
    let res = await fetch(`${API_BASE}/local-tools/activity`, { method: "DELETE" });
    if (!res.ok) {
      res = await fetch(`/api/local-tools/activity`, { method: "DELETE" });
    }
    return res.ok;
  } catch {
    return false;
  }
}

export function getLocalToolEventsUrl(): string {
  return `${API_BASE}/local-tools/events`;
}

export async function listAgentTools(): Promise<AgentToolEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/agent/tools`);
    if (!res.ok) return [];
    return (await res.json()) as AgentToolEvent[];
  } catch {
    return [];
  }
}

// --- Knowledge Graph API ---

export interface GraphNode {
  id: string;
  entity_type: string;
  name: string;
  properties: Record<string, unknown>;
  connections: string[];
  created_at: string;
  source_query?: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  confidence: number;
  timestamp: string;
}

export interface GraphStats {
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
}

export interface GraphQueryResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_count: number;
}

export interface PendingActionData {
  proposal: {
    id: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    reasoning: string;
    risk_level: string;
    status: string;
    created_at: string;
  };
  wait_seconds: number;
  summary: string;
}

export async function listGraphNodes(): Promise<GraphQueryResponse> {
  try {
    const res = await fetch(`${API_BASE}/graph/nodes`);
    if (!res.ok) return { nodes: [], edges: [], total_count: 0 };
    const data = await res.json();
    return data as GraphQueryResponse;
  } catch {
    return { nodes: [], edges: [], total_count: 0 };
  }
}

export async function listGraphEdges(): Promise<GraphQueryResponse> {
  try {
    const res = await fetch(`${API_BASE}/graph/edges`);
    if (!res.ok) return { nodes: [], edges: [], total_count: 0 };
    const data = await res.json();
    return data as GraphQueryResponse;
  } catch {
    return { nodes: [], edges: [], total_count: 0 };
  }
}

export async function getGraphStats(): Promise<GraphStats> {
  try {
    const res = await fetch(`${API_BASE}/graph/stats`);
    if (!res.ok) return { total_nodes: 0, total_edges: 0, node_types: {} };
    const data = await res.json();
    return data as GraphStats;
  } catch {
    return { total_nodes: 0, total_edges: 0, node_types: {} };
  }
}

export async function queryGraph(params: { query?: string; entity_type?: string; limit?: number }): Promise<GraphQueryResponse> {
  try {
    const url = new URL(`${API_BASE}/graph/query`);
    if (params.query) url.searchParams.set("query", params.query);
    if (params.entity_type) url.searchParams.set("entity_type", params.entity_type);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    const res = await fetch(url);
    if (!res.ok) return { nodes: [], edges: [], total_count: 0 };
    const data = await res.json();
    return data as GraphQueryResponse;
  } catch {
    return { nodes: [], edges: [], total_count: 0 };
  }
}

// --- Approval Gate API ---

export async function getPendingActions(): Promise<{ pending_actions: PendingActionData[]; total: number }> {
  try {
    const res = await fetch(`${API_BASE}/approval/pending`);
    if (!res.ok) return { pending_actions: [], total: 0 };
    const data = await res.json();
    return data as { pending_actions: PendingActionData[]; total: number };
  } catch {
    return { pending_actions: [], total: 0 };
  }
}

export async function decideAction(params: { proposal_id: string; approved: boolean; reason: string; reviewed_by: string }): Promise<{ status: string; proposal_id: string }> {
  const res = await fetch(`${API_BASE}/approval/decide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Decision failed: ${res.statusText}`);
  const data = await res.json();
  return data as { status: string; proposal_id: string };
}

export async function getApprovalStats(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  try {
    const res = await fetch(`${API_BASE}/approval/stats`);
    if (!res.ok) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    const data = await res.json();
    return data as { total: number; pending: number; approved: number; rejected: number };
  } catch {
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
}

export async function proposeAction(params: { tool_name: string; arguments: Record<string, unknown>; reasoning: string; risk_level: string }): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/approval/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Proposal failed: ${res.statusText}`);
  const data = await res.json();
  return data as { id: string; status: string };
}

// --- Long-Term Conversation Memory API (legacy, kept for backward compatibility) ---

export interface MemoryEntry {
  id: string;
  query: string;
  response: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface MemoryStats {
  total: number;
  today: number;
}

export async function memoryStats(userId: string, tenantId: string): Promise<MemoryStats> {
  try {
    const res = await fetch(`${API_BASE}/memory/stats?user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return { total: 0, today: 0 };
    return res.json() as Promise<MemoryStats>;
  } catch {
    return { total: 0, today: 0 };
  }
}

export async function memoryHistory(userId: string, tenantId: string, limit?: number): Promise<MemoryEntry[]> {
  try {
    const url = new URL(`${API_BASE}/memory/history`);
    url.searchParams.set("user_id", userId);
    url.searchParams.set("tenant_id", tenantId);
    if (limit) url.searchParams.set("limit", String(limit));
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<MemoryEntry[]>;
  } catch {
    return [];
  }
}

export async function memorySearch(q: string, userId: string, tenantId: string, top_k?: number): Promise<MemoryEntry[]> {
  try {
    const url = new URL(`${API_BASE}/memory/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("user_id", userId);
    url.searchParams.set("tenant_id", tenantId);
    if (top_k) url.searchParams.set("top_k", String(top_k));
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json() as Promise<MemoryEntry[]>;
  } catch {
    return [];
  }
}

export async function memoryClear(userId: string, tenantId: string): Promise<{ status: string }> {
  try {
    const res = await fetch(`${API_BASE}/memory/clear?user_id=${encodeURIComponent(userId)}&tenant_id=${encodeURIComponent(tenantId)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear failed: ${res.statusText}`);
    return res.json() as Promise<{ status: string }>;
  } catch {
    throw new Error("Failed to clear memory");
  }
}

// --- Typed Long-Term Memory API (Phase 4+) ---

export type MemoryType = "semantic" | "episodic" | "procedural" | "preference";
export type MemoryStatusType = "active" | "pending" | "rejected" | "forgotten" | "superseded";

export interface MemoryRecord {
  id: string;
  namespace: string;
  type: MemoryType;
  content: string;
  entities: string[];
  confidence: number;
  importance: number;
  status: MemoryStatusType;
  pinned: boolean;
  sensitivity: string;
  source_thread_id: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  access_count: number;
  valid_from: string | null;
  valid_to: string | null;
  superseded_by: string | null;
  content_hash: string;
}

export interface MemoryAuditEvent {
  seq: number;
  ts: string;
  event: string;
  memory_id: string;
  actor: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

export async function listMemoryRecords(
  namespace: string = "global",
  status?: MemoryStatusType,
  type?: MemoryType,
  limit: number = 50,
): Promise<MemoryRecord[]> {
  const url = new URL(`${API_BASE}/memory/records`, window.location.origin);
  url.searchParams.set("namespace", namespace);
  if (status) url.searchParams.set("status", status);
  if (type) url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json() as Promise<MemoryRecord[]>;
}

export async function getMemoryRecord(memoryId: string): Promise<MemoryRecord | null> {
  const res = await fetch(`${API_BASE}/memory/records/${encodeURIComponent(memoryId)}`);
  if (!res.ok) return null;
  return res.json() as Promise<MemoryRecord>;
}

export async function updateMemoryRecord(
  memoryId: string,
  updates: Partial<Pick<MemoryRecord, "content" | "importance" | "type" | "entities" | "status">>,
): Promise<MemoryRecord> {
  const res = await fetch(`${API_BASE}/memory/records/${encodeURIComponent(memoryId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
  return res.json() as Promise<MemoryRecord>;
}

export async function approveMemory(memoryId: string): Promise<MemoryRecord> {
  return updateMemoryRecord(memoryId, { status: "active" as MemoryStatusType });
}

export async function rejectMemory(memoryId: string): Promise<MemoryRecord> {
  return updateMemoryRecord(memoryId, { status: "rejected" as MemoryStatusType });
}

export async function forgetMemory(memoryId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/memory/records/${encodeURIComponent(memoryId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Forget failed: ${res.statusText}`);
  return res.json() as Promise<{ status: string }>;
}

export async function getMemoryAudit(memoryId: string): Promise<MemoryAuditEvent[]> {
  const res = await fetch(`${API_BASE}/memory/records/${encodeURIComponent(memoryId)}/audit`);
  if (!res.ok) return [];
  return res.json() as Promise<MemoryAuditEvent[]>;
}

// ============================================================================
// Legal Intelligence Multi-Agent Chamber API
// ============================================================================

export interface LegalCaseInput {
  case_title: string;
  case_text: string;
  case_type: string;
  court_forum: string;
  client_posture: string;
  specific_questions?: string[];
}

export interface ExtractedFacts {
  case_title: string;
  court_forum: string;
  parties: Record<string, string>;
  key_statutes: string[];
  chronological_events: { date: string; event: string }[];
  undisputed_facts: string[];
  disputed_contentions: string[];
  core_legal_issues: string[];
}

export interface WeaknessItem {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  category: string;
  title: string;
  description: string;
  statutory_basis: string;
  impact_on_case: string;
  opposing_counsel_angle: string;
}

export interface StrategyItem {
  id: string;
  phase: string;
  remedy_title: string;
  procedural_mechanism: string;
  strategic_rationale: string;
  actionable_steps: string[];
  key_cross_examination_questions: string[];
}

export interface PrecedentItem {
  case_name: string;
  citation: string;
  court: string;
  applicable_ratio: string;
  relevance_summary: string;
  stance: "SUPPORTING" | "DISTINGUISHING_ADVERSE_AUTHORITY";
}

export interface LegalAuditReport {
  case_id: string;
  case_title: string;
  case_type: string;
  overall_strength_score: number;
  risk_level: "CRITICAL_RISK" | "HIGH_RISK" | "MODERATE_RISK" | "STRONG_POSITION";
  executive_summary: string;
  facts: ExtractedFacts;
  weaknesses: WeaknessItem[];
  strategic_approach: StrategyItem[];
  precedents: PrecedentItem[];
  full_legal_opinion: string;
  deliberation_log: { agent: string; status: string; summary: string }[];
}

export interface CaseUploadResponse {
  filename: string;
  title: string;
  pages_count: number;
  character_count: number;
  word_count: number;
  extracted_text: string;
}

export interface SampleCase {
  id: string;
  title: string;
  case_type: string;
  court_forum: string;
  client_posture: string;
  text: string;
}

export async function uploadCaseFile(file: File): Promise<CaseUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/legal/upload-case`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload failed with status ${res.status}`);
  }
  return res.json();
}

export async function analyzeCase(input: LegalCaseInput): Promise<LegalAuditReport> {
  const res = await fetch(`${API_BASE}/legal/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(err.detail || `Analysis failed with status ${res.status}`);
  }
  return res.json();
}

export async function getLegalPrecedents(query?: string): Promise<{ total: number; precedents: any[] }> {
  const url = query
    ? `${API_BASE}/legal/precedents?query=${encodeURIComponent(query)}`
    : `${API_BASE}/legal/precedents`;
  const res = await fetch(url);
  if (!res.ok) return { total: 0, precedents: [] };
  return res.json();
}

export async function getLegalSampleCases(): Promise<SampleCase[]> {
  try {
    const res = await fetch(`${API_BASE}/legal/sample-cases`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function streamLegalAnalysis(
  input: LegalCaseInput,
  onEvent: (event: any) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}/legal/analyze-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const dataMatch = block.match(/data:\s*(.+)/);
          if (dataMatch && dataMatch[1]) {
            try {
              const parsed = JSON.parse(dataMatch[1]);
              onEvent(parsed);
              if (parsed.type === "final_report") {
                onDone();
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
      onDone();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        onError(err);
      }
    }
  })();

  return () => controller.abort();
}

