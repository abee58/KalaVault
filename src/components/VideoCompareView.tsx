import React, { useMemo, useState } from 'react';
import { Check, Film, Pause, Play, Star, Trash2 } from 'lucide-react';
import type { MediaItem } from '../types/media';
import { formatBytes, formatDuration } from '../engine/localVision';
import { MediaThumbnail } from './MediaThumbnail';

interface VideoCompareViewProps {
  items: MediaItem[];
  onApproveGroup: (burstGroupId: string) => void;
  onMoveToBin: (itemId: string, reason: string) => void;
  onOpenLightbox: (item: MediaItem) => void;
}

export const VideoCompareView: React.FC<VideoCompareViewProps> = ({
  items,
  onApproveGroup,
  onMoveToBin,
  onOpenLightbox,
}) => {
  const [previewPlaying, setPreviewPlaying] = useState(true);

  const videos = useMemo(
    () =>
      items
        .filter((i) => i.type === 'video')
        .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()),
    [items]
  );

  const duplicateVideoGroups = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const v of videos) {
      if (v.burstGroupId) {
        const list = map.get(v.burstGroupId) || [];
        list.push(v);
        map.set(v.burstGroupId, list);
      }
    }
    return Array.from(map.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([groupId, list]) => {
        const best = list.find((v) => v.isRecommendedBest) || list[0];
        const others = list.filter((v) => v.id !== best.id);
        return { groupId, best, others };
      });
  }, [videos]);

  const uniqueVideos = useMemo(
    () => videos.filter((v) => !v.burstGroupId || !duplicateVideoGroups.some((g) => g.groupId === v.burstGroupId)),
    [videos, duplicateVideoGroups]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#232730]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Video Archive &amp; Take Comparison
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Keep the steadiest, sharpest take from duplicate video recordings and reclaim hundreds of megabytes safely.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPreviewPlaying((p) => !p)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#262A34] bg-[#14171F] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-[#1C202B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{previewPlaying ? 'Pause Stability Preview' : 'Play Stability Preview'}</span>
        </button>
      </div>

      {/* Duplicate Video Take Comparisons */}
      {duplicateVideoGroups.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-amber-300">
            Duplicate Video Takes Ready for Review ({duplicateVideoGroups.length})
          </h2>

          {duplicateVideoGroups.map((group) => {
            const reclaim = group.others.reduce((sum, v) => sum + v.fileSizeBytes, 0);
            return (
              <div
                key={group.groupId}
                className="rounded-xl border border-[#252A36] bg-[#13151B] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{group.best.eventName}</h3>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Comparing {group.others.length + 1} recordings of the same scene &middot;{' '}
                      <span className="font-mono text-amber-300 tabular-nums">
                        Frees {formatBytes(reclaim)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApproveGroup(group.groupId)}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Keep Best Video &amp; Bin Shaky Take</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Best Video */}
                  <div className="rounded-xl border border-emerald-500/35 bg-[#101218] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#222630] text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-white truncate">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="truncate">{group.best.fileName}</span>
                      </span>
                      <span className="text-emerald-400 font-medium shrink-0">Best Video</span>
                    </div>
                    <div
                      onClick={() => onOpenLightbox(group.best)}
                      className="relative aspect-video cursor-pointer overflow-hidden"
                    >
                      <MediaThumbnail item={group.best} className="w-full h-full" />
                      <div className="absolute bottom-2.5 left-3 rounded bg-black/75 px-2 py-0.5 font-mono text-[11px] text-white tabular-nums">
                        {formatDuration(group.best.durationSec)} &middot; {group.best.width}&times;{group.best.height} &middot; {group.best.fps || 60}fps
                      </div>
                    </div>
                    <div className="p-3.5 space-y-2 text-xs">
                      <p className="text-emerald-300/95">{group.best.comparisonNote}</p>
                      <div className="flex items-center gap-4 text-zinc-400 font-mono tabular-nums">
                        <span>Stability {group.best.stabilityScore ?? 92}/100</span>
                        <span>Sharpness {group.best.sharpnessScore}/100</span>
                        <span>{formatBytes(group.best.fileSizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Shaky / Lower quality duplicate takes */}
                  {group.others.map((other) => (
                    <div
                      key={other.id}
                      className="rounded-xl border border-red-500/35 bg-[#101218] overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-2 border-b border-[#222630] text-xs">
                        <span className="font-semibold text-zinc-200 truncate">{other.fileName}</span>
                        <span className="text-red-400 font-medium shrink-0">Suggested for Bin</span>
                      </div>
                      <div
                        onClick={() => onOpenLightbox(other)}
                        className="relative aspect-video cursor-pointer overflow-hidden"
                      >
                        <MediaThumbnail
                          item={other}
                          animateVideoShake={previewPlaying}
                          className="w-full h-full"
                        />
                        <div className="absolute bottom-2.5 left-3 rounded bg-black/75 px-2 py-0.5 font-mono text-[11px] text-zinc-200 tabular-nums">
                          {formatDuration(other.durationSec)} &middot; {other.width}&times;{other.height} &middot; {other.fps || 30}fps
                        </div>
                      </div>
                      <div className="p-3.5 space-y-2 text-xs">
                        <p className="text-zinc-300">{other.comparisonNote}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-4 text-zinc-400 font-mono tabular-nums">
                            <span className="text-red-400">Stability {other.stabilityScore ?? 40}/100</span>
                            <span>{formatBytes(other.fileSizeBytes)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onMoveToBin(other.id, other.comparisonNote)}
                            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Move to Bin</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* All Preserved Unique Videos */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">
          Preserved Event Videos ({uniqueVideos.length})
        </h2>

        {uniqueVideos.length === 0 ? (
          <div className="rounded-xl border border-[#232730] bg-[#13151B] p-8 text-center text-xs text-zinc-500">
            No standalone videos in this library yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueVideos.map((vid) => (
              <article
                key={vid.id}
                className="rounded-xl border border-[#232730] bg-[#13151B] overflow-hidden hover:border-[#373D4C] transition-colors"
              >
                <div
                  onClick={() => onOpenLightbox(vid)}
                  className="relative aspect-video cursor-pointer overflow-hidden"
                >
                  <MediaThumbnail item={vid} className="w-full h-full" />
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded bg-black/75 px-2 py-0.5 text-[11px] font-mono text-white tabular-nums">
                    <Film className="w-3 h-3" />
                    <span>{formatDuration(vid.durationSec)}</span>
                  </div>
                </div>
                <div className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate">{vid.fileName}</span>
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                      {formatBytes(vid.fileSizeBytes)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {vid.eventName} &middot; {vid.year}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono truncate">
                    {vid.originalPath}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
