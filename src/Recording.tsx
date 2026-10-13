import { useEffect, useRef } from 'react';
import { playback } from './playbackCoordinator';

type Player = { pauseVideo(): void; destroy(): void };
type YouTube = { Player: new (frame: HTMLIFrameElement, options: {
  events: { onStateChange(event: { data: number }): void; onError(event: { data: number }): void };
}) => Player };
const youtubeWindow = window as typeof window & { YT?: YouTube; onYouTubeIframeAPIReady?: () => void };
let api: Promise<YouTube> | undefined;
function loadYouTube() {
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  return api ??= new Promise<YouTube>((resolve, reject) => {
    const previous = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(youtubeWindow.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { api = undefined; script.remove(); reject(new Error('YouTube API unavailable')); };
    document.head.append(script);
  });
}

export function Recording({ video, title, embed = false }: { video: string; title: string; embed?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!embed || !container.current) return;
    // Keep the native player visible; coordinate audio through its playback events.
    const frame = document.createElement('iframe');
    frame.title = title;
    frame.src = `https://www.youtube.com/embed/${video}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    container.current.append(frame);
    let disposed = false;
    let player: Player | undefined;
    let release: (() => void) | undefined;
    const relinquish = () => { release?.(); release = undefined; };
    const stop = () => { relinquish(); player?.pauseVideo(); };
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    void loadYouTube().then(YT => {
      if (disposed) return;
      player = new YT.Player(frame, { events: { onStateChange: ({ data }) => {
        if (disposed) return;
        if (data === 1 && !release) release = playback.claim(stop);
        else if (data === 0 || data === 2) relinquish();
      }, onError: ({ data }) => {
        console.warn(`YouTube embed ${video} failed with error ${data}`);
      } } });
    }).catch(() => { /* The native iframe still works if the API cannot load. */ });
    return () => {
      disposed = true;
      relinquish();
      document.removeEventListener('visibilitychange', hide);
      player?.destroy();
      frame.remove();
    };
  }, [video, title, embed]);
  return embed ? <div className="jp-recording" ref={container} /> : <div className="jp-recording">
    <a className="jp-recording-start" href={`https://www.youtube.com/watch?v=${video}`} onClick={() => playback.stop()}>
      Listen on YouTube · {title}
    </a>
  </div>;
}
