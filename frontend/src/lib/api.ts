import { Repository as FrontendRepository, RepositoryStatus, RepositoryStructure, CodeEntity, RepositoryGraph, RepositoryArchitecture } from '../types';


export interface BackendRepository {
  id: number;
  user_id: number;
  github_url: string;
  status: string;
  created_at: string;
  repository_name: string | null;
  owner: string | null;
  description: string | null;
  language: string | null;
  stars: number | null;
  forks: number | null;
  github_id: string | null;
  default_branch: string | null;
  size_kb: number | null;
  last_metadata_sync?: string | null;
  local_path?: string | null;
  analysis_status: string;
  framework?: string | null;
  framework_confidence?: number | null;
}

export interface SubmitRepositoryResult {
  success: boolean;
  data?: BackendRepository;
  error?: string;
}

const API_BASE_URL = "http://localhost:8000";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid GitHub repository URL": "Invalid URL",
  "Repository does not exist": "Repository Not Found",
  "Repository must be public": "Repository Must Be Public",
  "GitHub API Error": "GitHub API Error",
  "User not found": "User not found. Please sign in again.",
  "Repository exceeds supported size limit.": "Repository exceeds supported size limit.",
};

function parseRepoName(url: string): string {
  try {
    const cleaned = url.trim().replace(/\/$/, "");
    const match = cleaned.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match && match[1]) {
      return match[1];
    }
    const parts = cleaned.split('/');
    if (parts.length >= 2) {
      return parts.slice(-2).join('/');
    }
    return cleaned || "unknown/repo";
  } catch {
    return "unknown/repo";
  }
}

function mapApiError(body: { error?: string; detail?: string }): string {
  const message = body.error || body.detail || "";
  return ERROR_MESSAGES[message] || message || "An error occurred while submitting the repository.";
}

export async function submitRepository(
  userEmail: string,
  githubUrl: string
): Promise<SubmitRepositoryResult> {
  const response = await fetch(
    `${API_BASE_URL}/repository/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_email: userEmail,
        github_url: githubUrl,
      }),
    }
  );

  const body = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: mapApiError(body),
    };
  }

  return {
    success: true,
    data: body as BackendRepository,
  };
}

const analysisStatuses = new Set<RepositoryStatus>(['READY', 'CLONING', 'CLONED', 'FAILED', 'SCANNING']);

export function mapBackendToFrontend(item: BackendRepository): FrontendRepository {
  const hasMetadata = Boolean(item.repository_name);
  const formattedDate = item.created_at
    ? (() => {
        const date = new Date(item.created_at);
        const datePart = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        const timePart = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `${datePart} · ${timePart}`;
      })()
    : "Just now";

  const formattedSyncDate = item.last_metadata_sync
    ? new Date(item.last_metadata_sync).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : null;

  return {
    id: String(item.id),
    name: item.repository_name || parseRepoName(item.github_url) || "Repository Name Pending",
    url: item.github_url,
    status: analysisStatuses.has(item.analysis_status as RepositoryStatus)
      ? item.analysis_status as RepositoryStatus
      : 'READY',
    submissionDate: formattedDate,
    stars: item.stars,
    branch: item.default_branch ?? (hasMetadata ? null : "Metadata Pending"),
    language: item.language ?? (hasMetadata ? null : "Language Unknown"),
    owner: item.owner,
    description: item.description,
    forks: item.forks,
    githubId: item.github_id,
    sizeKb: item.size_kb,
    lastMetadataSync: formattedSyncDate,
    framework: item.framework ?? null,
    frameworkConfidence: item.framework_confidence ?? null
  };
}

export async function getRepositories(
  email: string
): Promise<FrontendRepository[]> {
  const response = await fetch(
    `${API_BASE_URL}/repositories/${email}`
  );
  if (!response.ok) {
    return [];
  }
  const data: BackendRepository[] = await response.json();
  return data.map(mapBackendToFrontend);
}

export async function deleteRepository(
  id: string,
  email: string
): Promise<boolean> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}?email=${encodeURIComponent(email)}`,
    {
      method: "DELETE"
    }
  );
  return response.ok;
}

export async function refreshRepository(
  id: string,
  email: string
): Promise<FrontendRepository | null> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/refresh?email=${encodeURIComponent(email)}`,
    {
      method: "POST"
    }
  );
  if (!response.ok) {
    return null;
  }
  const item: BackendRepository = await response.json();
  return mapBackendToFrontend(item);
}

export async function cloneRepository(
  id: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/clone?email=${encodeURIComponent(email)}`,
    { method: "POST" }
  );
  const body = await response.json();
  if (!response.ok) {
    return { success: false, error: mapApiError(body) };
  }
  return { success: true };
}

export async function getRepositoryStructure(
  id: string,
  email: string
): Promise<RepositoryStructure> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/structure?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as RepositoryStructure;
}

export async function getRepositoryEntities(
  id: string,
  email: string
): Promise<CodeEntity[]> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/entities?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as CodeEntity[];
}

export async function getRepositoryGraph(
  id: string,
  email: string
): Promise<RepositoryGraph> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/graph?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as RepositoryGraph;
}

export async function getRepositoryArchitecture(
  id: string,
  email: string
): Promise<RepositoryArchitecture> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/architecture?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as RepositoryArchitecture;
}

export interface CallGraphData {
  nodes: any[];
  edges: any[];
  call_chains: string[][];
}

export async function getRepositoryCallGraph(
  id: string,
  email: string
): Promise<CallGraphData> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/callgraph?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as CallGraphData;
}

export interface FlowStep {
  id: number;
  flow_id: number;
  step_number: number;
  step_name: string;
  description: string | null;
  entity_id: number | null;
  file_path: string | null;
  line_number: number | null;
  node_type: string | null;
}

export interface ExecutionFlow {
  id: number;
  repository_id: number;
  flow_name: string;
  flow_type: string;
  entry_point: string | null;
  components_used: string[];
  database_interactions: string[];
  external_services: string[];
  confidence_score: number;
  created_at: string;
  steps: FlowStep[];
}

export async function getRepositoryFlows(
  id: string,
  email: string
): Promise<ExecutionFlow[]> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/flows?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as ExecutionFlow[];
}

export async function searchRepositoryFlows(
  id: string,
  email: string,
  q: string
): Promise<ExecutionFlow[]> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/flows/search?email=${encodeURIComponent(email)}&q=${encodeURIComponent(q)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as ExecutionFlow[];
}

export async function getRepositoryFlowDetail(
  id: string,
  flowId: number,
  email: string
): Promise<ExecutionFlow> {
  const response = await fetch(
    `${API_BASE_URL}/repository/${id}/flows/${flowId}?email=${encodeURIComponent(email)}`
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(mapApiError(body));
  }
  return body as ExecutionFlow;
}
