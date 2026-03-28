export interface HeatmapCell {
  outletDomain: string;
  sourceName: string;
  compositeBiasLabel: string;
  articleCount: number;
  piCount: number;
  newsToNoiseRatio: number;
}

export interface HeatmapRow {
  topicId: string;
  topicLabel: string;
  dominantCategory: string | null;
  clusterSize: number;
  polSkew: number;
  geoSkew: number;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  isUsRelevant: boolean;
  isGloballyRelevant: boolean;
  isForeignRelevant: boolean;
  isStateLocal: boolean;
  newsToNoiseRatio: number | null;
  totalArticles: number;
  earliestPublished: string;
  latestPublished: string;
  medoidImage: string | null;
  cells: Record<string, HeatmapCell>;
}

export interface HeatmapSummary {
  totalTopics: number;
  totalArticles: number;
  categories: string[];
  lastRefreshed: string | null;
}

export interface Topic {
  topicId: string;
  label: string;
  storyCount: number;
  category: string;
  polSkew: number;
  geoSkew: number;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  totalArticles: number;
  earliestPublished: string;
  latestPublished: string;
}

export interface TopicDetail extends Topic {
  outletBreakdown: OutletBreakdown[];
}

export interface OutletBreakdown {
  outletDomain: string;
  sourceName: string;
  compositeBiasLabel: string;
  articleCount: number;
  newsToNoiseRatio: number;
}

export interface Article {
  storyId: string;
  title: string;
  headlineClean: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  isPublicInterest: boolean;
  piLabel: string | null;
  category: string;
  outletDomain: string | null;
  compositeBiasLabel: string | null;
  politicalGroup: string | null;
  image: string | null;
  similarityToCentroid: number | null;
  geoGroup: string | null;
  geoRegion: string | null;
}

export interface Outlet {
  outletDomain: string;
  sourceName: string;
  displayName: string | null;
  fullName: string | null;
  logoUrl: string | null;
  compositeBiasScore: number;
  compositeBiasLabel: string;
  politicalGroup: string;
  geoGroup: string;
  hqCountry: string;
  geoRegion: string;
  adfontesBiasScore: number;
}

export interface Freshness {
  lastPublishedAt: string | null;
  hoursAgo: number;
  totalEnrichedArticles: number;
  activeSources: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ---------------------------------------------------------------------------
// PI QA types
// ---------------------------------------------------------------------------

export interface PiqaStory {
  storyId: string;
  headline: string;
  sourceName: string;
  sourceUri: string;
  url: string;
  topCategory: string | null;
  publishedAt: string | null;
  topicId: string | null;
  topicLabel: string | null;
  clusterSize: number | null;
  scopeStatus: string | null;
  bodyText: string | null;
  llmIsPublicInterest: boolean | null;
  llmLabel: string | null;
  llmMetCount: number | null;
  llmMaterialImpact: boolean | null;
  llmInstitutionalAction: boolean | null;
  llmScopeScale: boolean | null;
  llmNewInformation: boolean | null;
  llmUsRelevance: boolean | null;
  llmGlobalRelevance: boolean | null;
  llmForeignRelevance: boolean | null;
  llmStateLocalRelevance: boolean | null;
  llmReasoning: string | null;
  llmModel: string | null;
  llmEvaluatedAt: string | null;
  humanIsPublicInterest: boolean | null;
  humanLabel: string | null;
  humanMaterialImpact: boolean | null;
  humanInstitutionalAction: boolean | null;
  humanScopeScale: boolean | null;
  humanNewInformation: boolean | null;
  humanUsRelevance: boolean | null;
  humanGlobalRelevance: boolean | null;
  humanForeignRelevance: boolean | null;
  humanStateLocalRelevance: boolean | null;
  humanNotes: string | null;
  humanLabeledAt: string | null;
}

export interface PiqaAnnotation {
  story_id: string;
  reviewer_id?: string;
  is_public_interest: boolean | null;
  label: string | null;
  material_impact: boolean | null;
  institutional_action: boolean | null;
  scope_scale: boolean | null;
  new_information: boolean | null;
  us_relevance: boolean | null;
  global_relevance: boolean | null;
  foreign_relevance: boolean | null;
  state_local_relevance: boolean | null;
  notes: string | null;
}

export interface PiqaFilterOptions {
  categories: string[];
  sources: { uri: string; name: string }[];
  piLabels: string[];
}

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export type UserRole = "visitor" | "member" | "investigator" | "moderator" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  preferences: Record<string, unknown>;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}
