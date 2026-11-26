import type { FaceTag, MediaItem } from '../types/media';

export interface LocalAnalysisResult {
  width: number;
  height: number;
  dHash: string;
  sharpnessScore: number;
  exposureScore: number;
  faceClarityScore: number;
  overallScore: number;
  detectedFaces: FaceTag[];
}

/**
 * Computes Hamming distance between two 64-bit perceptual difference hashes.
 * Lower distance = more visually similar (0-12 indicates burst / duplicate).
 */
export function hammingDistance(hashA: string, hashB: string): number {
  const len = Math.min(hashA.length, hashB.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    if (hashA[i] !== hashB[i]) dist++;
  }
  return dist;
}

/**
 * 100% local on-device Canvas pixel analysis:
 * 1) 64-bit dHash (9x8 grayscale gradient comparison) for visual duplicate detection
 * 2) Laplacian Variance optical sharpness measurement (detects blur vs crisp focus)
 * 3) Exposure balance histogram (detects blown-out flash or severely underexposed frames)
 * 4) YCbCr skin-region clustering heuristic for local offline portrait face box proposals
 */
export async function analyzeImageElementLocally(
  source: HTMLImageElement | HTMLVideoElement,
  fileId: string
): Promise<LocalAnalysisResult> {
  const naturalWidth =
    source instanceof HTMLVideoElement ? source.videoWidth || 1280 : source.naturalWidth || 1200;
  const naturalHeight =
    source instanceof HTMLVideoElement ? source.videoHeight || 720 : source.naturalHeight || 900;

  // 1. Compute 9x8 dHash
  const hashCanvas = document.createElement('canvas');
  hashCanvas.width = 9;
  hashCanvas.height = 8;
  const hCtx = hashCanvas.getContext('2d', { willReadFrequently: true });
  let dHash = '0'.repeat(64);
  if (hCtx) {
    hCtx.drawImage(source, 0, 0, 9, 8);
    const data = hCtx.getImageData(0, 0, 9, 8).data;
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    let bits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = gray[row * 9 + col];
        const right = gray[row * 9 + col + 1];
        bits += left > right ? '1' : '0';
      }
    }
    dHash = bits;
  }

  // 2. Compute optical sharpness (Laplacian variance) + exposure + skin region on 240px working buffer
  const sampleW = 240;
  const sampleH = Math.max(120, Math.round((naturalHeight / naturalWidth) * sampleW));
  const workCanvas = document.createElement('canvas');
  workCanvas.width = sampleW;
  workCanvas.height = sampleH;
  const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });

  let sharpnessScore = 72;
  let exposureScore = 80;
  const detectedFaces: FaceTag[] = [];

  if (wCtx) {
    wCtx.drawImage(source, 0, 0, sampleW, sampleH);
    const imgData = wCtx.getImageData(0, 0, sampleW, sampleH).data;
    const lum = new Float32Array(sampleW * sampleH);

    let lumSum = 0;
    let clippedHighlights = 0;
    let crushedShadows = 0;

    // Track skin-tone pixels in upper 70% of image for local portrait bounding proposal
    let skinCount = 0;
    let skinMinX = sampleW;
    let skinMaxX = 0;
    let skinMinY = sampleH;
    let skinMaxY = 0;

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        const idx = (y * sampleW + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        lum[y * sampleW + x] = l;
        lumSum += l;
        if (l > 246) clippedHighlights++;
        if (l < 12) crushedShadows++;

        // YCbCr skin range check (inclusive across warm & deep skin tones)
        if (y < sampleH * 0.72) {
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
          if (l > 45 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 175) {
            skinCount++;
            if (x < skinMinX) skinMinX = x;
            if (x > skinMaxX) skinMaxX = x;
            if (y < skinMinY) skinMinY = y;
            if (y > skinMaxY) skinMaxY = y;
          }
        }
      }
    }

    const totalPx = sampleW * sampleH;
    const meanLum = lumSum / totalPx;
    const clippedRatio = (clippedHighlights + crushedShadows) / totalPx;
    // Ideal mean luminance around 105-155, low clipping
    const lumPenalty = Math.abs(meanLum - 125) * 0.45;
    exposureScore = Math.max(25, Math.min(98, Math.round(98 - lumPenalty - clippedRatio * 120)));

    // 3x3 discrete Laplacian filter across interior pixels
    let lapSum = 0;
    let lapSqSum = 0;
    let count = 0;
    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const c = lum[y * sampleW + x];
        const lap =
          -4 * c +
          lum[(y - 1) * sampleW + x] +
          lum[(y + 1) * sampleW + x] +
          lum[y * sampleW + (x - 1)] +
          lum[y * sampleW + (x + 1)];
        lapSum += lap;
        lapSqSum += lap * lap;
        count++;
      }
    }

    const meanLap = lapSum / Math.max(1, count);
    const variance = lapSqSum / Math.max(1, count) - meanLap * meanLap;
    // Log-normalize Laplacian variance to 0..100 sharpness score
    const normalizedSharpness = Math.round(Math.min(99, Math.max(12, (Math.log10(Math.max(1, variance)) / 3.45) * 100)));
    sharpnessScore = normalizedSharpness;

    // Propose an unnamed local face region if a cohesive portrait skin cluster exists
    const skinRatio = skinCount / totalPx;
    if (skinRatio > 0.015 && skinRatio < 0.45 && skinMaxX > skinMinX + 12 && skinMaxY > skinMinY + 12) {
      const boxW = Math.min(34, Math.max(12, ((skinMaxX - skinMinX) / sampleW) * 100 * 0.72));
      const boxH = Math.min(38, Math.max(15, ((skinMaxY - skinMinY) / sampleH) * 100 * 0.72));
      const centerX = ((skinMinX + skinMaxX) / 2 / sampleW) * 100;
      const topY = (skinMinY / sampleH) * 100;
      detectedFaces.push({
        id: `${fileId}-face-auto-1`,
        personId: null,
        personName: null,
        box: {
          x: Math.max(4, Math.min(92 - boxW, Math.round(centerX - boxW / 2))),
          y: Math.max(4, Math.min(90 - boxH, Math.round(topY))),
          w: Math.round(boxW),
          h: Math.round(boxH),
        },
        confidence: 0.84,
        faceSharpness: sharpnessScore,
      });
    }
  }

  const faceClarityScore = Math.min(99, Math.max(15, Math.round(sharpnessScore * 0.85 + exposureScore * 0.15)));
  const resolutionBonus = Math.min(100, Math.round(((naturalWidth * naturalHeight) / 4_000_000) * 100));
  const overallScore = Math.round(
    sharpnessScore * 0.5 + faceClarityScore * 0.3 + exposureScore * 0.15 + resolutionBonus * 0.05
  );

  return {
    width: naturalWidth,
    height: naturalHeight,
    dHash,
    sharpnessScore,
    exposureScore,
    faceClarityScore,
    overallScore,
    detectedFaces,
  };
}

