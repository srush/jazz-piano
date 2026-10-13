# Working on Jazz Piano

- This is a standalone React/Vite app. Keep tests and build outputs inside this repository.
- Preserve the blog's plain white presentation: headings and demos, no figure captions, decorative boxes, dividers, bar counters, or piano numbers.
- Keep writing suggestions in Markdown comments unless the user asks to display them.
- Reuse the shared visualization components; preserve the single-player coordinator, including cancellation while audio loads.
- Keep all blog keyboards fixed at C2–C6. Preserve canonical song chord labels across arrangements; display major as △ and minor as −. In the scale view, highlight only root, 3, 5, 7 and the ninth above the octave, with no upper tonic. Use the shared blue palette and consistent grey roots.
- The three circle explorers share controls and audition one second after changes; song demos retain their play controls.
- Preserve functional note spelling, timing, ties, and explicit arrangement exceptions in musical data.
- Keep source scores, personal account data, and arrangement-generation tooling out of this frontend repository unless explicitly requested.
- Run `npm test` and `npm run build` after behavior changes. For visual-only edits, build and inspect the relevant page.
