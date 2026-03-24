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
  topCategory: string | null;
  clusterSize: number;
  polSkew: number;
  geoSkew: number;
  asymmetryScore: number;
  leftCount: number;
  centerCount: number;
  rightCount: number;
  totalArticles: number;
  earliestPublished: string;
  latestPublished: string;
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
