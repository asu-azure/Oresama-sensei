# Pop-art aesthetic — v1 archive

This folder preserves the **original "Japanese pop-art"** design of Ore-Sama
Sensei, captured before the app was re-themed to "Editorial FUI"
(cobalt / ink-paper / serif-grotesk).

## What's here

Verbatim copies of the pre-editorial source files:

- `globals.css` — the full pop-art design system: green/rose tokens
  (`--primary:#16a34a`, `--accent:#f43f5e`), `--pop-*` colors, the graph-paper
  grid, and every decorative keyframe (`pop-float`, `glitch-in`, `card-sweep`,
  `splash-sweep`, `buddy-*`, `pop-wipe`, `pitch-*`, `halftone`, `pop-divider`,
  `pop-card`).
- `components/button.tsx` — the click-burst Button (flying pop shapes).
- `components/splash-screen.tsx` — title glitch-in + rainbow underline.
- `components/pixel-buddies.tsx` — the walking pixel characters.
- `components/background-particles.tsx` — floating pop-art shapes / halftone.
- `components/page-transition.tsx` — the pop-wipe page transition.

## How to restore

**Whole look:** check out the snapshot tag —

```
git checkout aesthetic/pop-art-v1
```

(or `git checkout aesthetic/pop-art-v1 -- <path>` to lift back a single file).

**Cherry-pick art:** copy a keyframe / class / component out of this folder back
into the live `src/` tree. These files are reference copies and are not imported
by the app.
