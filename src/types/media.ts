export type MediaType = 'photo' | 'video';

export interface FaceTag {
  id: string;
  personId: string | null; // null means unnamed face waiting to be tagged
  personName: string | null;
  /** Percentage bounding box relative to media dimensions (0-100) */
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  confidence: number;
  /** Focus quality measured specifically on this face region (0-100) */
  faceSharpness: number;
}

export interface VisualEffectSimulation {
  blurPx?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  shaky?: boolean;
}

export interface MediaItem {
  id: string;
  fileName: string;
  /** Original untouched local PC path — KalaVault NEVER moves files on disk */
  originalPath: string;
  folderName: string;
  type: MediaType;
  src: string;
  /** Optional visual degradation simulation for realistic burst demonstration */
  visualEffect?: VisualEffectSimulation;
  capturedAt: string; // ISO timestamp
  year: number;
  eventName: string;
  cameraModel: string;
  isVintageCamera?: boolean;
  width: number;
  height: number;
  fileSizeBytes: number;
  /** 64-bit perceptual difference hash (binary string) */
  dHash: string;
  /** Local computer vision metrics (0-100) */
  sharpnessScore: number;
  faceClarityScore: number;
  exposureScore: number;
  overallScore: number;
  /** Video-specific metrics */
  durationSec?: number;
  fps?: number;
  stabilityScore?: number;
  /** Burst & Duplicate Grouping */
  burstGroupId: string | null;
  isRecommendedBest: boolean;
  /** User's explicit review decision inside a burst group */
  userDecision: 'keep' | 'bin' | 'undecided';
  comparisonNote: string;
  /** Lifecycle status */
  status: 'active' | 'trashed';
  trashedAt?: string;
  trashReason?: string;
  /** Picasa-style non-destructive virtual face tags */
  faces: FaceTag[];
  /** Whether this item came from a real local PC folder scan */
  isLocalDiskFile?: boolean;
}

export interface BurstGroup {
  id: string;
  title: string;
  eventName: string;
  capturedRange: string;
  type: MediaType;
  itemIds: string[];
  recommendedBestId: string;
  isReviewed: boolean;
}

export interface PersonSummary {
  personId: string;
  name: string;
  photoCount: number;
  events: string[];
  coverMediaId: string;
  coverSrc: string;
  coverBox: { x: number; y: number; w: number; h: number };
  coverVisualEffect?: VisualEffectSimulation;
}

export type ActiveSection =
  | 'timeline'
  | 'review'
  | 'people'
  | 'videos'
  | 'bin';

export interface ScanProgress {
  active: boolean;
  totalFiles: number;
  processedFiles: number;
  currentFileName: string;
  stage: 'reading' | 'analyzing' | 'grouping' | 'done';
}
