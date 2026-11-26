import React, { useRef, useState } from 'react';
import { FolderOpen, HardDrive, Lock, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { MediaItem, ScanProgress } from '../types/media';
import {
  collectFilesFromDirectoryHandle,
  scanLocalFilesOffline,
  type RawLocalFileEntry,
} from '../engine/localFileSystem';

interface ScanFolderModalProps {
  open: boolean;
  onClose: () => void;
  onImportLocalItems: (items: MediaItem[], mode: 'merge' | 'replace') => void;
  onResetSampleArchive: () => void;
}

export const ScanFolderModal: React.FC<ScanFolderModalProps> = ({
  open,
  onClose,
  onImportLocalItems,
  onResetSampleArchive,
}) => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({
    active: false,
    totalFiles: 0,
    processedFiles: 0,
    currentFileName: '',
    stage: 'reading',
  });

  if (!open) return null;

  const processEntries = async (entries: RawLocalFileEntry[]) => {
    setErrorMessage(null);
    if (entries.length === 0) {
      setErrorMessage('No supported photo or video files were found in that folder.');
      return;
    }
    try {
      const items = await scanLocalFilesOffline(entries, setProgress);
      if (items.length === 0) {
        setErrorMessage('Could not decode images/videos from the selected folder.');
        return;
      }
      onImportLocalItems(items, importMode);
      onClose();
    } catch {
      setErrorMessage('Could not scan the selected folder. Please try selecting a folder with JPG, PNG, or MP4 files.');
      setProgress((p) => ({ ...p, active: false }));
    }
  };

  const handleNativeDirectoryPicker = async () => {
    setErrorMessage(null);
    const picker = (
      window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }
    ).showDirectoryPicker;

    if (typeof picker === 'function') {
      try {
        setProgress({
          active: true,
          totalFiles: 0,
          processedFiles: 0,
          currentFileName: 'Reading local folder structure...',
          stage: 'reading',
        });
        const handle = await picker();
        const entries = await collectFilesFromDirectoryHandle(handle);
        await processEntries(entries);
        return;
      } catch (err) {
        setProgress((p) => ({ ...p, active: false }));
        // If user cancelled, stop; if blocked by iframe policy, fall back to folder input
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Graceful fallback that works in every browser & iframe sandbox
    folderInputRef.current?.click();
  };

  const handleFallbackInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const entries: RawLocalFileEntry[] = Array.from(files).map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));
    await processEntries(entries);
    e.target.value = '';
  };

  const pct =
    progress.totalFiles > 0
      ? Math.round((progress.processedFiles / progress.totalFiles) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={() => !progress.active && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#2A2E3A] bg-[#14171F] p-6 text-zinc-100 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-white">Scan Local PC Folder</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                100% on-device analysis &middot; Zero cloud uploads &middot; Files are never moved
              </p>
            </div>
          </div>
          {!progress.active && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-[#222633] hover:text-white cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Privacy & Non-Destructive Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-[#232734] bg-[#101218] p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-emerald-400">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Private &amp; Offline</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Perceptual hashing, blur detection, and face region analysis run strictly in your local browser memory.
            </p>
          </div>
          <div className="rounded-lg border border-[#232734] bg-[#101218] p-3 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Vintage-Safe &amp; Non-Destructive</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Older cameras are protected automatically. Nothing is moved or deleted without your approval.
            </p>
          </div>
        </div>

        {/* Import Mode Segmented Control */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-400">Import mode</span>
          <div className="inline-flex rounded-lg bg-[#0E1015] p-1 border border-[#232730]">
            <button
              type="button"
              disabled={progress.active}
              onClick={() => setImportMode('merge')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                importMode === 'merge' ? 'bg-[#232733] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Add to Library
            </button>
            <button
              type="button"
              disabled={progress.active}
              onClick={() => setImportMode('replace')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                importMode === 'replace' ? 'bg-[#232733] text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Show Only My Folder
            </button>
          </div>
        </div>

        {/* Hidden native folder input fallback */}
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '' } as Record<string, string>)}
          accept="image/*,video/*"
          onChange={handleFallbackInputChange}
          className="hidden"
        />

        {/* Progress State or Action CTA */}
        {progress.active ? (
          <div className="rounded-xl border border-[#262B38] bg-[#101218] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-white">
                {progress.stage === 'reading'
                  ? 'Reading folder contents...'
                  : progress.stage === 'grouping'
                    ? 'Grouping bursts & ranking sharpest photos...'
                    : 'Analyzing focus, exposure & visual hashes locally...'}
              </span>
              <span className="font-mono text-amber-400 tabular-nums">
                {progress.processedFiles}/{progress.totalFiles || '...'}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#1E222D] overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-150"
                style={{ width: `${Math.max(8, pct)}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-zinc-500 truncate">
              {progress.currentFileName}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {errorMessage && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleNativeDirectoryPicker}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Choose Folder from This PC</span>
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-[#222630] text-xs text-zinc-500">
              <span>Supports JPG, PNG, WebP, MP4, MOV</span>
              <button
                type="button"
                onClick={() => {
                  onResetSampleArchive();
                  onClose();
                }}
                className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Demo Archive</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
