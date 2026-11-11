/**
 * Inter is part of the design (the 400/600 contrast, tabular numerals, optical size). A theme cannot
 * carry `@font-face`, so the bundle registers the faces itself, from the folder it was loaded from: once
 * in a page, when Fluvy is in use on it (the look says so — the theme on, Settings included, the look covering
 * the app, a wall, a dashboard that wears the look — or a card, a page or the panel of ours connects; a page on
 * another theme fetches none), and in every same-origin panel frame the shell reaches (HACS), whose document
 * has fonts of its own.
 */
const FACES: ReadonlyArray<readonly [file: string, style: string]> = [
  ['inter-variable.woff2', 'normal'],
  ['inter-italic-variable.woff2', 'italic'],
];

/** A host page that ships Inter itself (the playground, a test) opts out with `__FLUVY_FONTS__ = false`. */
const optedOut = (): boolean =>
  (globalThis as { __FLUVY_FONTS__?: boolean }).__FLUVY_FONTS__ === false;

let folder: string | undefined;

/**
 * Where the font files are: the build's entry says (`fonts/` beside it, in the folder the integration serves the build
 * from) — this module is bundled into a chunk one folder down, so its own URL would miss them.
 */
export function setFontFolder(url: string): void {
  folder = url;
}

/**
 * Said on a document's `fonts` when one of our faces is added to it: a face loaded first and added after fires no
 * `loadingdone`, and what measures text (`FontsSettled`) listens for this beside it. Reading the set itself to find out
 * (its `size`) recomputes the page's styles.
 */
export const FACES_ADDED = 'fluvy-faces-added';

/** Registers the Inter faces in `target` (the page, or a frame's document); the files come from the browser's cache after the first. */
export function addFonts(target: Document): void {
  const Face = (target.defaultView as (Window & typeof globalThis) | null)?.FontFace;
  if (!Face || optedOut()) return;
  // Resolved at run time against wherever the bundle was loaded from; kept out of a
  // `new URL('…', import.meta.url)` literal so the bundler does not try to inline the font files.
  const here: string = import.meta.url;
  const base = new URL(folder ?? new URL('fonts/', here).href);
  for (const [file, style] of FACES) {
    const face = new Face('Inter', `url(${new URL(file, base).href}) format("woff2")`, {
      style,
      weight: '100 900',
      display: 'swap',
    });
    face
      .load()
      .then((loaded) => {
        target.fonts.add(loaded);
        target.fonts.dispatchEvent(new Event(FACES_ADDED));
      })
      .catch(() => {
        /* Roboto remains: the stack has a real fallback */
      });
  }
}

let requested = false;

/** Registers Inter in this page, once. */
export function ensureFonts(): void {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  addFonts(document);
}
