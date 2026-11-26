import React, { useState } from 'react';
import { Download, Monitor, ShieldCheck, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-400 flex items-center gap-2 border-t border-[#262A34]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="truncate">Installed locally on PC</span>
      </div>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#2D323E] bg-[#191C23] px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-[#222630] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Install on This PC</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#2A2E39] bg-[#14161B] p-6 text-zinc-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="text-base font-semibold tracking-tight text-white">
                  Install KalaVault Locally on PC
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-[#222630] hover:text-white transition-colors cursor-pointer"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              KalaVault is a standalone local desktop web app with an offline service worker. Once installed, it opens in its own desktop window and works completely without internet.
            </p>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-zinc-300 list-decimal list-inside">
                <li>Tap the <strong className="text-white">Share</strong> button in Safari.</li>
                <li>Choose <strong className="text-white">Add to Home Screen</strong>.</li>
                <li>Launch KalaVault anytime offline.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-zinc-300 list-decimal list-inside">
                <li>Open KalaVault in its own <strong className="text-white">Chrome</strong> or <strong className="text-white">Edge</strong> browser tab.</li>
                <li>Click the <strong className="text-white">Install App</strong> icon on the right side of the address bar (or Menu &rarr; Save and Share &rarr; Install KalaVault).</li>
                <li>Pin KalaVault to your Windows Taskbar or macOS Dock. All scanning runs 100% locally on your CPU.</li>
              </ol>
            )}

            <div className="mt-5 pt-4 border-t border-[#262A34] flex items-center justify-between text-xs text-zinc-400">
              <span>Zero cloud uploads · Offline ready</span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#171920] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg">
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline Mode · Running 100% locally on this PC</span>
    </div>
  );
};
