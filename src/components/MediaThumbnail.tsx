import React, { useState } from 'react';
import { Film, ImageOff } from 'lucide-react';
import type { MediaItem } from '../types/media';

interface MediaThumbnailProps {
  item: MediaItem;
  className?: string;
  /** Optional zoomed focus centered on the primary face box */
  zoomFace?: boolean;
  /** Render crisp container-contained full view vs cover crop */
  objectFit?: 'cover' | 'contain';
  /** Animate subtle handheld shake for shaky video preview */
  animateVideoShake?: boolean;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  item,
  className = '',
  zoomFace = false,
  objectFit = 'cover',
  animateVideoShake = false,
}) => {
  const [failed, setFailed] = useState(false);

  const fx = item.visualEffect;
  const filters: string[] = [];
  if (fx?.blurPx) filters.push(`blur(${fx.blurPx}px)`);
  if (fx?.brightness) filters.push(`brightness(${fx.brightness})`);
  if (fx?.contrast) filters.push(`contrast(${fx.contrast})`);
  if (fx?.saturate) filters.push(`saturate(${fx.saturate})`);

  let transform = '';
  let transformOrigin = '50% 50%';

  if (zoomFace) {
    const primaryFace = item.faces[0];
    if (primaryFace) {
      const cx = primaryFace.box.x + primaryFace.box.w / 2;
      const cy = primaryFace.box.y + primaryFace.box.h / 2;
      transformOrigin = `${cx}% ${cy}%`;
      transform = 'scale(2.45)';
    } else {
      transformOrigin = '50% 42%';
      transform = 'scale(2.1)';
    }
  } else if (fx?.scale || fx?.offsetX || fx?.offsetY) {
    const sc = fx.scale ?? 1;
    const ox = fx.offsetX ?? 0;
    const oy = fx.offsetY ?? 0;
    transform = `scale(${sc}) translate(${ox}%, ${oy}%)`;
  }

  const isRealLocalVideo = item.type === 'video' && item.isLocalDiskFile && item.src.startsWith('blob:');

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#181B22] text-zinc-500 p-4 text-center ${className}`}
      >
        {item.type === 'video' ? (
          <Film className="w-7 h-7 mb-2 text-zinc-500" />
        ) : (
          <ImageOff className="w-7 h-7 mb-2 text-zinc-500" />
        )}
        <span className="text-xs font-medium text-zinc-400 truncate max-w-full">
          {item.fileName}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#121419] ${className}`}>
      {isRealLocalVideo ? (
        <video
          src={item.src}
          muted
          playsInline
          preload="metadata"
          className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={item.src}
          alt={`${item.eventName} — ${item.fileName}`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          style={{
            filter: filters.length > 0 ? filters.join(' ') : undefined,
            transform: transform || undefined,
            transformOrigin,
            transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${
            animateVideoShake && fx?.shaky ? 'animate-[pulse_0.9s_ease-in-out_infinite]' : ''
          }`}
        />
      )}
    </div>
  );
};
