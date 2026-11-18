# Decision log

Newest first. Each entry says what was decided, by whom and why. Owner decisions are binding; agent decisions are defaults that the owner can overturn.

## 2026-11-18, scenery PR

Fourth round, after the owner's review:

- **Owner: the frame has its crank.** The rusty frame is larger and carries a toothed chainring with five spider arms, a crank arm and a pedal. The loose chainring was removed, as it did not read.
- **Owner: the steep banners are abstract.** Banners on the ramps and the stairs carry a graphic per design (chevrons, a wave, diagonal stripes, dots, a split, a zigzag, a sawtooth) instead of imitating lettering.
- **Agent: finds that read.** The earthworm is a plump, ringed pink S curve, and the old bidon is a standing blue bottle with a black cap, a nozzle, a grip waist and a white stripe (white looked like a snowman).

Third round, after the owner's review:

- **Owner: nothing stands on the track.** The feather flag and the end of the banner fence stood in the track where it bends down from the flyover. The pose fence now runs at s 52 from e -6 to 214 and the flag stands behind it at (184, 30). The stairs fence and two lines of hill tape were shortened where they reached into the dismount lane and the summit. A unit test (`tests/unit/scenery.test.ts`) keeps every flag, fence and line of tape more than half a track width plus one unit from the route.
- **Owner: the banners advertise cyclocross.cz, and some offer themselves for sale**: every third banner says KUP SI REKLAMU on the Czech page. **Agent:** on the English page it says ADVERTISE HERE, the usual wording on such banners, rather than the literal BUY ADVERTISEMENTS. The made-up trades are gone. Each message has layouts from one line to two short lines, and a banner uses the longest that fits.
- **Agent: the scenery is built once per language.** Only layers whose pixels differ get a file per language (today only `scene-back.cs.png` and `scene-back.en.png`); `scene.json` lists `files` per locale for every layer.
- **Agent: steep banners carry no lettering.** On the ramps and the stairs, 3 by 5 letters shear into noise, so those banners show an upright badge and a bold band in word-long blocks.
- **Owner: more finds in the soil**: a rusty frame, bones and a green lager bottle with a cream label and gold foil (no brand name). **Agent:** the bones are a small dinosaur, and a mole at the end of its tunnel, a cowbell (rung at every cyclocross race) and an earthworm were added. Stones keep clear of the finds.

Second round, after the owner's review (photos of a stairs hill and a race flyover):

