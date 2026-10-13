# Jazz Piano

An editable Markdown blog with interactive piano, chord, scale, and voice-leading demos. Extracted from the working `jazz-proof/web` app in [srush/music-personal](https://github.com/srush/music-personal), including the local blog and visualization changes.

## Run locally

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

- `/` or `/blog/`: the Blue Room post.
- `/explore/`: the song studies, chord explorer, and scale explorer.
- `/proof/`: the original harmony example.

## Write the blog

Edit [`content/blue-room.md`](content/blue-room.md). Ordinary Markdown renders around the demos; writing suggestions are preserved in HTML comments. Vite updates the page when you save.

A fenced `visual` block embeds the shared React components:

````markdown
```visual
{"type":"piano","study":"Blue Room","parts":"melody","title":"Blue Room · melody only"}
```
````

- `piano`: choose a catalog study title and `parts` (`melody`, `melody-root`, or `full`). `study: "blue-room-full"` selects the complete 32-bar arrangement; `form: true` adds section navigation.
- `comping`: select a study; hear one mixed-inversion comping line with syncopated attacks, root bass, and an optional sampled tenor sax melody. Major triads/sixths are extended for this teaching demonstration.
- `scales`: shared circle and fixed keyboard; only root, 2/9, 3, 5, and 7 highlighted.
- `chords`: circle of fifths and chord qualities.
- `progression`: ii–V–I demonstration.
- `recording`: YouTube video ID; defaults to an external link. Set `embed: true` only for an embeddable recording. For local YouTube playback use `http://localhost:5174/blog/`; the numeric loopback address may fail.

The demos reuse the components exported from [`src/index.ts`](src/index.ts). Piano and embedded-recording playback share a coordinator, so starting one stops or cancels the previous player.

## Check and build

```sh
npm test
npm run build
npm run preview
```

The production site is in `dist/`, including static route entry points and a downloadable Markdown file. The Vite configuration uses `/jazz-piano/` as its base in GitHub Actions; public assets and routes use that base. Local development continues to work at `/`. The published blog is https://srush.github.io/jazz-piano/.

## Data and assets

The runtime data is checked into `public/generated/`; no Python, Lean, LilyPond, source scores, or access to the old repository is needed to run, test, or build this app. The arrangement-generation tools remain in `music-personal`. New studies can be exported there and their viewer JSON copied into this repository.

`studies.json` contains the eight-bar song studies. `blue-room-full.json` contains the expanded 32-bar solo arrangement. It uses five-note shared-hand voicings (sounding bass, melody, and three inner tones), restricted to 3/5/7/9 for the blog. Inner tones release before passing-melody collisions. The original harmony fixture and SVG scores support `/proof/`.

Piano recordings are the Salamander Grand Piano samples by Alexander Holm, licensed CC BY 3.0. Attribution and distribution details are in [`public/audio/salamander/ATTRIBUTION.txt`](public/audio/salamander/ATTRIBUTION.txt). Musical compositions and recordings retain their respective rights; sample licensing does not cover song material.

Tenor sax notes use FluidR3_GM, rendered by MIDI.js / gleitz (CC BY 3.0); see `public/audio/tenor-sax/ATTRIBUTION.txt`. Only the notes needed for the Blue Room excerpt are bundled.
