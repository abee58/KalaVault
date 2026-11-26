import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Edit3,
  Folder,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { MediaItem, PersonSummary } from '../types/media';
import { MediaThumbnail } from './MediaThumbnail';

interface PeopleViewProps {
  items: MediaItem[];
  onNameFace: (mediaId: string, faceId: string, newName: string) => void;
  onRenamePerson: (personId: string, newName: string) => void;
  onOpenLightbox: (item: MediaItem) => void;
}

const FaceCropAvatar: React.FC<{
  src: string;
  box: { x: number; y: number; w: number; h: number };
  alt: string;
  sizeClass?: string;
}> = ({ src, box, alt, sizeClass = 'w-24 h-24' }) => {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Scale so the face box comfortably fills the square portrait
  const zoom = Math.min(4.2, Math.max(1.8, 72 / Math.max(box.w, box.h)));

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#0D0F14] border border-[#282D3A] shrink-0 ${sizeClass}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        style={{
          transformOrigin: `${cx}% ${cy}%`,
          transform: `scale(${zoom})`,
        }}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export const PeopleView: React.FC<PeopleViewProps> = ({
  items,
  onNameFace,
  onRenamePerson,
  onOpenLightbox,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [namingInputs, setNamingInputs] = useState<Record<string, string>>({});
  const [editingPersonName, setEditingPersonName] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  // Build Picasa-style virtual person collections (chronological, never moving files)
  const { people, unnamedFaces } = useMemo(() => {
    const peopleMap = new Map<
      string,
      {
        personId: string;
        name: string;
        mediaIds: Set<string>;
        events: Set<string>;
        bestScore: number;
        coverMediaId: string;
        coverSrc: string;
        coverBox: { x: number; y: number; w: number; h: number };
      }
    >();

    const unnamed: {
      mediaId: string;
      faceId: string;
      src: string;
      fileName: string;
      eventName: string;
      year: number;
      box: { x: number; y: number; w: number; h: number };
    }[] = [];

    // Deduplicate burst views slightly in unnamed tray by preferring best-in-burst first
    const sorted = [...items].sort((a, b) => Number(b.isRecommendedBest) - Number(a.isRecommendedBest));
    const seenUnnamedKeys = new Set<string>();

    for (const item of sorted) {
      for (const face of item.faces) {
        if (face.personId && face.personName) {
          const existing = peopleMap.get(face.personId);
          if (!existing) {
            peopleMap.set(face.personId, {
              personId: face.personId,
              name: face.personName,
              mediaIds: new Set([item.id]),
              events: new Set([item.eventName]),
              bestScore: item.overallScore,
              coverMediaId: item.id,
              coverSrc: item.src,
              coverBox: face.box,
            });
          } else {
            existing.mediaIds.add(item.id);
            existing.events.add(item.eventName);
            if (item.overallScore > existing.bestScore) {
              existing.bestScore = item.overallScore;
              existing.coverMediaId = item.id;
              existing.coverSrc = item.src;
              existing.coverBox = face.box;
            }
          }
        } else {
          // Avoid repeating identical unnamed face across an 8-shot burst in the quick tray
          const dedupeKey = `${item.burstGroupId || item.id}-${Math.round(face.box.x / 10)}-${Math.round(face.box.y / 10)}`;
          if (!seenUnnamedKeys.has(dedupeKey)) {
            seenUnnamedKeys.add(dedupeKey);
            unnamed.push({
              mediaId: item.id,
              faceId: face.id,
              src: item.src,
              fileName: item.fileName,
              eventName: item.eventName,
              year: item.year,
              box: face.box,
            });
          }
        }
      }
    }

    const summaryList: PersonSummary[] = Array.from(peopleMap.values())
      .map((p) => ({
        personId: p.personId,
        name: p.name,
        photoCount: p.mediaIds.size,
        events: Array.from(p.events),
        coverMediaId: p.coverMediaId,
        coverSrc: p.coverSrc,
        coverBox: p.coverBox,
      }))
      .sort((a, b) => b.photoCount - a.photoCount);

    return { people: summaryList, unnamedFaces: unnamed };
  }, [items]);

  const selectedPerson = useMemo(
    () => people.find((p) => p.personId === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  const selectedPersonPhotos = useMemo(() => {
    if (!selectedPerson) return [];
    return items
      .filter((item) => item.faces.some((f) => f.personId === selectedPerson.personId))
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [items, selectedPerson]);

  const submitUnnamedFace = (mediaId: string, faceId: string) => {
    const val = (namingInputs[faceId] || '').trim();
    if (!val) return;
    onNameFace(mediaId, faceId, val);
    setNamingInputs((prev) => {
      const next = { ...prev };
      delete next[faceId];
      return next;
    });
  };

  if (selectedPerson) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#232730]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setSelectedPersonId(null);
                setEditingPersonName(false);
              }}
              className="rounded-lg border border-[#262A34] bg-[#14171E] p-2 text-zinc-300 hover:text-white hover:bg-[#1E222D] transition-colors cursor-pointer"
              aria-label="Back to People"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <FaceCropAvatar
              src={selectedPerson.coverSrc}
              box={selectedPerson.coverBox}
              alt={selectedPerson.name}
              sizeClass="w-14 h-14"
            />

            <div>
              {editingPersonName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameDraft.trim()) {
                        onRenamePerson(selectedPerson.personId, renameDraft.trim());
                        setEditingPersonName(false);
                      }
                      if (e.key === 'Escape') setEditingPersonName(false);
                    }}
                    autoFocus
                    className="rounded-md border border-amber-500/60 bg-[#0C0D10] px-2.5 py-1 text-base font-semibold text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameDraft.trim()) {
                        onRenamePerson(selectedPerson.personId, renameDraft.trim());
                      }
                      setEditingPersonName(false);
                    }}
                    className="rounded-md bg-amber-500 p-1.5 text-zinc-950 hover:bg-amber-400 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    {selectedPerson.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameDraft(selectedPerson.name);
                      setEditingPersonName(true);
                    }}
                    className="rounded p-1 text-zinc-500 hover:text-zinc-200 hover:bg-[#1D2028] cursor-pointer"
                    title="Rename person"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono tabular-nums">
                  {selectedPersonPhotos.length} {selectedPersonPhotos.length === 1 ? 'photo' : 'photos'}
                </span>
                <span aria-hidden="true">&middot;</span>
                <span>{selectedPerson.events.join(', ')}</span>
                <span aria-hidden="true">&middot;</span>
                <span className="text-emerald-400">Virtual view · Original folders untouched</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chronological Photos of This Person */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {selectedPersonPhotos.map((item) => {
            const dateLabel = new Date(item.capturedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <article
                key={item.id}
                onClick={() => onOpenLightbox(item)}
                className="group rounded-xl border border-[#232730] bg-[#13151B] overflow-hidden hover:border-[#394052] transition-colors cursor-pointer"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <MediaThumbnail
                    item={item}
                    className="w-full h-full group-hover:scale-[1.03] transition-transform duration-200"
                  />
                  {/* Highlight this person's face box subtly on hover */}
                  {item.faces
                    .filter((f) => f.personId === selectedPerson.personId)
                    .map((f) => (
                      <div
                        key={f.id}
                        style={{
                          left: `${f.box.x}%`,
                          top: `${f.box.y}%`,
                          width: `${f.box.w}%`,
                          height: `${f.box.h}%`,
                        }}
                        className="pointer-events-none absolute border-2 border-amber-400/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    ))}
                </div>
                <div className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate">
                      {item.eventName}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 tabular-nums shrink-0">
                      {dateLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono truncate">
                    <Folder className="w-3 h-3 shrink-0 text-zinc-600" />
                    <span className="truncate">{item.originalPath}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Picasa Non-Destructive Guarantee */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#232730]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            People &amp; Face Recognition
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Picasa-style virtual face collections sorted chronologically. Open any photo to draw or edit face tags.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>View-only index · Files are never moved on your hard drive</span>
        </div>
      </div>

      {/* Unnamed Faces Ready to Tag */}
      {unnamedFaces.length > 0 && (
        <section className="rounded-xl border border-[#272C38] bg-[#14171F] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-sm font-semibold text-white">
                Unnamed Faces Detected Locally ({unnamedFaces.length})
              </h2>
            </div>
            <span className="text-xs text-zinc-500">Type a name to group all their photos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unnamedFaces.map((face) => (
              <div
                key={face.faceId}
                className="flex items-center gap-4 rounded-lg border border-[#242834] bg-[#101218] p-3"
              >
                <FaceCropAvatar
                  src={face.src}
                  box={face.box}
                  alt={`Unnamed face from ${face.eventName}`}
                  sizeClass="w-16 h-16"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-xs text-zinc-400 truncate">
                    Found in <span className="text-zinc-200 font-medium">{face.eventName}</span> &middot;{' '}
                    <span className="font-mono">{face.year}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add name (e.g. Mausi, Karan)..."
                      value={namingInputs[face.faceId] || ''}
                      onChange={(e) =>
                        setNamingInputs((prev) => ({ ...prev, [face.faceId]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitUnnamedFace(face.mediaId, face.faceId);
                      }}
                      className="flex-1 min-w-0 rounded-md border border-[#2D3240] bg-[#171A23] px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => submitUnnamedFace(face.mediaId, face.faceId)}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Tag
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recognized People Directory (3-in-a-row desktop portrait cards) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-zinc-400" />
            <span>Recognized People ({people.length})</span>
          </h2>
          <span className="text-xs text-zinc-500">Click any person to view their chronological timeline</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => (
            <button
              key={person.personId}
              type="button"
              onClick={() => setSelectedPersonId(person.personId)}
              className="flex items-center gap-4 rounded-xl border border-[#232730] bg-[#13151B] p-4 text-left hover:border-amber-500/45 hover:bg-[#171A22] transition-colors cursor-pointer"
            >
              <FaceCropAvatar
                src={person.coverSrc}
                box={person.coverBox}
                alt={person.name}
                sizeClass="w-20 h-20"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-base font-semibold text-white truncate">{person.name}</div>
                <div className="text-xs text-zinc-400 font-mono tabular-nums">
                  {person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {person.events.join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
