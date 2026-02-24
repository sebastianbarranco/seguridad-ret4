'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { getRecordingPlayUrl } from '@/lib/api';

interface Recording {
  id: string;
  camera_id: string;
  recording_date: string;
  hour: number;
  filename: string;
  duration_seconds: number | null;
  size_bytes: number | null;
  status: string;
}

interface SecurityPlayerProps {
  recordings: Recording[];   // All hourly segments for a camera+date
  cameraName: string;
  date: string;
  onClose: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export default function SecurityPlayer({ recordings, cameraName, date, onClose }: SecurityPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentHour, setCurrentHour] = useState(recordings[0]?.hour ?? 0);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [showControls, setShowControls] = useState(true);

  // Group recordings by hour for the timeline
  const hourMap = new Map<number, Recording>();
  recordings.forEach(r => hourMap.set(r.hour, r));

  const currentRecording = hourMap.get(currentHour);

  // Auto-advance to next hour when video ends
  const handleVideoEnded = useCallback(() => {
    const nextHour = currentHour + 1;
    if (nextHour <= 23 && hourMap.has(nextHour)) {
      setCurrentHour(nextHour);
    } else {
      setIsPlaying(false);
    }
  }, [currentHour, hourMap]);

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed, currentHour]);

  // Time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      video.playbackRate = speed;
      if (isPlaying) video.play().catch(() => {});
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', handleVideoEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', handleVideoEnded);
    };
  }, [currentHour, speed, isPlaying, handleVideoEnded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowRight') {
        if (videoRef.current) videoRef.current.currentTime += 10;
      }
      if (e.key === 'ArrowLeft') {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      }
      if (e.key === '+' || e.key === '=') cycleSpeed(1);
      if (e.key === '-') cycleSpeed(-1);
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 'z') setZoom(z => Math.min(z + 0.5, 5));
      if (e.key === 'x') { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [speed]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const cycleSpeed = (dir: number) => {
    const idx = SPEEDS.indexOf(speed);
    const next = idx + dir;
    if (next >= 0 && next < SPEEDS.length) {
      setSpeed(SPEEDS[next]);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Zoom/pan handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom(z => {
      const newZ = Math.max(1, Math.min(5, z + delta));
      if (newZ === 1) setPan({ x: 0, y: 0 });
      return newZ;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoom > 1) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" ref={containerRef}>
      {/* Top bar */}
      <div className={`flex items-center justify-between px-4 py-2 bg-black/80 border-b border-dark-700 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4">
          <span className="text-red-500 font-bold text-sm flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            REC
          </span>
          <h2 className="text-white font-bold">{cameraName}</h2>
          <span className="text-dark-400 text-sm">{date}</span>
          <span className="text-cyan-400 font-mono text-lg">{currentHour.toString().padStart(2, '0')}:{formatTime(currentTime).split(':').slice(-1)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white text-xs bg-dark-700 px-2 py-1 rounded">
            Atajos: Espacio=▶ ←→=±10s +-=velocidad Z=zoom X=reset F=fullscreen
          </span>
          <button onClick={onClose} className="text-dark-400 hover:text-white text-xl px-2">✕</button>
        </div>
      </div>

      {/* Video area */}
      <div
        className="flex-1 overflow-hidden bg-black flex items-center justify-center cursor-crosshair relative"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button') && !isPanning) togglePlay();
        }}
        onMouseEnter={() => setShowControls(true)}
      >
        {currentRecording ? (
          <video
            ref={videoRef}
            key={currentRecording.id}
            className="max-w-full max-h-full"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
              transition: isPanning ? 'none' : 'transform 0.2s ease',
            }}
            preload="auto"
            autoPlay
          >
            <source src={getRecordingPlayUrl(currentRecording.id)} type="video/mp4" />
          </video>
        ) : (
          <div className="text-dark-500 text-center">
            <p className="text-4xl mb-2">📷</p>
            <p>Sin grabación disponible para las {currentHour.toString().padStart(2, '0')}:00</p>
          </div>
        )}

        {/* Timestamp overlay */}
        <div className="absolute top-4 left-4 font-mono text-sm text-white/80 bg-black/60 px-2 py-1 rounded pointer-events-none">
          {cameraName} | {date} {currentHour.toString().padStart(2, '0')}:{Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
        </div>

        {/* Speed indicator */}
        {speed !== 1 && (
          <div className="absolute top-4 right-4 font-mono text-lg text-yellow-400 bg-black/60 px-3 py-1 rounded pointer-events-none">
            ×{speed}
          </div>
        )}

        {/* Zoom indicator */}
        {zoom > 1 && (
          <div className="absolute bottom-20 right-4 font-mono text-sm text-cyan-400 bg-black/60 px-2 py-1 rounded pointer-events-none">
            🔍 {zoom.toFixed(1)}x
          </div>
        )}

        {/* Play/pause overlay */}
        {!isPlaying && currentRecording && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
              <span className="text-white text-4xl ml-1">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-1 bg-black/80">
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span className="font-mono w-12">{formatTime(currentTime)}</span>
          <div className="flex-1 h-1.5 bg-dark-700 rounded cursor-pointer relative group" onClick={seek}>
            <div
              className="h-full bg-red-500 rounded"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <span className="font-mono w-12 text-right">{formatTime(duration)}</span>
        </div>
      </div>

      {/* 24-hour timeline */}
      <div className="px-4 py-2 bg-dark-900/95 border-t border-dark-700">
        <div className="flex items-center gap-1 mb-1">
          <span className="text-dark-400 text-xs w-20">Timeline 24h</span>
          <div className="flex-1 flex gap-0.5">
            {Array.from({ length: 24 }, (_, h) => {
              const hasRec = hourMap.has(h);
              const isCurrent = h === currentHour;
              return (
                <button
                  key={h}
                  onClick={() => { setCurrentHour(h); setIsPlaying(true); }}
                  className={`flex-1 h-7 rounded-sm text-xs font-mono flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-red-600 text-white ring-1 ring-red-400'
                      : hasRec
                      ? 'bg-dark-600 text-dark-300 hover:bg-dark-500'
                      : 'bg-dark-800 text-dark-600 cursor-not-allowed'
                  }`}
                  disabled={!hasRec}
                  title={`${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00${hasRec ? '' : ' (sin grabación)'}`}
                >
                  {h.toString().padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-2 bg-dark-900/95 border-t border-dark-700">
        <div className="flex items-center justify-between">
          {/* Left: play controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const prev = currentHour - 1; if (prev >= 0 && hourMap.has(prev)) setCurrentHour(prev); }}
              className="text-dark-400 hover:text-white text-sm px-2 py-1"
              title="Hora anterior"
            >
              ⏮
            </button>
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}
              className="text-dark-400 hover:text-white text-sm px-2 py-1"
              title="-10 segundos"
            >
              ⏪
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 bg-dark-700 hover:bg-dark-600 text-white rounded-full flex items-center justify-center text-lg"
            >
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button
              onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
              className="text-dark-400 hover:text-white text-sm px-2 py-1"
              title="+10 segundos"
            >
              ⏩
            </button>
            <button
              onClick={() => { const next = currentHour + 1; if (next <= 23 && hourMap.has(next)) setCurrentHour(next); }}
              className="text-dark-400 hover:text-white text-sm px-2 py-1"
              title="Hora siguiente"
            >
              ⏭
            </button>
          </div>

          {/* Center: speed controls */}
          <div className="flex items-center gap-1">
            <span className="text-dark-400 text-xs mr-2">Velocidad:</span>
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-xs font-mono ${
                  speed === s
                    ? 'bg-red-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Right: zoom + image controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-dark-400 text-xs mr-1">Zoom:</span>
              <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="px-2 py-1 bg-dark-700 text-dark-300 hover:bg-dark-600 rounded text-xs">−</button>
              <span className="text-white text-xs font-mono w-8 text-center">{zoom.toFixed(1)}x</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="px-2 py-1 bg-dark-700 text-dark-300 hover:bg-dark-600 rounded text-xs">+</button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 py-1 bg-dark-700 text-dark-300 hover:bg-dark-600 rounded text-xs" title="Reset zoom">↺</button>
            </div>
            <div className="w-px h-6 bg-dark-600 mx-1" />
            <div className="flex items-center gap-1">
              <span className="text-dark-400 text-xs">☀</span>
              <input type="range" min="50" max="200" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-16 h-1 accent-yellow-500" title={`Brillo: ${brightness}%`} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-dark-400 text-xs">◐</span>
              <input type="range" min="50" max="200" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-16 h-1 accent-blue-500" title={`Contraste: ${contrast}%`} />
            </div>
            <div className="w-px h-6 bg-dark-600 mx-1" />
            <button onClick={toggleFullscreen} className="text-dark-400 hover:text-white px-2 py-1 text-sm" title="Pantalla completa (F)">
              {isFullscreen ? '⊡' : '⛶'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
