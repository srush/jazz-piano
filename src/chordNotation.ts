/** Display notation only; keep canonical song labels and musical data unchanged. */
export function chordNotation(label: string): string {
  return label.replace(/maj/gi, '△').replace(/([A-G](?:[#b♯♭])?)m(?=\d|△|\b)/g, '$1−');
}
