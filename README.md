# Portfolio — Man Cave Edition 🏁

## What's new

### 3D Man Cave Wall Art (F1 Frames)
Four canvas-drawn artwork frames are mounted on the **left wall**, clearly above
the name/subtitle text so nothing overlaps.

| Frame | Position (z) | Content |
|-------|-------------|---------|
| Lewis Hamilton #44 | -0.08 | Gold "44" on deep purple, 7× world champion |
| Scuderia Ferrari   |  0.09 | Ferrari red, SF shield badge, Italian flag |
| F1 Circuit Map     |  0.25 | Night-sky circuit trace with race stats |
| Formula One Art    |  0.41 | Checkered flag, speed blur, F1 branding |

**Clicking any frame opens the Projects view** — same as clicking "Projects" in
the side nav. Project cards still open their respective URLs on click.

### Neon Light Strips
Two thin neon strips glow above the frames with a subtle flicker:
- Ferrari **red** strip above frames 1 & 2
- Hamilton **purple** strip above frames 3 & 4

### Floating Particles
70 tiny red/gold sparks drift upward through the room continuously,
resetting at the ceiling.

### Command Palette ⌘K
Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open a searchable
command palette. Navigate with arrow keys, press Enter to execute.

### Glassmorphism UI
Every panel (nav, contact, modal, command palette) uses backdrop-blur
glassmorphism — light and dark mode both look great.

### Animated Mesh Gradient
Three blobs (red, purple, gold) animate slowly behind the 3D canvas.

### PWA
A `manifest.json` makes the site installable on mobile.

---

## Fine-tuning frame positions

All frame positions are in a config block at the top of the man cave section
in `main.js`. Look for `FRAME_CONFIGS`:

```js
const FRAME_CONFIGS = [
  { id: 'hamilton', art: createHamiltonTexture, z: -0.08, w: 0.13, h: 0.16 },
  { id: 'ferrari',  art: createFerrariTexture,  z:  0.09, w: 0.13, h: 0.13 },
  { id: 'circuit',  art: createF1CircuitTexture, z: 0.25, w: 0.13, h: 0.13 },
  { id: 'speed',    art: createSpeedArtTexture,  z: 0.41, w: 0.13, h: 0.13 },
];
```

The wall is fixed at `x = -0.27, y = 0.76` with `rotation.y = π/2`. Adjust `z`
to slide frames left/right along the wall; adjust `y` in `addManCaveFrames()`
if you need more/less vertical clearance.

## Install & run

```bash
npm install
npm run dev
```
