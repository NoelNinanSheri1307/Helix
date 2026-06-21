export type RepositoryStatus = 'READY' | 'CLONING' | 'CLONED' | 'FAILED' | 'SCANNING';

export interface Repository {
  id: string;
  name: string;
  url: string;
  status: RepositoryStatus;
  submissionDate: string;
  stars: number | null;
  branch: string | null;
  language: string | null;
  
  // GitHub Ingestion Metadata
  owner: string | null;
  description: string | null;
  forks: number | null;
  githubId: string | null;
  sizeKb: number | null;
  lastMetadataSync: string | null;

  framework: string | null;
  frameworkConfidence: number | null;
}

export interface RepositoryStructure {
  repository_id: number;
  directories: string[];
  files: string[];
  languages: string[];
  entry_points: string[];
  configuration_files: string[];
  config_files: string[];
  dev_config_files: string[];
  app_config_files: string[];
  documentation_files: string[];
  top_level_directories: string[];
  total_files: number;
  total_directories: number;
  repository_statistics: {
    extension_counts: Record<string, number>;
    total_files: number;
    total_directories: number;
    framework?: string;
    framework_confidence?: number;
  };
  frameworks: string[];
  dependencies: string[];
  repository_summary: {
    repository_type: string;
    primary_language: string;
    frameworks: string[];
    entry_points: string[];
    dependencies: string[];
    architecture_hint: string;
    file_count: number;
    directory_count: number;
    runtimes?: string[];
    build_tools?: string[];
  };
  runtimes: string[];
  build_tools: string[];
  project_type: string | null;
  scanned_at: string;
}

export interface User {
  name: string;
  email: string;
  avatarUrl: string;
}

export interface CodeEntity {
  id: number;
  repository_id: number;
  file_path: string;
  entity_type: string;
  entity_name: string;
  line_number: number;
  created_at: string;
}

export interface KnowledgeNode {
  id: number;
  repository_id: number;
  entity_id: number | null;
  node_type: string;
  node_name: string;
}

export interface KnowledgeEdge {
  id: number;
  repository_id: number;
  source_node_id: number;
  target_node_id: number;
  relationship_type: string;
}

export interface RepositoryGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  architecture_hint: string | null;
}


export interface SystemComponent {
  name: string;
  type: string;
  description: string;
  technologies: string[];
}

export interface DetectedFlow {
  name: string;
  steps: string[];
}

export interface RepositoryArchitecture {
  id: number;
  repository_id: number;
  architecture_type: string;
  project_type: string;
  components: SystemComponent[];
  deployment_model: string | null;
  architecture_summary: {
    project_type: string;
    architecture_pattern: string;
    primary_technologies: string[];
    core_components: string[];
    database_layer: string;
    authentication_layer: string;
    deployment_model: string;
    confidence_score?: number;
    evidence?: string[];
    secondary_architecture?: string | null;
    technology_roles?: Record<string, string[]>;
    architectural_drift?: string[];
    health_signals?: {
      coupling_score: number;
      circular_dependencies: string[];
      god_classes: Array<{ class_name: string; method_count: number }>;
      dead_modules: string[];
      separation_of_concerns_score: number;
    };
  };
  detected_flows: DetectedFlow[];
  created_at: string;
}


