import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import draft from '../content/blue-room.md?raw';
import { ProgressionDemo, type AnimatedStudy } from './ProgressionDemo';
import { ChordExplorer } from './ChordExplorer';
import { ScaleExplorer } from './ScaleExplorer';
import { buildComping, withChordRoots, type HandOrder } from './compingModel';
import { playback } from './playbackCoordinator';
import type { PianoParts } from './pianoModel';
import './blog.css';

function Recording({ video, title, embed = false }: { video: string; title: string; embed?: boolean }) {
  const [active, setActive] = useState(false);
  const lease = useRef<(() => void) | undefined>(undefined);
  const stop = () => { lease.current?.(); lease.current = undefined; setActive(false); };
  useEffect(() => () => lease.current?.(), []);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  if (!embed) return <div className="jp-recording"><a className="jp-recording-start"
    href={`https://www.youtube.com/watch?v=${video}`} onClick={() => playback.stop()}><span aria-hidden="true">↗</span> Listen on YouTube · {title}</a></div>;
  return <div className="jp-recording">
    {active ? <><iframe title={title} src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`}
      allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      <button onClick={stop}>Stop recording</button></> : <button className="jp-recording-start" onClick={() => {
        lease.current = playback.claim(stop); setActive(true);
      }}><span aria-hidden="true">▶</span> Play {title}</button>}
  </div>;
}

function Comping({ study, title }: { study: AnimatedStudy; title: string }) {
  const [order, setOrder] = useState<HandOrder>('3-7');
  const arranged = useMemo(() => buildComping(study, order), [study, order]);
  return <><div className="jp-hand-order" role="group" aria-label="Comping hand split">
    {(['3-7', '7-3'] as const).map(value => <button key={value} aria-pressed={order === value} onClick={() => setOrder(value)}>
      LH {value.replace('-', '–')} / RH 5–9</button>)}
    </div><ProgressionDemo study={arranged} embedded initialParts="comping" title={title} />
</>;
}

type VisualSpec = { type: string; study?: string; parts?: PianoParts; title: string; video?: string; embed?: boolean; form?: boolean };
function Visual({ source, studies, full }: { source: string; studies: AnimatedStudy[]; full: AnimatedStudy }) {
  const spec = useMemo<VisualSpec | null>(() => { try { return JSON.parse(source); } catch { return null; } }, [source]);
  const study = spec?.study === 'blue-room-full' ? full : studies.find(s => s.data.title === spec?.study);
  const rooted = useMemo(() => study && spec?.parts === 'melody-root' ? withChordRoots(study) : study, [study, spec?.parts]);
  if (!spec) return <p role="alert">Invalid visual block: check its JSON.</p>;
  let visual;
  switch (spec.type) {
    case 'recording': visual = /^[\w-]{11}$/.test(spec.video ?? '') ? <Recording video={spec.video!} title={spec.title} embed={spec.embed} /> : <p role="alert">Choose a valid YouTube video ID.</p>; break;
    case 'scales': visual = <ScaleExplorer />; break;
    case 'chords': visual = <ChordExplorer title={spec.title} />; break;
    case 'progression': visual = <ProgressionDemo embedded title={spec.title} />; break;
    case 'comping': visual = study ? <Comping study={study} title={spec.title} /> : null; break;
    case 'piano': visual = rooted ? <ProgressionDemo embedded study={rooted} title={spec.title} initialParts={spec.parts} form={spec.form} /> : null; break;
  }
  return <figure className="jp-blog-visual" aria-label={spec.title}>
    {visual ?? <p role="alert">Visual unavailable: check its type and study title.</p>}</figure>;
}

export function BlogPost() {
  const [assets, setAssets] = useState<{ studies: AnimatedStudy[]; full: AnimatedStudy }>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const get = async (url: string) => { const r = await fetch(url, { signal: controller.signal });
      if (!r.ok) throw new Error(`Cannot load ${url}`); return r.json(); };
    Promise.all([get('/generated/studies.json'), get('/generated/blue-room-full.json')])
      .then(([catalog, full]) => setAssets({ studies: catalog.studies, full }))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  return <main className="jp-blog"><article>
      {error ? <p role="alert">{error}</p> : !assets ? <p role="status">Loading the musical examples…</p> : <Markdown
        skipHtml components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => className === 'language-visual'
            ? <Visual source={String(children)} studies={assets.studies} full={assets.full} />
            : <code className={className}>{children}</code>,
        }}>{draft}</Markdown>}
    </article>
  </main>;
}
