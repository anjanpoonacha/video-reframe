# Video Reframe

Make vertical videos from horizontal ones. Record a normal wide video, and this app will crop it into a tall video (the kind you post on Reels, Shorts, or TikTok). Everything happens on your phone — your video stays private.

## How to Use

### Quick Start

1. **Select Video** — pick from photos/files
2. **Detect Motion** — wait for the bar to fill
3. **Fix frames** — drag the crop box if needed
4. **Export** — don't close the app while working
5. **Save Video** — downloads to your phone

### All Features

**Crop Editor** — the big preview with a highlighted box

| Action | What it does |
|--------|-------------|
| Drag the box | Move crop left/right for this frame |
| Tap anywhere on preview | Jump crop to that spot |
| Arrow keys (left/right) | Step through frames one by one |
| Play button | Plays through all frames at ~10fps |

When you drag the box, you create a "user keyframe" — the app smoothly moves between your keyframes for all frames in between.

**Skip Ranges** — cut out parts you don't want

| Action | What it does |
|--------|-------------|
| Mark Start | Sets the beginning of a cut (at current frame) |
| Mark End | Finishes the cut — frames between are greyed out |
| Undo | Removes the last cut you made |

Skipped frames won't appear in the export. The app adds a smooth 4-frame crossfade at each cut so it doesn't look jumpy.

**Remove KF** — appears when you're on a frame with a user keyframe. Tap to delete your manual adjustment and let the auto-tracking take over again.

**Brand Kit** — tap the gear icon (top right)

| Setting | What it does |
|---------|-------------|
| Channel Name | Shows in the lower-third overlay and intro |
| Logo | Upload PNG/SVG — appears as watermark + in intro |
| Colors (Primary/Accent) | Used in overlays (bars, borders, intro) |
| Logo Position | Which corner for the watermark (TL/TR/BL/BR) |

Saves automatically. Stays between sessions.

**Export Options** — shown above the Export button

| Option | What it does |
|--------|-------------|
| Duration | 10s, 30s, or full video |
| Intro | Animated logo + channel name (first 2.5s) |
| Lower Third | Name + handle bar at bottom (2.5–6.3s) |
| Watermark | Tiny logo in corner (whole video) |

Uncheck any effect you don't want.

**Session Recovery** — if you close the app or refresh, your keyframes and skip ranges are saved. Upload the same video again and it picks up where you left off.

**Clear & Start Over** — appears after you load a video. Erases everything and lets you pick a new video.

## Recording Tips — Do This for Best Results

- Keep your phone **still** (use both hands or lean it on something)
- Have the person stay in **one area** of the frame — don't let them run corner to corner
- Film in **good light** — the app tracks movement by seeing what changes between frames
- Film **one person** at a time — it gets confused with multiple people moving
- Keep the background **simple** — a busy background with moving trees/cars tricks the app

## Don't Do This

- Don't **pan** (move the camera sideways) — it confuses the tracker completely
- Don't film in the **dark** — the app can't see what's moving
- Don't record with people **crossing paths** — it won't know who to follow
- Don't put the subject at the very **edge** — there's no room to crop around them
- Don't film something **too far away** — the person should fill a good part of the frame

## TocaBoca Recording Guide

### Rules

- Record **landscape 1080p+**, navigate to room **before** recording
- Use **bright rooms** (kitchens, parks) — dark rooms break tracking
- **Stay in ONE room** — scrolling triggers pan detection, crop freezes
- **First 3s = dead zone** — intro overlay covers it, use for setup
- Move character **one direction at a time** — left-to-right preferred
- Keep taps **in one area** — scattered taps = centroid averages to center
- **No menus/sparkle effects** — full-screen flashes = pan = crop freezes
- Keep clips **30–60s** (tracking caps at 200 samples = 67s)
- After any flash/transition: **wiggle character for 1–2s** to re-anchor
- Stay on one side **2s minimum** before crossing back

### What Breaks It

| Action | Result |
|--------|--------|
| Room scroll | Crop freezes (pan detected) |
| Tap everywhere | Centroid = center (useless) |
| Dark room | Too few pixels change |
| Still after transition | Crop stuck at old spot |
| Clip > 67s | Sparse sampling |

### After Recording

1. Use **skip ranges** to cut transitions/menus
2. Drag keyframes where tracking drifted
3. Cross-fade smooths cuts automatically

### Frame Zones

```
┌─────────────────┐
│ [*]        10%  │ <-- watermark
│                 │
│ +-----------+   │
│ | SAFE ZONE |   │ <-- gameplay
│ | center 60%|   │     HERE
│ +-----------+   │
│                 │
│ |Ch. Name   |   │ <-- lower third
│ |@handle    |   │     (2.5-6.3s)
│ - - - - - - - - │
│ [*][*][*]  20%  │ <-- platform UI
└─────────────────┘
```

### Overlay Timeline

```
0s        2.5s       5.5s  6.3s    end
|          |          |     |       |
|==========|          |     |       |
 INTRO BUMPER         |     |       |
 (dark+logo)          |     |       |
           |==========|=====|       |
            LOWER THIRD  fade       |
            (name+handle) out       |
           |========================|
            WATERMARK 25% until end
```

### Crop Tracking

```
16:9 source:
+----+------+----+------+----+
|    |[CROP]|    |      |    |
|    | 9:16 |    |      |    |
+----+------+----+------+----+
x=0       x=0.5       x=1.0

moves --> [CROP] follows --> OK
stops --> no motion --> STUCK
  fix: wiggle character
```

## Development

```bash
bun install
bun run dev
```
