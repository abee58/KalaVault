import type { MediaItem, ScanProgress } from '../types/media';
import { analyzeImageElementLocally, clusterAndScoreLocalItems } from './localVision';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'mkv', 'm4v']);

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function inferEventFromPath(relativePath: string, year: number): { eventName: string; folderName: string } {
  const segments = relativePath.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const parentFolder = segments[segments.length - 2];
    // Clean up common generic folder names
    const cleaned = parentFolder.replace(/[_-]+/g, ' ').trim();
    if (/^(dcim|camera|100apple|100canon|pictures|photos|downloads)$/i.test(cleaned)) {
      return { eventName: `Camera Archive ${year}`, folderName: parentFolder };
    }
    return { eventName: cleaned, folderName: parentFolder };
  }
  return { eventName: `Local Imports ${year}`, folderName: 'Selected Folder' };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function loadVideoMetadataAndFrame(
  url: string
): Promise<{ video: HTMLVideoElement; duration: number; thumbUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) * 0.25);
      } catch {
        cleanup();
        resolve({ video, duration: Math.round(video.duration || 10), thumbUrl: url });
      }
    };

    video.onseeked = () => {
      cleanup();
      resolve({ video, duration: Math.round(video.duration || 10), thumbUrl: url });
    };

    video.onerror = (e) => {
      cleanup();
      reject(e);
    };
  });
}

export interface RawLocalFileEntry {
  file: File;
  relativePath: string;
}

/**
 * Recursively collects image & video files from a FileSystemDirectoryHandle
 * (modern Chromium Desktop / Installed PWA File System Access API).
 */
export async function collectFilesFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  prefix = ''
): Promise<RawLocalFileEntry[]> {
  const results: RawLocalFileEntry[] = [];
  const rootPath = prefix ? `${prefix}/${dirHandle.name}` : dirHandle.name;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const ext = getExtension(entry.name);
      if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
        const file: File = await entry.getFile();
        results.push({
          file,
          relativePath: `${rootPath}/${entry.name}`,
        });
      }
    } else if (entry.kind === 'directory') {
      if (results.length < 250) {
        const sub = await collectFilesFromDirectoryHandle(entry, rootPath);
        results.push(...sub);
      }
    }
  }
  return results;
}

/**
 * Processes real local PC files completely offline in the browser, computing
 * perceptual hashes, optical sharpness, face proposals, and burst groupings.
 */
