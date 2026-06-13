# Video Reframe

Make vertical videos from horizontal ones. Record a normal wide video, and this app will crop it into a tall video (the kind you post on Reels, Shorts, or TikTok). Everything happens on your phone — your video stays private.

## How to Use

1. Open the app and tap **Select Video**
2. Pick a video from your photos
3. Tap **Detect Motion** — wait for it to finish (the bar fills up)
4. You'll see a strip of small frames at the bottom. The app already picked what to show in each frame
5. If something looks wrong, drag the highlighted box left or right to fix it
6. Tap **Export** and wait — don't close the app while it's working
7. Tap **Download** when it's done

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
