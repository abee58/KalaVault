import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  Edit3,
  Film,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type { MediaItem } from '../types/media';
import { formatBytes, formatDuration } from '../engine/localVision';
import { MediaThumbnail } from './MediaThumbnail';

interface TimelineViewProps {
  items: MediaItem[];
  searchQuery: string;
  selectedEventFilter: string | null;
  onClearEventFilter: () => void;
  onOpenLightbox: (item: MediaItem) => void;
  onRenameEvent: (oldName: string, newName: string) => void;
  onJumpToReview: () => void;
  onMoveToBin: (itemId: string, reason: string) => void;
  pendingBurstCount: number;
}

type MediaFilter = 'all' | 'photo' | 'video' | 'vintage';

export const TimelineView: React.FC<TimelineViewProps> = ({
  items,
  searchQuery,
  selectedEventFilter,
  onClearEventFilter,
  onOpenLightbox,
  onRenameEvent,
  onJumpToReview,
  onMoveToBin,
  pendingBurstCount,
}) => {
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editEventValue, setEditEventValue] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedEventFilter && item.eventName !== selectedEventFilter) return false;
      if (mediaFilter === 'photo' && item.type !== 'photo') return false;
      if (mediaFilter === 'video' && item.type !== 'video') return false;
      if (mediaFilter === 'vintage' && !item.isVintageCamera) return false;
      if (!q) return true;
      const inName = item.fileName.toLowerCase().includes(q);
      const inEvent = item.eventName.toLowerCase().includes(q);
      const inCamera = item.cameraModel.toLowerCase().includes(q);
      const inYear = String(item.year).includes(q);
      const inFaces = item.faces.some((f) => (f.personName || '').toLowerCase().includes(q));
      const inPath = item.originalPath.toLowerCase().includes(q);
      return inName || inEvent || inCamera || inYear || inFaces || inPath;
    });
  }, [items, searchQuery, selectedEventFilter, mediaFilter]);

  const groupedByEvent = useMemo(() => {
    const map = new Map<
      string,
      {
        eventName: string;
        year: number;
        latestTs: number;
        earliestTs: number;
        totalBytes: number;
        photoCount: number;
        videoCount: number;
        folderPath: string;
        items: MediaItem[];
      }
    >();

    for (const item of filteredItems) {
      const ts = new Date(item.capturedAt).getTime();
      const existing = map.get(item.eventName);
      if (!existing) {
        const folderDir = item.originalPath.substring(
          0,
          Math.max(item.originalPath.lastIndexOf('\\'), item.originalPath.lastIndexOf('/'))
        );
        map.set(item.eventName, {
          eventName: item.eventName,
          year: item.year,
          latestTs: ts,
          earliestTs: ts,
          totalBytes: item.fileSizeBytes,
          photoCount: item.type === 'photo' ? 1 : 0,
          videoCount: item.type === 'video' ? 1 : 0,
          folderPath: folderDir || item.folderName,
          items: [item],
        });
      } else {
        existing.items.push(item);
        existing.latestTs = Math.max(existing.latestTs, ts);
        existing.earliestTs = Math.min(existing.earliestTs, ts);
        existing.totalBytes += item.fileSizeBytes;
        if (item.type === 'photo') existing.photoCount++;
        else existing.videoCount++;
      }
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.items.sort((a, b) =>
        sortOrder === 'newest'
          ? new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
          : new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
      );
    }

    groups.sort((a, b) =>
      sortOrder === 'newest' ? b.latestTs - a.latestTs : a.earliestTs - b.earliestTs
    );

    return groups;
  }, [filteredItems, sortOrder]);

  const startRename = (eventName: string) => {
    setEditingEvent(eventName);
    setEditEventValue(eventName);
  };

  const commitRename = (oldName: string) => {
    const trimmed = editEventValue.trim();
    if (trimmed && trimmed !== oldName) {
      onRenameEvent(oldName, trimmed);
    }
    setEditingEvent(null);
  };

  return (
    <div className="space-y-8">
      {/* Contextual Smart Review Callout when bursts are waiting */}
      {pendingBurstCount > 0 && !selectedEventFilter && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#2A2E39] bg-[#14171E] px-5 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {pendingBurstCount} similar burst &amp; duplicate {pendingBurstCount === 1 ? 'group' : 'groups'} ready for your review
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Best sharp shot picked per moment. Standalone &amp; older camera memories are protected automatically — nothing moves to Bin until you approve.
            </p>
          </div>
          <button
            type="button"
            onClick={onJumpToReview}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Review Bursts</span>
          </button>
        </div>
      )}

      {/* Filter & Chronological Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232730]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#14161C] p-1 border border-[#232730]">
            {(
              [
                { id: 'all', label: 'All Media' },
                { id: 'photo', label: 'Photos' },
                { id: 'video', label: 'Videos' },
                { id: 'vintage', label: 'Vintage Protected' },
              ] as { id: MediaFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMediaFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mediaFilter === tab.id
                    ? 'bg-[#232733] text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {selectedEventFilter && (
            <button
              type="button"
              onClick={onClearEventFilter}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Event: {selectedEventFilter} &times;
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="font-mono tabular-nums">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </span>
          <button
            type="button"
            onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#262A34] bg-[#14161C] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#1B1E27] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowDownUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </div>

      {/* Chronological Event Groups */}
      {groupedByEvent.length === 0 ? (
        <div className="rounded-xl border border-[#232730] bg-[#13151B] p-12 text-center">
          <p className="text-sm font-medium text-zinc-300">No photos or videos match this filter.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Clear your search query or switch filters to see your full local archive.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByEvent.map((group) => {
            const formattedDate = new Date(group.earliestTs).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <section key={group.eventName} className="space-y-4">
                {/* Event Header — clean typography & unboxed metadata */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-[#1E222B]">
                  <div>
                    {editingEvent === group.eventName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editEventValue}
                          onChange={(e) => setEditEventValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(group.eventName);
                            if (e.key === 'Escape') setEditingEvent(null);
                          }}
                          autoFocus
                          className="rounded-md border border-amber-500/60 bg-[#0C0D10] px-2.5 py-1 text-base font-semibold text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(group.eventName)}
                          className="rounded-md bg-amber-500 p-1.5 text-zinc-950 hover:bg-amber-400 cursor-pointer"
                          aria-label="Save event name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-semibold tracking-tight text-white">
                          {group.eventName}
                        </h2>
                        <button
                          type="button"
                          onClick={() => startRename(group.eventName)}
                          className="rounded p-1 text-zinc-500 hover:bg-[#1D2029] hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Rename event"
                          aria-label={`Rename ${group.eventName}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{formattedDate}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="font-mono tabular-nums">
                        {group.photoCount} {group.photoCount === 1 ? 'photo' : 'photos'}
                        {group.videoCount > 0
                          ? `, ${group.videoCount} ${group.videoCount === 1 ? 'video' : 'videos'}`
                          : ''}
                      </span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="font-mono tabular-nums">{formatBytes(group.totalBytes)}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="text-zinc-500 truncate max-w-xs sm:max-w-md font-mono text-[11px]">
                        {group.folderPath}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Media Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.items.map((item) => {
                    const namedPeople = item.faces
                      .map((f) => f.personName)
                      .filter((n): n is string => Boolean(n));
                    const unnamedCount = item.faces.filter((f) => !f.personName).length;

                    return (
                      <article
                        key={item.id}
                        className="group flex flex-col rounded-xl border border-[#232730] bg-[#13151B] overflow-hidden hover:border-[#373D4C] transition-colors"
                      >
                        {/* Photo/Video Thumbnail */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenLightbox(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenLightbox(item);
                            }
                          }}
                          className="relative aspect-[4/3] w-full overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <MediaThumbnail
                            item={item}
                            className="w-full h-full group-hover:scale-[1.03] transition-transform duration-200"
                          />

                          {/* Contrast scrim at bottom for readable overlays */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />

                          {/* Top-left subtle media status text (not decorative pill spam) */}
                          {item.type === 'video' && (
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded bg-black/75 px-2 py-0.5 text-[11px] font-mono text-white">
                              <Play className="w-3 h-3 fill-white shrink-0" />
                              <span className="tabular-nums">{formatDuration(item.durationSec)}</span>
                            </div>
                          )}

                          {/* Bottom-left sharpness / best / protected text over scrim */}
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] text-zinc-200">
                            <span className="truncate font-medium">
                              {item.burstGroupId
                                ? item.isRecommendedBest
                                  ? 'Best in burst'
                                  : 'Burst sibling'
                                : item.isVintageCamera
                                  ? 'Vintage protected'
                                  : 'Unique'}
                            </span>
                            <span className="font-mono tabular-nums text-zinc-300 shrink-0">
                              Q {item.overallScore}
                            </span>
                          </div>
                        </div>

                        {/* Unboxed Metadata Footer */}
                        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenLightbox(item)}
                                className="text-xs font-medium text-zinc-100 hover:text-amber-300 truncate text-left cursor-pointer"
                              >
                                {item.fileName}
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveToBin(item.id, 'Manually moved to Recovery Bin from Timeline')}
                                className="opacity-70 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-[#1D2029] transition-colors shrink-0 cursor-pointer"
                                title="Move to Recovery Bin"
                                aria-label={`Move ${item.fileName} to Recovery Bin`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500 truncate">
                              <span className="truncate">{item.cameraModel}</span>
                              <span aria-hidden="true">&middot;</span>
                              <span className="font-mono tabular-nums shrink-0">
                                {formatBytes(item.fileSizeBytes)}
                              </span>
                            </div>
                          </div>

                          {/* People / Vintage quiet line */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1D2028] text-[11px] text-zinc-400">
                            {namedPeople.length > 0 || unnamedCount > 0 ? (
                              <span className="flex items-center gap-1.5 truncate">
                                <User className="w-3 h-3 text-zinc-500 shrink-0" />
                                <span className="truncate">
                                  {namedPeople.join(', ')}
                                  {unnamedCount > 0
                                    ? `${namedPeople.length > 0 ? ' + ' : ''}${unnamedCount} unnamed`
                                    : ''}
                                </span>
                              </span>
                            ) : item.isVintageCamera ? (
                              <span className="flex items-center gap-1.5 text-emerald-400/90 truncate">
                                <ShieldCheck className="w-3 h-3 shrink-0" />
                                <span className="truncate">Old camera protected</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-zinc-500 truncate">
                                <Film className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {item.width}&times;{item.height}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