export async function scanLocalFilesOffline(
  entries: RawLocalFileEntry[],
  onProgress: (p: ScanProgress) => void
): Promise<MediaItem[]> {
  const validEntries = entries.filter((e) => {
    const ext = getExtension(e.file.name);
    return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
  });

  const total = validEntries.length;
  const analyzedItems: MediaItem[] = [];

  for (let i = 0; i < total; i++) {
    const { file, relativePath } = validEntries[i];
    const ext = getExtension(file.name);
    const isVideo = VIDEO_EXTS.has(ext);
    const objectUrl = URL.createObjectURL(file);
    const capturedDate = new Date(file.lastModified || Date.now());
    const year = capturedDate.getFullYear();
    const { eventName, folderName } = inferEventFromPath(relativePath, year);

    onProgress({
      active: true,
      totalFiles: total,
      processedFiles: i + 1,
      currentFileName: file.name,
      stage: 'analyzing',
    });

    const id = `pc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      if (!isVideo) {
        const img = await loadImage(objectUrl);
        const analysis = await analyzeImageElementLocally(img, id);
        analyzedItems.push({
          id,
          fileName: file.name,
          originalPath: relativePath.replace(/\//g, '\\'),
          folderName,
          type: 'photo',
          src: objectUrl,
          capturedAt: capturedDate.toISOString(),
          year,
          eventName,
          cameraModel: year <= 2015 ? 'Legacy Local Camera' : 'Local PC Media',
          isVintageCamera: year <= 2015 || analysis.width * analysis.height < 4_500_000,
          width: analysis.width,
          height: analysis.height,
          fileSizeBytes: file.size,
          dHash: analysis.dHash,
          sharpnessScore: analysis.sharpnessScore,
          faceClarityScore: analysis.faceClarityScore,
          exposureScore: analysis.exposureScore,
          overallScore: analysis.overallScore,
          burstGroupId: null,
          isRecommendedBest: true,
          userDecision: 'keep',
          comparisonNote: 'Analyzed locally on device',
          status: 'active',
          faces: analysis.detectedFaces,
          isLocalDiskFile: true,
        });
      } else {
        const { video, duration } = await loadVideoMetadataAndFrame(objectUrl);
        const analysis = await analyzeImageElementLocally(video, id);
        analyzedItems.push({
          id,
          fileName: file.name,
          originalPath: relativePath.replace(/\//g, '\\'),
          folderName,
          type: 'video',
          src: objectUrl,
          capturedAt: capturedDate.toISOString(),
          year,
          eventName,
          cameraModel: 'Local Video Recording',
          width: analysis.width,
          height: analysis.height,
          fileSizeBytes: file.size,
          dHash: analysis.dHash,
          sharpnessScore: analysis.sharpnessScore,
          faceClarityScore: analysis.faceClarityScore,
          exposureScore: analysis.exposureScore,
          overallScore: analysis.overallScore,
          durationSec: duration,
          fps: 30,
          stabilityScore: Math.min(96, Math.max(40, analysis.sharpnessScore)),
          burstGroupId: null,
          isRecommendedBest: true,
          userDecision: 'keep',
          comparisonNote: 'Video analyzed locally on device',
          status: 'active',
          faces: [],
          isLocalDiskFile: true,
        });
      }
    } catch {
      // Skip unreadable/corrupt file gracefully
    }
  }

  onProgress({
    active: true,
    totalFiles: total,
    processedFiles: total,
    currentFileName: 'Grouping bursts & duplicates...',
    stage: 'grouping',
  });

  const clustered = clusterAndScoreLocalItems(analyzedItems);

  onProgress({
    active: false,
    totalFiles: total,
    processedFiles: total,
    currentFileName: '',
    stage: 'done',
  });

  return clustered;
}

/**
 * Generates a safe Windows PowerShell script that sends ONLY the user-approved
 * Recovery Bin files to the native Windows Recycle Bin (never bypassing Recycle Bin!).
 */
export function downloadSafeCleanupScript(trashedItems: MediaItem[], platform: 'windows' | 'mac-linux'): void {
  const isWin = platform === 'windows';
  const lines: string[] = [];

  if (isWin) {
    lines.push('# KalaVault Safe Local Cleanup Script (Windows PowerShell)');
    lines.push('# Moves ONLY your approved Recovery Bin files to the Windows Recycle Bin.');
    lines.push('# Files remain recoverable in Windows Recycle Bin.');
    lines.push('Add-Type -AssemblyName Microsoft.VisualBasic');
    lines.push('');
    for (const item of trashedItems) {
      const escaped = item.originalPath.replace(/'/g, "''");
      lines.push(`# Reason: ${item.trashReason || item.comparisonNote}`);
      lines.push(`if (Test-Path '${escaped}') {`);
      lines.push(
        `  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
      );
      lines.push(`  Write-Host "Sent to Recycle Bin: ${item.fileName}"`);
      lines.push('}');
    }
    lines.push('Write-Host "KalaVault safe cleanup finished."');
  } else {
    lines.push('#!/usr/bin/env bash');
    lines.push('# KalaVault Safe Local Cleanup Script (macOS / Linux)');
    lines.push('# Moves ONLY your approved Recovery Bin files to ~/.Trash/KalaVault_Recovery');
    lines.push('TRASH_DIR="$HOME/.Trash/KalaVault_Recovery"');
    lines.push('mkdir -p "$TRASH_DIR"');
    lines.push('');
    for (const item of trashedItems) {
      const unixPath = item.originalPath.replace(/\\/g, '/').replace(/"/g, '\\"');
      lines.push(`# Reason: ${item.trashReason || item.comparisonNote}`);
      lines.push(`if [ -f "${unixPath}" ]; then mv -n "${unixPath}" "$TRASH_DIR/" && echo "Moved to Trash: ${item.fileName}"; fi`);
    }
    lines.push('echo "KalaVault safe cleanup finished."');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isWin ? 'kalavault-safe-recycle.ps1' : 'kalavault-safe-trash.sh';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
