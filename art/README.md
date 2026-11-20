# Pixel art source

The sprites are original work, generated from the files in this folder.

- `rider.mjs`: the bicycle and rider as a posable model (units, joints, jersey design).
- `palettes.mjs`: colour ramps per material, skin tones and the two kits.
- `lib/raster.mjs`: depth-buffered pixel rasteriser, shading and outline.
- `lib/png.mjs`: PNG encoder.
- `scenery.mjs`: the desktop scenery (sky, landscape, ground and hill, flyover, barriers, banners, tape, soil and its finds), painted from the course data in `src/hero/scene.ts`. `paintScene(locale)` letters the banners in Czech or English.
- `build.mjs`: exports the sheets and the scenery layers.

## Export

```
npm run art
```

writes the PNG sheets and `sheets.json` (cell size and view order), plus the scenery layers `scene-*.png` and `scene.json` (layer order, depths and the file for each language; a layer with banner lettering has one file per language), to `public/art/`. Commit the result together with the source change. `npm test` fails when the committed sheets differ from what the source produces.
