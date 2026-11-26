import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Eye,
  ShieldCheck,
  Star,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { MediaItem } from '../types/media';
import { formatBytes } from '../engine/localVision';
import { MediaThumbnail } from './MediaThumbnail';

interface SmartReviewViewProps {
  items: MediaItem[];
  onUpdateDecision: (itemId: string, decision: 'keep' | 'bin') => void;
  onSetGroupBest: (burstGroupId: string, newBestId: string) => void;
  onApproveGroup: (burstGroupId: string) => void;
  onOpenLightbox: (item: MediaItem) => void;
}

export const SmartReviewView: React.FC<SmartReviewViewProps> = ({
  items,
  onUpdateDecision,
  onSetGroupBest,
  onApproveGroup,
  onOpenLightbox,
}) => {
  const burstGroups = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of items) {
      if (item.burstGroupId) {
        const list = map.get(item.burstGroupId) || [];
        list.push(item);
        map.set(item.burstGroupId, list);
      }
    }

    return Array.from(map.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([groupId, list]) => {
        const sorted = [...list].sort(
          (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
        );
        const best = sorted.find((i) => i.isRecommendedBest) || sorted[0];
        const binItems = sorted.filter((i) => i.userDecision === 'bin');
        const reclaimBytes = binItems.reduce((acc, i) => acc + i.fileSizeBytes, 0);
        return {
          groupId,
          eventName: best.eventName,
          type: best.type,
          items: sorted,
          bestItem: best,
          keepCount: sorted.filter((i) => i.userDecision === 'keep').length,
          binCount: binItems.length,
          reclaimBytes,
        };
      });
  }, [items]);

  const protectedVintageItems = useMemo(
    () => items.filter((i) => !i.burstGroupId && i.isVintageCamera),
    [items]
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    burstGroups[0]?.groupId ?? null
  );
  const [compareItemId, setCompareItemId] = useState<string | null>(null);
  const [zoomFaces, setZoomFaces] = useState(false);

  useEffect(() => {
    if (burstGroups.length === 0) {
      setSelectedGroupId(null);
      return;
    }
    if (!selectedGroupId || !burstGroups.some((g) => g.groupId === selectedGroupId)) {
      setSelectedGroupId(burstGroups[0].groupId);
    }
  }, [burstGroups, selectedGroupId]);

  const activeGroup = useMemo(
    () => burstGroups.find((g) => g.groupId === selectedGroupId) || burstGroups[0] || null,
    [burstGroups, selectedGroupId]
  );

  useEffect(() => {
    if (!activeGroup) {
      setCompareItemId(null);
      return;
    }
    const nonBest = activeGroup.items.find((i) => i.id !== activeGroup.bestItem.id);
    setCompareItemId((prev) => {
      if (prev && activeGroup.items.some((i) => i.id === prev && i.id !== activeGroup.bestItem.id)) {
        return prev;
      }
      return nonBest?.id ?? activeGroup.bestItem.id;
    });
  }, [activeGroup]);

  const comparedItem = useMemo(() => {
    if (!activeGroup) return null;
    return (
      activeGroup.items.find((i) => i.id === compareItemId) ||
      activeGroup.items.find((i) => i.id !== activeGroup.bestItem.id) ||
      activeGroup.bestItem
    );
  }, [activeGroup, compareItemId]);

  const totalReclaimable = useMemo(
    () => burstGroups.reduce((acc, g) => acc + g.reclaimBytes, 0),
    [burstGroups]
  );

  return (
    <div className="space-y-8">
      {/* Header Summary Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#232730]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Smart Burst &amp; Duplicate Review
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Compare same-moment clicks side-by-side. Your approval is required before anything moves to the Recovery Bin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <div className="text-zinc-500">Pending Groups</div>
            <div className="mt-0.5 font-mono text-base font-semibold text-white tabular-nums">
              {burstGroups.length}
            </div>
          </div>
          <div className="h-8 w-px bg-[#232730]" />
          <div>
            <div className="text-zinc-500">Space to Reclaim</div>
            <div className="mt-0.5 font-mono text-base font-semibold text-amber-400 tabular-nums">
              {formatBytes(totalReclaimable)}
            </div>
          </div>
          <div className="h-8 w-px bg-[#232730]" />
          <div>
            <div className="text-zinc-500">Old Camera Protected</div>
            <div className="mt-0.5 font-mono text-base font-semibold text-emerald-400 tabular-nums">
              {protectedVintageItems.length}
            </div>
          </div>
        </div>
      </div>

      {burstGroups.length === 0 ? (
        <div className="rounded-xl border border-[#232730] bg-[#13151B] p-12 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-base font-semibold text-white">All burst &amp; duplicate groups reviewed</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Only your approved best photos &amp; videos remain in the active library. Anything moved to Trash can still be restored from the Recovery Bin.
          </p>
        </div>
      ) : (
        <>
          {/* Group Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {burstGroups.map((g) => {
              const isSelected = activeGroup?.groupId === g.groupId;
              return (
                <button
                  key={g.groupId}
                  type="button"
                  onClick={() => setSelectedGroupId(g.groupId)}
                  className={`flex flex-col items-start rounded-lg border px-4 py-2.5 text-left transition-colors shrink-0 cursor-pointer ${
                    isSelected
                      ? 'border-amber-500/60 bg-[#1B1E27] text-white'
                      : 'border-[#232730] bg-[#13151B] text-zinc-400 hover:border-[#353B4B] hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs font-semibold whitespace-nowrap">{g.eventName}</span>
                  <span className="mt-0.5 text-[11px] font-mono text-zinc-400 tabular-nums whitespace-nowrap">
                    {g.items.length} {g.type === 'video' ? 'clips' : 'clicks'} &middot; Keep {g.keepCount}, Bin {g.binCount}
                  </span>
                </button>
              );
            })}
          </div>

          {activeGroup && comparedItem && (
            <div className="space-y-5">
              {/* Comparator Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#232730] bg-[#13151B] px-4 py-3">
                <div className="text-xs text-zinc-300">
                  <span className="font-semibold text-white">{activeGroup.eventName}</span>
                  <span className="mx-2 text-zinc-600">&middot;</span>
                  <span className="font-mono tabular-nums">
                    Keep {activeGroup.keepCount} of {activeGroup.items.length}
                  </span>
                  <span className="mx-2 text-zinc-600">&middot;</span>
                  <span className="text-amber-300 font-mono tabular-nums">
                    Frees {formatBytes(activeGroup.reclaimBytes)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setZoomFaces((z) => !z)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      zoomFaces
                        ? 'border-amber-500/70 bg-amber-500/15 text-amber-300'
                        : 'border-[#2B303D] bg-[#191C24] text-zinc-200 hover:bg-[#222633]'
                    }`}
                  >
                    {zoomFaces ? (
                      <ZoomOut className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{zoomFaces ? 'Full Frame View' : 'Zoom Faces 200%'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeGroup.binCount === 0}
                    onClick={() => onApproveGroup(activeGroup.groupId)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Approve &amp; Move {activeGroup.binCount} to Bin
                    </span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Loupe Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                {/* LEFT: Recommended Best Shot */}
                <div className="flex flex-col rounded-xl border border-emerald-500/35 bg-[#13151B] overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#232730] bg-[#151921]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">
                        Best Pick: {activeGroup.bestItem.fileName}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
                      Keep
                    </span>
                  </div>

                  <div className="relative aspect-[4/3] w-full bg-[#0A0B0E] overflow-hidden">
                    <MediaThumbnail
                      item={activeGroup.bestItem}
                      zoomFace={zoomFaces}
                      className="w-full h-full"
                    />
                    <button
                      type="button"
                      onClick={() => onOpenLightbox(activeGroup.bestItem)}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-medium text-zinc-100 hover:bg-black cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-xs text-emerald-300/95 leading-relaxed">
                      {activeGroup.bestItem.comparisonNote}
                    </p>
                    <div className="grid grid-cols-4 gap-3 pt-2 border-t border-[#222630] text-xs">
                      <div>
                        <div className="text-[11px] text-zinc-500">Sharpness</div>
                        <div className="font-mono font-semibold text-emerald-400 tabular-nums">
                          {activeGroup.bestItem.sharpnessScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Face Focus</div>
                        <div className="font-mono font-semibold text-emerald-400 tabular-nums">
                          {activeGroup.bestItem.faceClarityScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Exposure</div>
                        <div className="font-mono font-semibold text-zinc-200 tabular-nums">
                          {activeGroup.bestItem.exposureScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Size</div>
                        <div className="font-mono text-zinc-200 tabular-nums">
                          {formatBytes(activeGroup.bestItem.fileSizeBytes)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Selected Burst Sibling to Compare */}
                <div
                  className={`flex flex-col rounded-xl border bg-[#13151B] overflow-hidden ${
                    comparedItem.userDecision === 'bin'
                      ? 'border-red-500/35'
                      : 'border-emerald-500/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#232730] bg-[#151921]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 truncate">
                        Comparing: {comparedItem.fileName}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                        comparedItem.userDecision === 'bin' ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {comparedItem.userDecision === 'bin' ? 'Staged for Bin' : 'Marked Keep'}
                    </span>
                  </div>

                  <div className="relative aspect-[4/3] w-full bg-[#0A0B0E] overflow-hidden">
                    <MediaThumbnail
                      item={comparedItem}
                      zoomFace={zoomFaces}
                      className="w-full h-full"
                    />
                    <button
                      type="button"
                      onClick={() => onOpenLightbox(comparedItem)}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-[11px] font-medium text-zinc-100 hover:bg-black cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {comparedItem.comparisonNote}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDecision(
                              comparedItem.id,
                              comparedItem.userDecision === 'bin' ? 'keep' : 'bin'
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                            comparedItem.userDecision === 'bin'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          {comparedItem.userDecision === 'bin' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Keep Instead</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Move to Bin</span>
                            </>
                          )}
                        </button>

                        {comparedItem.id !== activeGroup.bestItem.id && (
                          <button
                            type="button"
                            onClick={() => onSetGroupBest(activeGroup.groupId, comparedItem.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#2D323E] bg-[#1B1E27] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Star className="w-3 h-3" />
                            <span>Set as Best</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 pt-2 border-t border-[#222630] text-xs">
                      <div>
                        <div className="text-[11px] text-zinc-500">Sharpness</div>
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            comparedItem.sharpnessScore < 60 ? 'text-red-400' : 'text-amber-300'
                          }`}
                        >
                          {comparedItem.sharpnessScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Face Focus</div>
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            comparedItem.faceClarityScore < 60 ? 'text-red-400' : 'text-amber-300'
                          }`}
                        >
                          {comparedItem.faceClarityScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Exposure</div>
                        <div className="font-mono font-semibold text-zinc-200 tabular-nums">
                          {comparedItem.exposureScore}/100
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-zinc-500">Size</div>
                        <div className="font-mono text-zinc-200 tabular-nums">
                          {formatBytes(comparedItem.fileSizeBytes)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Burst Filmstrip (All N clicks in this burst) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    All {activeGroup.items.length} captures in this burst — click any thumbnail to compare against Best Pick
                  </span>
                  <span className="font-mono tabular-nums text-zinc-500">
                    Green = Keep &middot; Red = Move to Bin
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                  {activeGroup.items.map((shot, idx) => {
                    const isComparing = shot.id === comparedItem.id;
                    const isBest = shot.id === activeGroup.bestItem.id;
                    const isKeep = shot.userDecision === 'keep';

                    return (
                      <div
                        key={shot.id}
                        className={`rounded-lg border overflow-hidden bg-[#13151B] transition-colors ${
                          isComparing
                            ? 'border-amber-400'
                            : isBest
                              ? 'border-emerald-500/60'
                              : 'border-[#242834] hover:border-[#3A4050]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCompareItemId(shot.id)}
                          className="relative block aspect-[4/3] w-full overflow-hidden cursor-pointer"
                        >
                          <MediaThumbnail item={shot} className="w-full h-full" />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/85 to-transparent" />
                          <span className="absolute top-1.5 left-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="absolute bottom-1 right-1.5 font-mono text-[10px] text-white tabular-nums">
                            Q {shot.overallScore}
                          </span>
                        </button>

                        <div className="px-2 py-1.5 flex items-center justify-between gap-1 text-[11px]">
                          <span
                            className={`font-medium truncate ${
                              isBest
                                ? 'text-amber-300'
                                : isKeep
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {isBest ? 'Best' : isKeep ? 'Keep' : 'Bin'}
                          </span>

                          {!isBest && (
                            <button
                              type="button"
                              onClick={() => onUpdateDecision(shot.id, isKeep ? 'bin' : 'keep')}
                              className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer"
                            >
                              {isKeep ? 'Bin' : 'Keep'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Protected Vintage & Standalone Camera Memories Guarantee */}
      {protectedVintageItems.length > 0 && (
        <section className="rounded-xl border border-[#232730] bg-[#12141A] p-5 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Old Camera &amp; Unique Memories Protected Automatically
              </h3>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                Older cameras naturally had lower megapixel resolution or softer focus. KalaVault never flags a standalone photo for deletion based on quality alone — it only compares similar clicks taken of the same moment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {protectedVintageItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenLightbox(item)}
                className="flex items-center gap-3 rounded-lg border border-[#222630] bg-[#161920] p-2.5 hover:border-[#343A49] transition-colors cursor-pointer"
              >
                <MediaThumbnail item={item} className="w-16 h-12 rounded shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{item.fileName}</div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {item.eventName} &middot; {item.cameraModel}
                  </div>
                  <div className="text-[11px] text-emerald-400/90 truncate">
                    {item.width}&times;{item.height} &middot; Protected unique photo
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