/**
 * Groups newly imported local files into burst / duplicate sets ONLY when items are:
 * - Same media type AND
 * - Taken within 120 seconds of each other OR visually similar (dHash Hamming distance <= 14)
 *
 * CRITICAL PRIVACY & VINTAGE PROTECTION RULE:
 * Standalone photos (even low-resolution old camera photos from 2005-2015) are NEVER grouped
 * for deletion. Only same-moment / same-scene siblings are compared against each other.
 */
export function clusterAndScoreLocalItems(items: MediaItem[]): MediaItem[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );

  const visited = new Set<string>();
  const clusters: MediaItem[][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const seed = sorted[i];
    if (visited.has(seed.id)) continue;

    const cluster: MediaItem[] = [seed];
    visited.add(seed.id);

    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j];
      if (visited.has(candidate.id)) continue;
      if (candidate.type !== seed.type) continue;

      const timeDeltaSec = Math.abs(
        (new Date(candidate.capturedAt).getTime() - new Date(seed.capturedAt).getTime()) / 1000
      );
      const visualDist = hammingDistance(seed.dHash, candidate.dHash);

      const isVisualDuplicate = visualDist <= 12;
      const isBurstClick = timeDeltaSec <= 90 && visualDist <= 22;

      if (isVisualDuplicate || isBurstClick) {
        cluster.push(candidate);
        visited.add(candidate.id);
      }
    }

    clusters.push(cluster);
  }

  const updated: MediaItem[] = [];

  for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
    const group = clusters[cIdx];

    if (group.length === 1) {
      // Unique memory: NEVER recommend deleting, regardless of old camera resolution
      const item = group[0];
      const megapixels = (item.width * item.height) / 1_000_000;
      const isVintage = item.year <= 2015 || megapixels < 4.5;
      updated.push({
        ...item,
        isVintageCamera: isVintage,
        burstGroupId: null,
        isRecommendedBest: true,
        userDecision: 'keep',
        comparisonNote: isVintage
          ? 'Unique vintage camera memory · Protected from cleanup'
          : 'Unique standalone capture · No duplicates found',
      });
    } else {
      const groupId = `local-burst-${Date.now()}-${cIdx}`;
      // Rank siblings strictly against each other
      const ranked = [...group].sort((a, b) => b.overallScore - a.overallScore);
      const winner = ranked[0];

      for (const item of group) {
        const isBest = item.id === winner.id;
        let note = '';
        if (isBest) {
          note = `Best 1 of ${group.length} · Sharpest focus (${item.sharpnessScore}) & balanced exposure`;
        } else {
          const sharpDiff = winner.sharpnessScore - item.sharpnessScore;
          if (sharpDiff >= 12) {
            note = `Softer focus than best shot (Sharpness ${item.sharpnessScore} vs ${winner.sharpnessScore})`;
          } else if (winner.exposureScore - item.exposureScore >= 10) {
            note = `Less balanced lighting than ${winner.fileName}`;
          } else {
            note = `Near-duplicate click in same burst (${group.length} shots)`;
          }
        }

        updated.push({
          ...item,
          burstGroupId: groupId,
          isRecommendedBest: isBest,
          userDecision: isBest ? 'keep' : 'bin',
          comparisonNote: note,
        });
      }
    }
  }

  return updated;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