- **Owner: golden hour.** The sky runs from blue-violet overhead through rose and peach to pale gold, with a low sun in the upper left, long thin clouds lit from below, warm highlights and cool, long shadows (separate shadow ramps in `SCENERY.shadow`).
- **Owner: a realistic flyover.** It is now a temporary race structure: steel scaffold posts, ledgers and braces, deck plates with grip strips and a coloured edge strip, handrails with a knee rail on both sides and sponsor banners hung on the ramp sides. The lane under the flat top is kept free of posts. The near handrails are in the front layer, so they pass in front of a rider on the deck.
- **Owner: wider, gentler stairs.** The summit is 96 (was 112) and the stairs run 130 units at about 36 degrees (were about 55), 26 units wide with timber nosings and side boards. The hill is broader: its radius is 130.
- **Owner: tape at real height.** Stakes and tape stand about a metre high (26 units) and follow the ground on the hill.
- **Owner: sponsor banners mixed with tape**, for the feel of a well supported amateur race: banner fences behind the pose area, along the foot of the hill and up the stairs (following the slope, as in the owner's photo), tape elsewhere, and four feather flags. The banners name made-up local trades and this site in a 3 by 5 pixel font without diacritics; no real company is named. They are candidates for real advertising slots later (SPEC.md 9.1), each with a labelled HTML link.
- **Agent: the track is 28 units wide.** A new occluder layer, `hill-tape` (s 160), holds the tape on the near side of the stairs and the drop.
- **Agent: Czech race photographs could not be downloaded from the build environment** (the photo host refused the connection), so the owner's two photos and general knowledge of race furniture are the references. Spectators are left out for now: at the riders' scale they would be as tall as the riders and crowd the scene.

First round:

- **Owner: route approved** by merging the route PR, including the 28 degree camera.
- **Agent: the scenery is painted by code from the course data** (`art/scenery.mjs`), like the riders, so terrain, structures and riders share one projection and the stairs, drop and flyover sit exactly on the route. Colours are named ramps in `SCENERY` (`art/palettes.mjs`); texture is seeded noise snapped to small clusters and dithered seams, so rebuilds are byte-identical.
- **Agent: the ground and the hill are a height field drawn column by column**, which gives correct occlusion of the hill and shows stair risers as real vertical faces. The hill's cross-section is a straight slope with a rounded crest and toe (`hillHeight` in `src/hero/scene.ts`); the stairs and the drop are cut in along their route lines.
- **Agent: the sun comes from the west, slightly in front of the scene and high**, matching the upper-left light on the riders. The flyover, barriers and big tree cast shadows on the ground.
- **Agent: the scenery is a background plus occluder layers, each at a ground depth** (`occluders` in `src/hero/scene.ts`, written to `public/art/scene.json`): course tape between the two left lanes (s 97), the near half of the flyover (s 121) and course tape in front of everything. A rider is drawn after every layer nearer the back than its draw depth. Riders on the flyover always draw after its near half. This replaces a single "under the bridge" flag.
- **Agent: the track is 22 units wide** (was 14 in the diagram; 28 since the second round), so it reads as a track at display size. The entry lane moved from s 140 to s 120 and the stairs foot with it: the earlier test only compared the lane with the ends of the flat top, but the flyover is diagonal, so the old lane clipped the ramp up. The test now checks the whole lane band against both ramps.
- **Agent: the canvas is 720 by 344.** The extra rows hold the soil cutaway, which fades into the page in stepped, dithered rows of lighter soil, so content below starts on the plain page colour.
- **Agent: autumn palette at launch**: pale sky with a few clouds, a far range of hills with a small village and church tower, a tree line in gold, orange, rust, olive and spruce, a large golden tree by the pose area and three birches, green grass with ochre patches, tufts and fallen leaves, brown track with ruts and stones, a timber flyover, white barriers and red-and-white course tape. Discoveries: a chainring, a tyre lever, race number 17 and an old bidon in the soil, a newer bidon in the grass.

## 2026-11-15, riding study and route PR

- **Owner: cyclist direction approved** by merging the proposals PR. Fonts and the wordmark are still open.
- **Agent: the riding cycle is eight frames per crank turn in all eight directions**, none mirrored. Sheets are `public/art/cycle-{rider}-{kit}.png`, rows in the order of `DIRECTIONS`, columns are crank positions. The wheels turn 15 degrees per frame, which loops cleanly with six spokes.
- **Agent: the desktop scene is 720 by 320 art pixels at two screen pixels each** (344 tall since the scenery PR). A mounted rider is 66 units tall, so riders are large in the scene. The alternative, a smaller sprite, loses the detail the owner approved.
- **Agent: the course is data in `src/hero/scene.ts`**: one projection (28 degree pitch, shared with the sprites and checked by a test), structures and fourteen route segments. Tests fail if segments do not connect, if the underside of the flyover's flat top does not clear a mounted rider, or if the route leaves the ground outside the stairs, hill and flyover.
- **Owner: route.** Enter left, two barriers, pass under the flyover, dismount, stairs up the hill heading north-east, remount, steep downhill heading south-east, back along the front, over the flyover heading north-west (steep up, short flat top, steep down), then turn left behind the barriers, stop and pose on the left and leave the screen to the left. The flyover replaces the earlier long bridge. The route does not pass under the flyover a second time (owner correction, 18 November). The hill is a ridge that runs off the right edge of the screen, with the whole descent on screen, so the landscape is not flat. Approved on 18 November by merging the route PR.
- **Owner: the route drawing is not the graphics.** It is a flat-colour diagram; grass, track, flyover and hill will be pixel art in the riders' style.
- **Agent: the camera pitch is raised from 18 to 28 degrees.** At 18 degrees the two lanes under the flyover were 8 screen pixels apart and the diagonal headings looked almost side-on. The approved riders are redrawn at the new angle (rider cell 76 by 88, anchor 38, 71); the owner is asked to confirm they still look right.

## 2026-11-13, art proposals PR

- **Agent: sprites are drawn from a posable model, not frame by frame.** `art/rider.mjs` describes bicycle and rider in model units; `art/lib/raster.mjs` projects it for a facing direction and rasterises it with a depth buffer, a three-step shade and an outside-only outline. One model gives every direction the same proportions, wheel centres and ground anchor (SPEC.md 5.3). Hand-finished pixels can be layered on after the direction is approved.
- **Owner (2026-11-15): Czech jersey in horizontal bands**, white at the top, then red, blue and light blue, shorts dark blue. (A first reading as vertical panels was corrected by the owner.)
- **Owner (2026-11-15): club kit is a single brown-orange long-sleeve jersey with one stripe on an arm**, in the spirit of classic single-colour jerseys. The band is on the right arm. The club bike is white.
- **Owner (2026-11-15): no logos or logo-like pixels on the bikes.** Frames are one colour.
- **Owner (2026-11-15): the helmet is completely white with a smooth aero profile**, after a reference photo the owner supplied for the shape only. No stripe, no maker's mark. The face is longer and more visible.
- **Owner (2026-11-15): approved** the club jersey, the shorts and the white club bike. The Czech-kit bike is red, in a deeper tone than the jersey band.
- **Owner (2026-11-15): helmet details.** Flat lower edge, a less dominant ear cutout, faint vent shading only. Glasses are two tinted lenses, not a black bar.
- **Owner (2026-11-15): gloves are white with the Czech kit and black with the club kit.**
- **Agent: jersey designs are functions** (`DESIGNS` in `art/rider.mjs`) of the position along and around a body part, so stripes stay vertical on the body in every direction. Components can be drawn alone through `parts`, and `stance: 'stand'` gives the off-bike figure.
- **Agent: kits are palette swaps** (`art/palettes.mjs`). Materials are named ramps, a kit replaces jersey, helmet and frame ramps.
- **Agent: the camera pitch is 18 degrees** for the proposals. Superseded by 28 degrees in the route PR.
- **Agent: generated sheets are committed in `public/art/`** because the site serves them. A unit test regenerates them and fails if they differ from the source.
- **Agent: review pages live under `/review/`** and are not built for production. They are also left out of the sitemap.
- **Agent: Czech race photographs are not yet on the reference board.** Wikimedia Commons could not be reached from the build environment and no link was guessed. See `docs/art-references.md`.

## 2026-11-13, calendar PR, owner review of screenshots

- **Owner: a development preview is published on GitHub Pages.** `.github/workflows/pages-preview.yml` builds `main` with `SITE_ENV=staging` under the sub-path `/cyclocross.cz/`, so it carries the development notice and `noindex`. This is not the production release; hosting for the real domain is still open. The sub-path comes from `BASE_PATH` and is applied only in the route registry (`withBase`, `stripBase`), so every internal link must come from `src/i18n/routes.ts`.
- **Owner: the filter is hidden by default.** A "Filtr" button opens the fields. The three shortcuts, the reset and the count stay visible. A dot on the button marks an active hidden filter, and a link that carries a filter opens the panel.
- **Owner: actions are buttons, not text links.** Official page, registration, regulations, results, calendar file, series links and the contribute actions use `.pill`; one primary action per group uses `.pill-primary`. Text links remain for sources and for the error report.
- **Owner: details are restructured to remove empty space.** One "Kde" line, then "Pro závodníky" and "Pro diváky" side by side with the programme, then the buttons, then one small line with sources, check date and the unverified note. A column with no data is not rendered.
- **Owner: the header stays fixed at the top** and the footer no longer repeats the navigation. The footer is a slim soil band with a pixel turf edge and three links (advertising, privacy, GitHub). A fuller pixel-art footer can follow with the art track.
- **Owner: the wordmark is one colour**, ".cz" in black.
- **Owner: the menu button on small screens is an icon without text** (accessible name "Menu"). The owner will judge the phone header again once the animation exists.
- **Agent: the row control "Podrobnosti" is a small bordered button** aligned on the status baseline.

## 2026-11-13, calendar PR

- **Owner: use Tailwind.** Tailwind 4 through its Vite plugin. Tokens live in `@theme` in `src/styles/global.css`; components use utilities in markup. A small `@layer components` holds what repeats (`.wrap`, `.button`, `.control`, `.chip`) and the two pieces that are not expressible as utilities (the stepped sky and ground).
- **Agent: a build uses real data or fixtures, never both.** `CONTENT_SET=fixtures` switches to the fictional set. Browser tests always use fixtures with `BUILD_TODAY=2026-11-30`, so they do not change when the calendar does.
- **Agent: a past race is labelled "Termín proběhl" / "Date has passed", not "completed".** `completed` is reserved for races a source confirms took place. Researched races keep `status: scheduled`.
- **Agent: researched races are `verification: unverified`** and every detail view says the organiser has not confirmed the data. The owner decides when a race counts as verified.
- **Agent: without JavaScript the calendar lists every race with a link to its page.** Filters and in-place details are enhancements. The table becomes cards below 960 px and keeps explicit ARIA table roles.
- **Agent: "This weekend" means Friday to Sunday**, so a Friday evening World Cup round is included.
- **Agent: "Children and youth" is one filter value** matching the `youth` and `children` participation types.
- **Agent: no season filter yet.** There is one season. Add the control when a second season has data.
- **Agent: calendar files live at `/ics/{slug}.ics` and `/ics/season-{season}.ics`**, outside the translated routes. Timed races without a known end have no `DTEND`. Races without a confirmed day are left out of the feed.
- **Agent: World Cup rounds carry the classification text "UCI World Cup"**, as the sources say, and no UCI class code.
- **Agent: map links go to OpenStreetMap** when a source gives coordinates. No map is embedded.
- **Agent: region left empty for Holé Vrchy and Hůrka** because no source read so far states it.

## 2026-11-13

- **Owner: the implementing agent draws all pixel art.** Original work, iterated in the browser.
- **Owner: the repository is public.** Issue Forms will live in this repository.
- **Owner: the initial calendar is researched from public sources** by the agent (UCI races in Ostrava and Tábor, cyklokros.cz series, TBC série, plus anything else it finds), with provenance, then reviewed by the owner.
- **Owner: do not commit screenshots.** Visual regression compares against a base-branch build made in the same run. Review captures go to `.review/`, which is git-ignored.
- **Owner: fonts must be self-hosted** so the site looks the same on every device. No system font as the body face.
- **Agent: Jersey 15 replaces Pixelify Sans as the provisional heading font.** In a rendered Czech specimen, Pixelify Sans draws `C` almost like `O`, `Z` like `2` and `5` like `S`, which is unacceptable for a site whose language switch reads "CZ". Of 19 pixel fonts checked, 14 cover all Czech letters; the Jersey family (10, 15, 20, 25) was the most legible with correct `ď` and `ť`. Silkscreen, DotGothic16, Sixtyfour and Workbench lack Czech glyphs. Press Start 2P covers them but with cramped capital accents. The final choice still needs the owner's review of the specimen (PR 3).
- **Agent: Inter (variable, self-hosted) is the provisional body font.** Full Czech coverage, OFL licence. Final choice in PR 3.
- **Agent: site track before art track.** The calendar PR moved ahead of the art PRs so art approvals never block it (SPEC.md section 15).
- **Agent: homepage fragment IDs are localised** (`#kalendar` / `#calendar`) and mapped through the route registry, so links read naturally in each language and the language switch keeps the section.
- **Agent: fictional fixtures live in `fixtures/`, outside `src/content/`.** They are loaded only when `SITE_ENV` is not `production`, and a production validation fails on any `demo: true` record.
- **Agent: the navigation collapses into a menu below 960 px.** At 768 px the four links plus the language switch do not fit on one row beside the wordmark.
- **Agent: Astro 7.4, plain CSS, no UI framework.** `astro preview` needs `--ignore-lock` when started by Playwright, because it otherwise detaches into the background.
