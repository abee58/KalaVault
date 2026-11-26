import React, { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Folder,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { MediaItem } from '../types/media';
import { formatBytes, formatDuration } from '../engine/localVision';
import { MediaThumbnail } from './MediaThumbnail';

interface LightboxModalProps {
  item: MediaItem;
  allEvents: string[];
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onNameFace: (mediaId: string, faceId: string, newName: string) => void;
  onAddFaceTag: (
    mediaId: string,
    box: { x: number; y: number; w: number; h: number },
    name: string
  ) => void;
  onChangeEvent: (mediaId: string, newEventName: string) => void;
  onMoveToBin: (mediaId: string, reason: string) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  item,
  allEvents,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onNameFace,
  onAddFaceTag,
  onChangeEvent,
  onMoveToBin,
}) => {
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
  const [faceDraft, setFaceDraft] = useState('');
  const [tagMode, setTagMode] = useState(false);
  const [pendingBox, setPendingBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );
  const [newFaceName, setNewFaceName] = useState('');
  const [eventDraft, setEventDraft] = useState(item.eventName);
  const [editingEvent, setEditingEvent] = useState(false);

  useEffect(() => {
    setEventDraft(item.eventName);
    setEditingEvent(false);
    setActiveFaceId(null);
    setPendingBox(null);
    setTagMode(false);
  }, [item.id, item.eventName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hasPrev, hasNext, onPrev, onNext]);

  const handlePhotoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tagMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;
    const w = 14;
    const h = 20;
    setPendingBox({
      x: Math.max(2, Math.min(100 - w - 2, Math.round(clickX - w / 2))),
      y: Math.max(2, Math.min(100 - h - 2, Math.round(clickY - h / 2))),
      w,
      h,
    });
    setNewFaceName('');
  };

  const commitNewFace = () => {
    if (!pendingBox || !newFaceName.trim()) return;
    onAddFaceTag(item.id, pendingBox, newFaceName.trim());
    setPendingBox(null);
    setNewFaceName('');
    setTagMode(false);
  };

  const capturedLabel = new Date(item.capturedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-black/95"
      onClick={onClose}
    >
      {/* Left/Center Photo Canvas */}
      <div
        className="relative flex-1 flex flex-col min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#1E222B] bg-[#0B0C0F]">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{item.fileName}</div>
            <div className="text-xs text-zinc-400 truncate">
              {item.eventName} &middot; {capturedLabel}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {item.type === 'photo' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowFaceBoxes((s) => !s)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    showFaceBoxes
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-[#272C37] bg-[#151820] text-zinc-300 hover:text-white'
                  }`}
                >
                  {showFaceBoxes ? 'Hide Faces' : 'Show Faces'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTagMode((t) => !t);
                    setShowFaceBoxes(true);
                    setPendingBox(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    tagMode
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-[#272C37] bg-[#151820] text-zinc-300 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tagMode ? 'Click a face on photo...' : 'Tag Face'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#272C37] bg-[#151820] p-1.5 text-zinc-300 hover:text-white hover:bg-[#1E222D] cursor-pointer"
              aria-label="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Stage */}
        <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none">
          {hasPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-3 z-20 rounded-full border border-[#2C3140] bg-black/70 p-2.5 text-zinc-200 hover:text-white hover:bg-black cursor-pointer"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-3 z-20 rounded-full border border-[#2C3140] bg-black/70 p-2.5 text-zinc-200 hover:text-white hover:bg-black cursor-pointer"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Exact aspect container so face box percentages align accurately */}
          <div
            onClick={handlePhotoClick}
            className={`relative max-h-full max-w-full aspect-[4/3] w-auto h-full max-h-[74vh] overflow-hidden rounded-lg ${
              tagMode ? 'cursor-crosshair' : ''
            }`}
          >
            {item.type === 'video' && item.isLocalDiskFile && item.src.startsWith('blob:') ? (
              <video
                src={item.src}
                controls
                autoPlay
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <MediaThumbnail item={item} className="w-full h-full" />
            )}

            {/* Existing Picasa Face Bounding Boxes */}
            {showFaceBoxes &&
              item.type === 'photo' &&
              item.faces.map((face) => {
                const isEditing = activeFaceId === face.id;
                return (
                  <div
                    key={face.id}
                    style={{
                      left: `${face.box.x}%`,
                      top: `${face.box.y}%`,
                      width: `${face.box.w}%`,
                      height: `${face.box.h}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFaceId(face.id);
                      setFaceDraft(face.personName || '');
                    }}
                    className={`absolute rounded-md border-2 transition-colors cursor-pointer ${
                      face.personName
                        ? 'border-amber-400/80 hover:border-amber-300'
                        : 'border-dashed border-sky-400 hover:border-sky-300'
                    }`}
                  >
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-2 py-0.5 text-[11px] font-medium text-white shadow">
                      {face.personName || 'Click to name'}
                    </div>

                    {isEditing && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-full mt-7 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-lg border border-[#303647] bg-[#14171F] p-1.5 shadow-xl"
                      >
                        <input
                          type="text"
                          value={faceDraft}
                          onChange={(e) => setFaceDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && faceDraft.trim()) {
                              onNameFace(item.id, face.id, faceDraft.trim());
                              setActiveFaceId(null);
                            }
                            if (e.key === 'Escape') setActiveFaceId(null);
                          }}
                          placeholder="Name..."
                          autoFocus
                          className="w-28 rounded bg-[#0C0D10] px-2 py-1 text-xs text-white outline-none border border-[#2C3140] focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (faceDraft.trim()) {
                              onNameFace(item.id, face.id, faceDraft.trim());
                            }
                            setActiveFaceId(null);
                          }}
                          className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Newly Placed Face Box in Tag Mode */}
            {pendingBox && (
              <div
                style={{
                  left: `${pendingBox.x}%`,
                  top: `${pendingBox.y}%`,
                  width: `${pendingBox.w}%`,
                  height: `${pendingBox.h}%`,
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute rounded-md border-2 border-emerald-400"
              >
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-lg border border-[#303647] bg-[#14171F] p-1.5 shadow-xl">
                  <input
                    type="text"
                    value={newFaceName}
                    onChange={(e) => setNewFaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitNewFace();
                      if (e.key === 'Escape') setPendingBox(null);
                    }}
                    placeholder="Person name..."
                    autoFocus
                    className="w-32 rounded bg-[#0C0D10] px-2 py-1 text-xs text-white outline-none border border-[#2C3140] focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={commitNewFace}
                    className="rounded bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Archival Inspector Panel */}
      <aside
        className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-[#232730] bg-[#111319] p-5 overflow-y-auto space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Local Analysis Verdict */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-400">Local Quality Analysis</div>
          <p className="text-xs leading-relaxed text-zinc-200">{item.comparisonNote}</p>
          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            <div className="rounded-lg border border-[#222630] bg-[#161921] p-2.5">
              <div className="text-[10px] text-zinc-500">Sharpness</div>
              <div className="mt-0.5 font-mono font-semibold text-white tabular-nums">
                {item.sharpnessScore}
              </div>
            </div>
            <div className="rounded-lg border border-[#222630] bg-[#161921] p-2.5">
              <div className="text-[10px] text-zinc-500">Face Focus</div>
              <div className="mt-0.5 font-mono font-semibold text-white tabular-nums">
                {item.faceClarityScore}
              </div>
            </div>
            <div className="rounded-lg border border-[#222630] bg-[#161921] p-2.5">
              <div className="text-[10px] text-zinc-500">Exposure</div>
              <div className="mt-0.5 font-mono font-semibold text-white tabular-nums">
                {item.exposureScore}
              </div>
            </div>
          </div>
        </div>

        {/* Event Assignment */}
        <div className="space-y-2 pt-4 border-t border-[#1F232C]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Event Album</span>
            </span>
            {!editingEvent && (
              <button
                type="button"
                onClick={() => setEditingEvent(true)}
                className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Change
              </button>
            )}
          </div>

          {editingEvent ? (
            <div className="space-y-2">
              <input
                type="text"
                list="kalavault-events-list"
                value={eventDraft}
                onChange={(e) => setEventDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && eventDraft.trim()) {
                    onChangeEvent(item.id, eventDraft.trim());
                    setEditingEvent(false);
                  }
                }}
                className="w-full rounded-lg border border-amber-500/50 bg-[#0C0D10] px-3 py-1.5 text-xs text-white outline-none"
                placeholder="e.g. Birthday 2014"
              />
              <datalist id="kalavault-events-list">
                {allEvents.map((ev) => (
                  <option key={ev} value={ev} />
                ))}
              </datalist>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (eventDraft.trim()) {
                      onChangeEvent(item.id, eventDraft.trim());
                    }
                    setEditingEvent(false);
                  }}
                  className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 cursor-pointer"
                >
                  Save Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEventDraft(item.eventName);
                    setEditingEvent(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-white">{item.eventName}</div>
          )}
        </div>

        {/* Tagged People List */}
        <div className="space-y-2 pt-4 border-t border-[#1F232C]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Tag className="w-3.5 h-3.5" />
            <span>People in This Capture</span>
          </div>
          {item.faces.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No faces tagged yet. Click &ldquo;Tag Face&rdquo; above to click a person on the photo.
            </p>
          ) : (
            <div className="space-y-1.5">
              {item.faces.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-xs text-zinc-300"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{f.personName || 'Unnamed face'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFaceBoxes(true);
                      setActiveFaceId(f.id);
                      setFaceDraft(f.personName || '');
                    }}
                    className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    {f.personName ? 'Edit' : 'Name'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Untouched Original Disk Info */}
        <div className="space-y-2 pt-4 border-t border-[#1F232C] text-xs">
          <div className="text-xs font-semibold text-zinc-400">File &amp; Disk Details</div>
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Camera</dt>
              <dd className="text-zinc-200 text-right truncate">{item.cameraModel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Dimensions</dt>
              <dd className="font-mono text-zinc-200 tabular-nums">
                {item.width}&times;{item.height}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">File Size</dt>
              <dd className="font-mono text-zinc-200 tabular-nums">
                {formatBytes(item.fileSizeBytes)}
              </dd>
            </div>
            {item.type === 'video' && (
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Duration</dt>
                <dd className="font-mono text-zinc-200 tabular-nums">
                  {formatDuration(item.durationSec)} ({item.fps || 30} fps)
                </dd>
              </div>
            )}
          </dl>

          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Original PC location (never moved)</span>
            </div>
            <div className="flex items-start gap-1.5 rounded-lg border border-[#222630] bg-[#0C0D10] p-2.5 font-mono text-[11px] text-zinc-400 break-all">
              <Folder className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <span>{item.originalPath}</span>
            </div>
          </div>
        </div>

        {/* Move to Bin */}
        <div className="pt-4 border-t border-[#1F232C]">
          <button
            type="button"
            onClick={() => {
              onMoveToBin(item.id, 'Moved to Recovery Bin from Inspector');
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Move to Recovery Bin</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
