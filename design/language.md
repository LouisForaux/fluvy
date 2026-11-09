# Fluvy — visual language (Linen, v1 draft)

Single source of the rules every sheet is judged against. Numbers are CSS px. Everything sits on a 4 px grid at DPR 1/2/3
(`tools/render/measure.mjs` enforces it, plus control heights, icon boxes, touch targets, baselines, text-in-box, **containment** — no painted box outside its padded ancestor, no unpainted box outside its parent, nothing outside the frame — **pill sides** — badge/chip width − text ∈ [28, 31] — and the rules of text and targets: **overlap** (no word drawn under a control it is not inside, nor over another word in a value row, a readout or a tile's foot), **collision** (no two words laid over each other anywhere else), **midword** (no word broken across two lines, no figure parted from its unit), **cut-figure** and **cut-word** (no figure, and no word but a name's, ending in an ellipsis or a clamp; a `title`
excuses a name's words only — a figure cut behind a tooltip is still cut, and a state or status line is never a name), **pill-cut** (a content-sized pill holds its content, a name included), **clipped** (no line cut by a box with no ellipsis to say so), **raw-key** (no catalogue key on screen) and **head-target** (a head's button keeps a free 44 × 44 beside the controls raised over it); independent review reports were kept for every round; the approved renders are in `design/approved/`).

## Quality bar (the quality checklist, 2026-09-18)

Every screen — our cards and every Home Assistant page under the theme — is judged against these before anything else. When one instance of a flaw is fixed, the same class is hunted everywhere.

1. **One scroll.** A page never scrolls inside a scrolling page. The frame declares its 16 px margins through HA's safe-area insets, so pages sized from the viewport fit it.
2. **Our forms.** Fields, pickers, menus, switches, checks, radios, sliders and code editors speak the cards' idiom (see Form controls); no Material underline, no square field, no system scrollbar inside menus and picker lists.
3. **Aligned text.** Readout rows centred; labels and values on shared baselines; nothing drifts to the left of its column.
4. **Uniform spacing.** One rhythm between siblings (4 px grid; 8 / 12 / 16 / 24 steps); no two fields touching, no uneven gaps in a stack.
5. **Chip rows fill.** A horizontal row of chips or options occupies its row — equal widths or distributed — and leaves no empty tail. (A scrolling strip that overflows on purpose, such as view tabs, is exempt.)
6. **Text stays inside.** Ellipsis for names, wrap for prose; values never ellipsise, never overflow or clip. Japanese prose wraps between its phrases, never inside a word (スケジュールを / 追加, not 追 / 加): `word-break: auto-phrase` on every Fluvy element whose language is Japanese (Home Assistant writes its language on `<html>`), where the browser knows the phrases (Chromium 119+); every other language wraps as it did, Chinese between any two characters, as it is set. Simplified Chinese draws its Han in a Simplified face (PingFang SC, Microsoft YaHei, Noto Sans SC), named before the system's own on every Fluvy element whose language is `zh-Hans`; its Latin letters and figures stay Inter's.
7. **Clean motion.** Short, purposeful transitions (transform and opacity only), no jank, nothing replayed on a view change.
8. **Pixel alignment.** Edges, centres and baselines line up to the pixel across a row and down a column.

Code follows the same bar: clean, ordered, reusable, one place per concern. A page never shows a key: a word a lazy
family owns ships with that family's chunk and is said only where that chunk has registered it
(`packages/bundle/src/english.test.ts`; `finish.mjs` refuses a build whose every-page code carries one).

## Surfaces

| Surface | Size / geometry | Notes |
| --- | --- | --- |
| Card | radius 20, padding 20, content column 320 in a 360 card | hairline `inset 0 0 0 1px border`; no resting shadow |
| Compact card | padding 16, rounds 44 | mini media rows, compact climate row, counter row |
| Player card | 48 rounds throughout (transport and the head's round on the 80 art: power for a player that can be switched on or off, else "…") | the one card where the header round is 48, so it centres on the art on the grid; the head keeps one trailing round — two beside the art would leave a title 104 px in a phone's column — and the dialog stays a tap on the head — the art and its words, one button — or a still press on it away; a column that would leave the words under 96 beside the art and the round lets the art go (the head keeps its 80). The line under the title is the player's (who made it; at rest its state and when it last played) unless the person writes their own (`secondary`, 1.13, #101: words, a template, an entity's state with its unit), in every variant, the mini row's too, a name's words that may end in an ellipsis; out of reach it says why whatever was asked. A television that is on and plays nothing Home Assistant names is titled by its app, else its input, else its name, and its line never repeats the title |
| Tile | 172 × 168, padding 16, radius 16 | two per row: 172 + 16 + 172 on the phone (`.fv-grid2`), 152 + 8 + 152 on the desktop, 208 + 8 + 208 on the wall; the foot slot is 40: a 44 ruler hit band drawn 4 up, or two xs readouts |
| Tile · compact | 76 tall, padding 16, radius 16 — the scene tile's geometry: 44 icon, 12 gap, name 15/600 over state 13/500 (36 block centred on the icon); with `name_lines: 2` (1.13, #100) the name takes two balanced lines where one would end in an ellipsis, an ellipsis only past the second, and the tile is 88 (96 inside a card) whatever its name says, so a row stays level | the whole tile is the button — tap toggles what toggles (opens what does not), hold 500 ms opens the details; no switch: the tone fill says "on"; a small tile says "Unavailable" without the time |
| Tile · mini | 108 tall, padding 12, radius 16: 44 icon, 8 gap, name 13/600 over state 12/500, centred; 124 with the name in two lines (`name_lines: 2`), the circles of a row level | same behaviour; three or four per row |
| Tiles group | `.fv-tiles`: compact or mini tiles 8 px apart, or large ones (icon circle + switch, ruler or readouts) at the section's gaps; 2 / 3 / 4 per row or `auto` (148 / 84 minimum) | one card, the Mushroom-style pairs and threes; grouped and lone tiles are the same tile. A compact tile under 128 gives its name the icon's room, so buttons people reach for on a phone are large |
| Sheet | 392 wide, padding 16, content 360, radius 24 top | grabber, title/sub + close or switch |
| Phone frame | 392, side padding 16, content 360 | status bar, hello, room chips, sections, bottom nav 60 |
| Unavailable | dashed 1 px outline, page fill, neutral ink | card, tile, stat tile, icon ring **and** badge all dashed; value "—", the word "Unavailable" stays — a compact row, which has no second line for the word, says it as its value ("Unavailable", "Unknown", "Not found"; the dash only where the word would not leave the name its room); an entity that is not there draws the `ban` glyph, never a kind's |

**A tile is a button laid over it (1.9).** Every tile's surface taps and holds through one button laid over it
(`pressCover`), last of its parts; a large tile's switch, its circle-switch and its ruler are raised over that button,
beside it, and keep their own taps (never a switch inside a button). The keyboard reaches a tile as one stop: Enter
taps, Shift+F10 or the menu key holds. The same button is a room's photo and row, and a greeting's words. A tile is a
button only where it has something to run (1.10): a compact or mini tile whose tap and hold both do nothing (`none`,
or more-info and a toggle with no entity, as the template card's tile of nothing) draws no button, as a large tile
already did. Its switch, its circle-switch and its ruler say what the entity is; its fill what the tile shows
(`look`): the two are one on every tile but the template card's, whose fill is `active`'s. A stat tile is one too
(1.11, #71): its tap opens its entity's details (more-info: Home Assistant's dialog, with the history) or runs its own
`tap_action`, its hold only where it asks for one (`hold_action`, nothing by default), read as what it says ("Output ·
3.2 kW"); it gives under the finger and takes the hairline under the pointer as a tile does (`fv-tile--tap`). A stat
tile that cannot be read, or whose tap and hold are both `none`, stays a still surface.

**An unavailable tile keeps its size (the owner's rule, 1.9).** Unavailable, unknown or missing, a tile draws the live
tile's own anatomy in every size — the circle (the ban glyph, the off skin), the name, the state line ("Unavailable ·
2 h ago"), its readings as dashes, its switch there and still, its ruler at rest — so a large one never stands shorter
than its neighbours. Only the colours change.

**An unavailable card keeps its configured size (1.9, the owner's rule).** Unavailable, unknown or missing — a device
offline, a sensor with no reading, an entity taken out of the house — a card draws the same anatomy at the same size
as it does live, for the same config and the same column: the circle (the dashed ring, the `ban` glyph where the
entity is not there), the name, the state line ("Unavailable · 2 h ago"), every readout's slot with "—", every control
where it stands, disabled. Only the colours change. A grid of tiles stays a grid whatever state a device is in; a card
never falls back to one quiet line, never hides a row, a chart, a stepper or a set of modes because its entity cannot
be read, and its `layoutHeight` and `getCardSize` never depend on the state (the automatic dashboard lays columns out
before anything is read). What Home Assistant still writes for an unreachable entity — its name, icon, unit, class,
features and its capabilities: a thermostat's modes and range, a fan's presets, a light's colour modes and effects, a
select's options — fills the slots it can; a slot whose content is the state's own (a temperature now, a brightness, a
position, a forecast) keeps its place with "—" or at rest. A list keeps an unreachable row as a row, in its order.
- **The guard.** `tools/render/interactions-unavailable.mjs` mounts every card of the catalogue twice side by side, in
  every variant its editor offers, at 152 and 172 (half a section) or 211, 266 and 360, from its stub and from a
  fuller playground frame where the stub is thin, the second twin with every entity it reads unavailable, unknown and
  missing as Home Assistant writes them (`@fluvy/demo-home/out-of-reach`); the twins may differ by 0.5 px at most, say
  the same `getCardSize`, and the broken one stays within 8 of `layoutHeight` where the live one does.
  `unavailable.test.ts` holds the anatomy itself: the card's root and its parts, in order, are the live card's. The
  playground's `unavailable` sheet shows the owner's four large tiles with the printer gone, then each family live
  and out of reach.
- **Missing: as the page last read it.** An entity that is not in the house at all — its integration not set up yet
  after a restart, a YAML entity reloading, an id renamed — has no capabilities to read. A card draws it from what this
  page last read of it: its name, unit, device and state class, features and capabilities (`resolveEntity` keeps
  them; never its icon or picture, which the `ban` glyph replaces, nor its state's own attributes). One this page has
  never read is drawn from its config and its domain (below). Never one quiet line.
- **Never read.** An entity the page has never read (missing since it opened: an integration still starting, an id
  renamed) says nothing of what it could do: its card draws its domain's usual parts, the ones its `layoutHeight`
  declares where the house is not there to say — a fan's speed with its stepper, its ruler, Oscillate and Direction; a
  cover's position ruler and Open · Stop · Close; a robot's Start · Stop · Return to dock and its battery (a mower's
  Start and Return to dock) — every control disabled and every value "—", as a thermostat draws its configured modes or
  Off · Heat · Cool (`drawnAs`); a robot's configured readouts with "—". One read before it went missing keeps what Home
  Assistant last wrote of it. `interactions-unavailable.mjs --states never` holds the card to that declared height.
- **Controls out of reach.** Every control stays where it stands and takes no tap: a ruler, a dial and a stepper
  disabled at rest; a switch disabled, faded as a stepper is (§ Controls); an option tile or a chip in the dashed skin
  (`unavailable`), so it does not vanish into the card's page fill — the thermostat's modes, presets and fan speeds, the
  alarm's modes, a select's options, the cover's commands and favourites; a lock's latch and a room's own button
  disabled. A card out of reach wears the dashed card itself (`is-off`): the thermostat, the lock and the alarm now as
  the fan, the cover and the robot.
- **No line more.** A row or a field says why it cannot be read on a line it has live: a list row's second line, a
  field's line under its name in the area's place. A field with no such line says it in its control — "—" in a
  number, the word in an empty text field — never on a line it does not have (a list out of reach keeps its size).
- **A scene out of reach** is the scene's own tile (76, its name in two lines in a grid) in the off skin: the dashed
  hairline on the page fill, the `ban` circle, "Unavailable" or "Not found"; a tap opens its details.

**Dashed, or quiet out of reach (1.16, #126).** Dashed is the default, the house's until it chooses and each card's
(`unavailable`), because out of reach is a state worth seeing: the dashed hairline on the page's fill, the faded words
and the ban glyph say at a glance that a device has gone where an off one is resting, and a dashboard must not change
on upgrade. `quiet` is for a home where a device dropping out now and then is noise: the card or the tile draws as it
does while off — its surface, its own glyph in its resting circle, its words, its switch and its controls at full
strength — and keeps everything that is true: its words ("Unavailable"), "—" for every value it cannot know, every
control still and `aria-disabled`, its anatomy and its size. Only the look of being out of reach goes. It is a sheet of
its own (`ui/styles/quiet.css`, fetched with the first quiet card): each rule answers a rule of the dashed skin at that
rule's own specificity (its mark weighs nothing) and gives back paint alone, never layout, on what carries the mark
`data-unavailable="quiet"` — a card's root, or each tile of a group whose tiles say their own. An entity gone from the
house keeps the ban glyph, quiet too: it has no kind to borrow one from.

**What a chart, a figure and a reading keep out of reach (1.9, the sensors and the energy cards).** A chart keeps
the window it had, in the off ink: a sensor's curve, its axis and its minimum · maximum · average, a gauge's ring and
its row, a day's bars, the history bars — history is the past and stays; only the reading now is "—" (the sensor's
bubble at "now" says it). A sensor that is not there at all is read as the recorder keeps it
(`recorder/get_statistics_metadata`: its unit, a sum that counts or a mean that measures), so its bars and its day
are drawn as they were; what the recorder knows nothing of says so in the chart's place. Where a layout is decided
by figures, a figure that cannot be read is laid out as the widest the card still reads, else as a stand-in of its
kind: stat tiles a row as "88.8 kWh" takes, the signed gauge's ring for the ends a 5 kW connection takes ("5 kW out")
— never as the dash, which is narrower than any figure. A row keeps the second figure it last showed (the batteries'
"Full in —"); a meter's row keeps its bar, empty, and its line, the state in it, and a stacked row with no line of
its own says its state beside the dash ("— Unavailable"). A two-way source the balance cannot read at all is listed
once, among what comes in (its way is not known). The weather keeps its hero's line ("Feels — · Wind —"), its hours
and its days ahead with nothing forecast in them (no glyph, "—"). A word in a figure's slot is the short one: a
badge, the weather's condition, a meter's dash say "Not found" where the line says "Entity not found". A name that is
only an id's (a sankey device, a sensor among several) takes no more room than the live name would: the device's
ends in an ellipsis inside its figure's box, the sensor's is the last word of its id ("…_humidity" is "Humidity").
The score keeps its low-carbon ring while the CO₂ signal is out of reach.

- **A card that hides itself** (a list asked to hide while empty, the alerts while all is clear) does it as Home
  Assistant's own updates and repairs cards: the `hidden` attribute, `card-visibility-changed` whichever way it goes,
  and it stays connected (`connectedWhileHidden`) so it can come back on its own. A stack or any other wrapper loses
  it too (`:host([hidden])`). In the editor's preview it is never hidden: a card nobody can see cannot be edited.
  `selfHide`.

## See-through cards (1.15, #121)

A card's surface may be less than solid: its own `card_opacity`, else the house's (*Appearance › Cards*), else 100.
At 100 nothing of it is on the card; under it the card is one material at that opacity, the view's background showing
through, blurred by default.

- **See-through** — the card's own colours, each at the card's opacity: the card, its off and unavailable fill (the
  page's), a `card_color` wash, a lit light card's wash, a resting `tint: always` wash; a tile that is a card of its
  own; the wells inside (the page's fill, the sunken page, the wash's deeper step) and what is painted to look like the
  card (an icon circle washed into it, the dial's disc, a knob's halo). Wells on a see-through card are a second layer
  of the same material: they read a step denser, as they read a step deeper on a solid one.
- **Solid** — what says a state in its colour (a lit tile, a light card lit whole: the light's colour is the
  information, and over a blue picture it would turn another), what a finger holds (a switch's thumb, a knob: see-through,
  a thumb takes its lit track's colour and vanishes at 0), what sits on a picture (a room's name pill and quick actions
  on its photo) and what lies over the card (sheets, the keypad, menus, dialogs, a chart's bubble). Their colours are
  the card's own as they were (`--fv-solid-…`, written beside the see-through ones).
- **A knob's halo** stays the card's material: at 50 % it reads as a soft frosted ring that still cuts the tick or the
  line under it; transparent, the arc's ticks would touch the knob.
- **Quiet inks** go towards the main ink as the background comes through: the secondary, the disabled and the
  unavailable ink keep all of their own colour solid and none from 50 % down, where they are the main ink (between,
  in proportion). Measured over the issue's blue and a busy picture, light and dark, blur on and off, against the
  worst pixel behind each word: at 80 % and 50 % every quiet word reads at 3.3:1 or more (it was 1.0:1 at 50 % on
  the blue). A ruler's and a dial's resting ticks go the same way at the card's own pace (half their colour at 50 %):
  they keep about the contrast they have on a solid card and stay under the lit ticks, whose tone the background takes
  down too; at the words' pace they outweighed them. Below about 35 % what reads is the background's to say: dark
  words need a light picture and light words a dark one, the main ink included.
- **The blur** (16 px) is on each outermost surface itself: a layer beneath its content would see the card alone, for
  the card's entrance holds an opacity that cuts it off from the page (a Backdrop Root). What opens from a card lives
  in the top layer (menus, sheets, the keypad), so a blurred card still leaves it the page. A wall tablet that scrolls
  slowly is better without it; the cards stay see-through.
- **Never see-through**: Fluvy's own pages (Activity, History, the panel), the screensaver's clock and the dashboard's
  own on the page — the greeting, a heading, the chips card's tabs (1.16: controls on the page, with no surface or
  card colour of their own; a pill under the finger stays solid, as on a see-through card). Home Assistant's cards
  follow the theme's `ha-card-background`.

What a see-through card wears (its sheet's writer and its rules) is fetched by the first card under 100 %: a house of
solid cards never pays for it, and a house under 100 fetches it as the page starts. A see-through card's first frame
waits for it (1.16): on a cold load it is drawn see-through from the start, never solid a moment before.

## Header pattern (every card except the weather hero)

44 icon circle (20 glyph) · title 16/600 · sub 13/500 secondary · trailing = **one** of: 28 badge (state, content-sized: 14 px sides, text + 28 → 4-grid, tabular numerals), 48×28 switch, 44 round ("…", map, add).
Sub = context or time (`Living room · 46 % RH`, `21:40 by Marta`). Badge = state, once. Never repeat the state in sub + badge + row.
In a narrow column the head is fitted by measure (`HeadFit`), and what gives way has an order: a badge (its state is in the body too), the sub's trailing segments, then the icon circle. **A control never gives way**: a switch stays at every width — two lamps on a phone's line (172 each) read "name · switch" over their ruler.

**The head is the card's button (1.9, #42).** Where a card has a tap (`tap_action`, more-info by default), the whole
head row answers it: the circle, the name, the line under it, the room up to what trails them, and a passive badge.
A still press of 500 ms anywhere on it is the hold. The title is the button (`head()`: `<h3><button class="fv-card__tap">
Name</button></h3>`), its overlay (`::after`) stretched over the row: the name it reads is its own words, it is one tab
stop, and the keyboard's focus ring goes round the whole row (radius 12). Enter and Space tap; Shift+F10 or the menu
key hold.
- **A control in the head keeps its own tap**, beside the button and raised over it, never inside it (the room
  lights' rule): the switch, a round ("…", map, add), a readout that is a button. A near miss on a control's own
  44 is the control's. The body keeps its own controls, so a slide is never a tap.
- **Pressed**, the circle gives under the finger (`scale` 0.94 — the individual property, so it composes with a
  spinning fan's `rotate`) and the words dim to 0.7, as a row does; under a pointer the circle rises 1.06, as the
  circle that was the button did. The overlay itself never shrinks.
- **A press that travels is not a tap:** a mouse or a pen that moves more than 8 px between down and up (a drag, a
  selection) runs nothing; a finger's pan is the browser's to cancel. A keyboard's click is never swallowed.
- **A head with nothing to run is no button**: `none`, or more-info and toggle with no entity to act on (a card of
  many has no details of its own) — no tab stop, no pointer, no hover, the plain heading.
- **The circle may give way; the tap never does.** The fitting order is unchanged (badge, the sub's trailing segments,
  the circle), but the circle now goes only where its room makes the name whole, or where the name would otherwise
  end before it had begun (under 96, a row's rule) — a circle that would leave the name cut anyway stays, the name
  taking its ellipsis, read whole on hover (the button's `title`). `show_icon` on every head card: `auto` (this rule —
  the updates', the helpers' and the timer's heads are fitted since 1.9, as every head, the timer's badge going under
  300 as before), `always` (the circle stays while the name keeps its floor — two letters and the ellipsis, 40, or the
  whole of a shorter name — beside it and what trails it: where the full circle would leave less, the head's smaller
  one, a compact row's 40 with a 16 glyph; where not even that, none, as `auto` — a name never vanishes, never a stump:
  beside a switch the smaller circle shows from a 200 card, the full one from 204, so in half a phone's section, 152 or
  172, the name has the row), `never`.
- **Custom heads follow the same rule:** a player's art and its words are one button (the head's), a mini row's art
  and words likewise; the now-playing strip's art and titles; a greeting with no avatar (hidden, or no person to be)
  takes the tap and the hold on its words; a room's photo and its row run the room's `tap_action` (its path, or the
  area's settings for an admin, only by default), hold, and answer the keyboard.
- **A picture of the person's own (1.13, #99):** a head card with `image` (the thermostat) draws it in the circle's
  place, in the circle's box (44, the smaller 40), whole on no fill with a control's corners; it gives way where the
  circle would, and out of reach it greys and fades with the card (the dashed ring is the circle's alone). An address
  is loaded only from the web, a path or `data:image/` (`shared/picture.ts`), else the circle stays.
- **A round in the head, and a short title (1.9):** the people and map cards' head keeps the short title where the
  long one would not hold beside the circle and the round (the map card has one too: "Everyone", `map.title_short`),
  and where not even the short one holds beside the round (half a phone's column, 152) the round gives way to a "Map"
  row under the body — a control never goes, as the automations card's `+` steps to a row. One rule for both cards
  (`shared/map-head.ts`).

## Icon circles

- 44 with a 20 glyph everywhere; **hero 64 with a 32 glyph** only for the weather condition and confirm sheets.
- Glyphs live on the 24 grid with a 1.75 round stroke, ink 3..21 tall and centred on (12, 12) — a glyph that draws smaller (flame, moon) is re-centred with a `<g transform>` or redrawn to the set's height; the flame keeps its inner tongue ≥ 1 unit clear of the outer base.
- Fill semantics: filled pastel = on / active / alert. Off, idle, events (person detected, vehicle) and weather day rows are neutral.
- Dashed ring = unavailable.
- **Which icon (1.10, the owner's rule: Fluvy's glyphs for as much as possible, Home Assistant's where we have
  none), on every card, row, tile, chip and sheet that draws an entity:** the card's own `icon`; else the icon the
  person set for the entity in Home Assistant — its registry's, or the one its own settings hold where Home
  Assistant keeps it there (a helper's, a scene's, a script's, a zone's, an old group's, a template's: they write it
  into the state as the registry's is, and no integration chooses one for them); else Fluvy's glyph for its kind,
  drawn as it stands; else its integration's (`attributes.icon`); else Home Assistant's own for its state
  (`<ha-state-icon>`: its device class, the state the circle draws, its integration's icon translations); `dots`
  last. Fluvy has no glyph for a domain it does not know, nor for a sensor or a binary sensor of a class it does not
  draw (pm2.5, pressure, vibration: Home Assistant's icon knows the class). One of no class keeps Fluvy's stand-in
  (`trendUp`, `check`) unless Home Assistant knows better: its integration gives it an icon, or names it by a
  translation key (where integrations declare their icons). A lawn mower is the leaf. An entity that is not there:
  `ban`. One function, `iconOf(view, own)` (`cards/src/shared/domain.ts`); an Activity entry draws the entity as it
  stood (Home Assistant's icon too, for the state it had); a group there looks like what it holds unless it has an
  icon of its own.
- **What draws a kind keeps its own glyph** (a role, a place, a set — not an entity): a room's and a room's
  lights' head (the area's icon, the home), the weather's condition, the energy flow's nodes, a meter's flame or
  drop, the batteries' battery, the appliances' kinds, a chart's head for a set of sensors (the trend, a class), an
  alert (its preset's glyph, or a split alert's entity's own icon), the lock card's head (lock or unlock as the knob
  stands: it says the state when the badge has given way), the player's art plate, the map's zones, the updates
  card's "Auto-update at night" (the clock), the Energy dashboard's devices (the plug), an automation row (the
  clock for a schedule), the Activity's runs and an event's bell, a scene's check as it runs.
- **What opens and shuts is drawn as it stands:** a door, a gate, a garage and a window — a cover of the class, or a
  `door` / `opening` / `garage_door` / `window` sensor — wear their open glyph while open or opening (a sensor: on)
  and their shut one otherwise; a chart's head (no state) draws them shut. A damper is the fan; a shutter, blind,
  curtain, awning or shade the blinds, open or not. Motion, occupancy, moisture and smoke keep one glyph: the fill
  says on.
- **The opening glyphs:** `door` / `doorOpen` (the frame, its leaf swung in on the hinge, the knob at its free
  edge), `window` / `windowOpen` (four panes; the two sashes swung in), `gate` / `gateOpen` (a braced field gate
  between its posts; its leaf swung toward you on the left post, wide and unbraced, so it never reads as a slashed
  sliver), `garage` / `garageOpen` (a garage, its door shut in two panels — one seam, 4.5 from its head and its foot,
  so it never merges into a bar at 16 px; open, the door rolled up into one band at its top). Same grid, stroke and
  ink box as the set; each read at 16, 20, 24 and 32 in a filled and an outlined circle, light and dark.
- **Home Assistant's icon in a circle** takes the glyph's box: 20 in the 44, 16 in the smaller 40 and a compact
  row's circle, 32 in the hero.

## Controls (one idiom per job)

| Job | Idiom | Sizes |
| --- | --- | --- |
| Continuous value | ruler (lit from its origin — left, or bottom on a vertical — up to the knob; value-based ticks: minor 5 %, major 25 %; tile rulers 1/12 & 1/4, temperature tiles 1 °C / 5 °C; fine mode 1 % / 2 %) + knob | ruler 44 high (vertical: 44 wide, ticks and knob centred on the band's centre line); end ticks keep their full 2 px stroke |
| Knob | white disc, tone ring 2 px, centre dot, drop lift (falls on the halo), and a 4 px halo of the surface colour outside the ring (`--knob-halo`); a ruler tick that would meet the halo is omitted — ticks are whole or absent | **28 compact** (tiles, seek bar, small dial) · **36 standard** (card rulers, vertical ruler, large dial) |
| Read-only marker | the knob ring without the dot and without lift, same size as the knob | battery, vacuum battery, timer elapsed |
| Nudge | stepper pill 96 × 44 (− │ +) | on the value row; centred under a dial |
| Setpoint | dial: soft disc, tick ring, knob riding the ring, current-temperature dot, min/max labels, stepper below | `dial({ min, max, target | range, current })` — real units, never fractions; a range dial keeps the stepper and marks the selected knob with the focus halo (tap to select); its ring comes from the column (84 where it has 216, down to 56: twice the ring, its ticks and their 12, on the 4 grid), and its figure takes the largest size the disc holds with its unit, measured on what it says at rest (a range's two ends), so a knob under the finger never resizes it; `show_stepper: false` draws none, 56 shorter |
| Toggle | 48 × 28 switch in a 56 × 44 hit | tile heads, rows, sheet heads |
| Modes | option tiles (84 tall, radius 12): a 20 outline glyph top-left, 12/500 label, 16/600 value; active = tone fill + dark ink, **no ring, no dots** | row fills the column exactly: 3 × 104 + 2 × 4 = 320; sheet 3 × 112 + 2 × 12 = 360; desktop 3 × 96 + 2 × 12 = 312; every row is full — a shorter last row splits the column among its own tiles (5 modes: 3 + 2 wider, `optionGrid`) |
| Stats | the option anatomy, read (`tiles()`; the stat tiles card's take a tap, 1.11), 2 × 156 + 8; **compact** (1.5): 64 tall (12 · label 16 · 4 · value 20 · 12), no glyph row, three a row in the mode row's rhythm (3 × 104 + 2 × 4) while the widest label and value fit a cell (`optionColumnsFor`, measured), four as two by two, else two, one a row where not even two cells hold a value — a value never wraps; `columns: auto \| 2 \| 3` | capacity, sub-values of a card |
| Gauge | the dial's tick ring without the disc; uppercase label above the value in the open centre; MIN / MAX / AVG readouts below | solar power, any read-only 0–max |
| Bar row | 76 tall: circle on the title/sub pair, value at the right, a 4 px bar from x 76 to the content edge under the text; a `plain` row is the 60 list row; **compact** (1.5): 48 tall, the 40 circle on the row (4..44), the name and the value on one line (12..32, baselines paired as the one-line rows'), the bar at 36..40 from the text column (52) to the content edge; a plain row the 48 compact list row. **Rows squeezed under what holds a name** (the words' column beside the value under 96, or under the name itself — measured, as the head is): the rows give their circles to the names, every row of the list with them, the bar and the hairline starting the row; a name that still does not fit ends in an ellipsis, as names may, never before it has begun | strings, plants, meters |
| Distribution | one stacked 12 px bar (2 px gaps) + legend rows 36 with 12 × 12 square swatches | what is drawing now |
| Filters / presets | chips: 36 pill in a 44 hit, text only, **content-sized**: 14 px sides → width = laid-out text + 28 rounded up to 4 (a post-render `fit()` pass measures the text in layout; the sheets render only once Inter is in use); same label → same width everywhere | gap 8; **a chip row fills its row** (revised 2026-09-18, quality bar #5): equal cells in as many rows as the labels need (`chipColumns`, measured where the card can: three short words on one line, three long ones as two and one, four as 2 × 2, a shorter last row split among its own chips — never a label cut to make a row); content-sized chips only on request (`*_style: chips`); tab rows (phone rooms, view tabs) use the 14 px face with 16 px sides (text + 32 → 4-grid), ink-filled active, and fill their line when they fit (they scroll — finger, trackpad, wheel or mouse drag — when they do not) |
| Commands | 44 rounds, one filled primary, quiet siblings, 8 gaps, left-aligned row | vacuum, blinds open/stop/close, timer |
| Transport | five equal rounds, `space-between` (5 × 48 in 320, 5 × 56 in 360 → 20 gaps) | shuffle · prev · play/pause · next · repeat |
| Buttons | `.fv-btn` 48 high, radius 12: quiet (page), accent, link (page + accent text) | paired actions always share one width (172/172 in a sheet; keypad pair 124/124); single actions are content-sized (text + 32) |
| Button family | one sheet (`fluvy/buttons.css`): **round** `.fv-round` 44 circle, 20 glyph — quiet, accent, **on-page** (the card's fill and hairline, for a button on the page's ground; the strong hairline on hover), **bare** (no fill, the colour of its words; a 6 % wash on hover); **action** `.fv-action` (a command row's cell); **button** `.fv-btn` (above) and its **pill** (44, the pill radius, 14/600, width = its measured words); **link** `.fv-link` (13/600 accent text, its 44 target reaching 14 past the words so they end on the column) | **switched on** (`is-on`): in a card the round's glyph takes the accent (shuffle, repeat); on the page's ground the button takes the accent's fill, as an active chip (sources narrowing, Today from another day). One disabled look (40 %, no pointer) and one press (0.94) for every button, from the interaction layer; no card declares its own button |
| Keys | 72 × 56, radius 12, page fill; backspace = quiet key with a glyph | keypad 3 × 72 + 2 × 24 |
| Slide to unlock | 44 pill track, knob at the true start (no halo: nothing to cut), destination ring (the knob's 36 + 2 px geometry in text-secondary ink) with the unlock glyph at the right, hint centred | no ticks — it is not a dimmer |
| Text field | `.fv-field` (one sheet, `fluvy/fields.css`): 44, radius 12, 16 sides, page fill and a hairline (the strong hairline on hover), as Home Assistant's own fields wear the theme; glyph 20 in the secondary ink, 12 from the words (a leading glyph 2 px out, a trailing one 3 px out: optical); a trailing clear button is a 36 bare round 4 from the edge; words 15/500 (16 under a finger: iOS zooms into less), the placeholder 400 in the secondary ink | **on-page** takes the card's fill; focus = the 2 px accent ring inside; a value refused on leaving keeps a danger hairline, one refused while typed turns the words to the warning. The helpers' text, the to-do composer, Activity's search, the panel's hex and the time field are all this field |
| Dropdown | `<fluvy-select>` (`fluvy/menus.css`): the text field as a button — the chosen label 15/500, a 20 chevron in the secondary ink that turns over while open, the 2 px accent ring while open or focused; its menu in the browser's top layer (a popover, over Home Assistant's sidebar and dialogs; the same box fixed under the field where a WebView has no top layer): 4 under the field and as wide as it (192 at least, the window less 32 at most), padding 4, radius 16 on the card's fill with the hairline and the lift, 44 rows at radius 12 (concentric), the name 15/500 and its hint 13/500 in the secondary ink at the end (the hint leaves under 280: a name reads whole, a hint is never cut), the row under the pointer or the keys on the page fill, the chosen one an active tile (accent fill, its hairline, a check); 8 + 44 × n tall (every row up to nine; from ten, eight rows and 24 px of the ninth, on the 4 grid, so the cut row says there is more), over the field when there is more room above than below, only as tall as that side allows (the rest scrolls, no bar); unfolds from its field's edge in 200 ms (opacity, a 0.98 scale and 4 px of travel, no overshoot), leaves in a 120 ms fade — a surface that shrinks as it goes reads as flinching — and follows its field while open (a card still animating in) | opens on a tap, ↓ ↑ Enter Space Home End or a letter; ↓ ↑ never wrap and skip what cannot be chosen, PageUp / PageDown move five, letters find the next name (no diacritics needed, a repeated letter cycles), Tab chooses and moves on, Escape closes with nothing changed and never reaches the page; a tap outside, a scroll or a resize close it; choosing ticks the haptics once. The Preferences tab's language; a helpers card's select past six options (#96), whose row's value pill — its 16 chevron 4 after its words, turned over while open — opens the same menu without a field of its own (`anchored`): 4 under the pill, from its edge on the side of the row it stands on (the pill's end at the row's end, its start where the row stacked it under the name), as wide as its longest name (192 at the least, the window less 32 at most), the focus and the keys in the list while it is open and back on the pill as it closes; the menu's file is fetched the first time one opens |
| Calendar | one component (`monthGrid()` in `cards/shared/days.ts`, `fluvy/days.css`): the weekday row (11/600, tracked, secondary, 8 over the days) over seven columns (the owner's tracks), each day a 44 target — its number 15/500 in tabular figures, weekends in the secondary ink, a 4 px dot for events — whose plate (radius 12) carries its state; the arrows walk the one tab stop (a day, a week; Home / End the week's ends; Page Up / Down a month), turning the month when it leaves it; a new month slides in from its side | **one day** (the calendar card's month and week): the chosen day on the primary fill, today on the palette's mark or, while another day is chosen, the accent's pastel. **A period** (Activity's dates): the chosen days one band on the accent's fill, its ends on the primary, today in the accent with a dot. Hover lays the page's fill on the plate (in a period, an end's plate), focus rings the day inside |
| Artwork | `.fv-art`: the plate a player's picture sits on — the accent's gradient (a solid palette's primary) under a highlight, radius 12 (the hero's 20, lifted), the glyph centred in the plate's ink; the picture fades in over it and the 8 % hairline is drawn again on top; nothing playing, the plate goes neutral (page fill, hairline); a person's own picture (`image`, 1.13, #99) sits whole on the neutral plate (`contain`: a product picture is never cropped) where the player has no artwork, or always (`image_mode: always`), and greys with a player out of reach | the player (80, 44, the hero's 200) and the home's now playing (64) |
| Empty state | a 44 ring on the card fill with a 20 glyph, over one 14/500 secondary line, centred in a 120 panel (page fill inside a card, page-alt on the page) | `emptyState(glyph, text)`; HA's empty lists and drawers take the same idiom through the shell |
| Words as a value | a state written in words ("Grid-Connected, normally", "Niet gedetecteerd") sits at the right edge: one 16/20 line where it fits beside the name, else two 14/18 lines; the name gives way first (its floor leaves the longest word its line, 40 % of the row at least), and prose is clamped at three lines (1.6) | figures stay one line |

Rectangular tappables share **one radius: 12** (option tiles, buttons, keys, fields, toast actions); cards 20, tiles 16, sheets 24, device frames 24, the phone 40. Art thumbnails ≤ 80 are 12, the 200 hero 20. A scene tile on the page is a tile (76 / 16, hairline); inside a card it is an inner tile (84 / 12, page fill, no hairline). Active inner tiles are fill only (no hairline), like option tiles.

- Calendar month + day: the month grid on top, a day label ("Thursday 17 · 4 events") and that day's event rows underneath — the week card's idiom, a month tall; selecting a day swaps the list.
- **Shell (2026-09-18, the sheet's chrome):** the theme colours the sidebar and the header; the rest is the module's shell layer, only while the Fluvy theme is the page's theme: its sheets stay attached and are emptied when it is not. Public properties: `font-family: var(--ha-font-family-body)` on `body` (Home Assistant's template hard-codes Roboto there), `--ha-border-radius-sm: 12px` on `ha-sidebar`. Three adopted stylesheets (never touching elements): the sidebar — our glyphs as masks on the built-in panels (home, energy → bolt, map, logbook → list, history → clock, media → speaker, to-do → check, settings → sliders; custom panels keep theirs), the selected pill in the accent fill, labels 14/500, title 600; the drawer — no hairline between sidebar and content; the app root on ≥ 1024 px — a rounded panel (radius 24, 16 px inset, page-alt behind, hairline around) that contains the header and the drawer. Phones and tablets under 1024 stay full-bleed. `fluvy:` sidebar icons that failed before the module loaded are re-asked. The set's outlines are scaled 10/9 (ink 2..22) to sit beside Material icons at 24.
- **Shell, beyond the sidebar (2026-09-18 night):** the notifications drawer takes a white header without hairline, its title 20/600, the list 16 px in, and the empty state as the cards draw it (a 44 ring on the card fill with the check glyph, one 14/500 secondary line, in a 16-radius page-alt panel, the language's one empty state); notification cards get a 16/600 head and a 14/20 body. The settings lists' icon badges are our icon circle (accent on the accent fill) instead of the frontend's brand colours. Rule for every further page: the theme first (colours, radii, the body font), an adopted sheet only for what the theme cannot reach, always our existing idioms (icon circle, empty state, card head), never new ones.
- **Scrolling in the frame (revised 2026-09-18):** the app keeps the whole window and scrolls as Home Assistant designed it (the window for dashboards, inner lists for tables, logbook and history); the frame is declared as 16 px safe-area insets on `home-assistant-main`, so the header, sidebar, content, floating buttons and every viewport-sized page step inside by themselves, and a fixed, click-through layer paints the page around a 24-radius opening with a hairline. One scroll per page, nothing clipped; the page scrollbar is thin and in the theme's thumb colour. The dashboard's chrome (greeting, tabs) never plays the entrance (`still`), so the same header reads as fixed while the views change under it; a readouts strip is a card of its view, and enters as one (#148).
- **Form controls (HA's own, in Settings, editors and dialogs; 2026-09-18):** every control speaks the cards' idiom. Fields (`ha-input`, `ha-textarea`, `ha-picker-field` — also the face of `ha-select` — and the older composite pickers: labels, entity name, state content, clock format, the time row) are a 12-radius box on the **page fill** with a hairline, the strong hairline on hover, a 2 px accent ring on focus, no Material underline. Menus (`ha-dropdown`, what a select opens) take the sheets' 16 radius and lift, 44 rows at radius 10 in a 6 px inset, page fill on hover/focus, the chosen row as an active tile (accent fill, dark ink). Switches are the cards' 48 × 28 switch (20 thumb; off = page fill in a strong hairline with a card-white thumb, dark = lifted track with the secondary ink as thumb; on = solid accent, card thumb). A checked box or radio is the solid accent with the on-accent mark (radius 6 boxes, 1.5 px rings). Sliders carry the cards' knob (card-white 20 thumb, 2 px accent ring, lift) on a 6 px track. The code editor is a field with a hairline gutter. Buttons use the one tappable radius (12); card headers are 20/600. Where HA exposes a variable the **theme** sets it (switch, checkbox, radio, slider track, button radius, card header size, `--input-*`, disabled fills/inks); the rest are sheets in the component classes' Lit `elementStyles`, emptied when the Fluvy theme is not the page's theme.
- **Forms, second pass (2026-09-19, three explorations of System, editors and dialogs on a live instance — entities, profile, card editors):** a dialog's footer sits on the body's 24 column, 24 under the content, its buttons 48 tall, 8 apart and 112 wide when paired; every creation form (helpers, labels, tags, people, areas, floors) keeps one 16 rhythm (a required field no longer touches the next); a field's hint starts on its text's 16 column; a raised label is 11/500 with the value 16 under it, as the selects'; list rows are the cards' 20 + 16 lines (60 for two); radio options keep no margin of their own (a 44 pitch, a row of them 16 apart, the circle on its label's column); a short choice drawn as a row of radios (Network's Automatic · Static · Disabled) is a row of option tiles; side-by-side form cells line up on their boxes' bottoms, and a picker's label above its box is the fields' 13/500; the card editor's fields, preview and footer share one 24 column; the entities' own toggles are the 48 × 28 switch; code editors run on 20 px lines. A modal drawer (notifications) opens inside the floating frame, in its shape: 16 from the window, the frame's corners on its side, its hairline.
- **Home Assistant's theme is the person's (2026-09-19):** "Everywhere" reaches Home Assistant's pages only while the theme Home Assistant wears for that person is Fluvy (their profile's, or the house's default). Another theme keeps every Home Assistant page (no look, no shell: frame, icons, forms), and the look stays on Fluvy's dashboards as with "only dashboards"; the panel says so and offers the Fluvy theme through the profile's own picker event.
- **Quick search and pickers:** section chips on the page fill without separators (in the quick bar, five equal whole-pixel cells from 601), section titles as the cards' labels (11/600 caps, no grey band), rows of two lines at 60 (14/20 over 13/16), every glyph in our 40 icon circle on the accent fill instead of Home Assistant's brand colours, the tip 13/500 with its link in the accent.
- **Home Assistant's own Material icons (2026-09-19):** the chrome's icons (`ha-svg-icon`, told only a path: undo, redo, help, the ⋮ menu and its items, pencils, close, back arrows, search, copy, delete…) are drawn as our glyphs while the shell is on and the house keeps our icons: a table of 32-bit keys of the Material paths (`tools/icons/mdi-glyphs.json` → `packages/core/src/icons/mdi.ts`, `@mdi/js` pinned to Home Assistant's 7.4.47, only for the generator) tells which glyph replaces each; the Material path is kept on the element and comes back when the icons are switched off or another theme is worn.
- **A dashboard in edit mode:** the edit bar keeps its accent fill, everything on it in the bar's ink; Done is the primary action (36, the tappable radius, never shrunk); the open view is a tile on the card fill holding its arrows and pencil (no underline); frames of what can be edited are a fine dashed hairline; what adds (a title, a badge, a card, a section) is a fine dashed accent outline filling with the accent's wash; what edits is a quiet control on the card fill with a hairline.
- **All of Home Assistant under the theme (exploration of 2026-09-18):** the theme maps HA's whole colour system, not only the accent — the named palette (`--amber-color`… 21 names, which every per-domain state colour, timeline, logbook dot and 2026 summary resolves through), the success / warning / danger scales (`--ha-color-green|orange|red-05…95` from our status inks), off as the quiet strong hairline, weather glyphs, outlines, the edit-mode header (the accent fill), the code editor's syntax (keys accent, values ink, figures info, punctuation disabled). Type: HA's "bold" is our 600, font sizes keep `--ha-font-size-scale`, the old Material components get Inter without tracking (`--mdc-typography-*` from the shell's page sheet, not the theme: 2026.10 retires those names), HA tiles take the compact tile's 15/600 over 13/500. The shell registry then gives every HA component class its idiom: data tables (14/20 cells, 13/600 secondary headers, 36 toolbar controls), search boxes (card-white 12-radius field), menus, tabs on whole pixels, dialog titles 600 with an ellipsis, alerts as status panels (role fill, radius 12), option boxes as tiles, button toggle groups as a segmented track, section and card titles 20/600, card actions on the content column, empty states, Leaflet controls, logbooks that open instead of scrolling inside a scrolling surface, the automation editor (headings, rows, side panel, targets), and the charts' canvas font (the one wrapped builder). a shell health check (see `docs/shell.md`) lists which sheets HA still draws after an update.
- **All of Home Assistant, second round (2026-09-18, night):** Inter is registered at start on every page (not when the first card appears) and inside every same-origin panel frame (HACS), which gets a shell of its own while the page wears Fluvy. HA's charts draw the canvas in the body font and a series HA paints in its own default primary in the page's primary (where Fluvy is in use). The empty-state idiom reaches HA through one shell helper (tables, "No activity found", the area page's lists, the To-do panel, the notifications drawer). A card head that carries icon buttons (the Activity card, the log cards) keeps the standard head line (12 · 34 · 16) and hangs the 48 buttons over it. Option choices in HA become our option tiles with their glyph (the profile's Auto · Light · Dark), view switches our segmented track (Daily / Hourly), paired footer actions one width (112). A required field without a hint keeps no empty row; HA's 10 px step is the 11 px floor. Page titles are 600 everywhere, inactive tabs take the secondary ink, and a tab strip keeps a fixed trailing slot so it never moves between sibling pages.
- **Automatic dashboard:** `strategy: { type: custom:fluvy-home }` builds Home, Lights, Climate, Energy and Sensors from the registries and the energy preferences with the approved `/fluvy-home` layout: lights = `light.*` plus switches whose words say light, appliances = the other switches (one per device, twin outlets dropped) with their power and energy readings, climate = thermostats + weather + temperature/humidity sensors that are not the weather service's, energy = solar/grid/battery power by words + the energy dashboard's devices, sensors = device batteries, phones (mobile_app), people, openings, plants, updates. Names: the entity's own words, the device's name when the own words only say the kind, the area or the device for a reading's place. Capped lists (each with its "N more" row, below), empty sections and views left out, titles in the dashboard's language, `hide: [energy]` to drop a view.
- **Capped lists (1.11.1, #78):** a view shows the first of a long list — lights 6, plug tiles 4, blinds 6, garage doors and gates 2, thermostats 4, fans 2, humidity 3, temperatures 4 (Climate's sensor cards) and 3 (the readouts of Home, the wall and a room), Home's security rows 5 (the wall's 6), alarms 2, locks 4, cameras 4 (the Security dashboard's Cameras view 12), players 6, calendars 3, to-do lists 3, timers 3, things to run 6, scenes 6, batteries 8, phones 8, plants 4, helpers 6, updates 8, the energy dashboard's devices 8 (its Devices view 12), the day's stat tiles 4, power meters 9, a room's other devices 8 (`caps.ts`) — and nothing past the cap is out of reach: the list ends with the house's fold row, "N more" (the `list` glyph in its neutral circle, "{count} more", the chevron; "+N" where the words would not hold beside the chevron), which opens a subview of every one, after the view's path (`climate-humidity`, `room-kitchen-lights`) and back to it, its heading the way back as a room's is. The row is the last row of a list of rows (the entities card's `more` and `more_path`) and a card of its own under a list of cards, kept under the list's last card (a block never splits; a loose card takes its row with it). The subview lays the whole cards of a list of cards over its columns, a list of rows a card a room (the biggest first, as the Security dashboard's Openings view), a run of readings three a card (four share one, two by two). One past the cap of a list of rows or tiles is shown instead, as every fold of the house: it takes the room the "1 more" row would. The Openings cards and a room's Automations card fold their own lists at the list's cap (openings 4, automations 6, as the card's `max_rows`; in full, every one), the rest a tap away on the card, no subview. A chart's series are never capped (the distribution's eight are the palette's), nor the picks of an overview (Home's running thermostat, its first player, vacuum, list and scene). The dashboard's `caps` raises a list's cap (`caps: { lights: 12 }`), lifts it (`humidity: none`) or lifts them all (`caps: none`: every list whole, no row); the panel's Dashboards tab offers Long lists: Shortened (the default, writing nothing) · In full, and a raw configuration's own numbers read as Shortened and stay until In full is chosen.
- **Loading:** a Lovelace resource runs only once a dashboard has rendered; the shell reaches every page (Settings opened cold, History, Map) because the integration also loads the module at start on every page (`add_extra_js_url`, the loader beside the build under `/fluvy-frontend/<version>-<build>/`), and registers the settings panel with that same loader; a build's URL never changes, so no cache serves a stale one.
- **When Fluvy steps aside (1.10, after the HACS review):** what no sheet can reach (the charts' canvas, an icon's
  path, HACS's frame, the settings lists' glyphs, the more-info title's fade, a dashboard's header marks, the
  Activity and History pages) is one wrapped method of a Home Assistant element, and every wrap but two keeps three
  rules. Home Assistant's code runs first, always and unchanged. Ours runs after it only where Fluvy is in use — the
  page wears the Fluvy theme or the look covers the whole app, the dashboard on screen wears the look, or the device
  is a wall; anywhere else Home Assistant's elements stay its own: its chart font and colours, its Material paths,
  HACS's frame without Inter, no attribute of ours (`<home-assistant>`'s frame mark included), the page's background
  and theme colour as its theme left them (a mark a worn dashboard left behind is taken off, and the change that takes
  Fluvy off the page writes the chrome once more, as Home Assistant does, from its theme: Home Assistant wrote it
  while our sheet was still on). Ours is caught: a part that throws steps its patch aside for the session, in its own
  document (HACS's frame and the page apart), said once in the console and listed in `__fluvy.shell.report()`, which
  also sets Home Assistant's version beside the releases the build was checked against — a note, never a stop. The
  two that do not run Home Assistant's code first keep the other two rules: the Activity and History pages draw ours
  *in place of* the panel's render while the page wears Fluvy and the house keeps our pages (the panel's state,
  routes and subscriptions untouched; another theme or the house's choice gives Home Assistant's page back at once,
  and ours throwing gives it back for the session); and on a dashboard that wears the look with its actions in one
  menu, the root is lent `narrow` for the one call that draws them, before Home Assistant's render, which then draws
  them as on a phone (an own value over the property, taken away when the call returns or throws; a lending that
  throws steps aside and the render runs as written).
- **Icon set:** the glyphs (149) are a Home Assistant icon set, `fluvy:<name>` (kebab-case of the glyph key: `cloud-sun`), registered through `window.customIcons`; the paths are the strokes outlined to fills at build time (`tools/icons/outline.py`, shapely, 0.06 simplification) on the same 24 grid, in two parts: what Fluvy's chrome names (a Material icon it redraws, a sheet's mask, a view's icon) in core (`icons/generated.ts`), the rest — the six appliances a person may pick, the garage, the gate, the window, the door open and the security camera — in an `icons` chunk that `getIcon` fetches the first time Home Assistant asks for one of them (`icons/generated-on-demand.ts`; `ON_DEMAND` in `tools/icons/extract-glyphs.mjs` says which), written as an absolute start and relative steps in tenths (SVG's shortest numbers: 17 KB gzip for the set instead of 27). Inside our cards a `fluvy:` reference draws the stroke glyph inline; elsewhere `<ha-icon>` draws the fill. Our dashboards use `fluvy:` icons in the sidebar; built-in panels keep MDI.
- **Heading icon:** an optional icon before the section title — a 20 px glyph in a 24 box in the accent ink, 8 px before
  the 20/24 title, on its cap height; the title ellipsises before the meta gives way, and a meta longer than its 60 % of
  the row gives its words up to the chevron (its words stay in the button's label): never cut. It replaces emoji in
  titles.
- **Heading styles (1.9, #47; Home Assistant's own `heading_style`):** `subtitle` (the default) is the group's heading
  above; `title` is a page's section title, as the reporter drew "Großgeräte": 27/600 on a 32 row, 16 from a 32 glyph,
  its link 16/500 with a 24 chevron whose ink ends on the column's edge. Where the row is short what gives way has an
  order, measured in the card's own faces: the link's words, the title's size (27 → the subtitle's 20 and its 24 box),
  its glyph, the chevron — so the link gives way before the title is cut; a title that would not hold even alone keeps
  them and ends in its ellipsis, as a name may. 32 tall at any width (`layoutHeight`).
- **Section heading rhythm:** a heading below other cards of its section opens a new group — 24 under the previous cards (the grid's 16 + 8), 16 above its own; a heading that opens a section keeps the column's top line, so columns still start level.
- **Columns end on one line (generated views):** the automatic dashboard cuts its blocks — a heading with its first row, a pair of tiles, a card — into the three columns every possible way in reading order and keeps the cut whose feet are closest (heights measured from the real cards, the first column carrying the greeting and the tabs); single-purpose cards (media, vacuum, to-do) then fill the shortest feet. Tiles go two a row; an odd one out closes its group as a compact tile across the column, so no row is half empty.
- **Tiles squeezed narrow (2026-09-19):** a large tile whose inner width cannot hold its icon circle, 8 and the switch (under 132 px) folds the switch into the circle (the circle becomes the switch, as Home Assistant's own tile's icon is); a sensor's value that would not fit beside the circle goes to the state line; a foot keeps one readout under 120 px of inner width and the ruler is drawn to the inner width. A group of tiles lays out fewer columns when its width cannot hold the ones asked (large 100, compact 128, mini 64 at least); a lone compact tile under 128 gives its name the circle's room, a mini tile under 60 draws a 36 circle. A thermostat's "Target · Now 20.8°" label keeps one line: it is the longest of its forms its room holds (beside the stepper, the row less the stepper and its 12; stacked, the whole row) — the readout is never squeezed under its stepper (§ Value row).
- **Names that must read:** two compact tiles side by side under 200 px step the name to 14 px; a large tile's name that would end in an ellipsis steps to 14 px, and a large tile with nothing under its state line lets the name take two balanced lines; a scenes card goes one tile a row when a name would not read in two lines of a half tile; a pill sized to its text is padded on both sides from the measured text, so its label never ends in an ellipsis; in a list row a state in words wraps between its words once the name is down to its third, figures never wrap.
- **Customisation principle (user, 2026-09-18):** every card exposes what to show (section toggles such as `show_fan`), which items appear and in which order (subset lists such as `modes: [off, heat, cool]`), and at least two more layouts through `variant`. Chip rows fill the row by default and are content-sized on request (`preset_style`, `fan_style`, `suction_style: chips`). Editors show what the card does by default (`formEditor` / `listsEditor` with defaults): the dial, the mode tiles, every mode the device offers; a default the user leaves as it was is never written into the config. The thermostat is the reference: `variant: dial | compact | ruler`, `modes`, `modes_style: tiles | chips | full`, `preset_style`, `fan_style`.
  An option that cannot act is not shown; one that acts only in a style is shown in that style (2026-10-22, #58). The
  editor asks each field, each row of fields and each list when it can act (`when`), from the whole card — the config
  over the card's defaults, its lists too (a camera of the list asked live), so a house default counts as the card's
  own — and the house. A hidden option keeps
  its value, and acts again when it comes back; it is never a required one. The cases (1.10, #58): the light card's
  *How much colour* only while it shows its colour (its own *Show its colour*, else the house's); a compact lock
  without its rows; how whites show (`light_whites`) only beside "in its bulb's colour" while the bulbs show their
  colours, and on the light card not while its own colour or tone stands in for its bulb's; a tile's light colours
  only for a light, a tiles group's and an entities card's while their list holds one, a tile's readouts except under
  a large tile's ruler (a light that dims, a cover set to a position, a fan to a speed); a tile's and a template's
  colour at rest (`tint`) only where something shows then (a colour, or a tone that washes: never a status's at rest,
  never a template that is always on); the room lights card's colour at rest in tiles alone; the Cameras card's
  `max_live` where a picture streams (the card asked live, or a camera of its list); a room's controls, tiles and
  lights' colours except in a row, its picture for the photo alone, its colour at rest with tiles alone, its lights'
  colours not with `controls: none` (the room's never-read `size` and `readouts` are gone from its editor); the
  appliances card's picture for tiles and whole cards, no fold (`max_rows`) for whole cards, and the list's head,
  colours and actions not where whole cards hide an empty list (whole cards draw the list's head only while nothing
  shows). What is wrong where an option was shown and did nothing is fixed instead: the room lights card's tiles honour
  its `tone` and `show_level`, and a tile's `tint: always` acts without a colour.
- **When off (1.7):** a device card can keep to the essentials while the device is off (`when_off: essentials`; the default `all` shows everything): the head, the state (dial, readout or ruler, dimmed as today) and what wakes it — the mode tiles on the thermostat, the switch and the speed ruler on the fan. What hides is what has no use off: the thermostat's presets and fan speeds, the fan's presets, oscillation and direction. "Off" is the card's own (`stateOf()` / `expect()`), so a mode or the switch tapped brings everything back in the same render, before Home Assistant answers, and below the tile under the finger — nothing moves under it; Home Assistant resizes as for any `rows: 'auto'`. Covers (tilt, favourites) and media (sources, volume) keep everything: those are how they wake. The water heater and the humidifier only have modes: nothing hides. `layoutHeight` stays the on height (the automatic dashboard reserves it), and so does the card unavailable, unknown or missing (§ Surfaces).
- **Modes in their order (1.9, #46):** a thermostat draws its modes in the order its `modes` list gives them, and
  without one in a single order (`modeOrder`): a climate's in Home Assistant's (Off first), any other after them in the
  entity's own; a water heater's operations as listed; a humidifier's Off, then its modes — a water heater and a
  humidifier show their first six unless the list names more. That order is also what the editor shows by default,
  as chips dragged into place, offered from the entity's own modes and worded as the card words them (Fluvy's word
  for a climate's seven and for Off, else Home Assistant's own, translated): a check-box list kept the click order and
  never showed it ("Auto · Aus" on HomeMatic after unticking Heat). The alarm's modes alike, from the panel's
  features. A card's select may take its options from the house this way (`static choices`); the form itself stays
  one static schema.
- **What a thermostat shows:** `show_modes: false` hides the modes and their label (a 128 tile block, 88 as chips);
  `show_current: false` drops "· Now 20.6°" and the dial's sub; `subtitle` replaces the line under the name (empty
  hides it), which otherwise leaves the area out where it is the name ("Garderobe / Garderobe" said it twice).
  `show_stepper: false` with `show_modes: false` is the glance: the head and the readout, the readout the card's tap.
- **Declared heights (1.9):** every card's `static layoutHeight(config)` says what the card draws at a 360 column from
  its config, so the sections grid and the automatic dashboard place cards without gaps or overlaps. The automatic
  dashboard (and `tools/render/heights.mjs`, and the interaction suites that hold a card to its height) count it with
  the house (1.10: `houseHeightOf` in `cards/src/house-heights.ts`, a chunk of its own the strategy imports, so no other
  page carries the reading): what the house says of the card's entity is handed to the card's height function, which
  counts what the entity's capabilities draw — a thermostat's presets and fan speeds, a fan's oscillation and direction
  rows, a cover's position or tilt, a vacuum's readouts, battery, commands and suction, a lock's latch, an alarm's
  modes, a media player's sources, a weather's forecasts, a clock's forecast row, a light's colour or temperature ruler,
  a room's rows and readouts, a helper's range and options, an update that waits or installs. Without the house, the
  config's say and the documented default (Off · Heat · Cool; the oscillation and direction rows; a colour bulb). A row
  the card lays out by measure (filled chips, option tiles, a row of readouts, a legend) is counted with the same rule,
  its words estimated letter by letter (`textWidth` in `shared/heights.ts`, Inter's widths by the kind of letter,
  calibrated on the rows as they draw). A height that depends on live content the config cannot know (a printer's job, a
  calendar's events, the house's appliances, a to-do list's items, the Energy dashboard's devices) is declared from the
  config's maximum or its documented default and listed, with the reason, in `tools/render/known-heights.json`, which
  only shrinks. A card that is off, at rest or out of reach is reserved its on height.
- **Measured anatomies the declarations follow:** a tiles card is compact by default (76 a row, two a row; `columns`
  held to what a 360 column holds); the alerts and appliances rows start 4 under the head; the photo room card
  starts at its hero (no 20 above) with a 44 readout row 20 under it; the readouts card lays three a row and four as
  two by two; a helpers card is blocks (a number 92, a select's label and chips — its row's own options in their words, #96 — a text's label and field) and groups
  of 60 rows 16 above each group, a time's quick presets 56 under its row; the updates card's rows sit 16 under the
  head (76 installing), its switch a row of its own group; the printer's readouts are rows of three (44, 12 apart)
  and the printing card is 528 with one row; the side clock is 208 analog and 132 digital, its forecast row 60; the
  sensor card is 164 for a word, 276 for several sensors (a line each where a name would not hold its column).
- **Stat tiles a row**: as asked, or measured; and fewer, down to one a row, where a cell would not hold the widest
  figure — a figure never wraps (1.9: the full variant's "21.5 °C" no longer breaks under its number at 211) — or
  would be narrower than a finger's 44 (1.11: three single digits asked in a 172 column were 36 wide; two a row).
- Energy: see § Energy (1.4) below — the flow, its motion and the companion cards.
- Charts are scrubbable: a mouse over a curve or a bar strip reads the value under it (a finger while pressing; a vertical swipe still scrolls) — the dot, the dashed cursor and the bubble follow, the bubble adds the time ("3.1 kW · 10:15"), the card's big readout shows the scrubbed figure with the time as its label; on leaving, everything returns to now.
- The colour-temperature ruler tints its ticks with a faint warm → cool gradient (amber → cool grey-blue, opacity 0.85) and the knob's dot takes the colour under it; the ring keeps the tone. `temperature_tint: false` gives the neutral ticks of the brightness ruler.
- A row that grows (a wrapped sub, a multi-line to-do) keeps its icon, check and chevron centred on the whole text block (`align-items: center`, never `flex-start` with padding); a control beside a large figure (stepper, play/pause) sits on the figure's 44 line box (`align-items: flex-end` on the row), which centres it on the figure's ink. A row value never wraps; the sub gives way (ellipsis).
- Readout rows in equal columns (legends, totals, min/max/average, the stats strip) are **always centred in their columns**, whatever sits above them — a chart, a gauge, a list — so the row reads as one evenly distributed set (rule of 2026-09-18, replacing the earlier left-aligned-under-a-chart exception). A readout row under a left-aligned title (a tile foot, a meter beside bars) is not a column set and stays left.
- Command rows (cover open/stop/close, vacuum pause/stop/dock/locate) are **action rows**: glyph buttons in equal cells that fill the content column — 2 × 152, 3 × 96, 4 × 68 with a 16 gap — 44 tall, radius 12, page fill, the primary one accent. Never a left-hugging strip of circles, and never a cell under 44: a narrow column first closes the gap (down to 4), then wraps the row into two full rows (§ Narrow columns). Centred media transports stay round.
- Switch off in dark: track `border-strong` (a clear step above the card), thumb `text-secondary`; on = tone track with the dark thumb. Light keeps the page-alt track, hairline and white thumb.
- **A switch out of reach is drawn disabled (1.9):** an unavailable, unknown or missing device's switch keeps its place
  and size and fades to 0.4, as a disabled round or stepper does (`aria-disabled`), in every palette and both modes;
  inside a row that has faded as a whole it fades with the row, as the row's stepper does. A switch shown to someone who
  may only look (the settings panel for a viewer) is read-only, not disabled: full strength, `aria-readonly`.
- Trailing chevrons: glyph right-aligned in its 44 box with a −8 optical margin so the ink sits on the column edge (section meta: −5).
- **Media power and compact controls (1.5):** a player that can be switched on or off carries a power round — the player head's trailing round, the hero's corner (48, on the art's top line and the content's edge; the art gives the corner its 12 px), the mini row and the now-playing strip when `controls` names it. Off, it is the one clear thing to do: "Turn on" in the primary fill, and no dead transport under it (the play round waits for the player to be on). `controls` is an ordered subset of `power · previous · play · next · volume`, each only when the player can take it, drawn in the named order; a row that cannot hold them all lets them give way in an order of need — next, previous, volume, then power; play never, it is the control — as a head's lines do. The mini row holds as many as fit beside a title of 96 (three at a phone's column), its volume round muting where the player can and opening the dialog where it cannot; a column that cannot hold one round beside the art lets the art go first (the compact tile's rule) and keeps one round, the words then being the row's tap. The strip centres the transport, keeps power on its left edge and volume on its right, draws power and volume alone on a player that is off (no dead transport, as the card), and a half column spreads 44 rounds.
  **A player keeps its size (1.9)**: its seek line is always there — at rest, an empty track with its times as dashes,
  while nothing has a length (idle, off, a stream, a player that cannot be read) — and the strip's progress line too.
  Out of reach (unavailable, or gone from the house) it is the whole player in the off skin: the `ban` glyph on the idle
  plate, its name and why ("Unavailable · since 19:00"), the seek line, every round its features offer (the five, and
  the volume and power, for one gone from the house) and the volume, still; the hero's words keep their three lines'
  room; the mini row and the strip their rounds, still. A player gone from the house says so whole: "Not found" where
  "Entity not found" would not hold (the player card); on the strip why it is out of reach takes a second line rather
  than an ellipsis (the art's 64 holds the title and two). The strip's line is its names, each of which may end in its
  ellipsis ("Emily St. John Mandel… · Den", "Hall speaker… · idle"); the state after the speaker stays whole.
- **A robot's readouts (1.9):** the area, the time and the time left are laid out by `statsRow`, as the energy
  family's rows: as many equal columns as hold every label and figure, the last readout across a shorter last row,
  never a cut "Remaining".

## Clocks and calendar

- Analog face = the ruler's ticks bent into a circle: majors R/10 in ink, minors R/20 in border-strong (majors only at R 56); hour hand 0.52 R inside the numerals, minute 0.85 R and second 0.88 R over the numerals to the tick ring, widths 6/4/2 (R ≥ 96) · 5/3/2 (72) · 4/3/2 (56), round caps; only the second hand carries a counterweight (cap radius + 8); the cap is the Fluvy knob without halo or lift, 28 / 20 / 16. Numerals 14/600 secondary at 0.75 R (12/600 at R 56). Plain clocks are accent; a weather clock takes the sky's tone (accent at night, solar by day). Digital time 64/72 at −0.03 em, tabular, ink pulled onto the column (−0.06 em, declared `data-align="optical"`); seconds or AM/PM as a 24 unit on the baseline; date 14/500 secondary — the full date in a 320 column, "Thu 17 Sep" in narrow columns and tiles.
- Calendar: one table of events drives every view. Event rows 60 (time 40 right-aligned + 4 px tone bar 44 + title/sub, past rows quiet); month cells 44 radius 12 on a 46 pitch (today = accent fill, weekends secondary, one 4 px dot per day with events); week columns 44 × 72 with the same one-dot rule (the house's week, "This week"; a rolling week, `first_weekday: today`, #111, is today and the six days after it, "Next 7 days", and rolls over at midnight with the card's minute — a month keeps the house's first day); timeline 24 px per hour, true block heights (12 minimum), pastel blocks with dark ink and a 4 px tone bar, a 2 px accent now-line on the true minute; a block never shows more time than the event has. Calendars never use the accent (accent = today, selection, now, the primary action). A trailing slot may hold a 44 + 8 + 44 command pair.
- **Out of reach (1.9).** A clock whose weather cannot be read keeps its Outside · Tonight · Tomorrow row where it was
  asked for and the weather offers a daily forecast (its features stay written; a weather gone from the house is taken
  at its config), its figures dashes; its line says "Unavailable" (the clock itself never stops). A sun out of reach
  keeps its line and its foot: "Sunrise —". The row is three columns where every label and figure holds its third,
  else two and one (a long language in a narrow column: "HEUTE NACHT"), laid out for the widest degree ("−88"), so a
  reading or its dash never moves it.
- **A calendar at rest (1.9).** While its calendars are read, and while not one of them can be read (unavailable, or
  gone from the house), a view draws itself at rest at the size it declares: its head (the state first in the sub,
  "Unavailable · Thursday 17 September", the date giving way before the state), the month's grid and the week's strip
  without dots, the ‹ › pair still, four event rows as still bars on the page's fill (the loading bars, without their
  shimmer), the agenda's next-day row ("Tomorrow · —"), the timeline's configured hours empty, a tile its date or its
  calendar's name with the word. Only "Could not load events" (every read refused) is still one line under the head; a
  tile then says "Unavailable" at its size.
- **The time steps down before a digit is cut (1.9):** the digital hero's units go first, then the time steps from 64
  to 48 (`.ck-big--s`, the same 72 box); the side clock's time steps from 40 to 32, its units going first, and where
  not even the time alone holds at 32 beside the smallest sheet face (48) the face follows it down to a tile's 24 (the
  face yields to the time); the tile's time steps from 40 to 32 (`.ck-tile__time--s`, the same 44 box) in a tile too
  narrow for it (124 on a phone's 264 section).
- **Lines that are never cut (1.9).** A caption's sky takes the weather card's shorter word ("klare Nacht" → "klar")
  with the date's short form, and after a date it is the first to leave, whole; a weather out of reach says the house's
  word ("Entity not found" → "Unavailable", de's "Offline"). A date with no room even for its short form drops its
  weekday ("18 de set."). The side clock's sun says "Sunrise 07:31", its label's word ("Aufgang 07:31"), then without
  the day period — the form the wider of sunrise and sunset holds at the widest time, so the line never changes with the
  event or out of reach; the face yields to its shortest form as to the time, down to a tile's 24, and where not even
  that holds the line leaves.
- **The calendar in a narrow column (1.9).** The week strip takes the narrow weekdays (as the month's) where the short
  ones would not each hold their column and stand 4 apart. A head lets its circle go, then its badge, for its line's
  shortest form; the week's is "Wk 38" ("KW 38", "Sem. 38", "Sett. 38"), and a state that holds not even alone beside
  the ‹ › pair (out of reach, 211) is the house's dash. The next-day row is "2 events · first at 08:15", "· 08:15", then
  the count alone, which its circle gives way to. An event's place is a name (it may end in its ellipsis, its words in
  its `title`); an upcoming event's time stays whole and its place follows while 40 of it shows. The time column holds
  an all-day event's two words as it holds "12:30 PM", whatever the day holds. "Could not load events" is a sentence: it
  wraps.

## Room

- The area card of the ambient sheet, as a card: a **160 hero** bleeding to the card's edges (the room's photo,
  cross-faded in once decoded, under a scrim `rgb(0 0 0 / 0.28) → transparent 55 %` from the foot; without a photo,
  the accent's gradient 90 → 70 → 60), the **name pill** at 20 / 16 from the hero's corner (36 tall, card fill, 15/600,
  a 20 glyph in the accent, 12 before the glyph and 16 after the text, sized to its words on the 4 grid), then **three
  readouts** 20 under the hero in equal columns (m → s → xs by measure), then the room's controls: **category rows**
  (Lights, Climate, Media, All devices — 60, chevron, the hairline from the text's left edge) or **inner tiles** two a
  row. The hero and the rows open the room's page (`path`), or the area's settings for an administrator; nowhere to
  go, no chevron.
- **Inner tile** = a compact tile inside a card: 84 tall, radius 12, page fill, no hairline; on = the tone's fill
  alone with the tone's ink and a card-fill circle; off = a card-fill circle with the text ink (a pastel circle on
  the page ground would read as lit). Two a row, 8 apart; a name steps to 14 under 200 and may end in an ellipsis
  (long names belong to `controls: rows`).
- Compact surfaces write degrees without the unit — "4 of 10 on · 21.4°", "Idle · 22.8°" — the readouts keep "°C".
- **Weather · compact (1.5):** the hero folds into one head row — the 44 condition circle, the name (an ellipsis as names may), "condition · high / low · feels · wind" as the sub, fitted by `HeadFit` (the optional segments leave from the end, then the circle gives way: the words say the condition), the temperature at the end as the compact family writes it ("18.0°", 16/600) — over the hour strip and the days ahead as the strip's 64 columns (the weekday, the day's glyph, the high and its low in the secondary ink), as many as the width holds — fewer while the widest pair would not keep 4 px clear in its cell, `days` the most — starting after today, which the head already says. A condition the line cannot hold even in the circle's room (fr's "Partiellement nuageux" at 211) is the glyph's to say: the circle stays and the line begins with the day's figures, whole.
- The **tile** variant is a head (44 icon circle, the name, the count and the climate as its sub, "opens" as the
  bare 44 chevron with its ink on the column edge) over the inner tiles; the **row** variant is the compact tile
  itself (76), two a row on the automatic dashboards. The head keeps the head's rule (`show_icon`, § Header pattern): at
  211 the circle gives way where that makes the name whole beside the chevron ("Living room", "Wohnzimmer"), which takes
  48 of the line (its 44 and the 12 before it, less the 8 its ink stands past the column edge).
- Compact tiles measure their container's content box: the name steps to 14 under 168 inside (200 outside), the
  icon leaves under 96 inside (128 outside).
- **What a room holds (1.9, #39).** One rule for the card and the automatic dashboard (`areaContents`,
  `holdsSomething`): a room holds something when it shows an entity (one with a state, not hidden, not a config or
  diagnostic entity) or gives a reading. The area's entities come from the registries, never from the states a
  first reader happened to see: an entity whose state arrives late (Home Assistant still starting) is in the room
  the moment it does. A room counts what is on once: its "Devices on" readout, its line ("1 of 1 on · 20.5°") and its
  "All devices" row count the same devices — what the card shows — by the same rule (a heating thermostat and a playing
  speaker are on, a sensor never is), so a room with only a thermostat never reads "0 of 1" above "1 of 1 on".
- **A room's page shows everything its card counts (1.11.1, #76).** The page the card opens (`custom:fluvy-home`'s and
  `custom:fluvy-rooms`'s room subview) starts from the card's own count (`areaContents`) and puts each entity in one
  part (`roomParts`): its thermostats, lights, blinds, garage doors and gates (each a cover card, as the security view
  draws them), fans, players, plug tiles (their power and energy beside them), readings, openings and safety sensors
  — doors, windows, motion, leaks, smoke, gas — on one Openings card titled Sensors for the room (it folds after its
  rows), cameras, and the rest as rows under Devices; an appliance's own entities are its whole card's, across under
  the page. Every list keeps the house's order and its cap with its "N more" row, so "5 devices" on the card is five
  things on the page or a row away from it — never fewer.
- **A room's readings**, as Home Assistant's own area card finds them: the sensor the area's settings name, while it
  has a state, hidden or diagnostic too (the area's settings offer those); else a sensor of that class it shows, the
  first that reads a number (a dead one never hides a working one), else the first, its readout a dash; else its
  thermostat's own temperature (a thermostat or humidifier gives a humidity only where it measures one). Never by a
  unit alone: a "%" is a battery as often as a humidity. The card's `temperature_entity` / `humidity_entity` come
  first, a sensor or a thermostat. A thermostat's reading is written as the thermostat writes it: a tenth of a degree
  in the house's unit, a whole percent.
- **An empty room keeps its anatomy**: "empty" is what would draw nothing — nothing shown, no reading, no tile asked
  for (`controls: tiles` with `tiles`). The photo keeps its hero, the tile its head with the line, the chevron, the tap
  and the hold; the language's empty panel stands where the readouts and controls would be (20 under the hero, 16
  under a head), so the photo card of an empty room stands 60 taller than one with only its two readouts (320 against
  260 in a 360 column, 352 with a two-line hint) — not the same height, and not meant to be. For an administrator,
  when the area keeps entities out, the hint says why and the way out: "2 hidden or diagnostic entities · choose its
  sensors in the area's settings" (never counting a registry entry without a state); the way out leaves first where
  the hint would run past three lines, the whole hint where even the why would — measured as one whole line in the
  hint's type, never in its 380 measure (a probe in that class stops at 380, and every long hint then passed for three
  lines: up to seven at 211).
- **The name pill** gives way as a head does: the glyph first, where the name and the glyph do not both hold the hero
  less its 20 sides (half a section), then the name to its ellipsis in a pill as wide as the hero allows (a name may;
  a content-sized pill never cuts what it holds).
- **The category rows** give their circles to their words where a word would not hold beside its chevron (fr
  "Lumières" at 211), every row with them, as every list does (`rowsKeepIcon`); so do the fan's Oscillate and
  Direction rows beside their switch and chevron. "All devices" is a row only where the room has a device: a room of
  sensors alone shows its readings and no rows (its photo stands 244 tall, its tile 84: its height says so too).
- **A plug that files its settings as none (1.13).** A switch counts where its device is a plug: Home Assistant calls it
  an outlet, or its device has none of an appliance's controls — or (some Tuya and Zigbee2MQTT plugs, which leave a
  countdown `number` or a power-on `select` without a category) its one switch stands beside a power or energy reading
  with no control but numbers and selects. An appliance's option switches stay out: it has several switches, or a
  start button.
- **A room's own say (1.13, #95).** `include` counts what the rule leaves out, `exclude` leaves out what the room shows
  (its count, its rows, its readings, its default tiles and quick actions): entity ids, patterns of ids (`*`, matched
  as characters, never as an expression), device ids, domains. An entity or a device named whole comes from wherever its
  area is; a pattern or a domain reads the room's own; what a room includes it keeps whatever it excludes. The
  automatic dashboards take the same per room (`rooms: { <area>: { include, exclude } }`): the room's card, whether it
  is shown, and its page.
- **Quick actions (1.13, #113).** Rounds at the room's end, the room lights' rounds (§ Room lights): 44, 8 apart, its
  glyph, on its colour's fill and a 2 px ring 4 inside its edge to its level from the top while any of it is on, the
  neutral circle while none is, the dashed ring when none of it can be read (no tap; a hold still opens it). By default
  the room's lights (their ring: the room's light as a share of all it could give, an off lamp at 0, a dimmed one by
  its brightness, each lamp once) and its blinds (their ring: their mean position; never a door, a gate or a garage);
  `quick_actions` orders the room's `lights`, `covers`, `fans` (their speed) and `media` (their volume while they play)
  and any entity, each with its own name, icon, tone, colour and actions. A tap is the set's switch in one call — off
  while any of it is on, else on; blinds stop while they move, else close when open and open when closed; players pause
  what plays, else play — and an entity's the house's own toggle; a hold opens an entity's details, a set of one's
  too, and a set of several where the room opens (none where it opens nowhere). **Where:** the head's end, before the
  chevron, 12 after the words; the compact row's end, 12 after its words; the picture's foot, 20 from its edge and
  centred on the name's pill (12 from the foot), each round that is off on the card's fill as the pill is. Inside a lit
  row every round is a card disc, as the row's own circle is, a lit one in its colour's ink with its ring. **How many:**
  as many as the line holds once the room's own anatomy has its room — the head's circle (56) and chevron (48), the
  pill's glyph (28) and sides (28), the row's circle — and the name 96, or its whole width where shorter; none in half a
  phone's section (152, 172), and beside "Living room" at 360 two in the head (with its chevron), three on the picture.
  Never a line of their own: the card's height is its config's. A press on a round is the round's, never the room's (its picture's, its row's or its head's button);
  `show_quick_actions: false` hides them.

## Map

- The head is about the people (a person glyph in the leading circle); the map is what the trailing round does
  (`/map`). The sub counts who is home.
- **Zones as columns** of whole pixels computed from the content width (320: 4 × 80 with no gap, 3 × 104 with 4
  between, 2 × 160): a 44 icon circle (home = presence tone, a zone = its own icon or the pin, away = the walking
  figure, unknown = a person outline in the dashed off ring), 12, an 11/600 uppercase label, 12, a stack of faces 44
  high. Two faces at most, overlapping by 8 with the card's 2 px ring, initials 13/600; three or more fold to one
  face and a "+N" disc of the same size (page fill, 13/600 secondary). No presence dots in a stack (the column says
  where) and no count row (the fold's number and the sub carry it). Card 228.
  Where nobody can be placed (every tracker out of reach) the places keep their columns, empty — home and the zones,
  asked for or the house's — beside the faces that cannot be placed (1.9: the card keeps its size).
- **Rows**: one a person — the 44 avatar with its presence dot, the name, where they are as the value ("Home",
  the zone's name, "Away · 26 km" only when distance is asked for and the fix is good, "Unknown").
- The **map** variant is Home Assistant's own map card on a plate (16 radius, 1.6:1 or square); it falls back to the
  columns in silence where the card helpers are missing.

## Several sensors (1.6)

- **The card**: up to three sensors on one card (a room's temperature and humidity). The head is the set's: the
  room's name, the trend glyph in the accent, the window.
- **The readouts**: one per sensor in equal columns, 32 apart with a 36 hairline in the middle of the gap, each centred
  in its column (its circle and its words as one, the words left inside). Each is the sensor's circle in its measure's
  tone, then its name (what it says beyond the head: "Temperature" under "Living room") over its value, at the medium
  readout where every value fits.
- **What gives way**, checked on every name at every step: the circles go before a name would end in an ellipsis; a
  readout without its circle carries its curve's key beside its name (a 12 × 2 line in the curve's ink, 8 after the
  name; none where no curve is drawn). Then the gap closes to 16. Then one line a readout: the name and its key at the
  start, the value at the end on the name's baseline, a hairline across between them. A name that still does not fit
  ends in an ellipsis before its key: the name gives way, its key never does (the key is its own part, never inside
  the name's box). A value never shrinks past the extra-small size, and never wraps.
  A sensor that is not there is named by the last word of its id ("sensor.bme280_humidity" reads "Humidity"), unless
  the config names it.
- **The chart**: one curve per sensor, each on its own scale (the units differ, so a line is read against its own
  readout), in its measure's tone. Fills are lighter (16 %) so no curve hides another. A tone that would repeat passes
  to the next spare one. How the curves are drawn, in the house's style or the card's: § Charts (1.11).
- **Two curves never share an ink (1.9):** two curves are never drawn in inks closer than the palette engine's own
  distance between graph series (ΔE2000 ≥ `GATES.graphSeparation`, 8) on the palette the card wears; a curve too close
  to an earlier one takes the first spare tone far enough (`seriesTones`), a curve with a colour of its own keeps it
  and the others keep away from it. `AccentSheet.inkOf(source)` says what a tone or a hex is drawn in; the tokens
  runtime exports `deltaE` and `GATES`.

- **Scrubbing**: every readout says that moment, written at its reading's precision while it stays in the reading's
  unit (the figure never grows under the finger; a moment in a larger unit, 1.23 kW under 505 W, keeps its own). When
  is a pill in the bubble's colours (the text's ink, the page's words) on the axis row, which is 20 tall for it, the
  hours centred in it; kept inside the axis's width, under the cursor, while the hours give way. Past 24 h it says the
  weekday too ("Tue 09:47"), as the single chart's bubble does. No bubble over the plot, so the scale's top is 12 below
  the chart's (the ink from 17.5). The cursor runs from the highest dot down, under the dots, and sits under the
  finger: the scrubbed box is the drawn width. The statistics are one sensor's, so they stay out.
- **The hours under a chart** (one sensor or several): the clock times at the window's quarters ending in "Now", as
  many as keep 12 between every two, measured in their language — five, else three, else the two ends; a window of
  days says its days ago at its start and middle, three, else the two ends.

## Camera (1.6)

- **The picture**: stills that refresh themselves (as quick as half a second), or Home Assistant's own stream
  (`camera_view: live`: its player, WebRTC, HLS or MJPEG as the camera offers). The stream is one element for the
  card's life: it plays while the card is on screen and for 45 s off it (a scroll past the card is not a reason to end
  a camera's session and open another: some cameras go away under that, issue #28), a hidden tab is left to Home
  Assistant's players, and it goes for good with the card or when the card changes its camera or goes back to stills.
  Where Home Assistant gives no player, or the player gives up, the card falls back to stills and asks again a minute
  later, then less often. In full screen the stream shows the whole picture.
- **The shape**: 16:9 by default, or 4:3, 3:2, 1:1, 2:1, 21:9, or the camera's own (read off its first frame). Its
  height lands on the 4 grid.
- **The fit**: the plate fills its shape (`cover`, cropping what overflows), or shows the whole picture
  (`contain`) on the screen's dark, as a player's bands are.
- **Sharpness**: a still is asked at the plate's width in device pixels (sharp, and no heavier than it needs to be).
  Frames under a second apart cut, as a video does: a fade would never finish.
- **While streaming**: no time pill. "Live" stays.
- **A low picture**: under 108 the time pill goes (the rounds would sit on it); "Live" at the top start and the rounds
  at the bottom end never share a column. The plate never goes under 68 (the rounds, 12 above and below).
- **The camera's own shape** is remembered once read, so the plate is laid out in it before the first frame, and
  checked against the first frame: a camera that changed its shape (another profile, turned upright) is taken and
  remembered anew, one reflow.
- **Over a contained picture's bands** (and full screen's) a pill keeps its shape with a light hairline round its wash.
- **Full screen** has the room a low plate lacks: its clock and its snapshot round are back, and its round says how
  to leave it (the close glyph, "Exit full screen").
- **"Live"** is as wide as its word in every language, never under 64, on one line, on the 4 grid.
- **A narrow plate gives way in order**: on a low plate (the rounds share its rows) the snapshot round goes before it
  would come within 8 of "Live"; then "Live" folds to its dot; on a taller plate the clock goes before it would come
  within 8 of "Live".
- **The rounds over the picture** are a light glass with a fixed dark glyph, alike in light and dark; a pointer's hover
  makes the glass a touch whiter, never the glyph.
- **The live dot** is one vivid red (#f0453a) in both modes, ringed in white at 55 %, so it reads on any picture and
  alone, folded. Full screen never folds it: the word is back with the room. A stale "Live" (no frame for a while)
  fades and is hidden from readers too.
- **The rows under the picture** (and the lock's and the alarm's) give their circles together where a name would get
  less than its 96 beside what ends its row — the value's words, a switch's 56, a chevron's 44; an age takes its short
  form ("21 d", "3 h", "12 min") where any row's full words would not fit, every age of the list alike. A row that
  cannot be read says its state's word, never an age — where the word would be cut, its dashed skin says it alone and
  the word is the row's label. A camera's rows are its history (1.10): each says when it last changed, as the time of
  day (its age once it is over half a day old), unless the row's `secondary` asks for another line — its state, its
  area, an attribute, a template, or none — which it then says as every list does (its shorter form where the row
  cannot hold it whole, read in full). A row's own `tone` or `color` shows on its circle; with neither, the circle
  stays neutral. A row with no `tap_action` of its own opens its entity's details, never the card's tap — the lock's,
  the alarm's and the entities card's rows alike.
- **Out of reach (1.9)**: unavailable, unknown or gone from the house, the camera keeps its head (the `ban` glyph where
  it is gone), its plate in its shape with the camera's glyph and why, and its rows.
- **Back on screen, and a stream that failed (1.9):** a card put back off screen stays out until the viewport says it
  is seen (`attached = false` on reconnect); a stream that played resets the retry wait to a minute (`streams` with
  `hasVideo`); a live card whose stream could not play says "Stream unavailable" where "Live" stood
  (`camera.stream_failed`; the dot the glass's own white; its dot alone where the words would not fit the plate, the
  words its label), the stills showing meanwhile.
- **One feed, one plate (1.10):** every camera picture — the camera card's, the printer's, each tile of the Cameras
  card — is one feed (`camera/feed.ts`) and, where it has pills and rounds, one plate (`camera/plate.ts`). The feed
  fetches stills only while its own plate is on screen and the tab is in front, one request at a time (one unanswered
  after 30 s no longer holds the next back), keeps the last frame through two failures and gives the plate its off skin
  at the third, holds the stream as one element for the plate's life and ends its session when the camera changes or
  the plate goes back to stills; a picture that changes with its job (a printer's preview) is fetched again only when it
  does. The plate gives way by the same rules at any width: under 100 high its rounds share "Live"'s rows and the first
  ones go before they would come within 8 of it, the last one stays, then "Live" folds to its dot; from 108 high the
  clock, where it is 8 clear of "Live". A tile holds one round (full screen), the camera card two (snapshot, full
  screen).

## Cameras (1.10)

- **What it is (#60, the reader's mockup):** several cameras at a glance — the head (the security camera's circle,
  "Cameras", "Live overview", a round `…` at its end), then a tile a camera. A tile is the camera's plate (the camera
  card's own, `renderPlate`) in the card's shape — "Live" at its top start, one light glass round at its bottom end
  (full screen, that tile's picture alone; on an iPhone, the camera's details) — and, 16 under it, a 44 row: its circle,
  its name (15/600) over its line (13/500, a 16 glyph beside it). No clock and no snapshot round on a tile: the camera
  card keeps those.
- **The circle:** the camera's own `icon`, else the one set for it in Home Assistant, else its area's icon, else
  Fluvy's camera — `iconOf` — neutral, as the mockup draws it, motion seen or not (the line's glyph and words say
  it); in the camera's own `tone` or `color` while its line says motion is seen, where it asks one; out of reach,
  `ban` on the dashed ring.
- **The line:** `auto` reads the camera's motion sensor (its own `motion`, else a motion, occupancy or presence binary
  sensor on the camera's device): the running figure "Motion detected", or the eye "No motion"; a sensor that cannot be
  read, or none, leaves it to the camera — wifi "Online" (idle), "Recording", "Streaming"; out of reach, `ban` "Offline"
  (unavailable) or the state's word. A live picture whose stream cannot play says so in their place, `ban` "Stream
  unavailable" ("No stream" where that would not hold, read in full): "Live" folds to its dot on a narrow tile, and the
  line is where it is seen; a live line keeps the room of those short words, so nothing moves when a stream fails.
  `motion` and `state` ask for one of them, `none` (or `show_status: false`) leaves the line out — the row stays 44, its
  name alone.
- **What gives way, every tile's together, in order:** first the lines' 16 glyphs (their words say it), so that the
  circles — the icons people choose for their cameras — stand at more widths; then the circles, where a name would get
  less than its 96 or a line's words (the longest it may say: a line that reads a sensor holds room for both its words,
  so nothing moves when someone walks by) would not hold whole beside one, the glyphs coming back where they then hold;
  then a line whose words still would not hold says its glyph alone, its words its label. At a phone's 360 column (tiles
  of 136) and a desktop's (152) the circles give way in most languages; tiles of about 165 to 200 keep their circles
  without the lines' glyphs (English from 168, German from 180); from about 180 in English and 200 in German the
  mockup's whole row stands.
- **Tiles a row (`columns`):** `auto` one under a 320 column, two from 320, as many tiles of 240 as fit up to four on a
  wide band, never more than the card has cameras; a count asked for is held where a tile would come under 120. Tiles
  are one width on whole pixels, 16 apart (8 for the pictures alone), what a third leaves under a pixel.
- **"Live" at a tile's width:** the camera card's rules — as wide as its word, never under 64; on a low plate (a tile)
  it folds to its dot where it would come within 8 of the round (`live + 12 + 8 + 44 + 12`): its dot on half a
  section's tiles (152, 172) and a phone's (136), its word from a 211 card and on a desktop's 152 tiles in English and
  German; faded while stale; "Stream unavailable" where a live tile's stream could not play.
- **Live pictures (`camera_view: live`, `max_live`):** the first `max_live` (four by default, twelve at most) of the
  cameras asked live stream, the others keep to stills; each tile is a feed of its own — stills only while that tile
  is on screen and the tab in front, its stream one element for its life.
- **The head's round** opens the cameras' sheet (its own chunk), "All cameras" to a reader: the card's title over how
  many cameras, a row a camera (an 80 × 44 thumbnail with the live dot, its name over its line, a chevron to its
  details), and at the head's end a switch "Live" that shows every camera live (up to `max_live`), or none, while the
  dashboard stays open — never written to the card; where the title would not hold beside it, the switch steps to a row
  of its own under the head. A card that streams none (`max_live: 0`) has no switch: it would do nothing. A
  `hold_action` on the card that runs takes the round instead, and the round says "More", as every card's round that
  runs the card's own. The head itself is a button only where the card's `tap_action` goes somewhere without an entity
  (a page, a URL, an action).
- **Half a section:** where the title would not hold whole beside the round, the round steps to a compact row "More"
  under the tiles (its circle by the rows' rule): a control never goes; the sub line goes before a word is cut.
- **Variants:** `grid` (the default); `list`, a row of 60 a camera — its thumbnail, its name over its line, a chevron
  (the chevron, then the thumbnail, give way where a name would get less than its 96); `compact`, the pictures alone,
  as many of 96 as fit (three from 320, up to six), "Live" and no round, each with its name under it (8 + 20).
- **Out of reach:** a tile keeps its plate in its shape with the camera's glyph and the word its line says ("Offline",
  or the state's word; the glyph alone on a plate too low for it), and its row with the `ban` circle and that word; the
  card wears the off skin only when every camera is out of reach. With no cameras: the head and the empty panel ("No
  cameras", or `empty_text`); `hide_empty` hides it.
- **Height:** declared from the config alone (`camerasHeight`): its cameras (listed; an area's as the house counts
  them in `house-heights.ts`, two where it is not there to say), rows of tiles of the card's shape at a 320 column,
  a row of 60 each in `list`. A row of tiles is level: one shape for every tile (the card's `aspect_ratio`); with
  `native`, every tile of a row takes the tallest of its cameras' own shapes (16:9 until a camera's first frame says),
  a portrait doorbell beside a 16:9 camera giving the row its shape, each picture filling it or held whole in it.

## Greeting (1.6)

- **It gives way in tiers, never cut**: 28 with the name; 22 where the name is long; the greeting alone (the avatar
  says who), at 28 again where it fits; at 22; and last, where even that would be cut (a phone's column at the largest
  sizes), the language's short hello ("Hello", "Hallo", "Ciao"). The date and the weather give way under it as before.
- **Whose greeting**: without a `person`, the signed-in user's person (name, picture, more-info); a `person` pins one.

## Dashboards (the panel's tab)

- Five templates as rows in one card: a created one is a row that opens (accent circle, its url as the sub, the bare
  chevron); a missing one carries its description as the sub and a small quiet button at its end ("Create", 36 tall,
  radius 12) — the row is the tap target, the button says what the tap does; while it is being made the sub says so
  and the row takes no second tap. Then one card of options per dashboard the house has, headed by the dashboard's
  own name: its views as rows (the first "Always", the others switches), each choice as a full chip row, the wall's
  rooms as chips that toggle, then the sidebar switch and *Recreate* in two taps (the armed row in the warning tone,
  "Cancels in 4 seconds"). The preview draws the template touched last.

## View tabs (1.5, the dashboard header's)

- Home Assistant's own tabs (`hui-root`'s `ha-tab-group`), restyled by marks on the root, never replaced: a tab is
  still Home Assistant's element, its tap and its keyboard are Home Assistant's.
- **Fluvy** (default): the dashboard's name first (20/600, −0.01em, 24 line; 12 after the bar's 12 padding — on the
  view's column, 24 in — and 12 before the tabs; it never shrinks for them, a long one ends in an ellipsis at 40 %), then the views as words 14/600 in the secondary ink, 12 a side; the open one in the text's ink with a
  2 px accent line at the header's foot exactly as wide as its name. No line under the others, no track.
- **Pills**: the room tabs' pill (36 tall, 16 a side, pill radius, the card fill with the hairline; the open one in
  the selected ink, no hairline), 8 apart, centred in the 56 bar. They are Home Assistant's elements, laid out by it
  at text + 32: the 4-grid rounding of Fluvy's own measured pills does not reach them (nothing blurs: the hairline is
  an inset shadow on whole pixels).
- **Content**: the name (an icon tab writes its `aria-label`), the icon (24, Home Assistant's size), or both (a 20
  icon, 8, the name). A view without an icon, asked for its icon, gets the one its name says in any of the ten
  languages (a mask of the fluvy set in the tab's ink, from an on-demand table); a name that says none keeps its words.
- **The dashboard's name** is a switch of its own in every style: before Home Assistant's own tabs too, and with
  hidden tabs the bar may hold the actions alone.
- **Hidden**: no tabs; the name (when shown) grows and the actions keep the bar's end.
- A phone (`.narrow`) drops the name; the row scrolls under the finger and fades 24 px only where it goes on — its
  start once scrolled, its end while there is more — and keeps 24 px at its end. Home Assistant's chevrons give way
  there; on a wide screen they stay (a mouse has no other way along the row).
- Never in the edit mode, a subview or a one-view dashboard (Home Assistant's own title stays), and never on a
  dashboard that does not wear the look.
- The panel's card: a header mock on the card fill with the hairline (radius 12, 56 tall), the four styles as option
  tiles with their glyphs, the content as filling chips, the name as a switch row; *Hidden* and *Original* (Home Assistant's own),
  with nothing more to choose, each say why in a hint (*Hidden*: where the automatic dashboards' chips under the
  greeting are switched on).

## The corner (1.5, the sidebar's head and the header)

- Three choices of the house's (or a person's own look): **Home Assistant's logo** — its house in its blue (#18BCF2,
  24 on the 24 grid) on the menu button, which keeps its tap (open and close the sidebar), the name at 16/600 with
  0.01em, as Fluvy's screenshots draw it; **dividers** — the 1 px hairline under the sidebar's head and under the
  header, or none; **the header** — a bar on the card's fill, or on the page's own colour (no bar); **the actions** —
  Home Assistant's four buttons, or its phone's one menu on every screen (it draws them; Fluvy asks for that render),
  its button drawn as Fluvy's "…". All four: the screenshots' corner.
- The sidebar takes them only where the look covers Home Assistant (its sheets fill on `<html>`'s marks and the
  theme); a dashboard's header wherever it wears the look (marks on its root). The edit mode keeps Home Assistant's.
- The panel's card draws the corner: the sidebar's head (at most 256) beside the header (never narrower than its
  actions; the dashboard's name in it only where it holds a word: not on a phone), each on its fill over a band of
  the page, the hairline under both when chosen, the frame above them; four switch rows; under "only dashboards" a
  hint says where the sidebar follows. The tabs card's preview shows the header's actions when the tabs are hidden
  (what the bar then holds); its name is the header's (20/600, an ellipsis at 40 %, all the room when hidden).

## Wall

- A wall is the dashboard alone: no sidebar, no header, the view padded by the tablet's safe area and, when the house
  asks, the wall mesh behind the cards. Nothing of Fluvy's is on it but the **corner**, the way out, a 44 square at
  the top right in one of two presentations the house chooses. The **button** (the default — nobody is locked in a
  wall): a 32 disc on the card's fill at 88 %, hairline and the knob's drop (it floats over whatever the dashboard has
  in its corner), the × glyph 16 in the secondary ink; it is there when the wall comes (6 s) and while someone is (a
  touch, a pointer that moves, a key; 4 s after the last), fades in 200 ms and takes no touch while away — the tap
  that brings it back is the dashboard's, the next one leaves. A tap takes the device out of the wall and a **toast**
  at the foot says "Wall mode off" with "Back to the wall" for 8 s. The **hold**: invisible until pressed; a hold
  fills a 2 px ring (radius 18, the accent, its track at 20 %) over a second and a half and the tablet taps back once
  — letting go before cancels; it pauses the wall, and the toast says "Wall paused" with "Resume" for as long as the
  pause lasts. The toast: 44 tall, card fill, hairline and lift, radius 12, its words 14/600 and a 32 accent button.
  The corner's, the toast's and the way back's words are the core's (`wall`): a wall that never opened the settings
  panel speaks them in every language.
- **The way back from a subview** (1.6): the wall has no header, so Home Assistant's back arrow goes with it. The house
  chooses between two ways back:
  - **The button** (the default): the corner's disc grown into a pill at the top left, on the corner's line. It is 32
    tall in a 44 target, 6 from the edges, on the card's fill at 88 % with the hairline and the knob's drop. It holds
    a 20 chevron in the secondary ink, 4, then the view's title at 14/600, which ends in an ellipsis at half the
    screen. It is there for as long as the subview is: navigation is never hidden. The view keeps the pill's 44 above
    its cards, and a tap is Home Assistant's own way back (`back_path`, else its history).
  - **Home Assistant's header**, in subviews only, with the corner moved under it.
- The **screensaver** is a modal in the top layer: the wall mesh (or black), the digital clock in its hero size with
  the date under it in a 480 column, centred; dimmed, the clock is white at 60 %. It fades in over 320 ms and out over
  200; the touch that wakes it reaches nothing under it. At night the wall may lay a black veil at 20, 40 or 60 % over
  the page while awake.
- The panel's Wall tab: *This device* (the wall switch and the address with a copy button), *Wall dashboards* (the
  Scope list's idiom), *Screen* (the minutes as chips — five, in two rows on a phone —, two switch rows, a row
  whose button shows the screensaver itself over the page until a tap, and the motion sensor as a dropdown of every
  one the house has, its room as the hint), *Day and night* (four option tiles in 2 × 2 with a value line each, two
  time fields for the hours, the veil's share as chips), *Background* (two chips) and a preview of the clock over
  two tiles on the background chosen — in the night's tokens, under the night's veil, when the settings would make
  it night now. Its chip rows are written for a phone of 320 at least, in every language (a word that would not fit
  a chip there takes a shorter one). Every wall control edits the latest wall (`editWall`): two taps before a render never lose the
  first.

## Size (a device's, 1.5)

- A tablet across the room reads larger: 90, 100, 110, 125 or 150 % — the device's own, like the wall switch
  (`?zoom=125`, or *This device · Size* on the Preferences tab and the Wall tab's device card: five chips in one row,
  three over two on a phone).
  It is CSS `zoom` on the dashboard's view alone: the cards, their type and their controls scale together and the
  layout follows (a column that held three cards holds two); every rule of ours is written in the view's own pixels,
  so nothing is laid out twice.
- What does not scale: Home Assistant's header and sidebar, its dialogs, and the edit mode (a dashboard is edited at
  the size it is laid out in). A card's own dialog (the keypad) and a menu in the top layer scale with the view and
  are placed in its pixels.
- A gesture under zoom is read in the control's pixels: a drag travels by the control's own length (`trackDrag`'s
  `dx`, `localPoint`), a tap or a scrub by its fraction of the box. At the same column width the size never makes a
  new ellipsis; a bigger size makes a phone's column narrower (two thirds of it at 150 %), and the cards then give way
  as they do in any narrow column, by their own rules.
- The header's dashboard name follows the view's column at every size (its margin is the view's 24 grown with the
  size, less the bar's 12). A hairline inside the view is drawn at the size too: at 110 or 125 % it can straddle two
  device pixels — a known softness of a scaled page, the price of one layout for every size.
- An appliance's whole card is 376 at a 360 column for every big kind (Home Assistant's six grid rows) in every state
  and whatever of its kind's rows it has, so a row of them on a dashboard ends level whatever each holds. What it draws
  beyond the slot — a hob of five plates (two rows), a fridge of three compartments, its compartments' steppers, the
  quick modes, buttons and programmes asked for — its declared height says, read from the house
  (`applianceHouseHeight`, the appliances chunk's, which the automatic dashboard reads through `house-heights.ts`: its
  kind from its device, a second drum's line under a compact or dial hero, the rows
  its plates, chips and tiles take by their words); without the house, the family's from the config alone. The
  appliances card's whole cards are each theirs, one a row 16 apart.

## Palettes that travel

- Two more gallery lines after Electric: *Yours* (the house's saved palettes) and *Community* (the shipped ones, six
  shown and a "Show all (n)" chip), each swatch titled by its file with "by <author>" under the name (11/500,
  secondary, 16 line); the Custom entry is active only when the draft equals none of them. The *Share* card follows
  the custom editor: two labelled text fields (title, author) in a pair, the pair "Share this palette" (disabled until
  a title) | "Import a palette", and for an administrator one row — save (accent circle) or remove (its title as the
  sub) — or the reason there is no room.

## Energy (1.4, approved 2026-09-30 after four judge rounds)

**One colour rule.** A lane is coloured by where its energy came from: the sun's surplus going to the grid is gold,
the grid charging a battery is lilac, a battery selling to the grid is green. Destinations — the house, its
consumers — are ink (`--fluvy-text` at 62 % over the card). Figures and words are never coloured; the direction lives
in the unit slot, in the secondary ink ("0.4 kW out", "0.6 kW charging"). *In / out* is said of the grid only; a
battery or a car is *charging / discharging* (*charged / discharged* over a period, in kWh). A meter that cannot know
where its energy came from (a phase, a signed gauge) uses the grid's colour both ways. Head icons use the accent (the
lilac `energy-home` tone no longer marks a head), but the energy card's: it wears its line's tone (below).

**The house.** A 44 neutral disc; its supply as 3 px arcs at r 26.5 (outer edge 28), one per origin, in the order
sun · battery · generator · car · grid, 4 px apart; they slide to a new mix in 700 ms (the one dash animation,
declared). Nothing is estimated: when a source cannot be read and the house has no meter of its own, the house reads
"—" and the arcs rest.

**Lanes and arrowheads.** A lane is 6 px, its origin's ink at 40 % over the card, round caps. Its arrowhead is a
solid triangle 9 long and 11 wide, its corners rounded by its own 1.5 px stroke (the vertex at −0.75 so the tip is
the true end): the head's tip IS the lane's end, 6 px off what it reaches, and the lane stops 7 px before the tip
(split by de Casteljau), so its round cap ends inside the head and nothing shows past it. Legs and rail: a 2.5 px
lane with a 6 × 7 head, trimmed 5. A lane that reverses (a battery, a car, the grid) draws a body and a head for each
way and crossfades them — and its colour — in 400 ms.

**States.** At rest (below the source's threshold, 10 W by default): the lane at 50 %, its head at 35 %, no pulse,
the node's circle neutral, its figure in the secondary ink. Stale (no reading for 10 minutes): everything rests, the
arcs at 50 %, the sub says "Updated 12 min ago", no badge. Unreadable: a 1 px dashed hairline with no head, the node
a dashed ring, its figure "—", the sub "Grid · unavailable · since 19:47" (in segments, on every energy card: the time
leaves whole first), the badge "Unavailable". Nothing is taken away in any state, so nothing reshuffles.

**Rows (the default).** Sources stacked on the left, one pitch (80) apart from TOP 42 (one pitch under the head's
icon centre); words centred on their circle (lines 16 · 20 · 20); every lane leaves 12 px after the widest words of
the column (measured) and meets the house's ring (34 = 28 + 6) at a slot: 20 px of arc between neighbours (lane 6 +
head 8 + 6 clear); a grid that can import and export at once (read per phase, or by two sensors) is a pair of
parallel lanes 16 px apart, its second lane shown only while it does both; the window is 90° above the house's left
point and 48° below it (its words hang there); when the slots cannot fit, a pair shares one contact; a pair level
with the house arrives level at ±8. A lane shorter than 56 px is no lane: the card lists its nodes (the direction
drops to its own line only when its line would not fit, and then every line of that node does; a label keeps its
first segment — "Battery · 62 %" → "Battery"); below Home Assistant's own minimum the rows drop their circles.
Consumers (≥ 560 of content) mirror the sources on the right, the house in the middle, their lanes in ink; narrower,
they are rows with ink bars, "64 % of the house", and the rest of the house as its own row.

**Cross.** Home Assistant's arrangement: sun above, grid left, house right, battery below, mirror-symmetric about the
middle of the grid and the house; diagonals leave at ±45° and arrive radially with one pull (44). Each source's lane
into the house is always there (at rest when idle); the lanes between sources (sun → grid, sun → battery,
grid ↔ battery) appear only while they carry energy. The grid → house lane bridges the sun → battery lane: it is
drawn over it with a 12 px card-coloured edge, and its pulses travel over the other's.

**Motion.** Pulses are comets (a 26 × 6 capsule, its head the lane's cap in full ink, its tail fading into the lane)
carried by the Web Animations API — transform and opacity only, the lane sampled once — at a constant pace in px/s:
24 → 72 px/s as the flow's share of the house's peak (`max_power`, 6 kW by default; square root, so a trickle still
moves), one pulse under 1 kW, two under 3 kW, three above, one more per 140 px of lane, eight on a card at most
(the strongest flows first). A new reading retunes the pace without moving a pulse (`updatePlaybackRate`); a lane
that changes its way or colour fades its pulses out and the new ones in (400 ms). Off screen and in a hidden tab
every pulse pauses. `motion: calm` keeps one slower pulse a lane; `off` and reduced motion keep none (the lanes and
heads stay). A figure animates only when its text changes.

**Legends and blocks.** Distribution's idiom: a 12 px bar of segments with 2 px gaps and 6 px end radii; 12 × 12
squares, the name 14/500 and the figure 16/600 under it, in equal centred columns — measured: when a name does not
fit its column, or two neighbours' names would stand closer than 8, the row folds (four into two by two, three or
fewer into one a line). A block is its LABEL (11/600
caps) and total on one 20 px line, the bar 8 under, the legend 12 under that.

**Phases.** A row per phase: its name (and voltage) in 40, a bar centred on zero in the grid's colour both ways
(out to the left, in to the right, a 2 × 16 zero mark), the figure in 96 on the right; the axis "← out · in →" under
them.

**Sankey.** One px-per-kWh scale for every bar and ribbon (true proportions); rows Grid · Battery · Solar → House ·
Charged · Exported, so no ribbon crosses another; the house's own ribbons leave 56 px under its bar, under its words,
at 24 %; labels packed by their measured width (at the bar's start, else its end, else a second tier), 16 px apart.

**Glyphs.** `tower` is the grid in every state (the head keeps the bolt), `generator` a fuel can, `swap` two opposed
arrows (the balance), `oven`.

**Honest figures (2026-10-01).** A group's state of charge is weighted by capacity, so batteries that do not all state
theirs have no group charge ("—", the ruler asleep), and a group whose batteries go opposite ways has no "full in"
or "empty in": at those powers it never gets there. A row of a meter that cannot be read at all is the unavailable
row (the dashed ring, "Unavailable" opening its line); a state after "·" is lower case. A signed meter that is not
power (a temperature) has no default badge: "Active" is not a state of −4.2 °C. One precision runs through a row of
figures ("1.0 kW out" beside "2.2 kW out"). Out of reach (1.9), a group keeps the time it last showed beside its
charge, "—" in it ("Full in —" when the card opens so), and a source the balance cannot read at all is listed once,
among what comes in.

**Modes.** An option Home Assistant does not translate is worded, never shown as an id ("pv" → "PV", "minpv" →
"Min PV"); a mode with no meaning to say puts its name on the tile's value line, so the values share a baseline. A
chip chosen in half a column takes the same tone as its tile (the sun's for a solar mode).

**Stacks of arrays.** Four steps of the ink (100 · 45 · 72 · 30); the forecast of a stack is hollow (a 1.5 px outline
at 45 %), so no array is mistaken for hours to come. A legend of arrays folds by the legend rule, names and figures
measured.

**By source (1.5).** The house's power today: its use stacked by origin above the line (the sun first, the grid
last); under the line, from it down, what went into the battery (the battery's ink) and out to the grid (the grid's
ink), both at 60 % — Home Assistant's "Power sources" convention, where a sink sits below zero. Drawn from the power
sensors' five-minute means when the Energy dashboard names one for every source (as Home Assistant draws its own
graph), else from the meters in 15-minute blocks (30 or 60 when their step — 0.1 kWh — would show as a saw-tooth); a bucket without the grid or the battery is a gap (the curve
stops, the cursor reads "—"), never a zero. "Right now" is the house's own use, allocated live as the flow card does.
Its scale and gridlines are the whole house's (below); scrubbed, its legend gives each origin's power at that moment,
one unit for the row, as the whole house's does.

**The whole house (1.6).** Home Assistant's "Power sources" convention, kept whole:
- **Above the line**, every source's power stacked from the line up: the sun's whole production first, then the
  battery's discharge, a generator, a car, the grid's import.
- **Below it**, from the line down, the battery's charge, a car's and the export, at 60 %.
- **The house's use** is a 2 px line in the text's ink, under the bands' edges: each band keeps its own edge in its
  colour, so where the house uses everything the sources give, the top of the stack is the top band's colour, not the
  house's ink (issue #49 read the house's line at the top of the stack as the battery's).
- **The batteries' charge** is dashed (2 px, true 4 · 4, butt ends) in the battery's ink on its own scale: 100 % on
  the tag's line (28 under the chart's top: the power's top tick), read on its own scale at the end (below), or by a
  "100 %" tag at the top right (untracked) where that scale has folded, 0 % on the kW zero line, which is
  the chart's foot when nothing left the house: the charge always lives in the positive half, and only the areas of
  what went out are drawn under the line (1.7, issue #28). A 4 px
  card-coloured edge under it lets it read over the areas it crosses. Each run is laid out a whole number of dashes
  long, starting and ending on one, so a gap reads as two ends.
- **The scales (1.9, issue #49)**, on both stacked charts, the history bars' look (`energy/axes.ts`):
  - **The power's**, at the plot's start: the history bars' nice ticks (Heckbert's 1 · 2 · 2.5 · 5, four intervals
    at most, zero always a tick) over the day's highest stack and its deepest outflow, in W below a kilowatt and kW
    above (the power the chart draws, never kWh, from the meters too); 11/500 in the secondary ink, 8 from the plot (the
    hours under the plot with them: a scale reads in one ink), right-aligned, a true minus below the line; the unit
    rotated in a 16 column at the card's edge. The top tick sits on the tag's line (28), the lowest on the foot.
  - **The charge's**, at the card's end, right-aligned on its edge, 8 from the plot: 0 % on the zero line, 100 % on the
    top tick, labelled on the power's own gridlines — 0 · 25 · 50 · 75 · 100 % on four lines above zero, 0 · 50 ·
    100 % on two, 0 · 100 % on one; a positive half of three lines gets a fourth on top so the charge never reads 33 %;
    that fourth is one of the four intervals, so where a tick below zero leaves it no room the scale takes the next step
    (−5 … 15 is −10 … 20). Only where the charge's line is drawn.
  - **The gridlines**: a dashed hairline (`--fluvy-border`, 3 · 3, on the pixel grid) across the plot at every tick but
    zero; zero is the plot's baseline, a solid hairline in the strong border, always drawn under a scale.
  - **Where they fit**: the plot keeps 200 with both scales and 120 with the power's alone. The charge's folds first,
    into its readout and the "100 %" tag; then the power's; the gridlines stay across the whole width. The hours sit
    under the plot, each centred on its hour where the scales leave it the room (else flush with the card's edge), five
    where they keep 12 apart so placed, else three.
  - **Under a scale** the tag under the line goes: the scale's negative ticks and the legend say what is below.
  - `show_axis` and `show_grid` (both on): with both off, the chart is 1.6's, on the day's own extremes, with its tags.
- **Stacked or not.** The sources stack from the line up (the default): the battery's band starts where the sun's
  ends, so its top is the two added. `stack: false` draws every band from zero on its own, seen through (its ink at
  24 % over nothing, so two bands that overlap both read), the house's line over them as before.
- **Line width.** `line_width: thin` draws the bands' edges, the house's line and the charge's dashes 1 px (its card
  edge 3), and a lone curve's line; `regular` (2 px) is the default.
- **The tags** are never crossed by a line: the house's line, the charge and the cursor give way round each tag's box
  (4 round), in every stacked energy chart; the areas pass under the tag's text halo; the dots are drawn over the tags,
  never under their words. The tag under the line sits at the chart's start, or at its end where the charge crosses
  the start; where it crosses both, there is no tag (the legend names the areas).
- **The cursor** starts under the tag row (16 + 4), in every stacked energy chart. At "now" the house's dot is its
  ring; the charge's is a small solid dot (r 3) in the battery's ink with a 1.5 card edge, drawn over the ring, so it
  reads cleanly beside it, on its rim or inside it. While the chart is read, each band's edge at the cursor has a dot
  of the same idiom in its own ink (stacked, the stack's height through it; unstacked, its own value), but where the
  house's ring already is — so the sun's 5.6 kW reads under the battery's top at 9.8. Where the charge's dot would cover
  a band's (its centre within the charge's 4.5), the band's is the house's ring in its own ink (r 5, 2 px, the card
  inside) round the charge's dot, so both read (issue #49 at 11:57: the sun's 5.6 kW under a 56 % charge).
- **The pointer** reads the plot: over a scale it reads the plot's end beside it.
- **The foot**: the scale ends a pixel above the chart's foot, so the lowest area's 2 px edge is drawn whole.
- **The top row** is "Right now" (the house) with the charge now as its side readout. Each readout carries the key of
  its line beside its label, on the side away from the column it is aligned to: after a label on the column's start,
  before one on its end. So the words stay on the column (a 12 × 2 line; 12 × 2 dashes, 4 · 4 · 4). With no live
  power for the house (meters only), the chart ends on the last bucket whose meters have closed (an open one reads
  low, so it is not drawn), and that is the moment the row reads at rest: its time as the label ("21:15"), its power,
  the house's key, the charge then; the cursor and its ring sit there, on the line's end (a bucket's point sits at its
  middle, so it has closed half a bucket after it). The row is always there: with nothing to read yet (the Energy
  dashboard still loading, no data), "Right now" reads "—", so the row never comes and goes over the chart. The
  house by source reads a house with meters only the same way, so its height never changes under the finger.
- **Scrubbing** stops at the chart's end (now, or the last closed bucket) and the cursor sits on the bucket it reads,
  so its ring is always on the line; across a gap it reads "—".
- **The day axis** writes its five hours where they keep 12 apart in the chart's width, else three (00:00 · 12:00 ·
  24:00), as the sensor chart thins its own.
- **The title**: "House power" where it fits beside its round, else "House" (each language its short one).
- **The legend** is a square per area drawn. At rest it gives the day's energy (from the power's integral, or from the
  meters' hours as the Energy dashboard allocates them). Scrubbed, it gives each flow's power at that moment, one unit
  and one precision for the row; the readouts read that moment too ("12:30 · 522 W", "Battery 77 %").
- **Gaps**: a gap stops every series, and a charge that cannot be known (two batteries without their capacity) is
  "—" with no line.

**The line's tone (1.11.1).** The energy card's line and its head wear one tone: the card's own (`tone`, `color`),
else the tone of what the line shows, read from the Energy dashboard's settings — a source's sensor (its power or its
meter) that source's (the sun's, the grid's, a battery's, a generator's, a car's), an individual device's the house's
(`energy-home`), any other sensor the accent, as the Chart card's lone series. Never from a reading: a curve keeps its
colour whatever it says, and is the accent until the settings are read. Every one is a colour of the palette — on a
lime palette a grid's power is its slate grid, never the sun's amber, the card's tone before 1.11.1 whatever it drew.
The stacked charts keep the accent in the head: each band is its own source's colour. A meter that reads negative
while it imports is read the other way round (`invert`, the flow's rule): its "Right now" and its curve are what comes
in. A legend item of a meter that keeps counting reads its day with `period: today` — the statistics' change since the
house's midnight (a followed picker's range), "7.5 kWh" where its state says "12.5 MWh" — and "—" until it is read.

**Empty.** An energy card's empty panel sits 16 under its head and says what is missing in one line ("No batteries
yet"), with how to fix it as the hint under it ("Add them here, or give the Energy dashboard its batteries").

**Out of reach (1.9).** The energy card whose sensor is unavailable, unknown or missing keeps its anatomy and its size:
the head (the missing one says "Entity not found" under its name), "Right now —", the chart's room (its history where
the recorder has it, else "No history yet" in the same 120), the hours and the legend. A missing sensor's cost row is
measured at the widest a house says (10 kW), as a curve's widest figures are measured otherwise.

**Modes and the sankey in a narrow column (1.9).** An energy device's modes (the batteries' and the charger's) are
option tiles only while every name holds its cell (`optionsHold`, as the thermostat's modes); else the chips, which
never cut a word. The sankey in half a column (under 200): a tier holds its words at the column's start and at its end
only — the end first for a bar in the right half — so the words stand in two columns in their bars' order, instead of
a start per bar (five columns of words where the eye reads two). A device gone from the house keeps the room of the name
it had (the friendly name the page last read, or the registry's), so its labels keep their tiers; only a name that is
the id's alone takes no more than its figure's room and ends in its ellipsis there.

**Following a date picker (1.11, #62).** An energy card given a `collection_key` follows that picker's range and
draws Home Assistant's own figures for it: the statistics Home Assistant fetched once for the whole view, allocated as
the Energy dashboard allocates them, so a Fluvy card and Home Assistant's beside it say the same numbers and move
together. Its Day · Week · Month chips are gone (the picker is the control) and its subtitle says the range in the
house's words: "Today", "Yesterday", a date ("24 Oct"), a span ("17 – 23 Sep", "17 Sep – 3 Oct"), a whole month
("September"), a whole year ("2026") — the year only when it is not this one; a week is Home Assistant's calendar
week. A day card (Production, Water & gas) draws the range's last day and says its date. Until the picker's
collection exists the card draws today without chips, at the height it declared: a follower's height is the chip-less
one whatever `show_period` says. The Grid card, a live card, leads its subtitle with the range while its totals follow
one (the last segment to go when the column is narrow). The Energy card over more than a day labels its axis with the
range's first, middle and last dates (the two ends where three do not hold) and its readouts with the moment's date
and time.

## Energy period (1.11)

The Energy period card (#62) is the Energy dashboard's date picker as a strip: it drives an Energy date picker's
collection — the dashboard's own (`energy_<its url>`) unless `collection_key` names another — so Home Assistant's
energy cards and Fluvy's that follow it move together. Where no picker holds the key it has Home Assistant make its
own date card, hidden inside the strip, so the collection is made and fed by Home Assistant's code.

- **The strip.** The Energy dashboard's date picker as one row: ‹ the span › in one capsule on the inset fill (the
  steps 44 round its ends, the span's words 14/600 between them, centred; the capsule takes the row up to 360, on its
  start), then the Today pill (14/600, its words and 16 a side) and, asked for, Compare (a pill, `aria-pressed`).
  Today shows only away from today, in the tone's fill (the pages' "a day away from today"): on today the capsule says
  it, and its room is the capsule's; Compare takes the tone's fill while on. A row of 44 in the card's 20 (84).
  `compact`: the capsule alone, 36 tall in 12 (60), its words 13/600, its parts a finger's 44 reaching 4 past it.
  `stacked`: the row, then 8 under it the chips of its grains, filled (Day · Week · Month · Year — custom is the
  sheet's), the span's grain lit, no wider than the capsule (136). Where the four do not hold one line (half a
  section) they keep it and scroll, content-sized, the tab rows' fades at a side with more behind it and the span's
  grain brought into view: the strip is 136 at every width.
- **What gives way** (measured, never a width threshold): Compare's words for its glyph (bars), Today's for its glyph
  (the clock), the span's short words ("24 Oct", "Sep", "Sep 25" for another year, "2026", a span's two dates in
  figures), Today, Compare, and last the arrows — the span's words alone, the long ones where they hold. The sheet
  behind the words has all of them.
- **The sheet** (the cameras' modal bottom sheet, in the card's chunk): "Energy period" over "What this view's energy
  cards show"; ‹ the span (15/600, centred, wrapping at its words) ›, the quiet rounds, › off at today; the presets
  of its periods as filled chips (Today · Yesterday · This week · This month · This year · Custom; the span's own
  lit, Custom while the grid shows); for Custom the pages' date grid in whole days — no hours, no presets of its
  own (the sheet's are over it) — and Show; Compare as a switch row where the card offers it; Close. A preset picks
  and closes; the arrows walk and keep it open; Show picks the grid's days and closes. ‹ › walk the span by its own
  grain (a day, a week from the house's first weekday, a month, a year), as Home Assistant's picker walks it, never
  past today.
- **Following the collection.** The strip draws the span the collection holds now (it moves at once, the figures
  follow), today while the collection is being made, and "Only on a dashboard" (13/500, the secondary ink, centred
  across the capsule, wrapping at its words) where no dashboard is there to make one, every button off, at its size.
  Home Assistant's date card on the same view moves it, and it moves that one; a preset is remembered where Home
  Assistant remembers its own.
- **On the automatic Energy dashboard** the strip leads the Today view, across its columns before the first, and the
  day's flow, sankey, score and balance follow it, their chips gone.
- Its chunk is its own (`energy-period`, with the Energy usage card): every page carries only their names and
  heights (`energy-family.ts`).

## Energy usage (1.11)

The Energy usage card (#62) is Home Assistant's energy usage graph in the house's idiom, from the Energy dashboard's
statistics allocated bucket by bucket (an hour, a day, a month: Home Assistant's grain for the range) as the dashboard
allocates them, so its figures are Home Assistant's.

- **The chart.** A column a slot — an hour of a day, a day of a week or a month, a month of a year (Home Assistant's
  own grain for the range) — stacked from the zero line up by where the house took it from (the sun at the foot, the
  battery, the grid on top) and down by what went into the battery and out to the grid, each part in its source's
  energy ink (`--fluvy-state-energy-*`; a person's `color` over it, a colour of the palette's by its token); what went
  out is the same ink at 60 %. One column a slot, its parts flush, only its outermost end on each side of the line
  rounded — whatever the house says of a bar's ends, which is about single bars (the chart engine's columns in every
  style: `classic` in the inks, `soft` each part at 72 % of its ink over the card; `columns` would be classic's look
  under a second name, so it is not offered, and a card that names it draws classic). The scale hugs the
  columns: of the nice steps (1 · 2 · 2.5 · 5 × 10ⁿ), the one whose outermost tick on each side (the first multiple at
  or beyond that side's extreme) spans the least, three to five ticks in all, the more where two span alike — a week
  rising to 18 and falling to 9 reads −10 · 0 · 10 · 20; the unit rotated beside its ticks, the gridlines the
  style's. The plot 160 (compact 96, the mini strip 48) with 12 over it for the top tick and 8 under it; the axis 8
  under, 16 tall, starting where the plot does: a day's hours at 0 · 6 · 12 · 18 · 24 (0 · 12 · 24, or its ends,
  where they do not stand 12 apart), else a label centred under each column — a week's days by name (their initials
  where a name does not hold its column), a longer run of days by number, the months by name — every n-th from the
  first where they would crowd, kept inside the plot, never fewer than two: the first and the middle (Jan · Jul) at
  the most, else the ends (Jan · Dec; the months' initials where even those would not stand 12 apart).
- **What it says.** The head's badge is what the house used over the range (it gives way first in a narrow head; the
  title "Energy usage" takes its short word, "Usage", where it would be cut). The legend (the energy family's: the
  square, the name 14/500, the figure 16/600 under it) lists the sources drawn and what went out (Charged, Exported,
  their squares at 60 %), each with its total; it keeps the rows the card declares for its sources even where the
  house lacks one of them. "Other" (the house's ink) folds the last sources past `max_sources`, two at least.
- **Reading it.** A pointer, or a finger held on the chart, reads the slot under it; ← → walk the slots (Shift five),
  Home and End its ends, Escape lets go. The bubble (the text's ink, the page's words, radius 10, 8 · 12 padding,
  lines of 18): the slot's time ("13:00 – 14:00", "Mon, Sep 14", "September 2026") and what the house used in it,
  13/600; then each part of the stack from its top down and what went out from the line down, 12/500, an 8 square in
  its ink; then the same slot of the period before. Beside the cursor where it holds, else on its other side, inside
  the card — it may rise over the head, never past the card. In a card too narrow for its lines (half a section) it
  leans up to 16 into the card's padding (4 short of its edge, as it rises 4 short of its top), the time stands over
  its total, the parts' figures go bare (their unit said once, by the total, as the scale says it beside its ticks),
  and a line that still does not hold puts its figure under its words, at the end.
- **The period before.** `compare` (or a followed picker's Compare) draws it as one quiet column a slot behind the
  bars — what the house used up, what went out down — 1.8 × the bar's width (never wider than its slot less 2), the
  text's ink at 9 % (14 in dark mode), the bars' ends; the scale reaches it.
- **Nothing to draw.** A range with nothing recorded keeps the chart, its zero line and its legend of zeros, "Nothing
  recorded for this period yet" across the plot (13/500, secondary). No Energy dashboard, or statistics that cannot be
  read: the energy family's panel (in the mini strip its words alone, at the strip's height).
- **Heights.** Full = 100 + the chips 60 (not while following, `show_period`) + 180 (the plot and its 20) + 24 (the
  axis) + the legend: 16 and its rows (`legendRows` of its names in a 360 card's 320, 40 each, 12 between) — 412 for
  the Energy dashboard's three sources and their two returns, 472 with the chips; compact 240; mini 168. Half a
  section holds compact, mini and the full chart without its chips and legend at every width.

## History bars (1.8)

A sensor's last days, weeks or months as bars from Home Assistant's long-term statistics (issue #38's mock-up,
matched by default; every element the person's).

- **The data**, by what the sensor is and what a bar shows (`stat`). A meter's change as Home Assistant counts it
  and a measurement's mean, highest and lowest are its long-term rows: one `recorder/statistics_during_period` per
  sensor, window, way of reading, unit and hour, shared by every card of that sensor for five minutes. A counter that
  starts again on a cycle (`reset: day | week | month | year`; unset, it is counted as Home Assistant does), a lifetime
  meter (`never`), a reading at the end (`stat: state`) and a counter's extremes come from its **readings** (see
  History bars readings); a sensor with no state class, a measurement's reading or change, or `source: history`, from
  the recorder's **history** (every state since a step before the window, no attributes, reduced at once). Buckets
  are counted on the house's calendar (a day from the midnight Home Assistant shows, a week from its Monday, a month
  from its first; a 25-hour day is one bucket) and a row belongs to the bucket its `start` falls in, never to its
  position. **A bucket before the sensor's first statistic is empty** (a stub; "—" under the pointer), a meter's
  bucket after it with no row gained nothing, a measurement's has no bar. With no statistics the card says "No
  statistics yet" and how they come; read from the history, "No history yet". A read that fails is never kept: the
  bars on screen stay, and with none the card says "Couldn't read the recorder · Asking again in a minute" and asks
  again a minute on. The card has a clock (the shared ticker: never off screen, in a hidden tab or under a test's
  `_now`): it asks again a minute after the hour turns (Home Assistant compiles an hour ten seconds into the next)
  and when the window rolls at midnight, for a sensor whose state never changes too. The bucket in progress is drawn
  only when asked (`include_today`) and is **live** on every state change, with no question to the recorder; a
  sensor unavailable now keeps the compiled value. A scalable unit scales up by a typical bar — the middle of the
  finished bars that have something in them, by size (the bar in progress where none has) — so a Wh meter reads in kWh
  and Home Assistant's spike (a restart's whole reading counted again) reads in the days' unit ("18,280.2 kWh"), never
  writing them "0.0 MWh"; never down; `unit` converts within energy, power, volume and distance (the live reading and
  the history with it) and is ignored otherwise, the editor says so. Caps: 92 days, 52 weeks, 24 months. A sensor that
  is no longer in the house is asked as the recorder keeps it (its unit and whether it counts or measures,
  `recorder/get_statistics_metadata`), its card kept in the off skin; one the recorder knows nothing of shows the empty
  panel in the chart's place.
- **The head**: the icon circle, the name, "Last 7 days" (with "· Today" when the running day is drawn; an
  unavailable sensor opens the line with its state and keeps its history). The readouts (`head`, the total and the
  average by default; a measurement's average and highest) sit beside the title, right-aligned, a hairline between
  them, **only on a column of 440 or more where nothing of the head gives way for them**; on a phone they take their
  own row under the head (44), left-aligned with the hairline, folded into equal centred columns where even that row
  would not hold them in a line. Under the pointer they become one readout — the bar's date and its value — and come
  back when it leaves.
- **The chart**: a 120 plot (80 compact) over a nice scale (Heckbert's 1 · 2 · 2.5 · 5: the smallest step whose whole
  ticks hold both ends in four intervals at most — a signed scale widened to its ticks takes the next step rather than a
  fifth; zero always a tick), dashed `--fluvy-border` gridlines across, the ticks 11/500 in the secondary ink (as the
  dates: a scale is read, 4.5:1 and more), the unit rotated beside them (one look with the energy card's charts:
  `energy/axes.ts`, classes `ax-grid`, `ax-tick`, `ax-unit`);
  bars 40 % of their slot (2–40), rounded at the top only (4) and flat on the zero line (a bar that hangs is rounded at its foot), a pastel of the card's tone — the ink at 60 % over the card at the top, 48 % at the foot, negative bars hanging from zero, a bucket with nothing a quiet 2 px stub;
  the bar in progress lighter (its fill at 50 %), edged with a dashed line of its ink (1 px, 3 · 2): it is still
  growing; the bars below zero and the one in progress may wear colours of their own (`negative_color`,
  `current_color`, each with its own gradient; the card's by default);
  the values 12/500 in the text's ink, 4 above the bars, **all or none** (none where one would not hold its slot: thirty days write none); the dates (12/500, secondary ink) thinned to every n-th bar so neighbours keep 12 apart, the last bar always read, a label kept inside the plot at the ends.
  Bars grow in with an 18 ms stagger. Scrubbing lights the bar under the pointer and quiets the rest to 40 %; ← →
  Home End Escape walk the bars from the keyboard.
  The scrub reads the bar in progress by its word ("Today · 33.3 kWh"). Without a head (`show_head: false`) the
  chart is the card's button: a still tap (under 8 px of travel and 500 ms) runs its `tap_action`, Enter and Space
  too; a press that travels or holds reads the bars. The mini sparkline draws its bars on a zero line where the
  values put it: a bar below zero hangs from it in its own colour, never cut to nothing; the one in progress is
  lighter.
- **The facts strip**: a page-filled panel 24 under the dates (radius 16, padding 16) of cells 44 tall — a circle, an
  11/600 caps label and a 20/24 figure with its unit — in equal columns 24 apart with a hairline in the gap. Columns
  by measure, the circles first: three, two or one columns with their circles — the first whose cells hold a circle
  with every label and figure (two at a 360 column, the third fact alone on its row; three at the mock-up's width) —
  else one column with the glyph alone before the words, the figure at the extra-small size and then no glyph at all
  before a figure would ever be cut. A neutral circle is the card's own disc with a hairline on the page's surface; a
  coloured fact's circle wears its tone's wash. A fact's label is a name and may end in an ellipsis in a column too
  narrow even for that. Each fact is a button: its `tap_action`, else the sensor's more-info (a share opens the sensor
  it is a share of). Icons per kind: bolt, chart, trend up, trend down, calendar, leaf, globe, car, grid, tag, text; a
  fact's own `color` is its circle's accent.

- **Honest figures**: the average, the highest and the lowest are the **finished** buckets' — a day still running
  is not a low day — over the buckets that have a value (a day before the sensor was there has none); the total adds
  the bucket in progress where it is drawn, and a `today` readout or fact is that bucket, live, drawn or not. Bars
  that do not add up (a mean, an extreme, a reading that is not its bucket's own count) have no total, money, CO₂,
  trees, kilometres or share: "—". The head by default says a total and an average where the bars add up, an
  average and the highest where they do not. A share is summed as the card's own bars, by its sensor's state class
  and reset; the equivalents (CO₂ 0.4 kg a kWh, 22 kg a tree a year,
  5 km a kWh, money at the house's price) are rough, named "est." where they are money, each factor editable, and
  only shown when asked for; a kind without its ground (no kWh, no price, no other sensor) reads "—". Money is the
  figure then the symbol, two decimals; a share whole percent; CO₂ and trees one decimal; kilometres none.
- **Heights** (360): full 40 + 44 + 60 + 20 + 20 + 120 + 24 + 24 + 32 + 44 × rows + 12 × (rows − 1) = 484 by default
  (two rows of facts); compact 272; mini 148 (the head and one 48 row of readouts beside a sparkline, a readout giving
  way before the sparkline, the sparkline before the last readout). The declared height counts the strip's rows by its
  labels and its figures (two a row with their circles at 360, three where both are short, one where either runs
  long: a caps label is about 7.4 px a character, a figure's digit about 13.5 at 20/600 — a whole digit more for a
  week's bars, two for a month's, one for a total — and its unit about 8 a character at 13/500); a figure the config
  cannot foresee (a minus sign, "MWh", a day of 27.7 that is a pixel wider than 27.4) can fold the strip once more
  than declared, and the "No statistics" and "Couldn't read the recorder" panels are shorter.

## History bars readings (1.9)

How a counter is read when Home Assistant's sum is not the truth (issues #44, #45). Home Assistant compiles a
counter's sum from every state it records: a `total_increasing` that falls below 90 % of its last reading is a new
meter that starts from zero, so a reset that comes as two writes (two inverter counters summed by a template) or a
restart that reads 0 for a moment counts the reading in between again, every night, in the Energy dashboard too; a
`total` without `last_reset` counts its reset as a fall below zero. `reset: auto` keeps Home Assistant's count, the
Energy dashboard's numbers; any other reset reads the counter by its readings.

- **Readings**: the counter's value at the end of each step (its `state` rows), asked from one step before the window
  so the first bucket's baseline is known, in a chunk of their own (`history-bars-readings`, fetched by the first card
  that reads this way). Readings are end values: a glitch or two writes a moment apart never land on one.
- **The step** keeps every reset in sight: a day counter by the hour for days, by the day for weeks and months (each
  day read at its close is its own count); a week's, month's or year's counter by the day, by its own length where a
  bar is a whole cycle (and a year's months by the month); a lifetime meter and a reading at the end by the bars'
  period; a counter's mean, highest and lowest by the hour for days, the day otherwise.
- **A step's gain** from reading p to r: r − p — except a lifetime meter, whose fall is a fall (a restart's glitch
  nets out on the recovery); a step that is a whole cycle, which is its reading; a fall at the cycle's boundary,
  which is a fresh start (0.30 → 0.28 at midnight reads 0.28); and a fall below 90 % of p anywhere, Home Assistant's
  own rule (an inverter that resets at sunrise). A smaller dip is a dip and comes back on the recovery. The meters'
  day reads its live hour by the same rule (`history-bars/gain.ts`).
- **A boundary whose reading rose** (p ≤ r: a dry month, then rain on the first) cannot be told from its two readings:
  the finer reading just after the boundary (five minutes in an hour, an hour in a day) says whether the counter fell,
  and the step then reads r. One small question each, once per boundary; at most four in a window — a counter that
  rose at more of its boundaries does not start again on that cycle, and keeps its rises.
- **The first reading** counts from zero where its whole cycle lies in its bucket (a day counter first read that
  evening gained its reading that day); otherwise it is where counting starts.
- **Live**: as Home Assistant counts it, the bucket so far is its own `recorder/statistic_during_period` (five minutes
  old at most, asked every five minutes a minute after each is compiled, only where the bucket in progress is read)
  and one step on from its newest five-minute reading, by the state class (`total_increasing` by the 10 % rule, a
  `total` anew when its `last_reset` changed, anything else r − p); read by its readings, one step of the same rules
  from the last compiled reading (a cycle boundary since then makes any fall a fresh start); a reading at the end is
  the reading now, an extreme takes it in, a mean stays.
- **When it resets** (`reset`, "When it resets"): unset, the card counts as Home Assistant does (`auto`), and the
  editor shows that; its helper says what the sensor is: a `total` without `last_reset`, a utility meter's cycle
  (read from its `last_reset` and `next_reset` where it starts where the house's calendar does), or what a reset
  does. A reading at the end of a counter adds up when its reset is the bars' period; the helper under the stat
  says so.
- **Limits, said in the docs**: a glitch that lasts exactly over an hour's end can still be read as a reset (as Home
  Assistant would); a daily counter shown as weeks or months is read at each day's last state, so a device that
  resets before the house's midnight loses that day (day bars read it by the hour); a history is kept ten days by
  default; day rows follow the server's midnights, the hourly readings do not.

## Charts (1.11)

**One engine.** Every chart and gauge is drawn by one set of rules (`packages/cards/src/chart/engine/`, its own chunk
`chart`, fetched as the bundle starts): one Catmull-Rom (tension 1/6, `toFixed(2)`), one bar path, one time-axis
labeller, one nice scale. A card names a **style** (`chart`) or takes the house's (fluvy's settings → Charts); a
**fine key** changes one thing of the style and is offered only where the style draws it. One rule resolves them: the
card's own key › the house's setting › the style's own default. `classic` is 1.10's chart, path for path, and takes
nothing from the house but motion (and, on the Chart card, the house's series colours): it is the factory style, so
nothing changes on upgrade.

**The styles.**

| `chart` | Line | Under it | Its end | Grid | Now · forecast | Bars |
| --- | --- | --- | --- | --- | --- | --- |
| `classic` | smooth, 2.5 | gradient 28 → 0 % | the dot (r 5, the card's stroke 3) | none | — · dashed where a card has one | one cap, gradient 60 → 48 % |
| `soft` | smooth, the house's line | gradient (the house's 18 %) + the soft copy (+5 px, stroke + 4.5, the ink at 55 % over the card at 35 %) | Fluvy's knob (or the dot) | hairlines at the quarters | knob on a hairline · dashed 4·5 | the house's ends, the highest in the ink, the rest the border's grey, its dashed MAX line |
| `glow` | smooth | the blurred copy (one feGaussianBlur 3 on the static copy only) | Fluvy's knob (or the dot) | none | knob · dashed | — |
| `minimal` | smooth, one step thinner (≥ 1.5) | none | the dot | none | — · the line's ink at 35 % | — |
| `step` | each reading held across its slot | flat (two thirds of the fill) | none; the lowest (ok) and highest (danger) marked | horizontal, on a nice scale | knob · dashed | — |
| `bars` | — | — | — | horizontal, nice scale | hairline · hollow bars | the house's ends, the ink, the highlight's lit, the rest quiet |
| `columns` | — | — | — | horizontal, nice scale | hairline · hollow | stacked by sign: with the house's ends `top` its parts flush and only the outermost rounded, with `both` (the factory's) each part a pill |
| `band` | straight | the band of lows and highs 14 % | the dot | horizontal, nice scale | knob · dashed | — |

**Geometry.** A chart 120 tall: 44 of headroom (the bubble's room) over the plot and 8 under its floor, the plot the
68 between; the spark 24 tall, 4 in. The bars' ends are the house's (`caps`: both from the factory, or the top alone);
classic keeps its one.
Scales: a lone curve on its own ends, several on a shared one with a tenth of air (each sensor its own where units
differ), a nice one (1 · 2 · 2.5 · 5, four intervals at most) wherever a horizontal grid or bars are drawn. A nice
scale spans the readings' own range — a day at 17 … 23 °C reads on 16 · 18 · 20 · 22 · 24, on whole steps where one
fits (never 15.0 · 17.5 · 20.0), whole ticks written whole; a band counts only where the style draws one — and holds
zero only where bars stand on it, where the readings reach or cross it, or where the quantity starts there (a
counter, power, energy, rain, a price, a battery); a temperature, a humidity or a pressure never forces it. A card
may lay its own nice scale and hand it over (`ChartSpec.ticks`: the Energy usage card's, which hugs its stacks).
**Bars** stand for what adds up (a counter, energy, power, rain, gas, water, a price — never a measurement of a
state): a window reads in at most 24 of them (an hour each over a day), each a slot's mean, or what a counter gained
in it. A bar is 40 % of its slot, 2–40 wide, corners min(4, w/2). A `null` reading breaks the line.

**Clipping and what stands proud.** Every line, area, copy and bar is clipped to the plot (after the scale's column,
the line's half width either side for its round caps). Only the dot, Fluvy's knob and the bubble stand proud of it,
by their radius, inside the headroom and the card.

**Marks.** The lowest and highest readings (`step`'s highlight) are marked over what has happened, never on the
forecast: the knob at now is the only ball there, and a forecast's line ends bare.

**Knobs.** No circle of the engine's own: the end of a line and now are Fluvy's knob (`.fv-knob`, the thermostat's
ball: card fill, 2 px ring in the tone, the dot a quarter of it, the lift on a 6 px card-coloured halo that cuts the
line), 16 across in a chart; where the end of the past is now there is one ball. The classic dot stays the classic
dot.

**Text by rule.** The axis's labels: the first flush with the plot's start, the last with its end, the others centred
on their tick; under a scale the axis row starts where the plot does. The scale's ticks (11/500, secondary ink)
right-aligned on one column 8 before the plot, each centred on its tick, the zero line the strong border. A bar's
value centred over it: where the style lights some (a highlight, the MAX bar), over the lit ones alone; else over
every bar where the slot holds 30, over none where it does not. The bubble centred on its x and kept
inside the plot's width — its tail moves, not the pill (the classic bubble leans 16 into the card's padding, as 1.0
drew it).

**Colours.** A lone series wears its card's colour › its tone › the accent; several on the Chart and Energy usage
cards wear the palette's six series colours (`--fluvy-graph-1…6`, ΔE2000 ≥ 8 pairwise, icon contrast on the card) or
the house's saved set, unless the card names its own; the sensor card's several sensors keep their measures' tones
(§ Several sensors), the History page its hashed graph colours. A saved set's colour is **one of the palette's** or **a hex of its own**. One of the palette's
is named, not copied — its twelve series colours (`graph-1` … `graph-12`), its accent, the statuses (`ok`,
`warning`, `danger`, `notice`), the lit light (`light`) and the energy states (`solar`, `grid`, `battery`, `water`,
`gas`, `home`) — and worn by its token (`var(--fluvy-graph-3)`, `var(--fluvy-state-energy-solar)` …), so the set
**follows the palette and the mode** at draw time, with no fitting and nothing per frame: choose a green palette and
the charts wear that green. A hex is **fixed**: the person's hue as chosen, and each mode wears it **fitted** to its
card, as the palette's own six are built and as the house's statuses are — a colour that does not hold 3:1 on that
mode's card goes away from it (deeper in light, lighter in dark) at its hue, only the lightness moving (and the
chroma sRGB cannot hold there), as far as the gate asks, then up to a twentieth of the scale further where that sets
it 8 apart from the colours before it, the palette's among them; a colour that already holds both is worn as picked.
A set is fitted once per set and palette (the look's), never per frame; a series of hexes carries both colours
(`fc-set`: `--fc-light`, `--fc-dark`) and the engine's sheet wears the mode's (`:host([dark])`, `[data-mode='dark']`),
its legend's square too. The check reads both modes as they are worn, so two of the palette's own that sit together
(Linen's accent and its first series colour) are said by their words. A series of the Chart card and a source of the
Energy usage card may name one of the palette's colours in their `color` the same way (a colour name or a hex stays
as it is). The fills, the soft copy and the bars derive from the ink once, in the engine's sheet: fill top the
house's % (several 16 %), the band 14 %, the copy the ink at 55 % over the card; dark mode +6 points. The new tone
`ok` (the success role) is what is good or cheap.

**Gauges are Fluvy's controls, read.** `ticks` (the gauge card's ring since 1.0, `<fluvy-dial gauge>`), `dial` (the
thermostat's dial read — `<fluvy-dial readonly>`: its disc, its knob, no stepper; in a tile a 20 knob its ring can
carry, touching the disc's rim, the reading whole inside), `ring` (the border's circle lit to the value, round caps,
Fluvy's knob at its end, the reading in its middle with the unit under it), `ruler` (`<fluvy-ruler readonly>`, lit to
the value, its knob whole). Every knob is the thermostat's ball — its dot, its lift on its halo — never the read-only
marker. Nothing is lit, no knob, "—" when there is no reading.

**The gauges that move.** Seven more gauges, each a small scene whose motion is its sensor's own variable, drawn only
where a card's sensor is of its kind (else the card's ticks): `liquid` (a percentage, a humidity: two slow waves, 9 s
and 14 s, a wavelength across the box, the reading in the larger of water and air), `thermo` (a temperature: no water
— a sky over the ground tinted by the comfort's tone, cold the fifth series colour, mild the accent, warm the warning,
extreme the danger at 16 % where the rest are 11 %; snow falling on a drift under 16 °C, a mild sun turning in 36 s
and a fair cloud drifting across over a hill (the fourth series colour) to 24, a stronger sun (18 s) and heat haze off
dry ground to 35, a blazing sun (9 s, its halo breathing at 2.2 s) over dunes with saguaros from 35; the reading in
the sky's top left, the comfort's word under it — Cold, Cool, Comfortable, Warm, Hot, Extreme heat), `tank` (a volume
or a level: quicker, shorter waves, bubbles in its right part while it fills, twice as many and as fast from a third
of the tank an hour), `battery` (its charge as a level in the battery's tone, the warning's under 40 %, the danger's
under 20 %; bubbles and the glowing bolt while it charges, faster as it fills faster), `pulse` (power: a disc in the
tone with the bolt, rings that beat in 3.2 s under a kilowatt, 1.8 s under three, 0.95 s above), `air` (wind, a
ventilation's flow: streamlines in a band of the page's colour over the reading, 4.2 s calm under 10 km/h, 2.2 s a
breeze under 30, 0.9 s strong wind) and `sun` (what the sun gives: rays that lengthen with its share and turn in 60,
34 or 16 s, a breathing halo). How fast a tank fills or a battery charges is read over the window's last two slots
(its last hour over a day). Bubbles are white at 75 % in both modes; a drift and a cloud white at 60 % over the card.
- **The reading is placed by rule**: in a box (the liquid, the tank, the sky) on the 4 grid, 16 in (12 in a tile),
  never across the waves' reach (the line, `wave` either side of it, and 4 more) nor any sweep of the weather (a flake
  down its fall, the cloud across its drift, the haze up its rise, the sun's rays and halo); the sun keeps the corner
  beside the reading, else stands under it, smaller where it must. Under a mark (the battery, the pulse, the air, the
  sun) the reading is centred. A reading is the figure (32/700, 24 in a tile, 20 at the last) with its unit and a word
  under it (13/500, 12 in a tile): the word gives way where it does not fit, the figure never.
- **Room.** On the gauge card a moving gauge takes the column's width and the dial's height (its range's labels'
  too), so the card keeps its size; on the humidity card the liquid takes the ruler's room and its labels' (64), the
  figure the readout's over it.
- **Motion** is CSS alone, one keyframe set in the engine's sheet, on transform, opacity and the dash offset; no SVG
  filter. Told not to move (`animate: false`, the card's, else the house's), or asked for less by the system or the
  house, a gauge rests on its first frame — still a wave, never a flat line — and what exists only moving (bubbles,
  rings, snow) is gone. Out of reach it keeps its room and its anatomy, grey and still, "—".

**The cards that take them.** A card is offered only the styles it draws, and a style it does not draw is its classic
(the house's soft leaves the history bars and the arrays as they were).
- **The sensor**: classic, soft, glow, minimal and step, and `bars` and `columns` alone where its readings add up; a
  tile's spark `minimal` where the card's style is, else classic.
- **The energy card's line**: classic, soft, glow, minimal, step — a stepped power on a nice scale from zero in the
  unit the card's figures take for the window's peak (kW for a house that peaks at 3 kW), the hours under the plot
  after the scale's column; a classic line asked thin keeps 1.10's one pixel. **Its stacked charts** (by source, the
  whole house): classic, soft (the bands' fills at 24 % over the card where classic's are 40 %, the house's hairlines
  in place of the dashes), step (each bucket held across it); their lines thin 1, regular 2, bold 3.
- **The history bars**: classic (1.10's gradient), bars (the ink, flat, rounded as the house's bars are, a highlight
  lighting the highest, the lowest or the bar in progress and the rest the border's grey), columns; the mini row's
  sparkline classic or minimal (a thin line through the bars' values, its dot at the end).
- **Production**: classic (1.10's bars over the forecast, the arrays in the ink's ramp), soft for one meter (an hour a
  bar, the best hour in the ink, the rest quiet, the hours to come the forecast's hollow, now marked), columns (the
  arrays stacked in the series' colours, the legend's squares in them).
- **The gauge card's ring**: ticks (1.10's dial), dial, ring — in the dial's room (its box wide, as tall as the dial
  down to its range's labels: `dialLabelTop`), so the card keeps its height — or a moving gauge that reads its sensor;
  the bar and the signed ring have one look each. **The humidity's ruler**: ticks (its marker, the classic), ruler
  (read lit to the reading, Fluvy's knob on it) or the liquid; a dial or a ring has no room in its band.
- **The distribution's stack and the bars card**: classic or soft (each part of the stack a pill, a bar's ink
  deepening along it from 60 %). The score's rings are the engine's arcDash and keep their one look.
- **The History page** draws in the house's style and has no setting of its own: classic is its 1.10 plot, any other
  style its lines through the engine over the page's room and rules, on the page's own scale (its two rules keep their
  figures), a lone line in the accent and several each in its entity's graph colour.

**Motion.** A chart draws itself in (900 ms), its marks fade in after; once it has been read, the marks a read brings
and takes away (the cursor, the mark on each line, now's knob back at rest) come at once in the short fade (120 ms), as
the bubble does. `animate: false` (the card's, else the house's) or the system's reduced motion draws its resting frame
at once. The fade owns `opacity`: a layer's own strength is its `stroke-opacity` / `fill-opacity`.

**Reading.** A pointer over the plot (a finger held on it) reads it: the cursor (classic's dashes, a style's hairline),
the mark there, the bubble saying when; ← → (Shift five) Home End read it from the keyboard, Escape lets it go.

**What not to do.** No rainbows of series; no glass knobs or circles of a chart's own; no SVG filter on anything that
moves; no mixing styles in one view (the house's one style governs; a card may differ on purpose); no fill or copy past
the plot.

## Chart (1.11)

The Chart card (#68) draws any time series on one chart, from what has happened to what is to come: a sensor's
history or its statistics, a list in its attributes (a price's day and tomorrow, a solar forecast), a weather's
forecast. It is the engine's (§ Charts) in its house's style or its own.

- **The window** (`span`) rolls to now (24 hours, any hours or days) or is the house's day, alone or with tomorrow —
  which is today alone until tomorrow's prices are published. Its readings lie on equal slots, each what was in force
  across it weighted by how long (an hour of four quarter prices reads their mean; a meter drawn as bars reads what it
  gained), a line's points between the slots so its ends sit on the window's: a stepped price holds its own slot
  beside a smooth forecast. A stepped line is one path a run, its slots never under 5 across on a round length of
  time (a phone's card reads a day of quarters by the hour, a wide one keeps the quarters): a step narrower than its
  line is a bead, not a step.
- **Series**: six at most, each a line, an area, columns (under the lines, on one nice scale that reaches every
  reading) or its band; a lone series wears the card's colour, several the palette's series colours, and a series'
  own `color` may name one of the palette's (§ Charts → Colours); the forecast of several keeps its series' ink,
  dashed, where a lone one's is the style's.
- **Thresholds** colour a line from a value up to the next one: the line drawn again in each one's ink, clipped to its
  stretch of the scale, so it changes colour exactly where it crosses — a bar takes the ink of the threshold its value
  reaches; `ok` is the good, cheap one.
- **Marked windows** (`highlight`, a lone series): the lowest and the highest mean of `highlight_hours` over what is to
  come (from now's slot, where three windows' worth of readings lie ahead, else over the whole window), each a stretch
  of the plot behind every layer in its tone's fill at 55 % (a price's cheapest the ok tone, its dearest the danger's,
  any other series' its own) and a pill that names it — "Cheapest Fri 13:00–15:00 · 0.078 EUR/kWh" — in one of four
  forms, longest first (without the unit, without the figure, the hours alone), every pill in the same form; where the
  row holds none, the stretches say it alone.
- **The value row** (full, 16 + 64): the first series' reading now at the largest readout size (l or m, whichever lets
  the pills say the most) with its change on the period before as a neutral pill on the value's foot ("+5 %", a
  rolling window against as long a stretch before it, a calendar day against the day before; from the recorder only),
  the marked windows' pills at its end — or, for two or three series, the legend's lines with each reading at their
  end; four or more name themselves under the axis in two lines of two or three columns (+44).
- **Reading it.** Under a row that says the reading, the plot rises to 12 under the chart's top (the knob's room), and
  while the chart is read the row reads it — the value with the time as its label, or the legend's lines each with its
  reading and the time a pill on the axis under the cursor, the hours giving way (the several sensors' card's) — and
  no bubble is drawn: the cursor and its mark on the line alone, the marked windows' pills where they were. Where the
  row has nothing to say the chart takes its room (200) and keeps the bubble's 44; without the head (`show_head:
  false`) the bubble reads the chart in its 44 above the plot, under a row of the pills alone too.
- **Compact** is the head, the chart and its axis; **the tile** the reading over a spark of every series. The scale's
  column folds where it would leave the plot under 120 (half a section).
- **The axis of a calendar window** says the day of a midnight between its ends ("Thu 00:00 · Fri 00:00 · Sat
  00:00", never a bare 00:00 that could be either day), and where the times do not stand 12 apart, the days alone
  (Thu · Fri · Sat).
- **Heights** by variant and series count only: 320 (364 with a legend of four or more), 240, 168; loading (the
  skeleton), empty (the ring and "Nothing to chart in this window" on the page's fill) or out of reach, it keeps them.
- Its chunk is its own (`chart-card`, beside the engine's `chart`): every page carries only its name and height
  (`chart-family.ts`).

## People (1.6)

- **Each their own**: a name, a colour (a 2 px ring round the avatar, 2 clear of it on the card: a picture would hide a
  fill), and a tap and a hold of their own (a page of theirs, by default their details).
- **The title** is the card's own where it fits beside the map's round, a shorter one where it does not ("Who is
  home" → "At home"); a typed one is the user's (a name, which may end in an ellipsis).
- **A person's line** keeps their state; its detail (the zone, the time) goes, whole, where the column cannot hold
  both: a state never ends in an ellipsis. Where a state would not hold its grid column even alone, the card lays its
  people as rows. Rows give their avatars together, as every list's circles (the hairline then starts the row); a
  battery stays whole and its detail goes first; a state that would leave a name under 40 is a dash, its word the
  row's label.
  Someone out of reach says a word that holds the grid's column — their state, else "Unavailable", else a dash — and
  never turns the grid into rows (1.9).
- **A phone's charge** (`show_battery`, or a battery named by hand): the set's battery glyph (20, 16 in a row's sub)
  filled to its level, 12 wide inside and never under 3 so a low one shows, then the figure ("78 %", "—" unread). At
  20 % and under, glyph and figure take the warning ink; on its charger (Android's charging sensor, iOS's battery
  state, a tracker's word) a bolt crosses the glyph with a card edge and it is never low. The grid puts it under the
  state line, 4 below; a row before its detail ("▮ 78 % · 19:47"). Found from the tracker the person is seen by, else
  any of theirs, else a tracker's own `battery_level`.

## Openings (1.6)

- **Each row its own**: a name, an icon, a colour, a tap and a hold. Its colour is who it is: its circle wears it at
  rest. What needs acting on (open, wet, smoke) fills the circle in the warning tone and says its state in the
  warning's ink, whatever its colour; events (motion) and the rest stay neutral.
- **Layouts**: rows (60, the time under each name: "14 min" open, "2 h ago" since — gone, whole, where it would not
  fit beside the value), compact (48, the name and the
  state on one line; a value never wraps), or tiles (two a row, 84 inner tiles, columns at the dashboard's gap and rows
  8 apart: the circle, the name, the state and its time; an open one fills in the warning, a coloured one wears its
  rest wash; a tile's time goes, whole, where its tile cannot hold it; where a state would not fit even alone, or a
  name beside the circle would end before it had begun (96, or the name), every tile gives its circle's room to its
  words, and where a state still would not fit, one tile a row — measured in the tile's own type, at the grid's own
  gap). `show_time` takes the times away.
- **A sensor that cannot be read** (gone, unavailable or unknown) is a dash on its tile — on the dashed skin of
  anything gone, on the live skin when unknown — so its state never lays the tiles out otherwise; its word is said
  where the time would be when it fits, and is always its label.
- **The "all sensors" row** gives its circle with the rows'. Folded, it says what it hides and any alert among it
  ("2 more · 1 open"; compact, "+2" in the warning's ink); its chevron turns up when it is open.
- **The head** keeps its badge (the card's alert) before the sub's last part, then gives way as every head; the
  sheet's "Openings & motion" where it keeps both its circle and its badge, else "Openings".
- **The same sensor twice** keeps both rows (rows are by position, never by entity).
- **A row's own class and words (#102):** a row may read its sensor as a class of its own (`device_class`), which
  gives it the class's words, its icon open or shut as it stands, and whether its on needs acting on; its own words
  for a state (`states`) come before the class's, in the row, the tile and the label alike. The class decides what
  counts: words alone never make a sensor an alert (a tilt sensor reads "Tilted", calm), a borrowed window does.
- **The real last change (1.11, #67):** a row's time — the openings card's "2 h ago" or "14 min", a list row's *last
  change* line (entities, lock, camera, alarm), a tile's (a tiles group's, a room's), a template's, a person's, a
  helper row's — is Home
  Assistant's `last_changed` unless the row says where the real one is read (`since`: an entity whose state is a
  timestamp, ISO or an epoch in seconds or milliseconds, or `attribute:<name>` of the row's own entity), and the
  openings card names one for every row at once (`since_pattern`: `sensor.{id}_real_last_changed`, `{id}` the row's
  object id, `{entity}` its whole id; a row's own wins; no default pattern). Empty, unknown, unavailable, unparsable
  or missing falls back to `last_changed`. The sensors a card reads this way are watched. The editor's `since` is a
  select of the house's timestamp sensors (`device_class: timestamp`), any other value typed; the openings card's
  `since_pattern` shows while its rows say their times (not compact, not with the times off).

## 3D printer (1.6)

- **Full**: the head; the picture; the progress row; the bar; its line; the readouts; the filament unit's trays; the
  buttons. **Compact**: the head, the bar and one line, the readouts at the extra-small size. **Row**: the compact
  anatomy (76, 16 in), the printer's circle ringed by the job, its name over what it does, pause or resume. Narrow,
  it gives way in order: the line's trailing parts (the ring says the progress), then the round (where the state or a
  name's 96 would not hold beside it), then the name takes an ellipsis; the state is never cut.
- **The head**: the printer's glyph (the warning's when it failed, so a failure never reads as a pause), its name, the
  job (the stage while it prepares: "Heatbed preheating"), the state in the badge. The badge gives way first, as
  badges do, and the state is then said at the head of the sub ("Failed · Hook"): the state is never left unsaid.
  The job is the file sensor's name without the slicer's extension; a printer without one (Creality) says it in the
  status's own attributes, and a "None" (FlashForge at rest) is no job.
- **Why it failed**, in the integration's words, is a line of its own under the head: 13/500 in the warning's ink,
  two lines at most. The failed job keeps its bar where it stopped. A printer without an error of its own says the
  code its status carries (Creality's "2004").
- **Who it is**: a printer of an integration the card knows (OctoPrint, PrusaLink, Bambu Lab, Moonraker, Creality,
  Elegoo, Anycubic, Snapmaker's U1 and its older line, FlashForge) is read by its own words, the entity known most
  surely to play a role playing it (a "print status" over a "wifi status"); a printer of any other is known by what
  it has — a status, a heater and a job's measure together — so a washer with a progress is never one. A duration is
  read in its sensor's unit (minutes, seconds, Elegoo's milliseconds) or as a clock ("01:02:03", the older
  Snapmaker's). A system button, an emergency stop and a unit's own readings are never a role.
- **The picture**: the camera (stills, or Home Assistant's stream with `camera_view: live`), else the job's preview
  (`image` picks); its shape and fit as the camera card's (16:9 by default), never taller than 360 — capped, it keeps
  its shape, centred. A preview is fetched again only when its picture changes.
- **The card's colour** stands in for the accent only: paused and failed keep the warning, whatever its colour (as an
  item's colour never covers a status anywhere: an open window's tile stays the warning's).
- **Narrow** (where a heater's widest pair, "888 / 888 °F", would not hold half the column at the extra-small size;
  measured, never a fixed width): every heater reads alone and the layer writes its total as its unit ("112" with
  "/ 240"), so two readouts hold a row where their figures fit.
- **The progress row**: the progress at the large size and the time left beside it on its baseline; where the two (a
  label or a figure, the wider) and 16 do not fit, the time left goes under, on the column's start, 12 below.
- **The bar**: 8 tall, radius 4, in the phase's tone; under it one line: "Ready at 22:59" (the integration's finish
  time: it does not drift), the time printed so far, the layer where no readout says it — its parts left out whole,
  from the end. Finished: "Finished at 21:17", from the finish time or when the state changed, never now; another
  day's moment says its day by the calendar ("Ready Fri at 05:27", a date from six days out), a job finished before
  today how long ago ("Finished yesterday", "Finished 2 days ago").
- **The readouts**: equal columns, as many a row as hold every label and every value — at the small size, else the
  extra-small, before one fewer a row (two at the extra-small beat one at the small) — never leaving one alone on a row of three or four (four as two by two, five as three and two); a last
  row that cannot fill is centred. A heater says "142 / 220 °C" from 3 °C off its target (5 °F), and its reading alone
  from 1 °C (2 °F) (no flicker between); it is always measured as its widest form ("888 / 888"), so a drifting heater never moves the
  card. Each readout opens its entity. Any entity of the printer can be one more (`sensors`).
- **The filament unit's trays** (Bambu Lab's AMS, Creality's CFS, Anycubic's ACE — on the printer's device or on one
  of their own reached through it; the unit's slots in their number, the spool outside it last): a 44 cell a tray,
  its colour as a 12 swatch and its type (by the words the units use: `type`, `material`, `name`, else the state), the
  one printing (`active`, `selected`, `loaded`) ringed in the accent (a 2 px ring and its words in the accent's ink,
  never a fill: the action row keeps the one loud fill, and it says so to a reader, `aria-current`), an empty one
  (said so, or holding no type) with a dashed ring (a shape of its own); every swatch has a ring in the text's ink at
  about half, so black filament on a dark card and white on a light one still show. Four a row where every
  type fits its cell, else two, else the swatches alone (the type is each one's label and tip), four across where each
  keeps 44, else two by two. Cells with a hairline: a state, not buttons. The trays and the buttons share one gap, 8 to 16 (never wider
  than the 16 between the two groups): the first that lands both rows on the 4 grid, else the one nearest 16 that
  lands them on whole pixels; 4 only where nothing wider keeps every cell 44.
- **The buttons**: pause or resume (the primary, in the row too), stop (asked first, in Home Assistant's dialog), the
  light (the glyph takes the accent while it is on). Never a system button or an emergency stop.
- **Tones**: printing, preparing and finished in the accent; paused and failed in the warning (failed with its own
  glyph); at rest and stopped neutral; offline at rest (below).
- **The ring** (the row): 2 px at r 26.5 round the 44 circle, 3.5 clear of it, from twelve o'clock.
- **The row** with its ring is the card's button as the bare row is: a cover over the whole row taps and holds (the
  head's rule, #42), its pause or resume round raised beside it, its own.
- **Out of reach (1.9)**: a printer whose status cannot be read (unavailable, unknown, gone from the house) stands at
  the size of a job in the unavailable skin: the head with its badge, the picture's plate in its shape (the camera's
  glyph and why; also where only its camera is out of reach), the progress and the time left as dashes over an empty
  bar and a "—" line, its readouts (the layer too) as dashes, its trays, and pause, stop and the light still. The time
  left is measured as its widest form ("100 %" beside "88 h 88 min"), the layer as the job's count of digits, a tray as
  at least the empty one's word: a job counting down, a layer counting up or a tray emptied never moves the card.
- **Off screen (1.9)**: the stills pause (the period is 0 while the holder says the card is not seen) and the card
  back on screen pulls one at once, as the camera card does; the job's preview waits for the screen too.

## Appliances (1.9)

**One appliance card for every kind, one list for the house's.** A washer, a dryer, a washer-dryer, a dishwasher,
an oven (steam ovens too), a microwave, a hob, a hood, a fridge, a freezer, a wine cooler, a coffee machine, a kettle,
an air fryer, a toaster, a blender, a sandwich maker, or an appliance on a plug: the anatomy is one (a head with its
state, its times, its maintenance, its buttons), and each kind changes only its hero — a cycle's progress, a
temperature on its way, a hob's plates, a fridge's compartments, a state and its counters.

- **What it is**, asked in order: the card's `kind`; Miele's model, which is the appliance's type in English ("Washing
  machine", "Coffee system"); LG's model, which ends in its device type ("WM4000 (DEVICE_WASHER)", the older
  integration's "(TOWER_DRYER)"), a WashTower being two devices named "… washer" and "… dryer"; the keys only one kind
  has (salt is a dishwasher's, i-Dos a washer's, a cavity's temperature an oven's, Home Connect's programmes name their
  appliance, a Matter setpoint that tops out under 30 °C is a compartment's); the words of its name in any of the ten
  languages, read with its accents off (a "Sandwichtoaster" is a sandwich maker before it is a toaster). **Never
  one**: a vacuum (Home Connect's robot has no vacuum entity, only its keys; LG's robot and stick), a charger, a 3D
  printer (the printer card's: a washer is never a printer, a printer never an appliance), a hair dryer, and — until
  1.10 — a warming drawer, LG's Styler, a kimchi fridge.
- **Who plays what**: by the integration's own translation key (LG ThinQ, Home Connect, Miele, SmartThings and
  LocalThings, Samsung's on the house's own network, Matter, Whirlpool, Tuya), then the keys they share, then the end of
  an id (hOn, Electrolux, LG's SmartThinQ: the community's, read and never written to), then what an entity is (a door
  by its class, a power reading by its unit). Both LG integrations are known by what they say, never by their names; the
  older one is read by its device sensor's attributes as well (the time left, the course, the step, an oven's cavities,
  a cooktop's zones, a fridge's temperatures: most of its own sensors are off by default). An id is read without the
  device's name, so a Miele coffee machine nobody renamed — the "Coffee system", every id saying "system" — is never
  taken for a system's. A system entity (firmware, reboot, identify, wifi) is never a role; nothing filed under
  diagnostics acts. A second drum or cavity on one device (SmartThings' upper washer and second cavity, Whirlpool's
  lower oven) is read apart, never silently left out. A card that scans nothing (`scan: false`, #98) reads only the
  entities it names (`entity` and `roles`): its device still names it and says what it is and whose it is.
  `device: none`, the way until then, reads no device at all, as it always did: the card is named after its entity and
  is what its `kind` or its entity's name says (1.13.1; 1.13.0 read its entity's device), and one that names only its
  roles shows them, known by the first of them. Its editor has no scan switch then: there is nothing to search.
- **What it is doing** folds every integration's words into the card's few: off, ready, scheduled, running,
  preheating, paused, needs attention, done, error, offline. The words shown stay Home Assistant's (its translation of
  the state: "Spülen", "Rinsing"); where they say nothing (hOn's numbers, the older LG integration's plain English),
  the card's own, in the house's language. A stopped machine whose job says finished is done, and a machine that
  runs while its phase waits for a delayed start, preheats or says it finished is waiting, preheating or done (a
  Samsung's runs before its cycle and on after it); an LG washer that
  powers off when done is done for two hours after it said so (LG's sleep is off, a rinse hold is paused, night dry a
  dry). A failure the appliance says outright (Miele's flag, Matter's error, LG's error event for half an hour, Home
  Connect's aborted programme) is the status, said in its own words where it has them.
- **The steps**: a washer washes, rinses and spins (prewash first when it prewashes), a washer-dryer dries after, a
  dishwasher prewashes, washes, rinses and dries (its drain is its rinse), a dryer dries, cools and keeps the load from
  creasing. Each integration's phase words are folded into them; a word no step holds says no step.
- **The times** are the printer's, shared (`shared/job-time.ts`): the time left from the remaining time or the finish
  time, when it ends from the finish time (it does not drift), the whole from a total or what has run and what is
  left, the progress as the appliance says it or from those — never a guess at zero. An appliance's "1:35" is an hour
  and 35 minutes. "Ready at 14:32", "Ready Fri at 05:27", "Starts at 02:00", "Finished yesterday": the shared `job`
  words, worded for any job; the printer keeps its own, which agree with its noun.
- **Done, and unloaded**: a washer's, a dryer's, a dishwasher's finished cycle waits to be unloaded from half an hour
  after it finished (`unload_after`) until its door opens after the finish (or shuts: it was opened), LG says its door
  was opened, the person taps "Unloaded" for that finish, or — with no door to say so, as LG's washers and dryers have
  none — two hours after the finish (`done_for`). A dryer keeping the load from creasing asks to be unloaded now.
- **A door left open** (a fridge's, a freezer's, a wine cooler's) is said after a minute (`door_alert`), with how long.
- **Looking after it**: one item a thing (salt, rinse aid, detergent, softener, filters, machine care, descaling,
  cleaning, the water tank, beans, the drip tray, milk, a leak), the most pressing of what says it, due before soon
  before fine. Home Connect's present is due, its confirmed due and seen to, its off fine; a level is due at half the
  low level (`low_level`, 20 %) and soon at it; a filter used is read as what is left; LG's notifications count for a
  day, its rinse aid level is empty due and the last step soon, its tub-clean count due at the thirty cycles its
  machines ask at.
- **Compartments** are known by their key, LG's raw location ("fridge", "freezer" in every language), an id, else by
  their range (a setpoint that tops out under −5 °C is a freezer's, under 3 °C a chiller's, from 14 °C a wine
  cooler's, any other a fridge's), each its setpoint, its reading and its door, the fridge first. A range's burners
  are named by where they sit: left front, left rear, centre, right front, right rear.
- **Writes are pinned or absent.** Start, pause, resume, stop, power, a programme and a setpoint are offered only for
  an integration whose exact service and data a contract test pins from its source: LG's operation select and power
  switch, Home Connect's active programme (it starts the one chosen) and its buttons, Miele's buttons and power,
  SmartThings' operating state (its remote control on) and buttons, LocalThings' buttons, power switch and lamp (its
  Smart Control on for what runs its machine, never for its stop), Matter's buttons and power, Whirlpool's oven stop
  and light, Tuya's kettle. Beyond them, the start, pause, resume and stop a role names — a device's button found by
  its key or named by hand, a helper's button, a script — are pressed for any integration as Home Assistant's own
  button would be (#97); a paused appliance resumes by its start where it names no resume. A select's option is
  offered only when the select lists it. Start needs the appliance at rest and its remote start on (else the cell is
  disabled, titled so); stop asks first, and so does switching off one that runs. hOn, Electrolux and LG's older
  integration are otherwise read only.
- **Discovery's cost**: the house's appliances are read again when the registries change, never on a state's tick.
- **The whole card is the reporter's (#47)**, in the theme's tokens: what the mockup draws in its lavender and blue,
  every palette draws in its own, light and dark. `full` (the default for a big appliance: washer, dryer,
  washer-dryer, dishwasher, oven, hob, fridge, freezer, wine cooler, coffee machine, air fryer; a microwave, a kettle,
  a toaster, a blender, a sandwich maker and an appliance on a plug start as a `row`, a hood `compact`): 20 over the
  head, the hero 16 under it, the rows 20 under that, 16 under the last row (its circle keeps 2 of its 44, so the foot
  reads as the head's 20). Every big kind is **376 at a 360 column**: the hero's region is 108 whatever it holds and
  the rows are three, so the hairlines, the rows and the feet of a dashboard's row of appliances are level — padded with
  the kind's next rows, else a dash in a row's place, never stretched. `compact` (the head, the hero's bar — or its
  compartments as readouts, a hob's plates — the line, one row of extra-small readouts) and `ring` (the head, a dial in
  gauge mode whose disc says the time left with when it will be ready under it — an oven's temperature on its way to its
  target, what a plug draws, each compartment of a fridge its own dial side by side where two R 56 hold — the line and
  the buttons) keep their own anatomy. Their line is one line whatever it says: its parts fitted to it, the first whole,
  an integration's long words for a failure ending in an ellipsis with the whole in their title; a second drum's line
  the same, its unit measured in its own weight. A compact head's line is never cut: a hob's plate on that would not
  hold says how many are on ("1 of 4 on"), a programme or a quick mode that would not gives way (the hero and the rows
  say it). The cycle's step said alone sits on its own 16 line under its segment, never over the line below it. The
  anatomy is the kind's and the config's, never the state's: an appliance out of reach keeps every section, its values a
  dash, its buttons disabled (a fridge with no state of its own is out of reach when nothing of it can be read).
- **The head**: the picture (64 where the whole name holds beside it at 20; 44, then 32, where it holds at 20, then at
  16; else none, the name at 20, then 16 — the picture gives way before a letter of the name does, and only a name
  that holds nowhere ends in its ellipsis, beside no picture; `picture_min` keeps the least it asks, 32, 44 or 64,
  the name at 16 ending in its ellipsis beside it while a slot of 72 holds, #103), the name 20/700 over what it does
  16/400, and the
  power round (48). What it does is what asks for attention first (why it failed, a door left open, a load waiting,
  with how long; never a reminder, and not where an alarm row says it), in the warning's ink; a hob's zones on ("Zone
  1 on", "2 of 4 on"); a fridge at work "In operation"; else its phase while it works, else its state. What it does is
  one line: beside the name where its slot holds at least 120 (two thirds of the design's 180 at a 360 column, measured
  with the head's 16 gaps), else under the head at the card's width — by the column and the config, never by the words,
  so a row of appliances stays level whatever each says; its lesser parts (how long) give way first, then its shorter
  forms ("1 of 4 on" for a plate's name that would not hold, a step's status for its phase, "Empty" for a load, "Error"
  for a failure); a figure is never cut. The head is the card's button (#42); the round is
  raised beside it.
- **The picture** is the kind's product drawing (`picture: art`, the default; the `appliance-art` chunk): brushed
  stainless, white enamel, black glass and chrome, lit from the top left on a soft contact shadow, on a 64 grid —
  crisp at 32 to 64 and at twice that, no brand. One drawing serves both modes: on a dark card the shadow deepens, a
  rim light runs along its top and left edges and a soft glow sits behind it, so black glass never sinks into the
  card. `picture: icon` is the kind's 64 circle, `none` leaves the head to its words, centred in its 64, so the card
  stays level with its row; `image` is the person's own picture (an address, or an entity whose picture it is). Out of
  reach the picture greys and fades with the card.
- **The power round** (48; 44 in the row) is tinted by what the appliance does: the accent (the card's colour) while
  it works or waits to start, the success's green while it is on and ready (a fridge cooling, a coffee machine
  ready), the warning's while it needs a hand, quiet while off, the dashed skin out of reach. It switches the
  appliance only through the integration's pinned commands (switching off one that is not at rest — at work, waiting to
  start, failed — asks first in Home Assistant's dialog, and so does switching off what keeps food cold, whatever its
  compressor does); else it opens the appliance's details; `power_action` stands in for both. While a load waits to
  be unloaded, "Unloaded" (the accent's check) takes its place.
- **The heroes**, in a region of 108: a cycle's **time left** over its whole ("Remaining · **1:12 h** · of 2:45 h";
  when it starts, when it finished; `time: end` says when it ends) — the label and the line under it 16/400, the
  figure 32/700 in hours and minutes — then the **bar**, 12 tall, its share in the card's colour softened (42 % of it
  over the card) on the page's second surface, its percentage at its end in a room as wide as "100 %" (the bar keeps
  its length whatever it says), the cycle's steps instead where `progress_style: steps`. An oven's **temperature**
  and its target ("Target 200 °C"), its bar its programme's progress where the oven says it, else its heat on its
  way. A plug's power and what this cycle used. A fridge's **compartments** as inner tiles (84, radius 12, the
  page's fill) two a row: a 40 snowflake circle 8 from the name 15/400 over the setpoint 22/700 — the circles give
  way together before a word would, then one a row (`setpoint_style: stepper` keeps the rows with steppers: a row a
  compartment, its name with its reading now, its setpoint at m, the 96 stepper on its line, stacked and then halved
  as every value row is). A hob's **zones** on a soft panel (radius 16, the page's fill, 12 · 44 · 4 · 20 · 20 · 8):
  a 44 ring in the heat's ink 3 thick while it cooks, a disc at rest, the zone's name and its level in Home
  Assistant's words under it (the level in the heat's ink while on), all on one row where each holds its words (four at
  most), else three, two (four two by two) or one a row. A coffee machine's **drinks**: tiles (84, radius 12) as even as
  their words allow — the row's room shared equally, a tile whose words need more (8 a side) taking only what they
  need — so the row ends on the column's edge, a cup over each name
  (a wide cup for one with milk), and a 48 tile "…" for the rest; a tap starts the drink where the integration lets a
  card choose, else opens the programme. A hero the appliance cannot fill keeps its anatomy, a dash in each place: a
  coffee machine that offers no drinks its three tiles and "…" (disabled), a hob none of whose plates is found its panel
  of four, a fridge none of whose compartments is found its kind's tiles (the fridge's and the freezer's).
- **The rows** under a hairline (12 under the hero, 8 over the rows): three where the card names none, the kind's in
  the order it takes them among those the appliance has and its hero does not already say (a cycle's time left and its
  end, an oven's or a kettle's temperature and target, a plug's power and what this cycle used, a hob's plates on;
  the card's own `rows` say what they name) (`KIND_ROWS`: a washer its programme with its temperature,
  its water, its energy; a dryer its programme, its energy, its lint filter; a dishwasher its programme, water and
  energy; an oven its heating, the time left and when it ends; an air fryer its target and its programme; a fridge its mode, its filter, its alarm; a coffee
  machine its last drink, its water, its beans; a hob its zones on, its power, its energy), then its next ones where it
  has fewer (its times, what it draws, its alarm), then a dash in the place of a row it still lacks, said by its slot's
  most general word ("Filter —", "Water —", "Power —"): every whole card of a kind has its three rows, live, at rest and
  out of reach alike — what the appliance has is its registry's, never its state's. A reminder that falls due and is not
  among them takes the place of the last row it lacks, else the last row's. A row is a 40 circle in a soft tint (an eco
  programme the success's green, laundry's and water the water's blue, the rest quiet), 16 from its words 16/400, and
  its value: **beside them** (the figure 600 in the text's ink, its unit in the words', "Water **8.5** l"), **at the
  end** ("Energy …… 1.2 kWh"), or **one phrase** with them ("Filter OK", "No alarm", "Normal operation"), as the kind
  says (`row_values`); a reminder due says what to do in the warning's ink (its phrase, "Replace the water filter",
  where the row is a phrase or sits beside it), its circle quiet. The circles give way together where a row's words
  would not hold beside one. At the row's end, a value that would not hold beside its words even then goes under them,
  in the row's 44 ("Descalcificación" over "Descalcificar"); a value is never laid over its words. A row opens what it
  says (or does the card's own `tap_action`); a reminder's hold resets it where the integration lets a card, after
  asking. A second drum or cavity is a row over two of the kind's, as the reporter's oven holds its second cavity in the
  slot; beside the card's own `rows` it is one more. `rows` (the rows editor) names them and their order: a reading
  (`program`, `temperature`, `target`, `water`, `energy`, `power`, `remaining`, `end`, `elapsed`, `mode`, `alarm`,
  `last_brew`, `zones`, `spin`, `dryness`), a reminder, or any `entity` (a span in hours and minutes), each with its
  name (empty: the value alone, "200 °C"), icon, colour and actions. A meter of the machine's years is never its
  programme's (LocalThings', 1.13; SmartThings', 1.13.1): its energy row and readout say what this cycle added to it,
  as a plug's do, and its water meter has no row.
- **Reminders** beyond the rows (`maintenance_style`): as chips that fill the row (as many a row as hold their words
  with their glyphs, down to one, the glyphs alone only where not even one does), or as rows (what to do whole, on
  the lines it needs; its level or "Due · Soon · Fine" at the end). One item a thing, by the entity that says it, in
  the card's order and words where it names them (`maintenance`: key, name, icon, colour, tap, hold); a hold resets
  it after Home Assistant's own dialog has asked, where the integration lets a card (SmartThings' and Matter's
  filters), else opens it.
- **Buttons** (`show_controls`, the dial's by default): by what the appliance can do at all, never by what it does
  now, so the row keeps its cells — start and pause share the primary (start, resume or pause as it stands; the
  accent fill only while it can act), stop, power, the light; a cell that cannot act now is disabled, its title saying
  why ("Remote start is off on the appliance"). Stop, and switching off one that runs, ask first in Home Assistant's
  dialog. A stepper shows each tap at once, holds it until the appliance answers (5 s at most) and sends one call once
  the taps settle (650 ms): ten taps, one call.
- **Part by part**: `show_power`, `show_hero`, `show_progress`, `show_zones`, `show_drinks`, `show_rows`; one choice
  away: `setpoint_style: stepper`, `show_modes` (a fridge's quick modes as chips that fill the row, on in the cold's
  fill; tiles where every word holds its tile), `show_controls`, `show_programs`.
- **"Unloaded"** is remembered in the browser per appliance and per finish (a new finish asks again); every card on
  the page follows at once.
- **A second drum or cavity** (`unit`): a line under the first — its unit in the text's weight, what it does, its
  time — alone in its place (`sub`), or not (`main`).
- **On a plug**: running from `running_power` (5 W); finished where the power stayed under half of it for
  `finished_after` (3 min), a soak or a pause under it the same cycle; when it started and finished from one raw
  history call over the last twelve hours, then the live states; a threshold helper's sensor says it outright; what a
  cycle used is its meter's gain since it started, else what it drew. Its hero is the plug's whatever its kind. What
  keeps food cold (a fridge, a freezer, a wine cooler) draws in its compressor's bursts and never finishes: on a plug it
  is in operation while switched on — never running, finished or done, no cycle's energy — and switching it off always
  asks first ("Switch it off? It stops cooling.").
- **The clock**: the shared minute's ticker while something is under way, waits to start, finished less than two
  hours ago, has waited (a door, a load) — never off screen, in a hidden tab or under `_now`; a door opened now is
  said the moment it has stood its `door_alert`.
- **The row** (`row`): 88 with its picture (12 · 64 · 12), the name 15/700 over what it does 15/400 4 under it, the
  round that matters now — "Unloaded", else start, resume or pause for a cycle a card can start, else the power
  round (44): the reporter's bottom line. What gives way, in order: the line's trailing parts, the round, the picture
  to 44, then 32, before a letter of the name would go (measured against the row's own 16 in, not the card's 20: in
  Home Assistant's desktop band a one-word name like "Sandwichmaker" was cut by 3 px with the picture kept at 64),
  then the picture; the state is never cut, and the 96 still counts for what else may go (the round, the ring): a
  long name is cut before they are lost, so two rows side by side on a phone (182 each) keep their pictures (#103).
  `picture_min` keeps the least it asks beside a name cut however short, giving way only for the state.
  `picture: icon` keeps the circle ringed by its progress (76). What asks for attention is said in its own words
  where the bare row holds them (beside the least picture the card keeps), else in its state's (the warning's ink
  says the rest). The whole row is the card's button (a cover over it), the round raised beside it.
- **The house's appliances** (`fluvy-appliances-card`): every appliance of the house (or those it names, each with
  its name, glyph, colour and tap and hold), what needs a hand first (waiting to be unloaded, a door, a failure, a
  reminder), then what runs, ending soonest, then what waits to start, what is done, what rests; the head counts them
  ("2 running · 1 done · 3 at rest"). Bar rows (76; 48 compact) — the circle in the status's tone, what it does and
  when, the time left or its state at the end, its progress as the bar — or tiles two a row with the pictures (88;
  `picture: icon` the ringed circles, 84) whose pictures step down (64, 44, 32) and give way together before a word
  would be cut, or keep the least `picture_min` asks, every tile's need then saying its short state. Over
  `max_rows` (6) a "{n} more" row; `show: active` lists only the busy ones; its own empty words ("No appliance found",
  "Nothing running", `empty_text`) and `hide_empty`. A row's line keeps its first words whole: the circles give way
  together where one would not hold beside them, then its shorter forms ("Rinse aid", then "Refill", for "Add rinse
  aid"; "Empty" for "Waiting to be unloaded"; "42 min" for "42 min running"), then the segments after it. Tiles go one a
  row where two would not hold a tile's state whole. The head counts each in its number ("1 läuft · 2 fertig", "1
  terminado").
- **The house's appliances as whole cards** (`variant: cards`): each listed appliance its whole card — its item is
  the appliance card's config, so it takes any of its keys, the list's `picture` and `picture_min` where it names none
  (its `roles` and `scan` the rows and tiles read too) — side by side
  as many as hold: a whole card 300 at least (four across a desktop's band, 360 each), a row 240 (five), 16 apart as
  Home Assistant's section spaces its cards; no head, no surface of its own. The cards keep their places (`sort:
  none`, the order given, their default; by name where asked); its height at a 360 column is its cards' one under
  the other.
- **On the automatic dashboards (#47)**: the house's appliances (the card's own search) leave the plug tiles and the
  rooms' readings (an oven's or a fridge's temperature is not a room's; the energy views read the plugs' power as
  before). Home lays them across under its three columns, as the reporter drew them: "Large appliances" — a section
  title (`heading_style: title`: 27/600 beside its 32 glyph, "All appliances ›" 16 at its end) — over the whole cards
  side by side, two rows of four at most, what keeps food cold first, then what cleans, what cooks, the coffee; then
  "Small appliances" ("Show all ›") over a row of five, every small one a row whatever its kind would draw alone. Both
  lead to a subview of every appliance (never a tab; back to Home). A room has its own the same way across its columns
  (a wall's two), its headings leading nowhere: the room holds them all. A house without appliances is as it was. The
  band is one section across the view's columns, which Home Assistant narrows to a screen's; its cards are the
  appliances card's, which shares the band out itself: a card's share of a section is fixed, and four across a desktop
  would leave a tablet's band a quarter empty.
- **"Tell me when it's done"** (an administrator's, `show_notify`; never for what does not finish a cycle — a fridge,
  a freezer, a wine cooler, whose compressor on a plug would say "done" each time it rests, a hob, a coffee machine): on
  the whole card, a bell beside the figures,
  centred under the power round — the glyph alone in the text's second ink until it is on, then the accent's round
  (the power round's working tint). A tap writes a native automation through the automations store: when the
  appliance finishes — its integration's word that a cycle completed (LG's), else its state (or its phase) turning to
  a word that means finished, else a plug's power under half its running power for its minutes, else a running sensor
  going off — a notification titled with its name ("Dishwasher is done.") on the administrator's phone (Home
  Assistant's app on a device their person tracks), else among Home Assistant's own notifications. On at once, until
  the house lists it; then a tap turns it off and on, and a hold readies its removal — the warning's round, the bin,
  "Tap again to delete" — which a tap does within four seconds. Its shape is narrow, as a schedule's is (`fluvy_done_`
  and the appliance); Home Assistant lists, edits and deletes it as any other automation. Never for a guest, nor where
  nothing says the appliance finished (a fridge, a hob, a coffee machine); out of reach it keeps its place, disabled;
  where the figures' words would not hold beside it (half a column) it gives way.
- **Glyphs**: the ten kinds (washer, dryer, dishwasher, oven, microwave, hob, fridge, coffee, kettle, air fryer), the
  three small ones' and the rows' (a shirt, warm air, a cup, a wide cup, a bean, a filter, chips) are drawn by the
  family's chunk, which adds them to the set as it lands; the six a person would pick are outlined in the icon set
  (`fluvy:washer`, `fluvy:dryer`, `fluvy:dishwasher`, `fluvy:fridge`, `fluvy:oven`, `fluvy:coffee`). A hood is the
  fan, an appliance on a plug the plug.
- **Out of reach, as Home Assistant writes it (1.9)**: unavailable, unknown or gone from the house, an appliance draws
  the live card's parts at every column — its roles are its registry's (LG's older integration's attributes, which Home
  Assistant stops writing while the device is away, are remembered from while it could be read), a missing entity's
  capabilities (a setpoint's range, a select's options, a sensor's unit and class) as they were last read
  (`@fluvy/core`'s `capabilitiesOf`, beside `resolveEntity`'s view), and an entity gone from the house counts as out of
  reach as an unavailable one does (the status offline, the card's dashed skin). The house's appliances are found in its
  registries: their entities gone from the house leave every row, tile and whole card in place.

### Pet devices (1.13, #112)

**A feeder, a water fountain and a litter box are appliances**, so they take the family's whole anatomy — the picture,
the head and its round, a hero of 108, three rows, the buttons a card asks for, every layout, the list and the
dashboards' bands — and change only their hero and their words.

- **What it is**: PetKit's device type (its model id: `D3`…`D4SH` a feeder, `T3`…`T7` a litter box, `W4`, `W5`,
  `CTW2`, `CTW3`, `W7H` a fountain), PETLIBRO's product code (`PLAF` a feeder, `PLWF` a fountain, `PLLB` a litter box),
  else the keys only one of them has (a meal now, a litter state, a filter's percentage), else its name in the fourteen
  languages ("Futterautomat", "Arenero", "自動給餌器"; a glitter lamp is no litter box). A pet of PetKit's own is a device
  too, never an appliance. Both integrations are the community's (HACS) and named by their translation keys; their
  buttons, texts and switches are pinned from their source as Home Assistant's own are.
- **What it is doing**: a feeder feeds while PetKit's flag says so; a litter box's work state is folded as every
  appliance's (cleaning, levelling, dumping at work; a clean paused for a cat paused, its reason in Home Assistant's
  words); PetKit's box with its light on is at rest ("Light on", a word its translations lack), and only a clean, a
  dump and its maintenance pause: a calibration, a reset, a levelling or a deodorizing is at work with no pause
  (1.13.1); a device that says it is not reached (PetKit's device status, PETLIBRO's Wi-Fi flag) is out of reach;
  PetKit's error message (not its "No error") and PETLIBRO's dispenser fault are a failure. What is out — the food, the
  water, the litter, a full waste bin — is said in the head in the warning's ink ("Refill the food"); a feeder at rest
  counts down to its next meal ("Next meal in 1 h 13 min", its status's word the shorter form), on the minute's clock.
- **Its meals**: PETLIBRO's last and next feed are sensors of their own, their amounts beside them; PetKit's are the rows
  of its plan (its "Feeding schedule" switch's attributes, the same shape as PETLIBRO's plan): the last of today's
  given, the first still to come (one due a minute ago is on its way), else tomorrow's first on its weekdays; a plan
  switched off has none to come. The plan's times are the house's (its time zone), as the device keeps them. Amounts in
  the plan's unit: grams, or portions where the feeder counts them so.
- **The hero is two tiles** (`tiles`, the rows editor's, any number two a row): the compartments' tiles (84, radius 12,
  the page's fill, the name 15/400 over the value 22/700), the circle 16 from its words and ringed by what is left
  where the part says it in percent (2, 6 out of the circle, on the border's track, in the tile's tone). A part's tile
  is the kind's tone while fine (a feeder's and a litter box's the accent, a fountain's water), the warning's when it is
  soon, the danger's when it is out, its value in that ink. A feeder's food and next meal (its time: the row says the
  amount), a fountain's water and its filter, a litter box's litter and its waste bin. Compact, they are its readouts;
  on a dial the first that says what is left fills its ticks.
- **The rows** never repeat a tile, and a part due that a tile says never takes a row: a feeder's last meal with its
  amount, what it gave today and its desiccant; a fountain's drinks today, its last drink and the water it purified; a
  litter box's last use and by whom ("21:05 · Luna"), its uses today and its deodorant. A part's days left are said as
  days ("12 d"), in the warning's ink within `low_days` (seven), the thing to do when none are left.
- **The round is the button that matters**: a meal now (PetKit's amount written to its text, its smallest unless the
  card names one, `feed_amount`; PETLIBRO's button gives the amount set on the device), a litter box's clean, or a
  resume while a cat has paused it, a pause while it cleans; a fountain's power. A meal, a clean and a levelling ask
  first in Home Assistant's dialog ("Feed 20 g now?", "Clean the litter box now? Check that no pet is inside."); a
  deodorizing does not. `show_controls` adds the rest (deodorize, level, pause); the dump that empties a whole box is
  never a card's. A reminder's hold resets a filter, a desiccant or a deodorant, after asking.
- **The pictures**, in the family's hand: a feeder in white enamel, its hopper's smoked window on the kibble, a steel
  bowl in its base; a fountain whose water wells up on its steel top over a clear tank; a self-cleaning litter box, its
  dome, its dark entry with the litter at its foot, its drawer. Their glyphs: a hopper over a bowl, a tank under a drop,
  a dome over its entry; a paw for the pets.
- **On the automatic dashboards** the pet devices are a band of their own after the small appliances ("Pets", whole
  cards side by side), never "Large appliances". The list says what a feeder, a fountain or a box has left at a row's
  end ("64 %") and its next meal or last use under its name.

## Light colour (1.7)

- **A colour bulb's controls** (`supported_color_modes` with `hs`, `rgb`, `rgbw`, `rgbww` or `xy`) live under the
  brightness block of the full layout: **one ruler slot** and **a row of quick colours**. The slot holds the
  colour-temperature ruler while the bulb is white (`color_temp`) and a **hue ruler** (`tint: hue`: the hue circle
  along the ticks, the knob's dot the hue under it, 0–360 in whole degrees) while it glows a colour, or always where it
  has no white to set. A release sends `hs_color` at the bulb's own saturation (100 where it reports none).
- **The quick colours** are 44 rounds, 8 apart, from the left, wrapping (six fill a phone's column): each its colour
  with a 1 px edge of that colour a shade deeper (`color-mix` 86 % with the text ink), the one the bulb is on with a
  check in black or white by luminance. A colour sends `rgb_color`, a white `color_temp_kelvin`, both wake an off
  bulb; **the swatches are the mode's switch** (a white brings the temperature ruler back). The bulb is "on" a swatch
  within ±12 a channel, or within 15 % of its temperature range. The default six are warm and cool whites (2700 and
  5000 K, clamped to the bulb; each round shown beside a neutral 4000 K, so the cool one reads as a cool white and
  the warm one warm — a black body's 5000 K is a peach cream on a screen) then red, orange, green, blue; a bulb without a white gets red, orange, green, blue,
  purple, pink. The house lists its own (`colors`: `warm`, `cool`, a Home Assistant colour name, `#rrggbb`,
  `[r, g, b]`, `picker`, or any of those with a name — `{ color: '#ff2d55', name: 'Lila' }`, 1.8); a colour name is
  Home Assistant's own bulb colour, not the palette's tone — a bulb wears no palette. **The list is the house's, any
  number, any mix, any order** (1.8): no cap and no minimum, the rounds wrap by count (three one short row from the
  left, twelve two rows of six at a phone's column), the card's height follows the rows, `colors: []` draws no row,
  and the picker is a peer of the rest, wherever it is put. **What a round says** (its title and accessible name,
  the picker's input): the name the config gave it; else a white's word, the picker's, a colour's word where the
  catalogue has one, a hex as itself (canonical, `#ff2d55`), any other Home Assistant colour as words ("Deep purple").
  **The editor edits the list row by row** (the rows editor, reorderable): a row is a colour — the words, the
  picker, or Custom colour, which shows Home Assistant's colour well under it with its word as the helper (the well
  paints its whole box, so it carries no floating label; nothing is typed into the select — Home Assistant's select
  with a typed value says the value, not the word; a Home Assistant colour name still reads from YAML) — and a name; the bulb's default six show as rows until the list is touched, and the YAML
  stays the smallest that says the same (a word alone bare, a custom colour its hex, a name wrapping it as
  `{ color, name }`). **`picker`** is a round ringed in the hues (the colour wheel's conic) that opens the browser's own colour
  picker: an `<input type=color>` fills the round unseen, so the tap and the keyboard reach it; a colour chosen there
  is sent as `rgb_color` 250 ms after the last change (a drag in the picker is not a call a move). The round holds
  the bulb's colour, checked, inside a 3 px ring of the hues while the bulb is on a colour none of the other rounds
  has — a white is never the picker's — and opens on Home Assistant's orange otherwise.
- **The hue ruler's words** are its colours by value — red, green and blue where it holds them (0°, 120°, 240°) — as
  many as its column keeps 8 apart: green gives way first (Portuguese in a narrow column), then the others; the row
  keeps its place. A colour bulb **compact by its width** (half a section, a zoomed phone) keeps one row of its quick
  colours, as many as fit at 44 + 8, the picker kept last; `variant: compact` asked for keeps the ruler alone.
- **The card's colour (1.9, #41)** decides by whether a colour resolves, never by whether a key is written: its own
  `color` (a name, a hex; Primary or Accent is the palette's accent, named; Home Assistant's State, the editor's
  default, follows the light), else its `tone`, else **the light's**: the finger's choice while held (five seconds or
  until the bulb reports it, as a level is), what the bulb glows (`rgb_color` in a colour mode), a group's lit members'
  colours by their brightness (`entity_id`; each white by its warmth, or — `light_whites: palette` — adding nothing as
  the palette shows whites, so a red bulb among them glows red where Home Assistant's own mean would wash it to a beige
  and its majority mode call it white), and, while a flip waits for Home Assistant, the colour it last glowed (kept for
  the page), so it never flashes the palette's light first. Glowing none, the palette's lit light
  (`state['light-active']`, never the name amber, which is a near black on Noir). The icon circle, the switch and the
  rulers take it through the lit-light family `data-accent` remaps; `compact` too.
- **Whites** (`light_whites`, 1.10, #58): `temperature` (the default since 1.10, the owner's call) shows a lit white
  on one scale, from Home Assistant's own colour for its temperature (its `rgb_color`, marked a white: `WHITE`): its
  hue, and as much of the band's chroma as its share of a candle's (2,200 K) — a candle the warmest, 2,700 K plainly
  warmer than 4,000 K, 5,000 K nearly neutral, daylight (6,500 K) neutral, a cool white (above it) as cool as it is
  far from daylight — fitted to every gate a colour clears, never the grey ladder (`accentFamily(…, white)`); each
  step of the ladder at least a just-noticeable difference from the next. `palette` shows it as the palette's lit
  light. A white Home Assistant gives no colour for, a light that only dims and one that only switches have no colour
  of their own: the palette's lit light, whatever the setting. A group of whites is a white (their mean by
  brightness), one with a colour bulb among them a colour. The same key, the same default, on the light card, the room
  lights card, a tile, a tiles group, a room and an entities card (`litColour`, `cards/src/shared/light.ts`).
- **One rule for every light drawn (1.10, #58)**: a light's own `color`, else its own `tone`, else its bulb's colour
  (where the card shows bulbs' colours: `light_colors`), else the card's `color`, else the card's `tone`, else the
  palette's lit light (`lightLook`, `cards/src/shared/light.ts`). A bulb's colour and the card's are drawn in the
  lit light, which a colour's family redefines (the card's reaches it as the card's accent); an item's own in the
  accent, as every item's colour is. On a card of one light (the light card, a lone tile) the card is the item: its
  colour and tone come first. A light group wears its lit members' colours by their brightness on every card
  (`entity_id`), its members watched with it; a room's lights row is the mean of the room's lights, each lamp once (a
  group in the room counts as its members, `lampsOf`). In the editors an
  item's colour on a card of lights, tiles or rows shows none chosen — its default is its bulb's, else the card's, never
  the palette's accent — and the line under it says so (`accentField(…, { bulb })`); a default is never written.
- **The card shows its colour (1.9, #41)** — `tint`: `off` (never), `on` (while the light is on), `always` (at rest
  too); where the card says none, the house's (§ Settings panel → Lights; off). `tint_strength`:
  - **`full`** (the default) is **a lit tile's skin, rule for rule** (`.fv-card.is-lit` beside `.fv-tile.is-on`):
    the tone's fill, its hairline, the on-fill ink for the words and the state line at 80 %, a plain-card circle and
    switch thumb, the rulers on the fill (`on-fill`: their ink, their knob, their resting ticks), the stepper a
    plain-card pill. So it matches a lit tile on every palette, solid ones included (Volt's lamp is a solid fill with
    black on it). Its labels — the level's, the rulers' and their words — take the state line's ink (the secondary ink
    falls just short of 4.5 on Sage's and Harbour's fills); the temperature ruler's warm and cool ends take half the
    fill's ink; a quick colour's edge is the fill's ink over it (40 %), whatever its own colour.
  - **`soft`** and **`brightness`** are a wash (`litSurface`, `[data-surface]`): the role's fill over the card, its cap
    the most of it at which the words read at 4.5, the role's ink (the glyph, the switch's track, the ruler) at 3 and
    the fill's hairline at 1.35; lit it takes `rest + (cap − rest) × max(0.6, level)` (rest is two fifths of the cap),
    quantised to 5 %: a lamp at 10 % reads lit (1.13–1.22 from the card on the tints, 1.36–1.48 on the dark solids)
    and lit never equals rest. `soft` is that floor whatever the level; `brightness` follows the level, and the finger
    while it drags. On a wash a ruler's words take the secondary ink, its resting ticks half the wash's hairline, the
    inner fills the wash's deeper step (`--fluvy-inset`), and lit the circle and the thumb are plain-card discs.
  - **`full_brightness`** (1.17, #131) is the whole fill as much as the lamp is bright (`litFull`, `[data-surface]`
    `full <colour>-<level>`): from the soft wash (the floor's share) at the lowest step to `full` itself at 100 %, the
    very card, in 5 % steps that follow the finger. Two sets of inks take turns on it: the card's (a wash's, as above)
    and the fill's (a lit tile's skin: the on-fill ink, its state line at 80 %, a solid fill's ink on its switch and
    rulers). The card wears the fill's from the step where they clear their gates (words 4.5, the ink 3) at least as
    well as its own: from the first on the tints and the light solids, at 25–40 % on the dark solids (Volt, Mint, Noir:
    light words on a dim wash, dark ones on a bright fill). Where neither reads (from about a quarter to three quarters of a dark solid's fill)
    those shares are left out and each side's levels spread over what reads, so the inks and the surface change once,
    at one step, the same up and down — tied to the step, they cannot flicker. On the fill's side the step redefines
    what the role is drawn by (its fill and hairline: the accent's and the lit light's for a colour), so the thumb, the
    knobs and a quick colour's edge wear the step, and the hairline keeps 1.35 from it on the side it sits at 100 %.
  - **At rest** (`always`) every strength shows the rest wash of its own colour (or of the palette's light), unless the
    card has a `card_color` — that is its rest. Lit, the light's surface is over a `card_color`. A light that cannot be
    read keeps the unavailable skin: a state is never covered.
  - The surface eases in (background 320 ms, as a tile's) once the card has drawn — never on its first frame, which is
    drawn in the colours it ends in — and at once under reduced motion. No glow, no shadow.
- **A light that cannot be read keeps the card (A7)**: unavailable, unknown or gone, the head with its disabled switch
  and "Unavailable", the level "—" with its still stepper, the brightness ruler, the temperature ruler and the quick
  colours, faded and out of reach (a light Home Assistant has not described draws as a dimmer). Its height is its
  config's, whatever its state.
- **Heights** are the config's: the slot (100) when a temperature or a hue ruler may show, the row (8 + 52 a row of
  six) when the colours may; a white bulb under the same config draws less. `show_color: false` is the white bulb's
  card. The controls' table and row come in their own chunk the first colour bulb fetches.
- **A bulb that only switches is its head alone (1.11, #65):** a light whose `supported_color_modes` is `onoff` alone
  draws the light card as its head — the circle, the name, the state line (the area, else the state), the switch — in
  every style, `full`, `auto` and `compact` alike: 20 + 44 + 20 = **84** (`sl-card--switch`, `min-height: 0`), where
  1.10 left the head alone in a dimmer's 256 box (the automatic dashboards draw such a light as a tile). Its editor
  offers only what the bulb does: the layout, the stepper and the
  live update while the bulb dims; the temperature ruler and its tint with a white; the colours' switch and the quick
  colours with a colour; how whites show with either; everything for an entity the house has not described. A light
  Home Assistant has not described (gone, or unavailable since it started) still draws as a dimmer (268); one that
  only switches and cannot be read keeps its on/off anatomy (the attributes Home Assistant keeps), its switch
  disabled.

## Automations (1.8)

**The card lists, Home Assistant automates.** `fluvy-automations-card` is every automation of the house as a row: a
clock circle for a Fluvy schedule, the automation glyph for the rest, the name, and under it the schedule's days,
its window and its next run ("Workdays · 06:45–08:00 · Next in 9 h") or the plain automation's last run ("Ran
07:00", "3 days ago", "Never run"); the switch at the end (`show_switch`, a chevron without it), the row's tone the
card's accent while it is on, the Unavailable skin with an inert switch when it cannot be read. A schedule that
cannot run (Home Assistant could not load it: its id stays written) keeps its line without a next run, so its row
stands as it did; a listed automation gone from the house is a row that says so. The tiles go one a row where a value
would be cut — measured with the words a tile says out of reach as well ("Unavailable", "Entity not found"), so one
dropping out or coming back never lays them out again (1.9). **Rows** (60),
**compact** (48, the name and its switch), **tiles** (two a row of 84: the name and its next or last run, the on
ones lit; one a row where a line would be cut). Long lists fold after `max_rows` into "{count} more" / "Show less".
The head: the icon circle, the title, "{on} of {count} on", and **one trailing element** — the `+` round for an
administrator (`show_add`); the head itself is the card's button for its `tap_action` and its hold (#42), so it has no
"…" of its own. `show_filters` puts the chips All · Schedules · On under the head (44, 16 under); `show: schedules`, `area`,
`sort` (name, next, last; a listed `entities` keeps its order under name) narrow and order the list. **Days as
people say them**: "Every day", "Workdays", "Weekends", a run of three or more with an en dash ("Mon–Fri", "Fri–Mon"
across the week's end), the rest one by one ("Mon, Wed, Fri"); the short weekdays are the language's own. Moments:
the house's clock ("09:05", "09:05 AM"), "Sunrise", "Sunset −30 min", "Sunrise +1 h 15 min"; a window is its two
moments with an en dash ("09:00–11:00", "Sunrise +15 min–Sunset −30 min"). **A narrow row's line gives way in an
order, each form whole, never a segment cut**: the next run says itself in fewer words ("In 10 h") and then goes,
the sun's offsets go ("Sunrise–Sunset"), the end goes, a long day list becomes "4 days"; the days' word and the start
never go, and where even that least line ("Every day · Sunrise") would not hold beside the switch (whose 56 is
reserved before anything) it takes a second line and the row grows. An empty house: the empty panel ("No automations", "Tap + to
add a schedule" where there is a `+`); an emptying filter says "Nothing here"; an empty card's head
counts nothing (never "0 of 0 on"), as every list's. Everyone sees the list and the switch; only an administrator
reads configs (Home Assistant allows no one else), sees the `+` and opens the sheet — a tap is Home Assistant's own
dialog for the rest.

**A card for one lamp (`targets`, 1.9).** A popup's card is about a few entities, not the house: `targets` (an
ordered list, each an entity with its name, icon and what a new schedule for it does — its verb, a light's level, a
thermostat's temperature) and the list shows **their schedules and the automations Home Assistant relates to them**
(`search/related`, which anyone may ask: what names them in a trigger, a condition or an action; their device too
where it drives nothing else — never a group or a scene they are in). `show: schedules` is the strict view; with
`targets`, `area` and `domains` say nothing. **Nothing flashes**: until Home Assistant's first answer the body keeps
the empty panel's room blank (`aria-busy`), the head's line its place. **The head speaks for the lamp**: on one target
(an administrator's, `show_next`) its line is what the lamp does next and when, by the soonest change of the schedules
listed that are on — "Turns on in 9 h · 1 of 2 on", "Closes Mon 07:15", a window's end doing its `after` — the count
giving way first, and where even that change would not hold, the count alone (never cut). Empty: "Nothing scheduled
for Kitchen lamp yet" ("Kitchen lamp +2" for more); "Entity not found" when the house has none of them, the `+` there
and still (an unavailable card keeps its anatomy). A long name breaks inside the panel, never past it. A schedule is a
schedule to everyone: one a guest cannot read is known by its `fluvy_` id (the clock, `show: schedules`), and an
administrator's never shows as plain before its config lands.

**The sheet** (`fluvy-schedule-sheet`, a chunk of its own fetched on the first tap) is the keypad's modal bottom
sheet: 392 wide, 16 padding, radius 24, the scrim behind it; the dialog is the viewport and **the sheet scrolls
inside it** — its footer ends the content, nothing sticky, so it opens whole on a phone at 150 %. Sections 24 apart,
a label (11/600 caps) 8 above its control. **What**: a live search field (the search glyph trailing; keys typed in it never reach Home Assistant's shortcuts),
the targets chosen as content-sized chips with a close glyph, the candidates as compact rows grouped by area ("No
area" last) — **six matches, then "{n} more · keep typing"**, never an inner scroll; **a candidate that shares no verb
with those chosen is not offered**, so Do is never empty. **A card's targets** (`only`) take its place: **one is a
fixed row** — a row, not a chip, because it is information, not a control: its icon, its name, "Kitchen · On", the
Unavailable skin when it cannot be read — and a new schedule starts on its verb (its own, else its domain's first) with
its level or temperature, so `+` then Save is a working timer; **two to six are chips that fill their row and press
where they stand** (nothing moves under the finger), one that shares no verb with those pressed disabled; more are
searched among themselves; a target from elsewhere (a schedule written for the lamp and the hall) stays as a chip that
removes it, never dropped unseen. **Do**: the verbs the targets share as tiles (Turn on · Turn off · Open · Close · Run; chips where a
word would not hold its tile), the chosen one carrying its value ("70 %", "21 °C"); a light turned on gets a
Brightness row with a stepper in fives from "As it is", a thermostat a Target row in the house's unit; dimmed until
a target is chosen. **When**: four tiles — Every day · Workdays · Weekends · Custom, 2 × 2 — **Workdays always
available**, its second line "Workday sensor" when the house has one and "Mon–Fri" when it has not (the data layer
writes the sensor condition or the weekday list); **a tile's value is one line, measured**: where it would not hold
its cell it takes its shorter word ("Sensor", "4 days"), else goes — dropped, never wrapped — so every row of tiles
stays 84 ("70 %" under Turn on by the same rule); a value that describes rather than measures ("Workday sensor",
"Mon, Wed, Fri") is set as a word — the label's ink at 13/500 on the value's line (`.fv-option__value--word`) — never
at a figure's weight; Custom shows **the seven days as chips in one full row** (four
and three where seven short words would not hold), from the day the house starts its week on, each named in full
for a reader. Start: At a time · Sunrise · Sunset, then the time field (its arrows move the minutes by `time_step`,
five by default) or the Offset row ("Sunset −30 min · Today 19:11", a stepper by the same step within ±3 h). Until:
a switch that reveals **the quick ends** (its row their label: "Until" is said once; 15 min · 30 min · 1 h · 2 h after
the start, a chip row that fills — two and two where four would cut a word; the one the end is now pressed; one a sun
start's offset could not reach past ±3 h disabled), then the end's chips and field and, with two verbs to choose from, a
compact "At the end" row defaulting to the opposite; hidden for Run. **The end follows the start until it is set by
hand**: a window starts an hour after a clock start (within the day) or at the sun's other event, a quick end keeps its
span while the start moves (past midnight it runs into the next day), and "At a time" comes back to the time a moment
last had, never 08:00. The three mode chips go two and one where three would cut a word. **Name**: a text field that
suggests itself ("Kitchen lamp · Mon–Fri 09:00–11:00", "+1" for more targets) until a name is typed. **Footer**: for an
existing schedule a full-width Delete in the danger ink that **arms on the first tap** ("Tap again to delete" on the
armed button, § Colour, Armed; forgotten after four seconds), then the pair Cancel · Save — **one width for both**: the
design's 172 where the row holds two of them and the 16 between, else the row's equal share while the longer label holds
it ("Abbrechen" on a phone at 150 %), else the label's own and the two stacked — **Save disabled until the schedule is
whole** (a target, a verb, a start; an end before a clock start is "until tomorrow" and allowed).
Saving is honest: the sheet dims and locks, a success closes it and the row appears the moment its entity does, a
refusal keeps it editable with Home Assistant's message under the footer. The focus goes to the verb chosen (an existing schedule's, a card's one target's), else to the search or a card's
first target, on opening, and back to the row on closing; Escape and the scrim close. **The sheet reads the card's
clock** (a new schedule's next whole hour, "Today 19:11", "2 days ago"). **In a popup** (Bubble Card's, which closes on
a window's Escape and slides closed from a touch on itself) Escape closes the sheet alone and a touch that starts in it
is its own — the keypad's dialog likewise. **Details** (a
plain automation): the name, "last run · On", the switch in the head, "Open in Home Assistant" and "Traces" as rows
(with a config id), the pair Close · Run — Run reads "Done" for a beat, as the actions card does.

**Heights** at a 360 column: the head (100), the filter chips (60) when shown, then 60 a row, 48 compact, or the
tiles two a row (84, 8 apart) with the fold row (16 + 48) under them; the empty panel (132 with its hint) under the head.

## Alerts (1.9)

**One definition drives an alert: its count, its list and what can be done about it.** `fluvy-alerts-card` takes
`alerts`, a list where each alert is one line for what a house usually wants — `preset: low_battery`, `unavailable`,
`open`, `unlocked`, `hazards`, `errors`, `updates`, `lights_on`, `ha_alerts`, `repairs` — or the person's own
matcher, and anything over it: a name, an icon, a severity, a tone, a colour, more scope (`area: kitchen`), `for`.
The count, the list in the sheet and the buttons all read that one definition, so they never drift apart.

- **The grammar.** A clause is the AND of its keys; `match` is a clause or a list of them (any matching). Scope:
  `entity` / `entities` (ids, or objects naming one), `entity_id` (`*` and `?`, or `/regex/`), `domain`,
  `device_class`, `integration`, `area` and `floor` (id or name; the entity's area, else its device's), `label` (on
  the entity, its device or its area), `device` (id, name or a name's pattern), `exclude`. Conditions: `state`,
  `not_state`, `above` / `below` (strict, as Home Assistant's numeric state), `attribute` (alone: there and truthy).
  Modifiers: `for`, `unchanged_for`, `include_unavailable`, `hidden`, `diagnostic`. With a preset or `match`, the
  alert's own matcher keys narrow every clause (but the preset's parameters: `below`, `phones`, `acknowledged`), and
  its modifiers are every clause's default before the preset's. A config entity matches only when named by its id;
  unavailable and unknown never match unless `state` names them or the clause includes them.
- **Honest time.** `for` counts from when the state last changed (a restart resets it, as in Home Assistant); a
  number or an attribute counts from the first moment the card has seen it hold, seeded with the entity's last
  change or update — a lower bound, never a guess. `unchanged_for` is "neither state nor attributes changed": the
  frontend never sees when an entity last *reported*, so a sensor that repeats one value looks unchanged too.
- **The presets' sense.** Low batteries are 20 % and under (the battery glyph's warning), a battery that says "low",
  a battery binary sensor on; charging ones wait, phones stay out unless asked; counted by device, the lowest first.
  Unavailable waits five minutes (a restart's flapping), counts a dead node as one device of six entities, and never
  lists buttons, events, scenes or diagnostics. Open waits five minutes (a door walked through is not left open: Home's
  "Needs attention" never jumps at one): doors, windows, openings, and door, garage and gate covers (a row's Close).
  Unlocked waits ten minutes (Lock on a row, Lock all asked first). Hazards are critical. Errors: a vacuum or mower in
  error (Dock), a jammed lock, a problem sensor. Updates are information (Install for an administrator, while the update
  can be installed from here). Lights on: Turn all off, asked first. Home Assistant's alerts are one alert each
  (`split`), acknowledged through Home Assistant (`alert.turn_off`). Repairs are for administrators; a repair's own
  severity raises the alert's. Hazards, errors, updates, low batteries and lights on are news at once; `for` says
  otherwise (`for: 0` at once).
- **Severity sets the order and the tone; a colour is identity.** Critical, then warning, then info (then the
  config's order; `order: config` keeps only that). Critical is the danger tone, warning the warning's, info the notice
  — the accent where it never reads as a warning or a danger, else the palette's blue (§ Colour, Information). A tone
  asked for by name outranks the severity's (as everywhere: only a tone by name outranks a status); a `color` paints the
  alert's circle and rest wash, never the severity's fill, never its place in the order. `escalate: {for, count}` raises
  an alert (to critical unless said): a door open five minutes is a warning, at thirty critical.
- **When it applies.** `conditions` are Home Assistant's own visibility shapes, pasted as they are: state, numeric
  state, screen, user, time (the house's zone, across midnight, weekdays), location, and, or, not. `admin_only`
  shows an alert to administrators only.
- **Snooze and acknowledge** are the person's: kept in Home Assistant's user data, so they follow them to every
  device (`snooze: device` keeps them in this browser, `house` for everyone and written by administrators only,
  `off` none). An hour, eight, until eight tomorrow in the house's zone, or until it changes — each entity comes back
  the moment it changes again. A snoozed alert waits in the overview, with Wake.
- **Cost.** The card watches the whole house and pays for what changed: states compared object by object, only the
  changed ids tested again against the alerts that can match them, every clause compiled once; one timer for the
  earliest deadline (a `for` reached, an escalation, a snooze over, a time window's edge); the same answer — and no
  redraw — while nothing it says changes.
- **Five ways to show them.** `variant: tiles` (default): compact tiles on the page as a group's (two a row, 8 between
  rows, the section's gap between columns; `columns` 1–4 or `auto`, never narrower than 128), each alert filled in its
  tone — its circle, its name over its line, its count. `mini`: 108 tiles, the circle over the name and the line, three
  a row. `chips`: a strip of filled pills, glyph, name and count, in equal cells — as many a row as hold every name
  whole, else two a row (a long name ending in its ellipsis), else every pill its glyph and count alone, the name its
  label. `rows`: a card, its head "Needs attention" (its short "Attention" where the long one would not hold whole)
  with the count of alerts as a badge in the gravest tone, then a 60 row an alert — circle in its tone, name, line,
  count in the tone's ink, chevron; `compact: true` the 48 rows, name alone. A narrow column gives way in an order,
  every row together: the circles, as every list's; then, where a name would still end before it had begun beside its
  count and the chevron (half a section: 152, 172), the row's end — the count moves into the line as a tile's badge does
  ("Hall spots +1", "4 devices"), the chevron goes (the whole row is still the press), and the name has the row; compact
  rows say the name alone. `min_columns` stays 6, as every list's. `banner`: one tile, the gravest first, turning to the
  next every `rotate` seconds (6) with the words cross-fading; a pointer on it, the focus in it or a tab not shown holds
  it; held still (no motion, `rotate: 0`) it shows the gravest and says how many more. `max_alerts` folds the rest into
  a "2 more" tile, chip or row that opens the overview.
- **A tile's line says who, then what.** One match: its name with how much or how long ("Front door · 6 min", "Hall
  sensor · 12 %" — a number is how much), else its name alone, the time going first. Nothing is said of how long in a
  match's first minute (never "1 min" of a leak a moment old), on a tile, a row or in the sheet. Several: as many names
  as hold whole and how many more ("Hall spots, Balcony light", "Hall spots +1"); where the count is said beside the
  line (a tile's badge, a row's value) the names alone, the first ending in its ellipsis where it must; where not even
  that holds, how many ("4 devices"). A split alert (a Home Assistant alert) is its own entity: its line says how long.
  `show_culprit`, `show_duration` and `show_count` turn each part off.
- **What gives way, in a tile.** The count's badge first, as a head's: it stays only where the name is whole beside it.
  Then the circles, all together, as a head's circle: where dropping them makes a name whole, or where a name would
  end before it had begun beside one (96, or the name itself). A compact tile under 128 hides its circle by its own
  rule.
- **Severity's tone, the alert's colour.** Critical is the new danger tone, warning the warning's, info the notice;
  `tone` by name (the alert's, else the card's) outranks it. An alert's `color` is its circle's glyph on the card's fill
  (on a tile, a row's circle family) — never the fill, never the order.
- **Hidden while all is clear.** The card steps aside (`hide_empty`, true for this card: `selfHide`, said to the
  dashboard both ways, kept connected so a `for` reached shows it again), never in the editor — there it draws "All
  clear" over "Hidden on the dashboard while all is clear" — and never while its sheet is open. `hide_empty: false`
  keeps the quiet "All clear" tile, chip or the head over its empty panel; `empty_text` says it in the house's words.
- **The sheet** (the schedule sheet's pattern: a modal bottom sheet, 392 at most, its own chunk fetched the first time;
  Escape, the scrim and the close round close it, the focus goes back to the tile). A tap on an alert opens its sheet:
  the alert's circle, its name, "4 devices · oldest 2 h"; a 60 row a match — or a device and its entities when it
  counts devices ("3 entities · Office · for 6 h") — its glyph (the dashed ring when it cannot be read), its name, where
  and how long, its state in the tone's ink; a source item's word (a repair's "Warning" beside a critical one) in its
  own severity's ink; a row's button (Lock, Close, Install, Dock, Acknowledge) raised beside the row's press, the state
  then said first under the name. A row's tap opens its entity's details (a device of several: its page, for an
  administrator), the sheet stepping aside first; a hold, the device's page. Rows give their circles to their names
  together, as every list does. The footer's buttons share one width, two a row (one where a label would not hold half —
  decided on every label the footer can say, the armed one too, so the first tap moves nothing): Snooze, then the
  alert's own, the first the accent; alone, beside Close. A button that acts on every match asks first in the sheet
  itself — "Tap again to confirm" on the armed button (§ Colour, Armed), its own confirmation text over the footer — and
  Home Assistant is not asked again. Snooze opens a filled row: 1 h · 8 h · Tomorrow · Until it changes (not for a
  source with no state to wait on, the repairs), and Cancel. A button that clears the last match leaves the sheet saying
  "All clear" over Close; the card steps aside once it closes. While the sheet is open, the times it says move on with
  the minute. The sheet wears its card's mode (`dark`, `no-theme`), kept in sync while it is open, so its own rules for
  dark (an off switch's thumb) apply as on the card — the schedule sheet and the keypad likewise.
- **The sheet's words are never cut**: what its head says under the alert's name, and a row's line (a lock's state
  beside its button, "3 entities", "Snoozed until Fri 00:47"), take a second line where one does not hold them (a row's
  60 holds two). What gives way first: the alert's circle in the head (never the round back to the overview), the rows'
  circles together where a state or a count would not hold beside one, a state at the row's end that would leave the
  count no room (said first under the name instead), a button's words where its state would not hold beside them (its
  glyph alone, a 44 round, its words its label), Wake's words where the snoozed line would take more than two lines.
- **The overview** (an alert's hold; the rows card's head): every alert that applies — what needs a look with its count
  and a chevron to its own sheet (and back), what is snoozed ("Snoozed until 18:00", "Fri 08:00", "Snoozed until it
  changes") with Wake, and what is clear, quiet.
- **Repairs** are read for an administrator (an alert of others never asks): Home Assistant's own list, the ignored ones
  left out, read again half a second after the registry last spoke, one read per connection however many cards; each
  titled in its integration's words (`loadBackendTranslation('issues')`, `component.<domain>.issues.<key>.title`, its
  placeholders filled), else its id made readable; error and critical are critical. A row opens the repairs page.
- **The editor**: the alerts in the rows editor, each picked as a preset (or Custom), its form showing what that alert
  reads — the preset's parameters, its scope, time, counting and naming, its look and taps — or, custom, the whole
  matcher; conditions, escalation, buttons and `match` as Home Assistant's own YAML. A custom alert that matches nothing
  yet is written `match: []`: a list still empty, never a mistake.
- **Home** (the automatic dashboard) opens with "Needs attention": hazards, open, unlocked, errors and low batteries,
  and for an administrator the updates and the repairs; three tiles, the rest under a fold; hidden while all is clear.

## Room lights (1.4)

A room's lights on one card. **Row** (the default): the head's anatomy — the room's own icon (the area's, else `home`:
never a light's glyph), its name and "2 of 3 on · 63 %" — with a 44 round a light at its end, 8 apart. The room's
switch is a button under the whole card (a tap: every light off when one is on, else every light on, in one call; the
card gives under the finger, `scale` 0.985 — its entrance holds `transform`); the head lets a tap through to it, the
rounds and the gaps between them take their own — a round's hit reaches 4 px into the gaps, the rest of a gap is dead,
so a near miss never switches the room. The card is a group of the room's button and a switch a light (never a switch
inside a button). A lit round takes its colour's fill and ink, as a chosen chip or an on tile — by the rule every
light follows (§ Light colour): its own colour, its bulb's (a colour mode's, derived as an accent family so its ink
holds 3:1; a white's warmth by default, #58), the card's colour, the card's tone, else the palette's light — and a 2
px ring 4 inside its edge (on its fill, in its ink) to its level from the top, all the way round for a light that does
not dim or when the level is not shown: every lit round has a ring, no off one has. The ring follows a new level in
`--fv-base` (its one animation, declared). An off round is the neutral circle; an unreadable one the dashed ring,
which takes no tap and gives nothing under the finger (a hold still opens its details). Rounds that would leave the
name less than 96 (its own width when shorter) take their own line, 16 below the head, on whole pixels: the first
under the head's icon, the last on the content's edge, six a line at most, the lines balanced and sharing one set of
columns; the icon circle gives way first. **Chips**: the room's switch in the head (its hit is 56: the head keeps that
room), a filled chip a light (its glyph and name, chosen in its colour; an unreadable one the dashed ring), columns as
the names hold whole (three: two and one). **Tiles**: the room card's inner tiles (84), two a row; an odd last one
takes the row; one a row where a tile would be under 120, and under 136 a tile gives its name the icon's room. The
tiles take the card's tone and colour where a lamp shows none of its own, say their level as the card's line does
(`show_level`), and show their colour at rest only here (`tint: always`; the rounds and the chips have no surface to
wash — the editor offers it in tiles alone).
`show_brightness` puts one ruler for the room under the head (16 + 44 + 20; the 16 above it is the ruler's own, never
the room's): the average of what is on; a change sets what is on (everything when nothing is). An empty card's panel
sits 16 under its head.

## Template (1.10)

The template card (#59) is the tile card's tile — compact (76, the default), mini (108) or large (168), the same
anatomy, the same heights — whose name, line, icon, colour and fill are Home Assistant templates or words of the
person's own; the tile says only what it shows otherwise (two hooks: its look, its line), so with no template it is
the tile card's tile of the same entity, byte for byte.

- **With an entity** the tile is that entity's: its glyph, its tone, its state line, on a large tile its switch, its
  ruler and its readouts; a template reads it as `entity`, and the person looking as `user`. The fill follows
  `active` (`auto`: as the entity is; `always`; `never`; a template, on by the house's rule — any state not among the
  off ones, a number not 0, `true`/`yes`); the switch, the ruler and the flip still follow the entity, so a large
  tile never says its light is off while it is on.
- **With none** (a tile of nothing) it wears the resting skin, never the off one; it has no reading in its head, toggles
  nothing, and is a button only for what runs without an entity (navigate, a URL, an action, Assist). Its circle is the
  template's code braces (`code`) until it is given an icon — never the three dots, which say "more" on a round that is
  a button.
- **Pending.** Until Home Assistant answers, the tile shows what its entity would — its glyph, its palette, its fill —
  and a blank line (a no-break space) of the name's or the line's height where the words will land: nothing moves
  when they do. A template edited, or the card back on the page, keeps its last answer until the next lands. A
  warning (a name the template reads that is not defined) is not an answer.
- **A template that fails** shows nothing of itself (never its text): no name (its line kept, blank, as while it was
  pending, so a large tile's line never climbs into its place), no line, the entity's own icon and colour; a reader
  hears the entity's name, else "Template". An icon that names no icon (`mdi:…`, a glyph's name) and a colour no palette
  knows are the entity's own.
- **Colour.** A template's answer is a tone of the palette by its name (`warning`, `heat` …) or a colour as the
  card's palette draws it (a Home Assistant colour's name, `#rrggbb`, `rgb(…)`), never handed raw to a lit surface;
  `tint: always` keeps it at rest.
- **The line.** `state` (the default with an entity: the tile's own state line, fitted part by part), `area`,
  `last-changed`, `none` (the default without one), or the person's words — written or a template's: they lose their
  last ` · ` parts first, as a state line does, then what is left ends in an ellipsis as a name does (`data-name`),
  never left out. An entity that cannot be read says so on its line, whatever was asked.
- **Mushroom pastes in:** `primary` → `name`, `icon_color` → `color`, `layout: vertical` and its later `vertical: true`
  → mini (`horizontal`, `default` → compact); `fill_container`, `multiline_secondary`, `double_tap_action`, `entity_id`
  let go when the editor saves; `picture` and `badge_*` kept, not drawn (a follow-up). Its actions are the tile's, not
  Mushroom's: Mushroom's do nothing unless given one, the tile toggles what toggles on a tap and opens its details on a
  hold; `tap_action: { action: none }` keeps a pasted card still (the docs' paste paragraph says so).
- **Editor:** entity (not required), name and icon, the line (a keyword or a template), style and *Shows as on* on one
  row, tone and colour, the card's colour, *Show its colour* only with a colour, readouts only for a large tile, the
  actions; helpers under the name, the line, the icon, *Shows as on* and the colour (a colour template goes in YAML).
- Its chunk is its own (`template`, 2.1 KB of 8): every page carries only its name and height (`template-family.ts`).
- **Chips (1.13, #87).** A chip of the chips card takes the same templates for its words, its icon and its colour (the
  chip's `entity` is `entity` in them; never JavaScript: `[[[ ]]]` is words), one subscription a template, let go when
  the row leaves the page. Pending, a chip holds its pill with a blank where the words will land; an icon that names no
  icon and a colour no palette knows are none. A chip whose words render nothing keeps its icon, and one with neither
  is left out of the row: a chip that shows while there is something to say. The row stays one line, 44 tall, whatever
  the words; a pill whose icon comes or goes is drawn afresh, so it is fitted to its content again.

## Web page (1.11)

The web page card (#61) frames a page — a map, a chart, a site of the person's own — on a plate: the devices sheet's
plate (`.dv-cam.fv-plate`) under a head with the page's host on its line (`plate`, the default), alone on the card
(`frame`: the card's 20 above and below it) or with no card at all (`bare`: the plate alone, with a card's corners and
a card's entrance).

- **The plate** keeps the shape asked for (`aspect_ratio`, 16:9 by default; the camera's shapes, Home Assistant's
  `56%`, or `fill` for the view's height in a panel or grid view) or the `height` written (on the 4 grid, never under a
  plate's floor of 68), which wins. Heights are the config's alone: `plate` = HEAD + the plate across 320 (16:9 → 280),
  `frame` = 40 + plate (220), `bare` = the plate across 360 (204). The page may be drawn smaller (`scale` 0.5–1: a
  dense map at 0.75 shows more of itself) and asked for again every so many minutes (`refresh`), only while the tab is
  shown and the card on screen (the shared ticker).
- **The rounds** sit at the plate's bottom end as a camera's do (44, 8 apart, 12 in): reload, open in a new tab, full
  screen — the open and the full-screen ones by default. A plate too narrow for them gives them up in order, the
  reload first, then the open; the full-screen round stays, and every one is back in full screen. Full screen is the
  plate's own (`requestFullscreen` on the plate, as the camera's); a phone that has none (iPhone) opens the tab.
- **Loading.** A skeleton covers the plate until the frame's `load`; twenty seconds without one, counted from when the
  plate is on screen (the frame loads lazily: a card scrolled to late has its twenty seconds), the plate says "Still
  loading · Open in a new tab", the tab a link of 44 over the skeleton where the line holds it (the open round is the
  way where it does not). A card taken out of the page stops its clock; put back, its frame asks for the page anew,
  under the skeleton, and the clock starts afresh. A page that refuses to be framed loads all the same, blank: no card
  can tell from outside (the docs say the open round is the way out). A config whose address, sandbox and
  permissions are unchanged keeps the loaded frame (the frame is keyed by them and by its reload count); a change
  asks for a new one.
- **Insecure.** On an https dashboard an http page is never asked for (the browser refuses it without a word): the
  off plate at its size — page fill, dashed hairline, the globe on the off circle over "This page needs https" — its
  reload and full-screen rounds disabled, its open round alive. The address itself is read once, on `setConfig`: a
  scheme no page can be framed from (`javascript:`, `data:`, `blob:`, none) is refused with a readable error; a
  relative address resolves against the dashboard.
- **A state's words never sit under the rounds** (`stateLayout`): they are centred in the room the plate leaves over
  its rounds' 56, 8 at least above and below, on one line — the globe over the words in full, then over their short
  form ("Needs https"); the slow line with its link, then without it; the words alone, in full, then short ("Loading");
  beside the rounds at the plate's start where the plate is wide and low (a `height` of 68 across a full card); the
  globe alone. Where nothing holds (a half card's plate of 68 or 76, a bare one of 84) the skin, the skeleton and the
  rounds say it.
- **The looks.** `page` (the default) is the page's own colours; `dark` inverts the frame (`invert(.92)
  hue-rotate(180deg)` — the one thing that reaches a cross-origin page; pictures invert too, said in the docs); `auto`
  inverts only while the card is dark.
- **The sandbox** is Home Assistant's own set by default (`standard`: its `IFRAME_SANDBOX`), with
  `allow_open_top_navigation` adding its token; `strict` drops `allow-same-origin`, pop-ups, modals and downloads;
  `off` writes no sandbox. The frame sends no referrer (`referrerpolicy="no-referrer"`), loads lazily and takes
  `allow: fullscreen` as its permissions policy.
- **Home Assistant's iframe card pastes in** (`type: iframe`): `hide_background: true` → `variant: bare`,
  `disable_sandbox: true` → `sandbox: off`; both let go.
- **Editor** with `when`: the head (title, icon, its circle, subtitle) and the actions with the plate variant alone;
  the colours on a card (never bare); the shape only while no height is written; top navigation only while there is a
  sandbox; helpers under the look and the sandbox.
- **Two glyphs**: `external` (an arrow leaving its box by the top end corner) and `refresh` (a circular arrow), in
  the design lab and the set, outlined lazily with the 1.10 glyphs.
- Its chunk is its own (`web`, 4.5 KB of 8): every page carries only its name and height (`web-family.ts`).

## Items (1.11)

The Items card (#66) lists the items of one sensor's list attribute — the aircraft a FlightRadar24 sensor keeps in
`flights`, a departures board, parcels on their way — where every other list of the house draws one row per entity.

- **The list.** `attribute` names it; `auto` takes the first attribute that holds a list (`flights`, `items`,
  `entries`, `list` first, then the first list of objects). `items_template` gives it instead: one Jinja template a
  card, one subscription, its answer read as JSON — any sensor becomes a list. An item is an object read by dot paths
  (`altitude`, `airport.city`, `legs.0.from`).
- **The fields.** `item_name`, `item_secondary`, `item_value`, `item_unit`, `item_icon`, `item_image`, `item_url`: a
  path, or words with `{path}` in them, `{a|b}` taking b where a is empty. A number is written in the house's locale
  (0 digits whole, 1 otherwise), an ISO date and time as a moment (its time today, its short date and time otherwise;
  a preset's Unix times too), a truth as On/Off; a " · " segment that says nothing goes, and so does the arrow a blank
  field leaves at its edge ("AMS →"). A name left unmapped takes `name`, `title`, `label` or `id`.
- **Presets.** `preset: auto` (the default) draws flights where the attribute is `flights` or the items carry a
  `callsign` or a `flight_number`, and hides the `item_*` fields in the editor (its helper says what `auto` found);
  `none` keeps the mapping; `flights` asks for it. The flights row: the callsign (else the flight number) over
  "AMS → BCN · Boeing 737-800", the altitude in feet with `trendUp`/`trendDown` before it (the vertical speed past
  ±100 ft/min) or "On ground" in the quiet ink, the aircraft's small photo in its circle, the nearest first. The head
  says "Flights nearby" and "3 aircraft" — "Flights" where even the circle's room would leave the full words cut (a
  preset's title is the card's own words, not a name, so it takes its short form, measured, as the Dutch score's
  word does; a title of the person's own keeps a name's ellipsis); the empty panel "No aircraft nearby". The units are the integration's (ft,
  kt, ft/min, km), as it reports them.
- **Variants.** `rows` (60, the default), `compact` (48: the name and the value, the 40 circle with the glyph),
  `tiles` (76 inner compact tiles, two a row from a 288 column — a 360 phone's card — one under it).
- **Every row is laid out alike**, by the column and the widest value the card can show — the preset's ("On ground",
  a five-figure altitude with its arrow), else the widest the whole list holds — never by one item's words: where that
  value would leave a name under its 96 even without the circle (211 and under, for flights), every row puts its
  value under its name in the line's place (the name's 20, 4, the value's 20: the row keeps its 60); else the circles
  give way together where a name needs their room, and the lines give way by their segments. The tiles share their
  room the same way, every tile together: the circle where each name keeps 48 beside it and each value the card can
  show holds whole — the value's arrow gives way first, then the circle, and the arrows are back once the circles
  have gone (half a section).
- **The value's glyph** is a `listRow` option of its own (`valueGlyph`): a 16 glyph before the figure, the two centred
  on the value's line 4 apart (`.fv-row__value--glyph`), weighed with the value wherever a row fits its words.
- **Heights.** `max_rows` (1–20, five) is the card's height, never the list's length: HEAD + 60 × n (five → 400),
  HEAD + 48 × n, HEAD + rows × 76 + 8 between (`itemsList`). The list's box holds that height at every width whatever
  it shows: fewer items, the empty panel — as tall as its words lay out across the card (120 at least: a German "Keine
  Flugzeuge in der Nähe" takes four lines in half a section), in the box's middle rounded down to the 4 grid; in a box
  shorter than the panel, its words alone at the box's height — and a sensor out of reach (resting dashed rings, "—"
  names and values, as many rows as declared, the state under the title). The tiles one a row under 288 hold
  `max_rows` rows of them there, whatever the list holds: the one width at which the card draws taller than it
  declares at 360 (half a section, a third of one).
- **The head** counts from the sensor's state ("3 aircraft"; the whole list's length where the state is no number;
  `subtitle` wins, `show_count: false` drops it). Its title is the card's, else the preset's, else the sensor's name;
  its tap is the sensor's details.
- **Out of reach, the card keeps its anatomy** (an unavailable card keeps its size and anatomy): a sensor out of reach
  cannot say what it lists, so under `preset: auto` the preset is the one the config names (`attribute: flights`),
  else the one the sensor's attributes still say, else the one the list was last drawn by while it answered (kept for
  the session, on this view or another) — "Flights nearby" with the plane in the head's circle and in every resting
  ring, its rows laid out as the live ones are. Where nothing is known (a dashboard opened while the sensor is out of
  reach) the card is the plain list it would be — the sensor's name, the list glyph — and stays so until the sensor
  answers: no word is guessed to be taken back.
- **Pictures** (`show_image`, on by default) fill a 44 circle (`object-fit: cover`); one that will not load gives way
  to the glyph, in the row and in the sheet. Home Assistant's own paths go through `hassUrl`.
- **The sheet** (`item_tap: sheet`, the default; `none` makes the rows still): the cameras sheet's shape — a modal
  bottom sheet, Escape, the scrim and Close, the focus back where it came from — fetched the first time an item is
  tapped (its own chunk). Its head: the picture or the glyph, the name over the line (its segments giving way), and a
  `globe` round to the item's link where both hold beside it; else the link is a quiet button above Close, its word
  shorter where the full one would not fit ("Open on Flightradar24" → "Open the link"). Then the fields, a label over
  its line (64 a field, a line more for each that wraps, hairlines between): the flight's airline, flight number,
  callsign, route by city, aircraft, registration, altitude, ground speed, vertical speed, heading, distance,
  position, departure and arrival (the real time, else the estimated, else the scheduled); a plain item's every field
  that is a line, labelled by its own name. The sheet keeps its item while the list moves under it (by the item's
  `id`, else its name, among the whole list, not only the rows shown); an item gone from the sensor says "No longer
  listed".
- **No per-item tone**: the rows are what the sensor lists, live; their circles rest in the neutral, the card's
  colours are its head's and its sheet's.
- Its chunks are its own (`items`, 6.9 KB of 12; `items-sheet`, 2.7 KB of 8): every page carries only its name and
  height (`items-family.ts`) and the value's glyph.

## Slider (1.11.1)

The Slider card (#77) is the light card's anatomy for any value: a soundbar's volume, a calibration offset, a pump's
speed, a fan's. Its design page (owner's OK, 2026-10-28) is the spec; its decisions: the mute in the head (A), the
figure big with − + in the full card and on the line in the compact one (B), a tick a step up to twenty steps (C), a
signed range lit from zero (D), the house's tile (F); no vertical form ("too much empty space on the right").

- **The anatomy is the light card's**, piece for piece and in shared code: the head (`HeadFit`; the circle, the name
  16/600, the line 13/500, the control), the value row (`levelRow`: the label 11/600 and the l figure with its unit,
  the 96 × 44 stepper; the ladder in a narrow column — beside at l, beside at m, stacked, the halves at 44), the 40 the
  bubble rises into, the ruler (44, knob 36: relative drag, slower away from the axis, the fine scale on a hold, the
  keys) and its words 11/500 under it. The level is held until the entity reports it, a stepper's taps are one call
  once they stop, a drag is sent on release or as it moves (`live_update`): the light card's `Level`. Heights by the
  config alone: full 268, compact 188 (the head, the 40, the ruler and its words), tile 168.
- **What it sets.** A media player's volume (0–100 %, `volume_set`), a `number` or an `input_number` (its range, step
  and unit; `set_value`), a fan's speed (its speeds as stops, the fan card's words under them; `set_percentage` on the
  speed's floor). `min` and `max` narrow the range within the entity's; ends that make no range are let go. `label`
  names the figure: Volume, Speed or Value by default.
- **Ticks.** One a step where the steps are no more than the ruler's own ticks (twenty on a card, twelve on a tile) —
  every tick a value the knob stops at — the majors on the quarters, else the halves, else the ends; else the ruler's
  5 % and 25 % (a tile's 1/12 and 1/4). A fan's are the fan card's: its speeds the majors. The words under the ruler
  are the majors' figures, written briefly ("−2", "0", "+2"); a compact card or a column under 260 keeps the ends and
  the middle, and the measure keeps what stands 12 apart (`heldLabels`).
- **A signed range** (one that crosses zero) is lit from zero to the knob, either side (the ruler's `origin`), and its
  figures are signed: the typographic minus (−1.0; Intl's hyphen is loose in Inter) and a plus (+0.5), zero plain.
  Every figure the card writes takes the true minus; the value row is laid out for its widest figure, the ends of its
  range (and the word for off for a fan or a player).
- **The head's control** (`control: auto`): a player's mute as the 44 round (`volume` / `volumeOff`, "Mute" /
  "Unmute", held until the player says so), a fan's switch, or `toggle_entity`'s switch — another entity's power beside
  the value (the discussion's soundbar: a `number` for its volume, a switch for its power). `mute`, `switch` and `none`
  ask for one. The control never gives way; the line steps aside, then the circle (`HeadFit`).
- **The line.** Full: what the player plays, else its source, else the room ("Bluetooth"; muted, "· muted" after it);
  a number's room; a fan's room. Compact and tile: the same with the figure after it ("Bluetooth · 30 %", "Living room
  · −1.0 °C", "Muted · 30 %", "Off · 65 %" for a number whose switch is off, "Off" for a fan that is off); where it
  does not hold whole, the figure alone ("45 %" in half a phone's section; "−1.0 °C" on a tile of 156 or 172): the
  words before it give way, never the figure.
- **States.** Muted: the level stays, the ruler, the circle and the figure go neutral (the figure in the secondary
  ink), the knob stays up. A number whose switch is off: the same, its knob up. A fan or a player that is off: the
  word for off where the figure stands, the ruler asleep (a fan's wakes under a drag, a player's does not; its stepper
  and its round are still). Out of reach: the same size and anatomy — the ban on the dashed circle, "Unavailable · 2 h
  ago", the figure "—", the stepper, the round and the switch still, the ruler at rest.
- **Colour.** The tone of what it sets: `media` for a player, `fan` for a fan, the accent for a number; `tone` and
  `color` as the light card's. `tint` as the light card's: the colour on the surface while something is on (a player
  sounding, a fan running, a number's switch on) — `on`, the tile's default — at rest too (`always`), or never (`off`,
  the full and compact card's default).
- **The tile** (`variant: tile`) is the house's large tile (the card is built on the tile card): the circle and the
  control, the name, the line, the ruler at its foot (knob 28). The tile card and the tiles group learn the same ruler
  for a player's volume and a number's value: awake while the player is on (a number always), neutral while muted, a
  number's figure on its line after its room — alone where both do not hold (`keepsFigure`), the room giving way —
  and never also in its head; a player's line keeps its state ("Playing"), as a light's, its volume giving way. A lit
  tile's rounds stand on it as plain discs (`--fluvy-inset`), as a lit card's stepper does; the circle at rest and the
  knob's halo are the house's tile's.
- **Editor** with `when`: the − and + with the full card, the circle's option off the tile, `toggle_entity` while the
  control may be a switch, `min` and `max` off a fan (it stops at its speeds); helpers under the control and the other
  entity's switch. Its words are its own part (`slider.json`); `mute` and `switch` are option words of core's, as
  `common.volume` (the tile's).
- Its chunk is its own (`slider`, 3.8 KB of 8, its editor with the forms): every page carries only its name and height
  (`slider-family.ts`).

## Vehicle (1.13)

The Vehicle card (#84) is an electric car on the charge cards' anatomy: the head, the battery on the car charger's ruler,
the line under it, a row of rounds, rows and the tyres. Nothing in it is a new idiom but the car from above (the tyres'
panel) and the controls' row (the map's zone columns as buttons: a circle and its word under it).

- **Who plays what** (`vehicle/roles.ts`): the appliances' and the printer's rule. A role is known by the integration's
  own translation key (Tesla Fleet, Teslemetry and Tessie share one table; Renault, Volvo, Škoda; Kia's and Hyundai's
  kia_uvo, MySkoda, Polestar), then by a key it holds as a second choice (Tessie's usable charge, an estimated range
  beside the rated one, a lock's sensor beside the lock), then by the end of its id without the device's name (MG,
  Volkswagen's two and BMW's CarData name their entities in English), then by what it is (a battery by its class and
  percent, a plug, a lock, a climate, a tracker, an update). The integration's own plays a role over a helper attached
  to its device; `roles` wins, and `scan: false` keeps those alone. **Never a role**: what wakes, sounds, flashes or
  lends the car, opens a garage, starts its engine or drives it keyless, forces a report (it drains the 12 V battery),
  the route's tracker, a charge cable's latch (never the car's lock), a cabin's overheat guard (never its climate), a
  12 V battery or a fuel level that wears the battery's class. A car's doors, its windows and its tyres' warnings are
  gathered, each by its wheel.
- **What it does** (`vehicle/state.ts`) folds every integration's charging words into the card's few — charging,
  complete, stopped (the cable in, no charge), waiting (for its time, starting), unplugged, error, and idle (not
  charging, nothing said of the cable: its plug sensor says the rest) — a charge plugged in at its limit being complete.
  The car drives in a gear other than park, at a speed or by its motion sensor; sleeps where its state says so (Tesla's
  connectivity off, Volvo's power saving, MG's "likely asleep"); is out of reach where its battery, range, lock, place
  and charge all are.
- **The head**: the car's glyph in its circle (the badge's tone while it charges or drives, neutral at rest; the dashed
  ring out of reach), or its picture in the circle's place (64 × 44, the whole car, `image_position: head`); its name;
  the line — its address where it is away and its integration says one, else the place where no row says it — and
  "Updated 2 h ago" once its last report is older than `stale_after` (30 min), in the secondary ink: never an alarm. The
  badge says what it does: "Charging · 7.2 kW", "Driving · 64 km/h", "Charged" (the success's), "Plugged in", "Parked",
  "Asleep", "Unavailable". The badge outranks an address (`badgeFirst`): one that would take its room gives way to the
  place's word, then the time alone.
- **The battery** is the car charger's (`valueRow` and `markedRuler`): "Battery 64 %" at l, "Range 312 km" at s on its
  baseline (stacked where the column cannot hold both), the read-only ruler with the charge limit marked and named
  ("Limit"), in the card's colour, the warning's while the range is low. `hero: ring` is the appliances' gauge (R 88 at
  a 360 column, from the column), the charge in its disc, the range under it, the limit a dot outside the ring. The
  battery is a button of its own (its details; `hero_tap_action`, `hero_hold_action`).
- **The line under it** (13/500, one line, its parts fitted, a short form before a part goes) says the most pressing:
  why charging failed (warning); while charging, when it will be at its limit — the clock time, its day when another,
  how long from now and how fast its range grows ("80 % at 22:59 · 1 h 12 min left · +46 km/h"), "Full at" where the
  limit is 100 %; a low range (warning); a window, a door, the boot or the front boot left open (warning: a round may
  have given way); its limit reached (success); waiting to charge; plugged in, not charging; a cabin too cold (5 °C,
  41 °F) or too hot (35 °C, 95 °F) while the climate is off (the cool's and the heat's ink); unplugged and its limit;
  else its limit.
- **The controls**: the lock, the climate, the charge, the boot, the windows, the front boot, sentry (the doors and the
  port on request), each a 44 circle and its word under it (12/500, 4 between), the two one button. Equal cells that
  touch, at least 56 each, a word keeping 2 of its cell clear: as many a row as the column holds with every word at
  its widest (a state that changes never moves the row) — five at a 392 card in English, four at 360 — the car's own in
  one row, those that do not hold it giving way in their order, the card's own list in rows as even as they come (nine
  are five and four, the shorter centred). The circle in its state's tone (the lock locked in the card's colour,
  unlocked in the warning's; the climate in the heat's or the cool's while it runs; charging in the card's colour,
  charged in the success's; an opening open in the warning's; sentry on in the armed's); the word its state — "Locked",
  "21 °C", "Charging", "Off" — but an opening's, which is its name while shut ("Boot", "Windows") and "Open" (warning)
  while open, so a row never says "Closed" five times; the climate off on a cold cabin says the cabin's temperature in
  the cool's ink. A tap acts on the car where its integration lets a card (a lock, a climate, a switch, a cover, a
  button), asking first in Home Assistant's dialog where it matters — unlocking, opening or closing the boot, opening
  the front boot, venting or closing the windows, stopping a charge, turning sentry off — and `confirm` asks for any;
  a lock or a switch moves under the finger; what it cannot act on opens its details. The charge cannot start
  unplugged: the round is still, its title saying why. Hold: its details. Out of reach: the dashed circle and "—",
  disabled.
- **The rows**: compact rows (48: the 40 circle, the name 15/600, the value 16/600 at the end); their circles give way
  together, then every value goes under its name in the row's 48. Location (the place's word), odometer (whole,
  grouped, in the range's unit), inside, outside, charging power and rate, the limit, the time to full, the software,
  the speed, the fuel, or any entity — each named, glyphed, coloured and given its actions in the rows editor.
- **The tyres**: a soft panel (96, radius 16, the inset's fill) with the car from above in its middle (40 × 72, the
  set's stroke; a wheel with a warning in the warning's ink) and each pressure by its wheel (16/600, the unit 12/500; a
  bar's one decimal, psi's and kPa's none), low ones in the warning's ink; where only a warning is read, "OK" or "Low";
  where the column cannot hold a pressure beside the car, the car gives way.
- **Compact**: the head (its range leading the line), the battery as a 12 bar with its limit a 2 px mark and its
  percentage at the end (in a room as wide as "100 %"), the line, the rounds without their words. **Mini** (76): the
  car's circle ringed by its charge (the printer's ring, the card's colour, the warning's when low), its name over its
  charge, its range, what it does and where (the line's trailing parts give way first), and its first control's round,
  which gives way where the words would have less than 96; the strip is the card's button.
- **Glyphs** (`vehicle/glyphs.ts`, added as the chunk lands): the boot and the front boot (the car's side, its nose to
  the left, the end solid while shut, its lid up while open), a car's door and window (shut and open), the charge port,
  the odometer, a tyre.
- **Heights** by the config alone (`vehicle-family.ts`): full 460 (its picture over the battery 176 more, a ring 68
  more, its tyres 112 more, a row 48, the card's own controls 76 a row more), compact 200, mini 76. A car out of reach
  keeps every part.
- Its chunk is its own (`vehicle`, 20.2 KB of 24, its editor on its class): every page carries only its name and height.

## Value row (1.9)

A card's reading — its big figure — and what goes with it share one 64 row, 16 under the head: the control that sets
it (the stepper, a timer's rounds) or a second readout that qualifies it (when it is full, the time left). The row is
fitted, never squeezed: `fitValueRow` (shared/value-row.ts) decides it once from the content width, the label's forms
and **every figure the row can show** — the target's min and max, its range where the device can hold one, the word for
off — measured in the card's own classes. Never from the state: stepping 9,5 → 10,0, a mode tile, the device going off
or unavailable move nothing (the control stays, disabled), and two cards of one entity type side by side draw alike.

- **The ladder:** beside the control at l → beside it at m → **stacked**: the readout centred on its own row at the
  largest of l · m · s · xs the column holds, the control centred 12 under it (the dial's column without its ring) →
  under 96 of content the stepper's two halves at 44 (88) → under 88 the readout alone, which is then the card's tap.
  A row without a control is the readout alone at the largest size that fits.
- **Beside:** the readout at the start, the control at the end, 12 at least between them (`column-gap` — the gap is
  in the layout, not only in the sums; a miss shows as containment, never as words under a control).
- **The label** is the longest of its forms that fits its room ("Target · Now 20.6°", then "Target"): beside, the row
  less the control and its 12; stacked, the whole row.
- **Stacked height:** the readout keeps a 64 block at every size (label 16 · 4 · the 44 line box, the figure at its
  foot), so l, m, s and xs stack to the same 120 and a narrower figure never changes the card's height.
- **One alignment rule:** a control is centred, and the readout over it is centred with it; readouts alone keep the
  column's start, as the head's words do. So a side readout that goes under the reading (the charge cards' "Ready by",
  the printer's time left, the energy overview's battery) stays at the column's start, 12 below — measured on every
  form it takes (the words at rest and while a chart is read, its widest figure, a chart key beside its label:
  `sideStacked`), so reading the card never moves the row.
- **Who draws it (1.9, #46):** the thermostat's compact and ruler variants (the target, "Target · Now 20.6°" over it),
  the full light's level, the fan's speed, a tilt-only cover's tilt, the timer's time left (its rounds are the
  control: a running timer's two, 96) — each fitted with `fitValueRow`, never with a width threshold. The figures it
  is fitted on are every one the card can show: a thermostat's min and max, its range where the entity can hold one
  (`heat_cool`/`auto` with the range feature), the word for off where it can be off; a light's 100 % and its Off; a
  fan's 100 %; a timer's whole length. So 9,5 beside 19,5 draws one size, and 9,5 → 10,0 moves nothing.
- **The control stays:** a device off, unavailable or with no target keeps its stepper in its place, still
  (disabled) — it never leaves the row, so turning a thermostat off from its mode tile moves nothing under the finger.
- **A range's ends are buttons** (the readout "20.0 – 24.0 °C"): each a 44 hit round its figure, `aria-pressed`, the
  end the stepper drives in the accent's ink — the low one at first (the high one while cooling), then the one
  pressed; a step keeps it a step clear of the other end, which stays. The dial's range knobs work alike.
- **Without its control** (`show_stepper: false` on the thermostat, the light and the fan; `show_actions: false` on
  the timer; a column under the stepper's halves) the readout stands alone at the column's start and is the card's
  tap and hold: a button laid over the row (`readoutTap`, `pressCover`), named by what it says ("Garderobe · Target
  19.5 °C").
- **A side column's readouts** (the cover beside its ruler) keep to m: the tilt's stepper beside its readout, else
  under it at the column's start (its halves at 44 under 96). Where the column cannot hold them with the ruler's
  words and 24 between, the 24 closes to 16, then the ruler's Open/Closed give way — its knob and the position say
  where the cover is, the commands under them which way it opens (fr at 211: 171 of content, the side 111).

## Narrow columns (1.7, the 1.6.1 list)

**Where a card must hold.** A half-section card holds at **152** (a 320 section with Fluvy's 16 gap; 156 under Home
Assistant's own 8) and a full card at **211**, the floor a phone's zoom and a narrow desktop column make. The measurer
draws these widths as cards, not as windows: half-section cards at 152 and 172 (half the design's 360), full cards at
211 and 266, a 360 and a 412 phone as Home Assistant lays them out (their sections 328 and 380, halves 156 and 182) and
a desktop at the design's 360 — in every language, and a card's `min_columns` is a promise it keeps at that many
columns of the narrowest section.

What a card does at those widths, beyond the rules above — never a word cut, never a word under a control:
- **Option tiles** (an alarm's modes, a thermostat's and a water heater's) stay tiles only while every word holds its
  cell at the columns `optionColumnsFor` gives; else the row is the compact layout's chips, which give way in their
  order (glyph and word, the words, the glyphs alone). `optionsHold`.
- **A tile's foot** holds two (or three) readouts only while every label holds its equal cell (8 apart); else the first
  readout has the foot to itself (fr's "PUISSANCE · AUJOURD'HUI" on a phone).
- **A row of statistics** (the sensor's and the gauge's min · max · average, a charger's session, the balance's money,
  a legend, the flow's totals, the production's peak and sun hours) is one measured decision, never a width
  threshold: as many equal columns as hold every label and figure, the size every figure fits its room at (s, else
  xs), a shorter last row's one readout taking the whole row — and held to the whole row, not to a column, so three
  in half a column are two and one while the first two hold their halves (fr's "MOYENNE" under "MIN · MAX"), one a
  line only where not even those two do. Never a word wrapped onto its figure, never a unit past its readout.
  `statsRow`, the odd row `fv-cols--odd`; the energy family draws it through `statsCols`. A legend's names count as
  words.
- **A side readout goes under its reading by measure:** what qualifies a reading (the energy card's cost, the
  production's forecast, the humidity's dew point, the charge cards' "Ready by", the printer's time left, the
  overview's battery) stays beside it while the reading at l and the side at s, 16 apart, hold the column — measured
  on the widest figures the row can show and on the words it says while its chart is read, so reading it never moves
  the row — else it goes under the reading, on the column's start, 12 below (`sideStacked`,
  `.fv-value-row.is-stacked`). A reading's label with a short form takes it before the side goes under ("So far
  today" → "So far": fr's "Jusqu'ici" keeps the forecast beside it at 266), and alone in half a column the label is
  the longest form the column holds.
- **A head's line in segments**: the flow's dead source reads "Solar · unavailable · since 19:47", the weather's
  "Feels 16° · Wind 12 km/h NW", a keypad's "Enter your code · 29 s" — the segments after the first go from the end.
- **A head's line has shorter forms** (`HeadFit`'s `shorter`): where not even its first segment holds, the next form
  that does — a stale "Updated 32 days ago" is "32 days ago", the day's "Since midnight" is "Today", "Last 7 days" is "7
  days", "Entity not found" is "Not found" — and where none does, a line that is the card's own words lets go (the
  stacked charts' "Aujourd'hui · toute la maison" beside the round in half a column: the day axis says today; a missing
  energy sensor in half a section: the dashed card and its "—" say it). A card's own title takes its short one where it
  would be cut ("Score"), as the people's and the map's do.
- **A row's figure is its words' first claim** (`rowsKeepIcon`'s `sub`): a share, a time, a state's short word is what
  of a row's second line must stay whole; the circles give way to it as to the names, then the line takes its short form
  ("36 %", "21:47", "Not found"). A label over a figure never wraps onto it: "Right now" is "Now", "Net import" is
  "Import", measured on the column. An empty panel's line holds two lines broken between words, else its short form
  (`emptyText`).
- **An action's cell** keeps its glyph and its play while every name keeps its 96 (or itself) and the language's "ran
  07:00", "Never run" and "Running now" hold one line beside them; else the play goes, as side by side, then the glyph —
  decided from the column, never from a state. A line that would not hold says what the action does over when it ran:
  the first a name (the owner's words, the area's) that may end in its ellipsis, the second the line's fact, whole.
- **A compact head's state** (a light's, a fan's "Encendida") is said only where it holds beside the switch: else its
  level ("70 %"), else the line keeps its place, empty — the switch says on or off, and the name never moves when it is
  flipped. A count's line has its short forms ("3/4 encendidos", "3/4"); a lock's "32 days ago by Marta" lets who did it
  go, then says "32 d ago".
- **A sheet's title** wraps at its words; a word wider than its line steps the title down to a card's 16; where not even
  that holds, its short form, at the size it holds at (it "Programma"). A link row's word too wide for the bare row
  takes its short form (de "Ablauf"); a keypad's prompt its own ("Code eingeben").
- **A pair of equal buttons** stands one over the other, each as wide as its bar, where the longer label would not hold
  its half (the panel's apply pair in French on a phone).
- **A speed ruler's words** are the ones that stand 12 apart, measured: all, else the ends and the middle, else the ends
  (`axisHolds`, as the energy axis); no width threshold.
- **A room's head line** is fitted in the head's own class and room (the circle, the gap, the chevron's 44); a scene
  tile's line is dropped, never cut; a map row keeps its word and lets the distance go when both would not hold 55 %.
- **The lock's slide hint** hides where it would not fit between the knob and the end ring (the glyphs say it, the
  status line reads it out); **the camera's off text** takes a second line on a narrow plate; **the keypad** closes its
  gaps to 8, then, in a sheet too narrow for 56 keys (a 211 column: 179 of content), its keys give way on the 4 grid,
  never under a finger's 44 (`min(72px, max(44px, round(down, (100% − 16px) / 3, 4px)))`, 1.9).
- **The energy card's rolling axis** keeps its middle label only where the three stand 12 apart (`axisHolds`, shared
  with the sensor); **a long panel tab** keeps its words and the other tabs share what is left.
- **A fold line that hides an alert** says so in the warning ink in every layout; a short age ("21 d") is read in
  full; a layer's comets go at once when the layer changed size, never fading along the old lanes.
- **A glyph-alone chip is never under 44** (`widestOf` counts one 44): a compact alarm's five modes in a 211 column
  take two rows of glyphs rather than 36-wide chips.
- **Three chips go two and one** before they go one a line: a filled row of three that cannot stand in one line
  takes two columns, the third chip across the line under them (the thermostat's modes, a fan's presets, the schedule
  sheet's moments); one a line only where not even two hold. Five lamps and more in the lights card keep three a line
  at most.
- **An action row wraps before a cell goes under 44:** where not even 4 apart keeps every cell a finger's, the row
  takes two full rows — 3 + 2, 2 + 2, 2 + 1 with the last cell across — the gap the same between the rows as between
  the cells (the vacuum's four commands at 171: two rows of 78, no longer four of 36.75). `actionGap` / `sharedGap`
  give the gap and the columns; `actions()` takes the columns as `chips()` does.
- **An option tile's value is dropped, never cut**: a value of several words wraps, a word longer than the cell (de's
  "Bereitschaft" under Off, nl's "Overbrugging" under Away, de's "Überschuss" under a charger's sun mode) is let go —
  the thermostat's and the mode row's tile by tile (`valuesHeld`), the alarm's every value or none (`valuesHold`); a
  tile whose value is its only word keeps it.
- **A row's end is never cut** (helpers, updates): what ends a list row — a switch, an action's "Run" or "Install", a
  value's button ("06:45", a long select's option), a state's words — keeps its width. Where it would leave a name
  under 96 (or under the name itself) beside its circle, every row of the list gives its circle to its name, and a
  value's button then takes the circle's room too (`rowsKeepIcon`): at 211 a time no longer reads "0." and a switch
  no longer stands 8 px past its row. Every end counts — a chevron's 44, a state's words, Install's — and where even the
  row without its circle would leave the name (or its line's first segment) under that room, the end goes under the
  words, at their start, as wide as its own words (`rowStacks`, `.fv-row--stack`): de "Installieren" at 211, the sun's
  "Above horizon" under "Sets at 20:12"; the entities card's state in words likewise, where not even its longest word
  leaves the line its short form. Names and lines wrap at their words, never inside one.
- **A value's pill is capped (1.11)** (68 % of the row less the circle's room, less the one gap once the row gave its
  circle, on the 4 grid — `valueCap` mirrors the sheet's CSS) and holds what it shows whole: a date names its month
  ("10 de nov.") where the cap holds it, takes its figures ("10/11" — the profile's order, the two-digit year once it
  is not this one) where it does not, so the row keeps its line; where even the figures run over the cap the row
  stacks, and under the name the pill has the whole row. A time ("06:45") never reaches the cap; a select's option, a
  name, keeps its ellipsis as its last resort. The cap weighs for the circles too: a pill that would not hold within it
  gives the circles to the names, as a squeezed name does.
- A head's circle gives way; its tap never does (#42): the whole head is the card's button at every width. Compact
  light, fan, lock, gauge (bar) and room (row) cards hold at half a section and never less (`min_columns: 6`, as
  Home Assistant's own compact cards): in a third the switch left the name no room.
- A room's photo at half a section: the name pill drops its glyph before its name is cut ("Wohnzimmer" at 152 and
  172), and the empty panel's hint keeps the why and lets the way out go ("2 ausgeblendete oder
  Diagnose-Entitäten"), or goes whole where even that would run past three lines.
- **Half a section is a card's floor where its minimum is six columns** (152 at Fluvy's 16, 156 at Home Assistant's
  8, 112–206 of content across sections of 320–500): the compact thermostat holds it like the compact light, fan, lock
  and gauge (`min_columns: 6`, as Home Assistant's own thermostat; a card stored at four columns draws at six). A value
  row there stacks (the readout at l, the stepper centred 12 under it), the figure keeping its size from its
  neighbour's; at 150 % on a phone (about 66 of content) the readout stands alone and is the tap. A forced full light
  in half a section says "Temperature" over its warm-to-cool ruler where "Colour temperature" would wrap, and labels
  its level 0 · 50 · 100; a humidity reading says "Humidity" (de "Luftfeuchte") where "Relative humidity" would run
  onto its figure, beside its dew point or alone.
- **Every list keeps its circles by one rule (1.9):** the grid's price row, the distribution's rows, the humidity
  card's trend and humidifier rows, the meters' rows (the `w < 200` threshold is gone), the entities card's rows, the
  calendar's "Tomorrow" / "+N more" rows and the map's rows follow `rowsKeepIcon`, as the fan's, the room's, the
  helpers' and the updates' do: a column too narrow for a row's name beside what ends it (a figure, a switch's 56, a
  chevron's 44) gives every row's circle to the names together. The map's rows also take the people card's rule for a
  word that would leave the name under 40: a dash, the word the row's label.
- **The weather hero's figure** is drawn at 40 while it holds its column beside the 64 circle (measured), at the
  readout's 24 where it would cut its unit (a 211 column with "17.6 °C"). Its label takes the hero's width, over the
  figure and the circle, where a word it may say (any condition's, or a state's) is wider than its column beside the
  circle — read on every such word, so the hero never changes with the sky — and wraps at its words only. The day rows
  take the short weekday (`Seg.`) for every row where a long one (pt-BR's "Segunda-feira") would not hold beside its
  figures even without its circle; long otherwise. A day's line is measured in the row's class, its rain chance leaving
  whole; where a condition the language may say would not hold beside the figures, every day's condition runs under
  them, across the row, the figures on the day's line.

## Empty lists (1.9)

A card of a list (bars, entities, tiles, updates, stat tiles, helpers, distribution, actions, scenes, openings, tabs,
the map, people, readouts, room lights) with nothing in it — a filter that matches nothing yet (auto-entities), the
last entry taken out in the editor — is a card, never a configuration error (#48). Only a list that is not one
(`rows: sensor.x`) is still an error, said with the card's name ("must be a list").

- **Anatomy.** The head stays — the title, the user's subtitle, the circle, the head's tap and hold — and the empty
  panel stands where the list would be, in the list's own 16 under the head: the 44 ring with the card's own glyph over
  one line in the card's words ("No sensors", "No people", "No readings"). A head counts nothing: no badge ("All good",
  "Off", "All clear") and no "0 of 0" or "0 sensors" in its line. An empty card is never unavailable: no faded card, no
  off tone, as nothing in it failed. In a list of 60 rows (`.fv-rows`, the entities card's), whose box sits 8 under the
  head with its circles 8 into their rows, the panel's own 16 folds with the box's 8: 16 under the head and the card's
  20 under it, as every list's (`lists.css`); with no head, the card's 20 all round.
- **Its own words.** `empty_text` says what nothing means there ("All closed", "Nobody home"). The updates card keeps
  its quiet row ("Everything is up to date") and the room lights their panel with its hint, which goes when the card
  has words of its own.
- **On the page.** A card with no surface of its own (a group of tiles, the scenes, the tabs) draws the panel on the
  page, 120 tall, in the page's other fill (`emptyState(…, page)`); the scenes' title stays over it. A bare entities card
  and the readouts strip keep their card round it (20 + 120 + 20).
- **Height.** `layoutHeight` says the empty card, never the rows it might have: the head and the panel 220, the panel
  alone 120, in its card 160, the lights with their hint 232, the updates' quiet row 160. A section's title or a
  divider among a list's entries is no row (`entryCount`).
- **Hiding.** `hide_empty: true` lets the card step aside while it is empty and come back as soon as something is
  listed (`selfHide`, § Surfaces): off by default, so an empty card stays in sight, and never in the editor. The
  updates card has nothing to show while nothing waits, as Home Assistant's own updates card, so it steps aside then
  too, and its `empty_text` is its quiet row's words.
- **auto-entities.** Its matches arrive under `entities`, each an object with options of its own: every card of a list
  reads them so (`itemsOf`; the bars as their `rows`, the stat tiles as their `tiles`). Handed none and then its
  matches again on the same element, a card draws the panel and then its rows — never the rows it had.

## Readouts and text

- Readout = 11/600 uppercase label (0.06 em) + tabular value + unit on the baseline; a unit has its own line box (`line-height: 1`) so it never grows the value's box. Sizes: xs 16/20 (tile foot), s 20/24, m 24/28, l 40/44.
- Trend arrows in secondary ink (green is reserved for confirmations and the presence dot).
- Paired readouts of different sizes are baseline-aligned (`data-baseline` group); side readouts get the padding that puts them on the big value's baseline.
- A 16/600 value beside a 15/600 title or 14/500 legend name (list rows, bar rows, legend rows) carries `top: −1px`: Blink floors the half-leading, so in the same 20 px box the 16 px baseline lands 1 px low. One-line rows pair title and value in a `data-baseline` group; two-line rows (title + sub) centre the value on the pair instead.
- **A label in a control is centred on its capitals (1.15, #122)**: one line of words in a box of fixed height (a
  button, a chip, a badge, a pill, a dropdown's value, a row's value pill, a month's day, a view tab) is trimmed to its
  capitals and its baseline (`text-box`) and padded back to its line's height, its baseline on a whole pixel half its
  capitals under the box's middle (`fluvy/labels.css`): where Chromium drew it already and WebKit (Safari, Home
  Assistant's iPhone app) drew it up to a pixel lower. Words that wrap keep their line boxes; a readout's value, a
  head's title, a row's text and a week strip's stacked day are laid out by their line boxes and are not trimmed.
  `tools/render/engines.mjs` reads both engines.
- Percent always with a thin space: `70 %`. Temperatures in compact surfaces: `21.5°`; on dials `21.5 °C`.
- **One rule for units and decimals (1.11, #69)** (`shared/units.ts`): a set read together is written in the unit the
  card asks for (`unit`, of the figures' class) else the one its largest figure asks for; its decimals are the card's
  (`decimals`, fixed, so a live figure keeps its width), else the sensor's own precision where the shown unit is the
  sensor's, else what the figure's size asks for (three significant places at most, a scaled figure keeping its one
  decimal). A unit of another class is ignored, never written on figures it does not measure. An item of a list (a
  legend's, a readout, a device row, a meter) may ask for its own, over the card's. Money keeps its cents: a card's
  `decimals` is for its energy figures. The editor offers both on one row, the last before the actions, the units of
  the sensor's class; a sensor whose unit converts to nothing shows no unit to choose.
- Celsius or Fahrenheit: a sensor's figure in its own unit, a climate's and a water heater's in the house's (Home
  Assistant hands them in it). Nothing assumes Celsius: a range, a step or a threshold an entity does not give is Home
  Assistant's own in the house's unit (a thermostat 7–35 °C by halves or 45–95 °F by whole degrees), and a readout is
  measured as wide as the unit makes it (a chamber's 104 °F has three figures).
- Compact family (tile + row): value `22°`, sub `Heating · 21.1°`. Dial family: value `21.5 °C`, sub `Now 20.8°`.
- Segments after `·` are lowercase unless proper nouns. Never ellipsis on a value.
- Chart bubbles: dark pill, tail on the cursor; charts reserve 44 px headroom so the bubble never touches the curve (a
  chart of several curves has no bubble: when is a pill on its axis row, so it keeps 12); the cursor sits at "now" and the fill stops there; the axis is the full 24 h (`00:00 … 24:00`) with labels placed by value (`axis()`), first left-aligned, last right-aligned — same rule as ruler labels.
- **A card's clock rests while nobody can see it:** what a card says about time ("Live · 5 s ago", "Ready in 12 min",
  a period's totals asked for again) is kept by one shared ticker — a minute unless the words need finer steps — that
  stops off the page, off screen and in a hidden tab, and asks at once when the card is back. A card under a test's
  clock never ticks. `shared/ticker.ts`.
- Legends without dots unless each dot is a plotted series. Empty states: a 44 neutral ring on the card fill + one line of secondary text, centred in a 120 page-filled panel; the way out, when there is one, is the hint under it (it may wrap). An unavailable icon circle is the dashed ring alone, unfilled in every palette.
- **A list that cannot be read keeps its rows (1.9)**: an update that cannot be read keeps its row in its order ("—"),
  and the head says how many cannot be read, never "Up to date"; a to-do list unavailable before its items came, or
  gone, keeps its head, a still "+" and the five rows it declares, still bars on the page's fill; a room keeps its
  humidity's place while its thermostat cannot say whether it measures one. A room's things and the house's
  automations are found, not named: one gone from the house is gone from them (#39).
- Flow diagrams: see § Energy (1.4) — contacts on the house are slots 20 px of arc apart, every arrowhead ends its lane.

## Colour — one theme, palettes chosen live

- **One theme, "Fluvy"**, carries the default look (Linen, Soft). Every other palette and shape is applied live by the bundle's look engine from Fluvy's settings (the house's, or a person's own): no palette has a theme file of its own, and nothing has to be picked in a profile. The engine and the theme file are written by the same function (`@fluvy/tokens/runtime` `lookDeclarations`).
- **Two lines.** *Pastel* (the soft pool: Linen, Sand, Sage, Mist, Clay, Slate, Harbour, Dusk, Ember) and *Electric* (the tint trio Blaze, Flamingo, Iris; the solid pair Volt, Mint; Noir, dark first). A palette is a seed: page, card, accent, fill, on-fill, and for the electric line `character: 'vivid'`, `fill: 'tint' | 'solid'`, an optional `highlight`, and the device colours it moved aside (`states`, `statuses`) or made its accent (`twin`). The seed is what ships: the build adjusts nothing on the electric line.
- **Electric = the accent is a graphic colour.** It draws icons, strokes, curves and fills at full chroma (>= 3:1); its text form `--fluvy-accent-text` (links, link buttons, a calendar's month) is the same hue taken to 4.5:1. In a soft palette the two are one colour. It keeps at least 80 % of the chroma sRGB holds at its hue and lightness in both modes. Device colours keep their own hues (no pull towards the accent), and the accent is never mistaken for one (ΔE2000 ≥ 8): the one it lands on becomes its **twin** (Mint's "home" is its green), the others step aside.
- **Solid fills** are the colour itself with black or white on it by contrast; a resting icon circle then carries only a wash of it (`--fluvy-wash`, up to 32 % over the card in light, backing off where an ink would drop under 3:1; in dark the lifted neutral surface, `--fluvy-wash-base`), so only what is on is loud. A status's fill sits a step deeper than the device colours' (a warning never reads as gas), and any two fills stay ΔE2000 5.5 apart. What is drawn on a solid tile takes the fill's ink (`--fluvy-solid` 100 %: a black switch track with a thumb in the tile's colour, black ticks and knob ring, no glow; labels and units in the on-fill ink at 72 %); on a tint (`--fluvy-solid` 0 %) the tone's own ink reads, as it always has. A tint plate always lets its own ink read as an icon (3:1): the plate steps paler until it does.
- **Primary action** (`--fluvy-primary`, `-hover`, `--fluvy-on-primary`): the round play button, the "+", a command row's first, a checked to-do, the calendar's selected day. Its hover steps away from the ink on it. The accent with its ink on a tint palette; on a solid one the fill with its black (ref Volt's black-on-periwinkle), never a black glyph on a mid-tone.
- **Information** (`--fluvy-notice`, `-fill`, `-fill-border`, `-on-fill`; the `notice` tone, a severity's, never a
  card's choice): what is information, not a warning (an alert of severity info). It is the palette's accent — its text
  colour as the ink, so a count reads at 4.5 — where the accent's fill and ink stand ΔE2000 5.5 from the warning's and
  the danger's in both modes, else the status info (the blue): Ember, Sand, Clay, Blaze and Flamingo take the blue, the
  rest their accent. One choice for the palette, the same in light and dark; a status, so a card's own colour leaves it
  be. Gated in the build (`roles/notice-separation`, its ink as text, its on-fill) and over every preset, the
  community's palettes and custom ones of each character, base and fill, warm accents among them.
- **The house's status colours (1.9).** Warning, danger, success and notice are each **Auto** — the palette's own,
  exactly as before, the default — or a colour the house picks (§ Settings panel, Status colours), over every palette, a
  person's own too. A pick is the status's whole family on the palette it sits on, in each mode, derived as the
  palette's own statuses are and at the hue picked: only lightness moves (and the chroma sRGB cannot hold there), and
  only as far as the gates ask. The ink is the pick itself, taken deeper (lighter in dark) until it reads as text on the
  card and the page (4.5) and as a glyph on its resting circle (3) — #47's `#dc630b` (3.5:1 on white) is `#b04c00` in
  light (5.4) and itself in dark (4.9). The fill is the palette's plate for a status (a pale tint at the profile's fill
  lightness; on a solid palette the colour itself a status's step from the device colours) in the pick's hue and chroma,
  paled until the ink reads on it at 3; its hairline 1.35; its ink 4.5 and its 80 % state line 4.5. Warning, danger,
  success and notice stand ΔE2000 5.5 apart, fill from fill and ink from ink, in both modes: a pick too close to another
  status first takes more of its chroma into its plate (up to 2.5×), then a deeper plate (up to 0.06 L towards its ink),
  and its ink up to 0.05 L deeper — never another hue; where that does not set them apart, it stays as it was and the
  panel says so. The family is written where the palette's is: `--fluvy-<status>`, `-fill`, `-fill-border`, `-on-fill`,
  and Home Assistant's `--warning-color`, `--error-color`, `--success-color`, its `--ha-color-*` status scales and quiet
  fills; Home Assistant's colour *names* (red, orange, green) stay the palette's (`named`): a name is a colour, a status
  a role. `--fluvy-palette` carries the picks after the palette's key (`linen|warning=#dc630b`), so a card that derives
  a colour in script (a lit surface in the warning, a series' ink) derives it on them, and a change of them is a new
  key: every card looks again. Gated in the build over every preset, the community's palettes and custom ones of each
  character, base and fill, both modes, with an orange, a yellow, a red, a green, a grey, a blue near the accent and the
  accent itself as the pick, for each status.
- **Armed** (`.fv-btn--armed`): a button whose second tap acts at once (an alert's bulk action, a schedule's Delete)
  says so on the danger's fill in its on-fill ink — 4.5 and more on every palette and mode — under the pointer and the
  focus too: the hover only firms its hairline in the danger's ink, as a filled tile's does.
- **Highlight** (`--fluvy-highlight*`): a second brand colour, the accent where a palette has none, always a **fill with its on-fill ink** (never a stroke, text, chart or the primary action), at most one per region. It marks *here*: `--fluvy-selected` / `--fluvy-on-selected` fill the open tab (ink on a soft palette, the highlight on Volt and Iris); and, only on a palette that has one, *you* and *today* (`--fluvy-mark` / `--fluvy-on-mark`: the avatar, the calendar's today). Where a palette has no highlight there is no mark, and those places keep their accent design (on a solid palette its fill, never a dark ramp of it). Today keeps its colour when it is the selected day; another selected day takes the primary fill. Beside the mark (the greeting's avatar) the rooms' "here" is the ink pill, so the region holds one highlight: on a palette with a mark the rooms row always takes the ink pill, and the highlight's "here" is left to the settings panel's tabs.
- **Custom palettes** go through the same derivation and gates, whatever colour is picked: an electric pick keeps its share of the gamut when its line has to go deeper to be seen (a pastel pink becomes a hot pink on white), the device colour it lands on becomes its twin, and crowded status or device colours turn a few degrees aside (at most 32° for a device, 24° for a status: a warning stays amber) until nothing is too close. "Electric" is asked of the accent only as far as the pick is: a dusty rose stays a dusty rose.
- **Colour per card (2026-09-28; on the first frame, 1.9).** A card's `color` is *which colour that card is*: one of Home Assistant's colour names (its picker's, and the three its YAML knows besides — `primary-text`, `secondary-text`, `disabled`: the palette's own inks), or a colour typed — a hex of any length (an opacity is dropped: a colour is drawn solid, so its gates hold; none at all is no colour), `rgb(…)`, or any CSS colour the browser reads (through a canvas; nothing where there is none). `primary`, `accent`, `none` and `state` are nothing: the card keeps the palette's accent. It stands in for the palette's accent inside the card (its chart's line and fill, its icon circle, its gauge's ring, its lit light — the accent's twin — its primary action, its ramp and graph series; the highlight too where the palette has none of its own), and nothing else: surfaces, text, the neutral ramp, the status and device tones and every Home Assistant name stay the palette's. The family is derived on the very palette the card wears (`--fluvy-palette`, written by the theme, by a look applied live, and by the cards' own fallback where no look reaches them) in the mode it is in, through the palette's own accent arithmetic (`deriveAccent`: the same ink fitting, fill legibility, on-fill and graph gates; a pick whose series sit too close stretches their tone stagger until they stand apart), and written into the card's shadow root on its children — never on the host, whose computed values the card reads — without `!important`. **The palette is read once the fallback is on the host:** `no-theme` and `dark` are reactive but never reflected by Lit (a frame late); `syncTheme` writes them itself (`wear()`) before it reads a token, so a card derives on its palette from its first frame — on a dashboard that does not wear the look, and in the card editor, whose preview is a new card on every edit (#40). A grey is drawn on the grey ladder (below). A part with a colour of its own and no tone is drawn in the accent (`toneOf`); a device tone (a fan, a heater, a speaker) is never recoloured. An item whose `color` is `primary` or `accent` wears the palette's own accent (`data-accent="accent"`), inside a card with a colour of its own too; an item with none wears the card's. Home Assistant's colour names resolve through one table (`NAMED_COLORS`), the same the theme writes them from, each in the tone Home Assistant gives it (pink the armed rose, cyan the water, teal the presence green, brown the gas): a card asking for teal is the teal every Home Assistant surface shows. The editor offers Home Assistant's colour picker. Its swatches show the palette's colours where the edit dialog wears the look — on a dashboard that wears it, the dialog is marked as its panel is, and the preview looks for the theme again whenever that mark moves; elsewhere they are Home Assistant's own (black and white as `#000` and `#fff`) while the card draws the ladder (recolouring them is not built). A `card_color` reads None in the picker until one is chosen.
- **The grey ladder (1.9, #40).** Black, dark grey, blue grey, grey, light grey and white — and any pick that close to grey (chroma under 0.03, or within the palette's own greys' peak, whatever its rounding) — are six rungs of one ladder in the palette's own greys, never lifted into the accent's chroma band, where a grey read as a colour nobody chose (Linen's black a beige, blue-grey violet, blue or green on Iris, Volt and Mint; white a near-black glyph on the electric palettes). A pick's place on the ladder is its OKLCH lightness between the names' own (the neutral ramp's 05, 40, 50, 60, 80 and 95), so a typed `#000`, `#333` or `#fff` lands on it too (`ladderPosition`). Each rung keeps the palette's greys' hue and chroma; a grey that leans elsewhere keeps its lean as a whisper: blue-grey is Home Assistant's own cool (#607d8b's hue, chroma 0.022), in the theme's `--blue-grey-color` too.
  - **Light:** black is the text's glyph (a black glyph) on the deepest grey plate its near-black words and their 80 % state line still read on; each rung up is lighter in its glyph and its plate; white is the palest plate an "on" surface may be (5.5 off the card, as any colour's fill) with the palest legible glyph, and **an outlined disc** at rest: its plate's hairline round its resting circle (`--fluvy-accent-ring`, the accent tone's `--tone-ring`; every other family says transparent, so an item in a white card has no ring).
  - **Dark:** black is the plate under the card (5.5 below it, or as deep as there is) with the dimmest glyph still legible — it never turns white; the other rungs lift above the card, white a near-white glyph on the palest plate a light word still reads on.
  - Between the ends the plates stand an equal CIEDE2000 step apart and the glyphs an equal step in lightness. A plate seen on the card (1.6) keeps a rest wash that is seen too (1.18), as `tint: always` asks. A solid palette's resting circle is still its wash of the plate (none in dark: the glyph alone tells the rungs apart there).
  - **Gates** (build tests, every preset, the community's palettes and a custom one of each character, base and fill, both modes): never above the softest colour's chroma (0.038); glyph 3:1 on the card, the page and its resting circle; on-fill 4.5 and its 80 % state line 4.5; hairline 1.35; on vs off 5.5; plates and glyphs strictly ordered; neighbours 5.5 apart, plate and glyph together; the lit light (the accent's twin) the rung itself.
- **A card's own surface (1.7, the second exception).** `card_color` tints the card itself: `--fluvy-card` becomes a
  wash of the colour's fill over the palette's card (`surfaceWash`: as much of the fill, up to 40 %, as keeps the
  primary and the secondary ink at 4.5 and the fill's hairline at 1.35 over it; with none to spare, the card itself),
  and `--fluvy-border` becomes the fill's hairline, so the card's edge and every divider in it say the colour. Both are
  written by the card's `AccentSheet` on its children, beside the accent's family, so everything that paints with the
  card's fill (a knob's halo and face, a resting icon circle's mix, the focus ring, a chart's strokes and halos)
  follows without a rule of its own. It is independent of `color`: the surface and the accent are two choices. The
  page fill, the inner tiles' ground, the inks, the tones and the statuses stay the palette's; an item that is on keeps
  its full fill; a card that is off or unavailable keeps the neutral skin (a state is never covered). Not on the
  greeting, a heading or the tabs, which have no surface of their own. The gate runs in the build for every palette,
  mode and pick.
  What sits inside it on the page's fill — a round, an action, the stepper, an option, a chip, an inner tile, a
  resting neutral circle — takes the wash's own deeper step (`--fluvy-inset`: the same share of the fill over the
  page, down to where the words read at 4.5; the page's fill on any card without a wash), never a hole of the page's
  colour in it (1.9). Where the words would not read on the wash's deeper step, it gives up some of its colour (less of
  the fill over the page) while it keeps half of it (a grey any of it: it has only its depth to keep); past that (Volt's
  light page leaves a colour no room over it) it keeps the colour whole and gives up depth instead, the share over a
  ground lifted from the page toward the card as far as the words need, flush with the wash at the most: never a hole of
  the page's grey in a coloured card. Gated on every palette (presets, community, custom) in both modes, a card's own
  colour and a lit light in every bulb colour and white: the words at 4.5, never the bare page, at least half of the
  wash's colour kept over the page. On a tiles group the colour is each tile's surface: the group has none of its own.
- **An item's colour, at rest too (1.6, the one exception to "surfaces stay the palette's").** Lists of things
  people tell apart by colour take a `color` per item: tiles, scenes, tabs, people (a ring round the avatar: a picture
  would hide a fill), openings (its circle), rows, bars, stat tiles and lights. Its fill shows while the item is on (the
  default), and the house may ask for it at rest too (`tint: always`, on tiles, a tiles group, a room's tiles, room
  lights' tiles, scenes and tabs). A tile with no colour of its own takes its tone's rest wash, as a light card at
  rest does (`data-surface`, `litSurface` at rest: two fifths of the most of the fill everything on it reads on; an
  inner tile its deeper step over the page, with the tone's hairline) — 1.10, #58; a scene and a tab with none keep
  the card's surface. A colour never covers a status: an open window, a jammed lock stay the warning's, circle, fill
  and words. Only a `tone` asked for by name outranks a status (the house's choice): the circle and the fill take it.
  At rest it is the item's rest wash (`--fluvy-accent-rest`, `-rest-inner` over the page on an inner tile) with the
  fill's hairline; on, the full fill as ever. The rest wash is as much of the fill, up to 40 %, as keeps the words on
  it — the primary and the secondary ink — at 4.5, derived per palette, mode and colour and gated in the build for all
  of them: a tint palette's pale fill takes the 40 %; a solid one in dark gives about a quarter, still 1.18 or more
  from the card. In a tint palette the whole way from the card to the fill is about 1.25, so the rest wash and the
  fill are close in lightness: on and off are told apart by the icon circle (filled when on), the fill's step and the
  state's word. The words keep
  their usual ink. A named colour is Home Assistant's tone on the palette (amber is the lit light's ink, which a
  palette may move aside): the palette keeps its harmony, and a hex picks one exactly.
  **A lit light in its bulb's colour (1.9, #41)**: tiles, a tiles group, a room's tiles, a room's lights row (the
  colour of what is lit, by brightness) and an entities card's light rows wear a lit colour bulb's colour
  (`light_colors`; the house's where the card says none, off), a white its warmth (`light_whites`, 1.10), an off light
  the palette's — by the rule every light follows (§ Light colour): an item's own `color`, then its `tone`, then the
  bulb's, then the card's `color`, then its `tone`. The room lights card keeps its own default (on), and its rounds
  and chips, like every surface of a light, show the colour a light last glowed while a flip waits.
- Text on a filled surface uses that surface's on-fill ink (a tile's state line, a scene row's time), never the page's secondary.
- Gates (build and tests, every preset and custom combinations): text 4.5, icons and graphics 3, ink on fill 4.5, icon on its resting circle 3, hairline 1.35, card vs page 1.18 (light), dark card lift 4–6 pp, ΔE separation of series and roles. The grey ladder's own gates are in its bullet above.

## Settings panel

- One centred column of cards (760 at most; the phone's 16 gutter). Its breakpoints are its own width (inside Home Assistant the sidebar takes part of the screen): from 648 it is laid out as on a desktop (12 gaps, the wide tabs); the preview takes the desktop card sizes when it has 672 of its own (a 760 panel); from 1184 the preview leaves the column for a 400 side column of its own, sticky (scrolling within itself when taller than the window) and on every tab — the look's preview, or the automatic dashboard's on its tab. Narrower, the preview closes the tabs that have one.
- **The Dashboard tab's preview** draws the lights in the chosen size, the thermostat in its variant and the energy flow in its style — on the house's own meters when it has any (the automatic dashboard's detection: the energy preferences, then the words), on made-up ones (sun, grid, a charging battery) when it has none.
- **Settings file**: Export writes everything Fluvy keeps — the house's settings, this person's, the automatic dashboard's options (not the house's own entities), the version and the date; Import restores them (the dashboard's options when the house has an automatic dashboard).
- **Backups keep everything (1.11)**: every setting of the house's or a person's lives in their settings (parsed, defaulted, versioned: `HouseSettings`, `PersonalSettings`), which Home Assistant keeps in its frontend data, so a Home Assistant backup and the settings file both carry it — the Charts tab and the house's series sets too (`panel.test.ts`, "exports every setting"). A setting of one device (*This device · Size*, a wall) says it stays on that device.
- **Tabs**: six — Appearance, Charts, Scope, Dashboards, Wall, Preferences — a tab row (14 px face) on the card surface, the open one in the selected ink. A phone scrolls content-sized pills and keeps the open one in the middle, fading only where the row goes on; a wide panel fills the column with the six equal tabs on one line. Fluvy's own facts (the About tab until 1.4) are Preferences' last card, *Fluvy*: its version as the head's sub, the look in use and the Home Assistant pages it styles as rows, the settings file as a label over the equal Export · Import pair with its hint under, and the house's reset row (an administrator's).
- **The panel wears the look being chosen**: a tap on a palette or a shape re-skins the page it was made on; the preview shows the real cards at their real size (desktop tiles 152 beside the thermostat's 312).
- **Nothing saves on tap (2026-09-19)**: every tab edits, and the edit is shown before it is saved — the look on the panel itself; where it applies, the frame and the menus' icons on the whole screen (the look engine's preview); the language and motion of the cards on the page. An edit back to the saved value is no edit, and an edit clears itself when Home Assistant hands the saved value back (no flicker to the old one). The Dashboard tab previews its cards (the lights as large tiles or rows, the thermostat in its variant).
- **Pending changes**: a bar in a dock at the foot of the column, in the flow (it never covers the last card) and sticky (at hand while scrolling), on every tab: what changes (one change in words, each part from → to: "Linen → Volt · Soft → Round", "Floating frame · Off"; several: "3 changes"), Discard, and how to save: a changed look as an equal pair, for the house or only for me (one accent "Apply for me" for someone who may not change the house's), the pair sharing the row while both words hold half of it with 8 on each side, as a chip's do, else one a row, each the whole width (French and English at 360, German and Dutch at 412); anything else one accent Save. The "Saved" notice sits in the same dock. Enter 220 ms, leave 160 ms, transform and opacity only.
- **Gallery**: three a row at every width (108 / 216 cells), Linen first; each palette a miniature of the product (its page, an on tile in its fill with an icon circle and lit ticks, an off tile in its card, its highlight); the chosen one on the accent fill with a check. Custom is a builder row of its own under both lines.
- **The Charts tab (1.11)**: the house's charts chosen as the look is — every change shown at once on the tab's own
  drawings and on every card of the page that names no style (the look engine's preview sets the house's chart
  settings), saved from the bar ("Charts · Style · Soft"). Four cards and the preview: **Style** and **Gauges** as the
  house's Apple-like tiles (the palettes' swatch: a picture over its name, the chosen one in the accent's fill with a
  check), two a row on a phone and four on a wide panel, a last row short of them sharing the width among its own
  (the eleventh gauge takes a phone's row whole, the last three share a wide panel's); each picture is the engine's
  drawing on the card's surface in the fine settings chosen — a day of temperature with its forecast after two thirds
  (the bars styles on a day of energy, twelve slots), a control gauge on 62 % in a 116 picture that is the small dial's
  own height (its disc on the grid; the ring and the ruler centred), each moving gauge on a reading of its kind
  (21.5 °C, 620 of 1,000 L, 1.8 kW …), moving as it would.
  **Details**: the fine settings the chosen style draws with, a label over a row of chips each, never one it does not
  draw with (the engine's `HOUSE_ACTS`); classic offers none and says so in one line; the Waves of a moving gauge
  while the house's gauge moves; **Motion** as the last row, a switch. **Series colours**: rows as the custom
  palette's (a picture of six rounded columns in the colours, the name, a check when worn) — the palette's six first
  (its `--fluvy-graph-1…6` as the look being chosen derives them in the mode on screen), then the house's sets; under
  them *Edit this set* (the one worn) and *New set…*, or the line that says twelve are kept.
- **A set of series colours**: its editor is a card of its own under them — the name (24 at most); **Colours**, the
  set's six as dots on the picker's columns (six a row on a phone, the first six of twelve on a wide panel), each a 36
  dot in its 44 with its **mark** — the palette's glyph where it follows the palette, a lock where it is fixed — the
  one being picked ringed in the accent with the card between; under them the colour being picked: its number
  (15/600) and its mark in words as a pill at the row's end (*Follows the palette* in the accent's fill, *Fixed* in
  the neutral one, fitted, 14 px sides, its glyph 16); then the **picker**: *Series* (the palette's twelve), *Tones*
  (the accent, Success, Warning, Danger, Notice, the lit light), *Energy* (Solar, Grid, Battery, Water, Gas, House),
  each a label over a row of the house's colour dots (six a row on a phone, twelve on a wide panel, every group on the
  same columns), each dot drawn by its token in the look being chosen and the mode on screen, named by its word (its
  tooltip and its label), the chosen one with its check; and *Custom*, the hex field with the system's well (on a
  colour of the palette's it shows that colour's hex here, to start from; a hex typed makes the colour fixed). **New
  set…** starts on the palette's six, named, so a new set follows the palette until a colour is made fixed. Then the
  check (two colours closer than 8 ΔE2000 as each mode wears them — "#2563eb and #2463ea …", "Series 1 and Accent are
  too close to tell apart" — on both cards, or on the one where fitting brought them together, in a warning panel; or
  one quiet line when every colour passes), the two modes side by side drawing six lines as each wears them, Cancel ·
  Save set as an equal pair, and *Delete this set* for one the house keeps. A set keeps its hues and each mode wears it
  as § Charts (1.11) → Colours says, so the check says only what fitting cannot fix. A set's row pictures it as the
  mode on screen wears it: a palette's colour by its token, so choosing another palette recolours a set that follows
  it at once, and leaves a set of hexes as it was. It is kept at once (as palettes are) and worn as an edit for the
  bar.
- **Both modes side by side** (the Charts preview, the set's check): two equal cards, each in its mode's colours (the
  look scoped to `.pn-day` and `.pn-night`), its mode's name as a label over its drawings — a sensor's day 120 tall
  with its bubble where the style shows one at rest, the day's energy as bars 64 tall, the house's gauge (a dial or a
  ring at most 112) — the light half keeping a light card's fills in a dark panel. Motion off: every drawing its
  resting frame, the bubble with it.
- **Custom palette builder**: the accent examples are the style's own — twelve pastels (L 0.85, C 0.08) or twelve electric colours, hue for hue, so changing the style keeps a listed pick's place; any colour can still be typed or picked. The highlight says what it does under its label (you and now: the avatar, today, the open tab), and the preview carries the greeting, whose avatar wears it. A colour dot's edge is its own colour a shade deeper (a grey ring stair-steps round a saturated dot).
- **Only on dashboards while Home Assistant wears Fluvy**: when the profile's theme (or the house's default theme) is Fluvy itself, every page wears it whatever the scope. Choosing "Only dashboards" then shows why in a note, with Home Assistant's own way back: the profile's theme picker event (`settheme`, theme `''` = the default) for the person; `frontend.set_theme` for an administrator when it is the house's default.
- **Scope → Everywhere** offers what belongs to the whole app: the floating frame and **our icons in the menus** (the sidebar's glyphs and Settings' icon circles; off, Home Assistant draws its own). Both are the house's, apply live on every screen, and are shown read-only to someone who is not an administrator.
- **Appearance → Lights (1.9, #41)**: what a card of lights does where its own config says nothing — *Show their colour*
  (Never · When on · Always: a light card's `tint`) as a full row of chips under its label, and *In their bulb's
  colour* (a switch: `light_colors` on tiles, rows and rooms) — a white then by its warmth, each card's own
  `light_whites` (no house setting). The house's, an administrator's (read-only for
  everyone else), off until chosen; shown on every card of the page at once, saved from the bar ("Lights · Show their
  colour · When on"). "Never", not "Off", beside "Show their colour": a light's own off is another thing.
- **Appearance → Status colours (1.9)**: one card under Lights, a block a status — Warning, Danger, Success, Notice —
  each its label over a full row of two chips, *Auto · Custom*. Custom opens the house's colour picker under them: six
  dots round the wheel (red, #47's orange, yellow, green, blue, violet; a row of six at every width, filling it) and the
  hex field with the system's well; it starts on the status's own (the warning on the orange, the danger on the red, the
  success on the green, the notice on the blue) and keeps a colour already picked. Where a picked status still sits
  close to another after the engine has moved it, the house's helper text says so under it ("Close to Danger: the two
  may be mistaken for each other") — nothing is turned aside. The house's, an administrator's (read-only for everyone
  else: the chips still, the dots and the field read only), Auto until chosen; shown on the panel and on the page at
  once, saved from the bar ("Status colours · Warning · #dc630b", "… · Auto").
- Choices inside a card share one rhythm (8 between cells on a phone, 12 on a desktop) and are laid out by measure, as a card's chips are: as many a row as their labels suggest while every word holds its cell, else fewer (three go two and one, the third across both: pt-BR's "Quando ligado" and es' "Al encenderse" on a phone), never a word cut; a label binds to the row under it; prose wraps; a destructive action (Reset) arms on the first tap and says so ("Tap again to reset", "Cancels in 4 seconds").
- **Preferences (2026-09-28)**: the language is the dropdown above — *Automatic* first, with the language it resolves to as its hint, then Fluvy's languages by their own names with the English name beside (eight chips before); the panel speaks the chosen language at once, before it is applied. Under the switches, a row opens the translating guide (`docs/translating.md`) in a new tab.

## Activity page (`/logbook`, 2026-09-19)

- **One scroll, and the rail is its scrollbar** (the native one is hidden). The time rail is the vertical ruler of the language: 2 px ticks centred on the axis (an hour, a label every three on the near side, "24" at the end of the day; over 36 h a tick per day and the day's number in the middle of its band), the histogram on the far side growing outward (whole pixels, a square root so a quiet quarter stays readable beside a burst of hundreds), the **part on screen lit** — drawn on the axis itself, a 2 px accent line from the knob to the foot of the screen (at least 8 past the knob's halo, so it never vanishes — but at the very end of the scroll, where the knob rests on the rail's foot and there is no room below it), with its ticks and bars in the accent — and the **36 knob** with the page's colour as its halo. **Whole or absent:** a tick, bar or label the halo would reach goes, whole (opacity, 120 ms), while the knob is over it; the dotted future stops 6 short of each tick it crosses. At rest the scale is the secondary ink at 80 % (3 : 1 on the page, a graphic); lit, the accent. The histogram is scaled to the busy stretches (twice the 90th percentile), not an outlier's: a restart's hundreds run the whole room with a 2 px notch, and the rest of the day keeps its shape; a bar eases to a new count (a filter, a live entry), and another period's histogram crossfades in over the last one, which holds its place while the next loads. The bubble sits left of the knob with its tail on it: the time, and how busy that stretch was. A mouse scrubs from anywhere on the rail (a click in the track jumps); a finger only from the knob (its target is 52) — elsewhere it scrolls the page, and a tap jumps. Keys: ↑ ↓ a quarter hour, Page an hour, Home now, End the oldest entry. It is felt as the lamps' rulers are: a light touch when the knob is taken (or a tap jumps), a selection tick at every hour crossed (every day over a long period), a medium one at either end. Every haptic of Fluvy — cards, rulers, dials, the rail — goes through `@fluvy/ui`'s `haptic()`: the person's Haptics preference holds for all of them, and ticks from one source are thinned to one per 60 ms. Desktop rail 88 wide beside the 720 column; phone 44 with the axis 28 from the screen's edge and, while a finger holds it, a strip of the page's ground (faded in over 12 px, never a hard cut) with the hours — a week's days — on it.
- **The scroll ↔ time map** runs through the rows (a row settles right under the pinned hour header), each hour's header (the quiet part of an hour is its header) and the start of the day, which is **the end of the scroll**: the last screen is the oldest hour, its header pinned over its rows and the start of the day (the page's foot leaves exactly that room, measured), and whatever lies past it maps there. An hour off screen is not laid out (content-visibility) and keeps the room of its rows at a real row's pitch; a long jump **chases its row** — measured again each frame as the hours it passes are laid out — until it sits under the header. After a scrub, a tap or a key the knob is pinned to what is shown until the reader scrolls by hand. Under the start of the day, the way on to the day before (a quiet button with its date).
- **Timeline rows** are the two-line list rows: 64 tall (12, the 40 circle, 12), the time 52 (72 for a 12 h clock) right-aligned, the 40 icon circle (20 glyph) for what people look for and an 8 dot for the house's small print (sensors, settings), name 15/20 over 13/16; a wrapped line stays on the 4 grid (84). **One spine** runs through every node and every hour header (an 8 hollow node on it), dashed across a quiet half hour, down to the start of the day. The hour header: its time in the time column, its count and a hairline in the text column; pinned, it gets its edge.
- **State pill** (the timeline's): 20 tall on the name's line, 8 sides, the from pill quiet, the to pill in the state's tone when it is on, dashed when unavailable; "from › to" is one unit and wraps as a whole. Moments (a button pressed, a doorbell) are neutral circles; runs of automations take the accent.
- **Folding**: restarts (the stop, what was written while down, the start, what came back in the next ten minutes — never what a person or an automation did), bursts and repeats are one row with a chevron; a row's detail opens under it (a card on the text column: When / Change / Trigger / Cause / Where, then equal 48 buttons — More info, Only this, History or Traces, Device). The buttons' layout is **measured, not a breakpoint**: one row of equals when every label fits its cell (12 px sides) in the page's language, else the main one alone and the rest in pairs, else one a row. The cause is a way in (its glyph, its name · what it is, ›); what it is goes when the line has no room for it. **Only this** is a quick look, not a choice of sources: the day narrowed to that device, nothing remembered, and the narrowed line's **Back** returns to the filter and the sources it came from.
- **The floor is 320** (a phone at its smallest, or zoomed): every moment is checked from 320 up, page and card. A button whose label cannot keep its 12 px sides even alone takes 8, then two balanced lines; the eyebrow drops the weekday ("Today") when the line cannot hold both; the way to the day before takes the date's short form, then "Previous day".
- **Text is never cut** but for names: the day's title steps down (32 → 24 on a desktop; the phone's short form 24 → 20; still too wide, its two ends — or its words — go on two balanced lines), state pills never shrink and are sized in layout (the canvas knows no font features; `@fluvy/ui`'s `textWidth` measures with them), "from › to" wraps as a unit and breaks after its arrow only when wider than its whole line, a burst's or a repeat's entry puts its change under its time on a short line, a line of parts ("135 changes · 3 runs · 1 restart", a detail's date · time) drops the "·" of a part that starts a line. The desktop layout starts at 720 (where its day header fits).
- **Filters** are the language's chips (a 36 pill in a 44 target): on a desktop, one row or two balanced rows of equal cells (5 · 5) — never more; when two rows cannot hold the labels, and on a phone, a strip of fitted pills (wheel and mouse drag too, faded at its ends). A filter that would change nothing is not offered: no row for one entity, on an empty day, or when every chip would show the same count; while searching, the counts are the search's.
- **Dates**: presets on top (Today · Yesterday over Last 7 days; a week is two taps on the grid, so the presets stay one short row), the language's calendar choosing a period, on seven equal cells (44 in the popover, wider in a phone's sheet, 41 wide × 44 tall on a 320 phone), the chosen days one band (its ends filled), the hours of the first and last day in **our time field** (hh : mm in the house's clock, and the day's half on a 12-hour one; digits, ↑ ↓, a whole segment moves on; a whole last day reads 24:00, or 11:59 PM on a 12-hour clock, where 12:00 AM would read as the day's start), one accent Show — kept back, with the reason under it, while the end is not after the start. Field labels are the fields' 13/500. A popover (radius 16) on a desktop; a bottom sheet with a grabber, its title and close on a phone. The picker says only the pages' shared words (`page`), so every page that opens it holds every word it says (the History page showed the raw "from" and "to" in 1.8.0, when the two were the Activity page's own). **Sources**: a drawer out of the floating frame in its shape, hosting Home Assistant's own picker.
- **On a card** (a person's preference): the column in its own card (radius 20, hairline), its controls on the page's fill; the room at the foot stays outside the card.
- **A period across midnight** names each day above its first hour, and dates its start ("Start of the period · Sep 16"); a more-info's "Show more" reads **Last 24 hours**, the entity's name as the eyebrow.
- **Motion**: another day — its title turns in from where the day went while the list leaves that way (160 ms; the summary says "Loading…" meanwhile), a skeleton holds the place, the new rows rise (30 ms apart, 10 at most). A live entry opens its place from nothing (grid rows 0fr → 1fr, 320 ms; its clip has no padding, so the row and its spine are where every row's are) with a ring that grows and fades (transform, 1.4 s); counters roll up. "N new" sits in the pinned header's 40 band, whose count steps aside meanwhile. Fluvy's Reduce motion reaches the rail's and the dates' shadow roots too. While the view's file loads, the takeover keeps our bar (Home Assistant's menu on a phone, the page's name) — never a blank page. Layers leave with **keyframes of their own** (an animation that keeps its name is not restarted: a reversed direction alone never ends, and a click-catching scrim would stay) and a timer that removes them regardless.

## History page (`/history`, 2026-09-20)

*(approved at its fifth review round. Three rules it settled hold for every chart of
ours: a mark placed by value sits at its value, a curve drawn from samples reaches the window's own highest and
lowest reading, and nothing is read past the end of the record.)*

- **A card per measure, one scale.** Everything a house measures in the same unit and device class shares one chart and one scale: our smooth curve, drawn only as far as the record goes — a window that runs into the future keeps its room and stays empty, and nothing is read past that end, by pointer or by key. A lone curve takes the card's accent, gets the area under it (a gradient in its own colour, fading to nothing), the band a summarised reading moved between, and MIN / MAX / AVERAGE beneath; several curves take the palette's graph colours — each series the one its entity id hashes to, so a search keystroke, a "+N more" or another window never recolours a room's line — and a legend of a row each (dot, name, its reading at the cursor), with the rest folded behind "+N more" until it is asked for. A chart never draws more series than the palette has colours to tell apart. 44 of headroom over the highest reading is the bubble's, as on every chart of ours.
- **One unit, one precision per card.** The unit is the one a typical reading takes — a house averaging 592 W reads watts in its head, its legend, its bubble, its readouts and its scale marks; one averaging 4 kW reads kilowatts everywhere — so three readings of one measure can be compared by eye. The decimals follow what the card's readings reach in that unit (Home Assistant's own precision wins while the unit is untouched), and a measure that only ever reads whole numbers is written whole. A reading that is not there is a dash, never a zero.
- **What a height means**: two hairlines at what the window actually reached, high and low, each with its figure and its unit at the left. A card of one measure with no device class is named by that measure's own name, not by its unit.
- **One cursor.** A finger on any chart reads every chart at the same instant: the dashed line, a dot on each curve — placed on the curve the chart drew, never on a reading the line does not pass through — the bubble (only where a single curve makes it unambiguous, and leaning into the card's padding rather than let its tail leave the dot), the card's big readout with the instant as its label, and every legend row and state line at that instant. A finger lifts and the page reads now again; a mouse keeps the reading until it leaves. The instant is named at the window's own resolution: the clock through a day, the day and the hour through a week, the day alone through a month of daily averages. Both the charts and the state lines take the keys — ← → a step (Shift, five), Home, End, Escape — and the page says what it reads on one live line.
- **The state lines** are what is not a number: a row each, the busiest first — its name and what it was under the cursor over the window as a bar of stretches, at the card's full content column, so their cursor lands exactly where the charts' does. A stretch spent on takes the accent; one spent doing something else (paused, idle, returning, docked) the neutral ink; one the recorder knew nothing of, that ink striped; a resting one the page's own fill. Under them the same axis the charts carry, and "+N more" for the lines a card will not draw — the same button, in the same place, as the legend's.
- **The window** is the last 24 hours and follows the clock, so a page left open all morning still says what it shows; ‹ Today › walks it by its own length and never into the future, and the calendar opens the pages' shared picker (a popover on a desktop, a sheet on a phone). How it is read follows how wide it is: its own states up to two days, the hour's statistics up to eight, the day's beyond — a month of hourly means draws a comb, not a curve — and a summarised chart says which it is under its title.
- **The axis** names the window's own ends (saying which day they are when the clock alone would print the same words twice) and puts round marks between them — hours through a day, whole days beyond — as many as the width affords, each costing its own measured ink and a gap: three labels on a 320 phone, five or six at 1440, never a label outside the card's column.
- **Its sources** are Home Assistant's own picker in our drawer, with Clear and Done at its foot, and what is picked is kept where Home Assistant keeps it — its links (`?entity_id=…&start_date=…&back=1`) open the same window ours writes.
- **Nothing to draw** says which nothing it is: nothing picked yet, a window with no history, or a search no measure and no state answers — each one panel (the page's other fill) holding its line and its reason, with the way out under it.

## Shape

- Three shapes, one scale each (sm · md · control · lg · card · xl): **Soft** 4 · 8 · 12 · 16 · 20 · 24 (approved), **Round** 6 · 10 · 16 · 22 · 28 · 32, **Crisp** 2 · 6 · 8 · 12 · 14 · 18. Cards, tiles, controls and sheets use the role variables (`--fluvy-radius-card|lg|control|xl`); Home Assistant's radius names refer to ours, so a shape moves them too. Circles never change; the small functional radii (bars 2, bubbles 10) do not either.
- **Buttons (the pill-shaped things), chosen apart from the shape (2026-09-19)**: **Pill** (approved, fully round), **Soft** 12, **Crisp** 6 — `--fluvy-radius-pill`, and through it Home Assistant's `--ha-border-radius-pill`. Chips, tab rows, badges, the bottom nav, the panel's notice, HA's assist and filter chips and the more-info centre button follow it; a switch stays a capsule.
- **A look inside another declares what it lacks**: the names only some palettes write (a solid primary's edge, the highlight's mark) are declared `initial` by a look that has none, so a look worn inside another (the panel wearing the look being chosen, a dashboard inside a themed page) never shows the outer one's through.

## Colour (Linen)

- On/active = filled pastel surface with dark ink. Never a tinted icon on white.
- Warning is an amber (`--fluvy-warning`, hue 58, chroma ×1.15), distinct from the gold accent; used for open sensors, unreachable devices, and the `⚠` glyph, which is reserved for alerts. The house may give it, the danger, the success and the notice a colour of its own (§ Colour, The house's status colours); the amber is Auto.
- Danger (`--fluvy-danger`, its fill, hairline and on-fill, gated as the warning's) is what is wrong now: a leak,
  smoke, a critical alert's tile. It is a tone a card may be given (`tone: danger`, in every editor's dropdown), never a
  device's colour; the warning keeps what wants a look (open, unreachable, low).
- Energy tones: solar gold, grid lilac, battery green, generator the gas tone, a car the vehicle teal; destinations (the house, its consumers) are ink. See § Energy (1.4).
- Dark mode is re-derived, not inverted; glow on filled ticks only; no neon; no backdrop blur.

## View backgrounds

Generated, opaque, no images: the page colour plus three radial stops in the palette's own hues (`design/approved/backgrounds`). Light = **Paper** (warm mesh) or **Plain** (page alone, the default); dark = **Charcoal** (page + an amber breath); wall panels = **Wall** (Charcoal one step deeper). Cards keep their hairline separation on every one; no blur, no photo by default (room photos are an opt-in, processed 1.6:1 with a tinted scrim).

## Compositions

- **Phone** 392: side padding 16, content 360; status bar 44, hello 60, room tab chips (14 px, ink active, content-sized), section titles 24 with a "4 devices ›" meta, tiles 2 × 172, cards 360, bottom nav 60.
- **Desktop** 1440 × 1024: the HA shell drawn as HA draws it and only coloured by our tokens — sidebar 256 with HA's fixed logo on the icon column and a colourable title (brand row 44), items 40 high / radius 4 / 24 icons, selection = the selected-icon colour at 12 %, foot ending on the sections' bottom line; toolbar 76 with the dashboard name sized by content, view tabs as text with a 2 px accent selection bar, bare 44 icon buttons at the right. Content 1184 with 32 padding → three 352 columns (content 312) and 32 gaps, 16 between cards; first nav item top = first card top (84); all three columns end on one line (992). Cards stretch to the column: tiles 152 + 8 + 152, rulers 120 / 312, options 3 × 96 + 2 × 12, readout columns 96 with 12 gaps, five 56 transport rounds with 8 gaps, scene tiles 84, presence as three 60 rows (success dot = presence), the plug foot 56 + 64.
- **Tablet / wall** 1024 × 768 (HA's header 76 kept when the tablet is not a wall — title, text tabs, bare icon buttons; no invented bar; as a wall the header and the sidebar are gone and the dashboard fills the tablet, the wall template's two columns): 8 between the header and the first row, 24 at the bottom; content 960 → two 464 columns (content 424) ending on one line (84–744, 660 of content); tiles 208 + 8 + 208, rulers 176 / 424, readout columns 128 with 20 gaps. Type tiers for a panel read from 1–2 m: glance = the clock 40/44 in the hello card and the dial value 48 (dial drawn large at R 88), approach = 24 readouts and the 22 greeting (card titles stay 16, rows 15), touch = 13 subs. Dark is the default for a wall panel; a day/night theme schedule is a product setting, not a design.
- **Review sheets**: explicit 392 / 392 grid with a 48 gap on a 900 canvas (1504 / 1088 for the compositions); frames start-aligned; rows top-aligned. Sheets are the storybook of the implementation. Every sheet also renders with `--frame dark`.
