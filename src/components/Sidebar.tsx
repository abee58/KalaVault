import React from 'react';
import {
  Calendar,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  Layers,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ActiveSection } from '../types/media';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  events: { name: string; year: number; count: number }[];
  selectedEventFilter: string | null;
  onSelectEventFilter: (eventName: string | null) => void;
  folders: { name: string; count: number }[];
  pendingBurstGroupsCount: number;
  unnamedFacesCount: number;
  trashedCount: number;
  totalActiveCount: number;
  videoCount: number;
  onOpenScanModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  events,
  selectedEventFilter,
  onSelectEventFilter,
  folders,
  pendingBurstGroupsCount,
  unnamedFacesCount,
  trashedCount,
  totalActiveCount,
  videoCount,
  onOpenScanModal,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: {
    id: ActiveSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
    highlight?: boolean;
  }[] = [
    { id: 'timeline', label: 'Timeline & Events', icon: Calendar, count: totalActiveCount },
    {
      id: 'review',
      label: 'Smart Review',
      icon: Layers,
      count: pendingBurstGroupsCount,
      highlight: pendingBurstGroupsCount > 0,
    },
    {
      id: 'people',
      label: 'People (Faces)',
      icon: Users,
      count: unnamedFacesCount > 0 ? unnamedFacesCount : undefined,
    },
    { id: 'videos', label: 'Videos', icon: Film, count: videoCount },
    { id: 'bin', label: 'Recovery Bin', icon: Trash2, count: trashedCount },
  ];

  const handleNav = (id: ActiveSection) => {
    onSelectSection(id);
    if (id !== 'timeline') {
      onSelectEventFilter(null);
    }
    onCloseMobile();
  };

  const content = (
    <div className="flex h-full flex-col bg-[#121419] border-r border-[#232730]">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#232730]">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/icon.svg"
            alt="KalaVault"
            className="w-7 h-7 rounded-md shrink-0"
          />
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-white leading-none whitespace-nowrap">
              KalaVault
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 whitespace-nowrap">
              Local Offline Archive
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden rounded-md p-1.5 text-zinc-400 hover:bg-[#1E212B] hover:text-white cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable rail body */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Primary Library Navigation */}
        <nav className="space-y-1" aria-label="Library sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id && !(item.id === 'timeline' && selectedEventFilter);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'timeline') onSelectEventFilter(null);
                  handleNav(item.id);
                }}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#1D2028] text-white'
                    : 'text-zinc-400 hover:bg-[#171A21] hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-amber-400'
                        : item.highlight
                          ? 'text-amber-500/80'
                          : 'text-zinc-500'
                    }`}
                  />
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span
                    className={`font-mono text-xs tabular-nums shrink-0 ${
                      item.highlight
                        ? 'text-amber-400 font-semibold'
                        : isActive
                          ? 'text-zinc-300'
                          : 'text-zinc-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Events Chronological Quick List */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">Events</span>
            <span className="text-[11px] font-mono text-zinc-600 tabular-nums">{events.length}</span>
          </div>
          <div className="space-y-0.5">
            {events.map((ev) => {
              const isSelected = activeSection === 'timeline' && selectedEventFilter === ev.name;
              return (
                <button
                  key={ev.name}
                  type="button"
                  onClick={() => {
                    onSelectSection('timeline');
                    onSelectEventFilter(isSelected ? null : ev.name);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1D2028] text-amber-300 font-medium'
                      : 'text-zinc-400 hover:bg-[#171A21] hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{ev.name}</span>
                  <span className="font-mono text-[11px] text-zinc-500 tabular-nums shrink-0">
                    {ev.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Untouched Original Disk Folders (Picasa-style virtual folder tree) */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">PC Folders (Untouched)</span>
          </div>
          <div className="space-y-0.5">
            {folders.map((folder) => (
              <div
                key={folder.name}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-zinc-500"
                title={`Original folder on disk: ${folder.name} (never moved)`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Folder className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="font-mono text-[11px] text-zinc-600 tabular-nums shrink-0">
                  {folder.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom local actions */}
      <div className="p-3 border-t border-[#232730] space-y-2 bg-[#101217]">
        <button
          type="button"
          onClick={() => {
            onOpenScanModal();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Scan PC Folder</span>
        </button>

        <PWAInstallButton />

        <div className="pt-1 px-1 flex items-center gap-2 text-[11px] text-zinc-500">
          <HardDrive className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="truncate">On-device processing · No internet</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent left rail */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70" onClick={onCloseMobile} />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">{content}</aside>
        </div>
      )}
    </>
  );
};
