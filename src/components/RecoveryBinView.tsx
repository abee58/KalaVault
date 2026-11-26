import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Folder,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { MediaItem } from '../types/media';
import { formatBytes } from '../engine/localVision';
import { downloadSafeCleanupScript } from '../engine/localFileSystem';
import { MediaThumbnail } from './MediaThumbnail';

interface RecoveryBinViewProps {
  trashedItems: MediaItem[];
  onRestoreItem: (itemId: string) => void;
  onRestoreAll: () => void;
  onPermanentlyDeleteItem: (itemId: string) => void;
  onEmptyBin: () => void;
}

export const RecoveryBinView: React.FC<RecoveryBinViewProps> = ({
  trashedItems,
  onRestoreItem,
  onRestoreAll,
  onPermanentlyDeleteItem,
  onEmptyBin,
}) => {
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const totalReclaimBytes = useMemo(
    () => trashedItems.reduce((sum, i) => sum + i.fileSizeBytes, 0),
    [trashedItems]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#232730]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Local Recovery Bin
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Mistakenly binned a photo or video? Restore it instantly to its original event and folder. Nothing is permanently deleted until you empty this bin.
          </p>
        </div>

        {trashedItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onRestoreAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Restore All ({trashedItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => downloadSafeCleanupScript(trashedItems, 'windows')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C3140] bg-[#161922] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-[#1F2430] transition-colors whitespace-nowrap cursor-pointer"
              title="Downloads a Windows PowerShell script that moves ONLY these approved files to your PC Recycle Bin"
            >
              <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>PC Recycle Script (.ps1)</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmEmpty(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>Empty Bin ({formatBytes(totalReclaimBytes)})</span>
            </button>
          </div>
        )}
      </div>

      {/* Recovery Safety Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#232730] bg-[#13151B] px-4 py-3 text-xs text-zinc-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Safe two-step cleanup: Review &rarr; Recovery Bin &rarr; Optional OS Recycle Bin Script or Permanent Delete.
          </span>
        </div>
        {trashedItems.length > 0 && (
          <button
            type="button"
            onClick={() => downloadSafeCleanupScript(trashedItems, 'mac-linux')}
            className="text-zinc-300 hover:text-amber-300 underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Download macOS / Linux (.sh)
          </button>
        )}
      </div>

      {/* Bin Contents */}
      {trashedItems.length === 0 ? (
        <div className="rounded-xl border border-[#232730] bg-[#13151B] p-12 text-center space-y-2">
          <Trash2 className="w-9 h-9 text-zinc-600 mx-auto" />
          <h2 className="text-sm font-semibold text-zinc-200">Recovery Bin is empty</h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            When you approve blurry or duplicate shots in Smart Review, they appear here safely so you can double-check or recover them anytime.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {trashedItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#232730] bg-[#13151B] p-3.5 hover:border-[#343A49] transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <MediaThumbnail item={item} className="w-24 h-16 rounded-lg shrink-0" />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {item.fileName}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">
                      {formatBytes(item.fileSizeBytes)}
                    </span>
                    <span className="text-xs text-zinc-500">&middot; {item.eventName}</span>
                  </div>
                  <p className="text-xs text-amber-200/85 truncate">
                    {item.trashReason || item.comparisonNote}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono truncate">
                    <Folder className="w-3 h-3 shrink-0" />
                    <span className="truncate">{item.originalPath}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onRestoreItem(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPermanentlyDeleteItem(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D323E] bg-[#191C24] px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permanent Empty Confirmation Modal */}
      {confirmEmpty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setConfirmEmpty(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#2C303D] bg-[#14171E] p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-semibold text-white">
                Permanently clear {trashedItems.length} items?
              </h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              This removes {trashedItems.length} binned items ({formatBytes(totalReclaimBytes)}) from KalaVault&apos;s Recovery Bin. If you also want to move these exact files into your PC&apos;s OS Recycle Bin first, download the PowerShell/Shell script before emptying.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEmpty(false)}
                className="rounded-lg border border-[#2D323E] bg-[#1A1D26] px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-[#232734] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onEmptyBin();
                  setConfirmEmpty(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer"
              >
                Empty Bin Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
