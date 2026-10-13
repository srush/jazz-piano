import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HarmonyExample, type HarmonyData } from './HarmonyExample';
import './page.css';
import { BlogPost } from './BlogPost';
import { ChordExplorer } from './ChordExplorer';
import { ProgressionDemo, type AnimatedStudy } from './ProgressionDemo';

const path = window.location.pathname.replace(/\/$/, '');
const blogPage = path === '' || path === '/blog';
const explorerOnly = window.location.pathname.replace(/\/$/, '') === '/explore';

function App() {
  const [data, setData] = useState<HarmonyData>();
  const [error, setError] = useState('');
  const [studies, setStudies] = useState<AnimatedStudy[]>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(explorerOnly ? '/generated/studies.json' : '/generated/example.json', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Study assets are unavailable. Check public/generated/.'); return r.json(); })
      .then(result => { if (explorerOnly) setStudies(result.studies); else setData(result); }).catch(e => { if (e.name !== 'AbortError') setError(String(e.message)); });
    return () => controller.abort();
  }, []);
  if (explorerOnly) return <main className="jp-instrument-page"><>{error ? <p role="alert">{error}</p> : studies ? <ProgressionDemo studies={studies} /> : <p role="status">Loading the study…</p>}</></main>;
  return <main>
    <header><a className="brand" href="/">JAZZ PROOF<span> / studies in harmony</span></a><span className="edition">NO. 001</span></header>
    <article><div className="eyebrow">MUSIC, WITH EVIDENCE</div>
      <h1>A chord is a promise.<br /><em>A voicing keeps it.</em></h1>
      <p className="intro">A lead sheet tells us what must stay true. A pianist chooses how to make it sound.
        Here, a small Lean library connects those choices to explicit, checkable rules.</p>
      <ChordExplorer />
      <div className="article-meta">AN ORIGINAL ii–V–I <span>·</span> D MINOR 7 → G7 → C MAJOR 7</div>
      {error ? <p role="alert">{error}</p> : data ? <HarmonyExample data={data} assetBase="/generated" /> : <p role="status">Loading the study…</p>}
      <section className="afterword"><span>THE IDEA</span><div><h2>Keep the notes. Explain their job.</h2>
        <p>A piano key is a physical pitch. “The third of A7” is a relationship. We keep both:
          the raw event says what sounds and when; the harmonic relationship checks why it belongs.</p>
        <p>That distinction matters. C♯ and D♭ share a key, but only C♯ spells the third of A.
          And a seventh that disappears halfway through a held chord cannot justify the entire voicing.</p></div></section>
    </article><footer>JAZZ PROOF <span>Original music. Explicit assumptions. Small proofs.</span></footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode>{blogPage ? <BlogPost /> : <App />}</StrictMode>);
