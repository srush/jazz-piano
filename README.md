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
- `comping`: select a study; switch between LH 3–7 / RH 5–9 and LH 7–3 / RH 5–9. Major triads/sixths are extended for this teaching demonstration.
- `scales`: fixed keyboard, one root-to-root major-scale octave highlighted.
- `chords`: circle of fifths and chord qualities.
- `progression`: ii–V–I demonstration.
- `recording`: YouTube video ID; defaults to an external link. Set `embed: true` only for an embeddable recording. The current Ella Fitzgerald reference was unavailable in the embedded player.

The demos reuse the components exported from [`src/index.ts`](src/index.ts). Piano and embedded-recording playback share a coordinator, so starting one stops or cancels the previous player.

## Check and build

```sh
npm test
npm run build
npm run preview
```

The production site is in `dist/`, including static route entry points and a downloadable Markdown file. Serve it at the domain root: asset URLs start with `/`. Hosting under a repository subpath requires adapting those URLs first.

## Data and assets

The runtime data is checked into `public/generated/`; no Python, Lean, LilyPond, source scores, or access to the old repository is needed to run, test, or build this app. The arrangement-generation tools remain in `music-personal`. New studies can be exported there and their viewer JSON copied into this repository.

`studies.json` contains the eight-bar song studies. `blue-room-full.json` contains the expanded 32-bar solo arrangement. Its reviewed bar-17 identity omission and pedal choices remain described in the Markdown writing notes. The original harmony fixture and SVG scores support `/proof/`.

Piano recordings are the Salamander Grand Piano samples by Alexander Holm, licensed CC BY 3.0. Attribution and distribution details are in [`public/audio/salamander/ATTRIBUTION.txt`](public/audio/salamander/ATTRIBUTION.txt). Musical compositions and recordings retain their respective rights; sample licensing does not cover song material.
