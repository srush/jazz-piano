import { sitePath } from './sitePath';
import { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import draft from '../content/blue-room.md?raw';
import { ProgressionDemo, type AnimatedStudy } from './ProgressionDemo';
import { ChordExplorer } from './ChordExplorer';
import { ScaleExplorer } from './ScaleExplorer';
import { buildCombo, withChordRoots } from './compingModel';
import { Recording } from './Recording';
import type { PianoParts } from './pianoModel';
import './blog.css';
import { PIANO_PALETTE } from './palette';
import { KeyboardRange, BLOG_KEYBOARD_RANGE } from './KeyboardRange';


function Comping({ study, title }: { study: AnimatedStudy; title: string }) {
  const [sax, setSax] = useState(true);
  const arranged = useMemo(() => buildCombo(study, sax), [study, sax]);
  return <><div className="jp-hand-order">
    <button aria-pressed={sax} onClick={() => setSax(v => !v)}>Tenor sax melody</button>
  </div><ProgressionDemo study={arranged} embedded initialParts="full" melodyInstrument="tenor-sax" title={title} /></>;

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
    case 'voicings': visual = <ChordExplorer variant="voicing" title={spec.title} />; break;
    case 'chords': visual = <ChordExplorer title={spec.title} />; break;
    case 'progression': visual = <ProgressionDemo showCircle embedded title={spec.title} />; break;
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
    const get = async (url: string) => { const r = await fetch(sitePath(url), { signal: controller.signal });
      if (!r.ok) throw new Error(`Cannot load ${url}`); return r.json(); };
    Promise.all([get('/generated/studies.json'), get('/generated/blue-room-full.json')])
      .then(([catalog, full]) => setAssets({ studies: catalog.studies, full }))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, []);
  return <KeyboardRange.Provider value={BLOG_KEYBOARD_RANGE}><main className="jp-blog"><article>
      {error ? <p role="alert">{error}</p> : !assets ? <p role="status">Loading the musical examples…</p> : <Markdown
        skipHtml components={{
          img: ({ src, ...props }) => <img {...props} src={src?.startsWith('/') ? sitePath(src) : src} />,
          strong: ({ children }) => <strong style={{ color: children === 'dark blue' ? PIANO_PALETTE.dark : children === 'light blue' ? PIANO_PALETTE.light : undefined }}>{children}</strong>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => className === 'language-visual'
            ? <Visual source={String(children)} studies={assets.studies} full={assets.full} />
            : <code className={className}>{children}</code>,
        }}>{draft}</Markdown>}
    </article>
  </main></KeyboardRange.Provider>;
}
