/**
 * BackgroundLayer — a camada de fundo da interface (atrás de tudo, z -1).
 *
 * Renderiza gradiente / cor sólida / imagem/GIF / vídeo direto / YouTube
 * conforme `useBackgroundSettings()`, com overlay de legibilidade (scrim),
 * blur e animação opcionais. É sempre chamada pelo AppShell; quando
 * `mode === "none"`, não renderiza nada (shell usa fundo sólido do tema).
 */
import { useMemo } from "react";
import {
  useBackgroundSettings,
  extractYouTubeId,
  isDirectVideoUrl,
} from "@/lib/appearanceSettings";

export function BackgroundLayer() {
  const s = useBackgroundSettings();

  const youtubeId = useMemo(
    () => (s.mode === "video" ? extractYouTubeId(s.videoUrl) : null),
    [s.mode, s.videoUrl],
  );
  const directVideo = useMemo(
    () => (s.mode === "video" ? isDirectVideoUrl(s.videoUrl) : false),
    [s.mode, s.videoUrl],
  );

  if (s.mode === "none") return null;

  const overlayBg =
    s.overlayColor === "dark"
      ? `rgba(0,0,0,${s.overlayOpacity / 100})`
      : `rgba(255,255,255,${s.overlayOpacity / 100})`;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {s.mode === "gradient" && (
        <div
          className={s.animated ? "bg-pan-anim" : undefined}
          style={{
            position: "absolute", inset: "-10%",
            background: s.gradient,
            backgroundSize: s.animated ? "200% 200%" : "cover",
          }}
        />
      )}

      {s.mode === "color" && (
        <div style={{ position: "absolute", inset: 0, background: s.color }} />
      )}

      {s.mode === "image" && s.imageUrl && (
        <img
          src={s.imageUrl}
          alt=""
          className={s.animated ? "kenburns" : undefined}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            filter: s.blur ? `blur(${s.blur}px)` : undefined,
            transform: s.blur ? "scale(1.05)" : undefined,
          }}
        />
      )}

      {s.mode === "video" && (
        <div
          style={{
            position: "absolute", inset: 0,
            filter: s.blur ? `blur(${s.blur}px)` : undefined,
            transform: s.blur ? "scale(1.05)" : undefined,
          }}
        >
          {youtubeId ? (
            <iframe
              title="Fundo de vídeo"
              // autoplay/mute/loop — playlist é exigida p/ loop no YT embed
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0`}
              allow="autoplay"
              frameBorder="0"
              style={{
                position: "absolute", top: "50%", left: "50%",
                width: "177.78vh", height: "100vh", // cobrir 16:9
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          ) : directVideo ? (
            <video
              src={s.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">
              Cole uma URL de YouTube ou vídeo direto (.mp4/.webm/.ogg)
            </div>
          )}
        </div>
      )}

      {/* Scrim de legibilidade — evita texto ilegível sobre o fundo */}
      <div style={{ position: "absolute", inset: 0, background: overlayBg }} />
    </div>
  );
}
