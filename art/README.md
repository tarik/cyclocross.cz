# Pixel art source

The sprites are original work, generated from the files in this folder.

- `rider.mjs`: the bicycle and rider as a posable model (units, joints, jersey design).
- `palettes.mjs`: colour ramps per material, skin tones and the two kits.
- `lib/raster.mjs`: depth-buffered pixel rasteriser, shading and outline.
- `lib/png.mjs`: PNG encoder.
- `build.mjs`: exports the sheets.

## Export

```
npm run art
```

writes the PNG sheets and `sheets.json` (cell size and view order) to `public/art/`. Commit the result together with the source change. `npm test` fails when the committed sheets differ from what the source produces.
