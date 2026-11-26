import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Menu, RotateCcw, Search, X } from 'lucide-react';
import type { ActiveSection, MediaItem } from './types/media';
import { createInitialLocalLibrary } from './data/demoLibrary';
import { loadLibraryLocally, saveLibraryLocally } from './engine/localDb';
import { Sidebar } from './components/Sidebar';
import { TimelineView } from './components/TimelineView';
import { SmartReviewView } from './components/SmartReviewView';
import { PeopleView } from './components/PeopleView';
import { VideoCompareView } from './components/VideoCompareView';
import { RecoveryBinView } from './components/RecoveryBinView';
import { LightboxModal } from './components/LightboxModal';
import { ScanFolderModal } from './components/ScanFolderModal';
import { OfflineIndicator } from './components/PWAInstallButton';

interface ToastState {
  message: string;
  undoIds?: string[];
}

export default function App() {
  const [library, setLibrary] = useState<MediaItem[]>(() => createInitialLocalLibrary());
  const [hydrated, setHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('timeline');
  const [selectedEventFilter, setSelectedEventFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Hydrate persisted edits from local IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadLibraryLocally().then((saved) => {
      if (mounted && saved && saved.length > 0) {
        setLibrary(saved);
      }
      if (mounted) setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist changes locally to IndexedDB whenever library updates
  useEffect(() => {
    if (!hydrated) return;
    saveLibraryLocally(library);
  }, [library, hydrated]);

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const activeItems = useMemo(
    () => library.filter((i) => i.status === 'active'),
    [library]
  );

  const trashedItems = useMemo(
    () =>
      library
        .filter((i) => i.status === 'trashed')
        .sort((a, b) => (b.trashedAt || '').localeCompare(a.trashedAt || '')),
    [library]
  );

  const eventsSummary = useMemo(() => {
    const map = new Map<string, { name: string; year: number; count: number; latestTs: number }>();
    for (const item of activeItems) {
      const ts = new Date(item.capturedAt).getTime();
      const existing = map.get(item.eventName);
      if (!existing) {
        map.set(item.eventName, { name: item.eventName, year: item.year, count: 1, latestTs: ts });
      } else {
        existing.count++;
        existing.latestTs = Math.max(existing.latestTs, ts);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestTs - a.latestTs);
  }, [activeItems]);

  const foldersSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of activeItems) {
      map.set(item.folderName, (map.get(item.folderName) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeItems]);

  const pendingBurstGroupsCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeItems) {
      if (item.burstGroupId) {
        counts.set(item.burstGroupId, (counts.get(item.burstGroupId) || 0) + 1);
      }
    }
    let groups = 0;
    for (const c of counts.values()) {
      if (c >= 2) groups++;
    }
    return groups;
  }, [activeItems]);

  const unnamedFacesCount = useMemo(() => {
    const uniqueKeys = new Set<string>();
    for (const item of activeItems) {
      for (const face of item.faces) {
        if (!face.personName) {
          uniqueKeys.add(
            `${item.burstGroupId || item.id}-${Math.round(face.box.x / 10)}-${Math.round(face.box.y / 10)}`
          );
        }
      }
    }
    return uniqueKeys.size;
  }, [activeItems]);

  const videoCount = useMemo(
    () => activeItems.filter((i) => i.type === 'video').length,
    [activeItems]
  );

  // ===========================================================================
  // Library Mutations (All 100% local, non-destructive until user approves)
  // ===========================================================================
  const handleUpdateDecision = (itemId: string, decision: 'keep' | 'bin') => {
    setLibrary((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, userDecision: decision } : item))
    );
  };

  const handleSetGroupBest = (burstGroupId: string, newBestId: string) => {
    setLibrary((prev) =>
      prev.map((item) => {
        if (item.burstGroupId !== burstGroupId) return item;
        const isBest = item.id === newBestId;
        return {
          ...item,
          isRecommendedBest: isBest,
          userDecision: isBest ? 'keep' : 'bin',
          comparisonNote: isBest
            ? 'Selected by you as Best Pick in this burst'
            : item.comparisonNote,
        };
      })
    );
  };

  const handleApproveGroup = (burstGroupId: string) => {
    const nowIso = new Date().toISOString();
    const binnedIds: string[] = [];

    setLibrary((prev) =>
      prev.map((item) => {
        if (item.burstGroupId !== burstGroupId || item.status !== 'active') return item;
        if (item.userDecision === 'bin') {
          binnedIds.push(item.id);
          return {
            ...item,
            status: 'trashed',
            trashedAt: nowIso,
            trashReason: `Approved burst cleanup · ${item.comparisonNote}`,
          };
        }
        // Kept item(s) are now clean standalone winners
        return {
          ...item,
          burstGroupId: null,
          isRecommendedBest: true,
          userDecision: 'keep',
        };
      })
    );

    if (binnedIds.length > 0) {
      setToast({
        message: `Moved ${binnedIds.length} ${binnedIds.length === 1 ? 'file' : 'files'} to Recovery Bin. Kept your best pick.`,
        undoIds: binnedIds,
      });
    }
  };

  const handleMoveToBin = (itemId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    setLibrary((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: 'trashed',
              trashedAt: nowIso,
              trashReason: reason,
            }
          : item
      )
    );
    setToast({
      message: 'Moved to Recovery Bin. You can restore it anytime.',
      undoIds: [itemId],
    });
  };

  const handleRestoreItems = (itemIds: string[]) => {
    const idSet = new Set(itemIds);
    setLibrary((prev) =>
      prev.map((item) =>
        idSet.has(item.id)
          ? {
              ...item,
              status: 'active',
              trashedAt: undefined,
              trashReason: undefined,
              userDecision: 'keep',
            }
          : item
      )
    );
    setToast({
      message: `Restored ${itemIds.length} ${itemIds.length === 1 ? 'item' : 'items'} back to original Event & Folder.`,
    });
  };

  const handleRestoreAll = () => {
    const ids = trashedItems.map((i) => i.id);
    if (ids.length === 0) return;
    handleRestoreItems(ids);
  };

  const handlePermanentlyDeleteItem = (itemId: string) => {
    setLibrary((prev) => prev.filter((i) => i.id !== itemId));
    setToast({ message: 'Removed item permanently from Recovery Bin.' });
  };

  const handleEmptyBin = () => {
    const count = trashedItems.length;
    setLibrary((prev) => prev.filter((i) => i.status !== 'trashed'));
    setToast({ message: `Cleared ${count} items from Recovery Bin.` });
  };

  const handleRenameEvent = (oldName: string, newName: string) => {
    setLibrary((prev) =>
      prev.map((item) => (item.eventName === oldName ? { ...item, eventName: newName } : item))
    );
    if (selectedEventFilter === oldName) {
      setSelectedEventFilter(newName);
    }
    setToast({ message: `Renamed event to "${newName}". Original PC folders unchanged.` });
  };

  const handleChangeItemEvent = (mediaId: string, newEventName: string) => {
    setLibrary((prev) =>
      prev.map((item) => (item.id === mediaId ? { ...item, eventName: newEventName } : item))
    );
    setToast({ message: `Assigned to event "${newEventName}".` });
  };

  const handleNameFace = (mediaId: string, faceId: string, rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;

    setLibrary((prev) => {
      // Reuse existing personId if someone with this name already exists (case-insensitive)
      let existingPersonId: string | null = null;
      for (const it of prev) {
        for (const f of it.faces) {
          if (f.personName && f.personName.toLowerCase() === trimmed.toLowerCase() && f.personId) {
            existingPersonId = f.personId;
            break;
          }
        }
        if (existingPersonId) break;
      }
      const targetPersonId =
        existingPersonId || `person-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

      // Also propagate to same-burst siblings matching the same face box position
      const sourceItem = prev.find((i) => i.id === mediaId);
      const sourceFace = sourceItem?.faces.find((f) => f.id === faceId);

      return prev.map((item) => {
        const sameBurst = Boolean(sourceItem?.burstGroupId && item.burstGroupId === sourceItem.burstGroupId);
        if (item.id !== mediaId && !sameBurst) return item;

        return {
          ...item,
          faces: item.faces.map((f) => {
            if (f.id === faceId) {
              return { ...f, personId: targetPersonId, personName: trimmed };
            }
            if (
              sameBurst &&
              sourceFace &&
              !f.personName &&
              Math.abs(f.box.x - sourceFace.box.x) <= 6 &&
              Math.abs(f.box.y - sourceFace.box.y) <= 6
            ) {
              return { ...f, personId: targetPersonId, personName: trimmed };
            }
            return f;
          }),
        };
      });
    });

    setToast({ message: `Tagged face as "${trimmed}" (virtual view only).` });
  };

  const handleAddFaceTag = (
    mediaId: string,
    box: { x: number; y: number; w: number; h: number },
    rawName: string
  ) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;

    setLibrary((prev) => {
      let existingPersonId: string | null = null;
      for (const it of prev) {
        for (const f of it.faces) {
          if (f.personName && f.personName.toLowerCase() === trimmed.toLowerCase() && f.personId) {
            existingPersonId = f.personId;
            break;
          }
        }
        if (existingPersonId) break;
      }
      const targetPersonId =
        existingPersonId || `person-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

      return prev.map((item) => {
        if (item.id !== mediaId) return item;
        return {
          ...item,
          faces: [
            ...item.faces,
            {
              id: `${mediaId}-manual-${Date.now()}`,
              personId: targetPersonId,
              personName: trimmed,
              box,
              confidence: 1,
              faceSharpness: item.sharpnessScore,
            },
          ],
        };
      });
    });

    setToast({ message: `Added face tag "${trimmed}".` });
  };

  const handleRenamePerson = (personId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLibrary((prev) =>
      prev.map((item) => ({
        ...item,
        faces: item.faces.map((f) =>
          f.personId === personId ? { ...f, personName: trimmed } : f
        ),
      }))
    );
    setToast({ message: `Renamed person to "${trimmed}".` });
  };

  const handleImportLocalItems = (newItems: MediaItem[], mode: 'merge' | 'replace') => {
    setLibrary((prev) => (mode === 'replace' ? newItems : [...newItems, ...prev]));
    const newBursts = new Set(newItems.map((i) => i.burstGroupId).filter(Boolean)).size;
    setActiveSection(newBursts > 0 ? 'review' : 'timeline');
    setSelectedEventFilter(null);
    setToast({
      message: `Scanned ${newItems.length} local PC files offline${newBursts > 0 ? ` · Found ${newBursts} burst groups to review` : ''}.`,
    });
  };

  const handleResetSampleArchive = () => {
    setLibrary(createInitialLocalLibrary());
    setSelectedEventFilter(null);
    setActiveSection('timeline');
    setToast({ message: 'Restored default sample local archive.' });
  };

  // Lightbox navigation index within active items
  const lightboxIndex = useMemo(
    () => (lightboxItemId ? activeItems.findIndex((i) => i.id === lightboxItemId) : -1),
    [activeItems, lightboxItemId]
  );
  const lightboxItem = lightboxIndex >= 0 ? activeItems[lightboxIndex] : null;

  const sectionTitle =
    activeSection === 'timeline'
      ? selectedEventFilter
        ? `Timeline / ${selectedEventFilter}`
        : 'Timeline & Events'
      : activeSection === 'review'
        ? 'Smart Review'
        : activeSection === 'people'
          ? 'People (Faces)'
          : activeSection === 'videos'
            ? 'Videos'
            : 'Recovery Bin';

  return (
    <div className="min-h-screen flex bg-[#0C0D10] text-[#F3F4F6]">
      {/* Persistent Left Rail (Desktop) + Mobile Drawer */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        events={eventsSummary}
        selectedEventFilter={selectedEventFilter}
        onSelectEventFilter={setSelectedEventFilter}
        folders={foldersSummary}
        pendingBurstGroupsCount={pendingBurstGroupsCount}
        unnamedFacesCount={unnamedFacesCount}
        trashedCount={trashedItems.length}
        totalActiveCount={activeItems.length}
        videoCount={videoCount}
        onOpenScanModal={() => setScanModalOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Workspace Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 lg:px-8 py-3.5 border-b border-[#232730] bg-[#0C0D10]/95 backdrop-blur-sm">
          {/* Zone 1: Mobile Menu + Contextual Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-[#262A34] bg-[#14171F] p-2 text-zinc-300 hover:text-white cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold tracking-tight text-white truncate whitespace-nowrap">
              {sectionTitle}
            </span>
          </div>

          {/* Zone 2: Live Local Search (Events, People, Year, Camera, File) */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeSection !== 'timeline' && e.target.value.trim()) {
                    setActiveSection('timeline');
                  }
                }}
                placeholder="Search event (e.g. Birthday 2014), person, year..."
                className="w-full rounded-lg border border-[#242834] bg-[#13151C] pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-amber-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setScanModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2C3140] bg-[#161922] px-3.5 py-1.5 text-xs font-medium text-zinc-100 hover:bg-[#1F2430] hover:border-amber-500/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Open PC Folder</span>
            </button>
          </div>
        </header>

        {/* Mobile Search Bar */}
        <div className="sm:hidden px-5 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeSection !== 'timeline' && e.target.value.trim()) {
                  setActiveSection('timeline');
                }
              }}
              placeholder="Search Birthday 2014, Ravi, 2011..."
              className="w-full rounded-lg border border-[#242834] bg-[#13151C] pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-amber-500/60"
            />
          </div>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 px-5 lg:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'timeline' && (
            <TimelineView
              items={activeItems}
              searchQuery={searchQuery}
              selectedEventFilter={selectedEventFilter}
              onClearEventFilter={() => setSelectedEventFilter(null)}
              onOpenLightbox={(item) => setLightboxItemId(item.id)}
              onRenameEvent={handleRenameEvent}
              onJumpToReview={() => setActiveSection('review')}
              onMoveToBin={handleMoveToBin}
              pendingBurstCount={pendingBurstGroupsCount}
            />
          )}

          {activeSection === 'review' && (
            <SmartReviewView
              items={activeItems}
              onUpdateDecision={handleUpdateDecision}
              onSetGroupBest={handleSetGroupBest}
              onApproveGroup={handleApproveGroup}
              onOpenLightbox={(item) => setLightboxItemId(item.id)}
            />
          )}

          {activeSection === 'people' && (
            <PeopleView
              items={activeItems}
              onNameFace={handleNameFace}
              onRenamePerson={handleRenamePerson}
              onOpenLightbox={(item) => setLightboxItemId(item.id)}
            />
          )}

          {activeSection === 'videos' && (
            <VideoCompareView
              items={activeItems}
              onApproveGroup={handleApproveGroup}
              onMoveToBin={handleMoveToBin}
              onOpenLightbox={(item) => setLightboxItemId(item.id)}
            />
          )}

          {activeSection === 'bin' && (
            <RecoveryBinView
              trashedItems={trashedItems}
              onRestoreItem={(id) => handleRestoreItems([id])}
              onRestoreAll={handleRestoreAll}
              onPermanentlyDeleteItem={handlePermanentlyDeleteItem}
              onEmptyBin={handleEmptyBin}
            />
          )}
        </main>
      </div>

      {/* Lightbox Viewer with Picasa Face Tagging */}
      {lightboxItem && (
        <LightboxModal
          item={lightboxItem}
          allEvents={eventsSummary.map((e) => e.name)}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < activeItems.length - 1}
          onPrev={() => setLightboxItemId(activeItems[lightboxIndex - 1].id)}
          onNext={() => setLightboxItemId(activeItems[lightboxIndex + 1].id)}
          onClose={() => setLightboxItemId(null)}
          onNameFace={handleNameFace}
          onAddFaceTag={handleAddFaceTag}
          onChangeEvent={handleChangeItemEvent}
          onMoveToBin={handleMoveToBin}
        />
      )}

      {/* Local PC Folder Scanner Modal */}
      <ScanFolderModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onImportLocalItems={handleImportLocalItems}
        onResetSampleArchive={handleResetSampleArchive}
      />

      {/* Action Toast with Instant Undo */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-[#2E3444] bg-[#161922] px-4 py-3 text-xs text-zinc-100 shadow-2xl max-w-md">
          <span>{toast.message}</span>
          {toast.undoIds && toast.undoIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                handleRestoreItems(toast.undoIds!);
                setToast(null);
              }}
              className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PWA Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}
