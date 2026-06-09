# Demo recording shot-list

The README hero demo is the single most important growth asset (GROWTH.md §4: "no clip = don't ship"). This is the spec for re-recording it cleanly. The current `demo.gif` was produced from `demo-source.mp4` via the ffmpeg command at the bottom.

## Specs

- Resolution: record at 1280x800 (or 16:10), retina off or downscaled; final GIF width 960px.
- Duration: 10-15s tight. Cut dead air.
- Frame rate: 12-15 fps is plenty for a UI demo (keeps GIF small).
- No audio (GIF has none anyway).
- Clean browser: no extension toolbars, no personal bookmarks bar, incognito is fine.

## Shot list (the story = open -> edit -> export)

1. (0-2s) Land on the editor with a deck already open — show a good-looking slide.
2. (2-6s) Edit mode: click a headline, change a word; show the property panel tweak (color or size).
3. (6-10s) Move mode: drag one element to reposition; quick resize.
4. (10-14s) Click Export -> choose PPTX/PDF -> show the success / downloaded file.
5. End on the finished slide or the exported file. No long tail.

Keep cursor movement deliberate and slow-ish; fast jitter reads badly in a GIF.

## Convert mp4 -> gif (palette-optimized, small)

```bash
# from repo root, source at docs/assets/demo-source.mp4
ffmpeg -y -i docs/assets/demo-source.mp4 \
  -vf "fps=14,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 docs/assets/demo.gif
```

If the GIF is too large (> ~6 MB), lower `fps` to 10, drop `scale` to 800, or trim the clip with `-ss <start> -t <seconds>`.

Wired into:
- main README hero: [README.md](../../README.md) (`docs/assets/demo.gif`)
- skill repo README (copy the gif there when publishing `nextppt-deck-skill`)
