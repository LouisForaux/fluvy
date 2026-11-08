# Energy

Fluvy's energy cards read a house the way its meters do and say only what they measure. This page is the guide:
how a card finds its sources, how to describe the ones it cannot find, and what each card of the family shows. Every
option of every card is in [the cards](cards.md).

## Where the cards read the house from

**The Energy dashboard, when a card is given nothing.** A flow, a balance, a grid, a batteries card with no
sources of their own read Home Assistant's energy preferences — every grid connection, every array and battery,
with the power sensor you gave each one there (`Settings → Dashboards → Energy`, the power sensors of 2025.12 and
later). A grid or a battery set up there with two power sensors (one for what comes in, one for what goes out) is
read as two sensors — Home Assistant's own diagram nets them into one; Fluvy keeps both, so a house that imports and
exports at the same moment shows both flows.

**Your own sources, when you describe them.** A card's `sources` list replaces the Energy dashboard's. A source is
one of `solar`, `grid`, `battery`, `generator` or `vehicle` (a car that can power the house), read in one of three
ways:

```yaml
sources:
  - type: solar
    power: sensor.inverter_power          # one sensor, positive toward the house
  - type: grid
    import: sensor.grid_import_power      # two sensors, both positive
    export: sensor.grid_export_power
  - type: battery
    power: sensor.battery_power           # + discharging; invert: true for a meter signed the other way
    level: sensor.battery_soc
    capacity: 10                          # kWh: weights several batteries' charge, and says "full in"
```

`power` is one signed sensor: positive is energy toward the house (import, production, discharge). A meter that
counts the other way takes `invert: true`. `import` and `export` are two sensors, both positive. `phases` is a list
of signed sensors, one per phase (or per inverter, per string), summed **per sign** — see below.

Each source may also have a `name`, an `icon`, a `color` (any Home Assistant colour, or `#rrggbb`), `threshold` (the
watts under which it rests, 10 by default), `arrows: none` and `show: active | never` (never: counted, not drawn).

Several sources of one kind — two arrays, two batteries — are listed one after the other, each with its own sensor
and sign, and each is drawn as its own node named by its sensor. One that cannot be read (an inverter asleep, a
battery away) shows as unavailable and counts as nothing, so the house is still worked out from the others; the kind
is unknown only when none of its sources can be read. A card that names one `solar` source reads it as it always did.

## A house that imports and exports at once

A three-phase house with its solar on one phase can import on two phases while it exports on the third. A single net
meter shows the difference and hides both flows — and then every share worked out from it is wrong (the sun seems to
cover more of the house than it does). Read the grid per phase:

```yaml
type: custom:fluvy-energy-flow-card
sources:
  - type: solar
    power: sensor.inverter_power
  - type: grid
    phases:
      - sensor.grid_power_l1
      - sensor.grid_power_l2
      - sensor.grid_power_l3
  - type: battery
    power: sensor.battery_power
    level: sensor.battery_soc
```

Each phase sensor must say its own direction (positive importing, negative exporting — or all inverted together with
`invert: true`). The positive phases are summed as what comes in, the negative ones as what goes out; the grid then
draws two lanes, the import in the grid's colour and the export in the colour of where it came from. If a phase
cannot be read, the grid says "—": a sum that skipped a dead phase would be a wrong number. The Grid card shows each
phase on its own bar, and the balance lists them under "Per phase".

## Live, or a period

A flow, a balance, the sankey and the score can show a day, a week or a month (`period: day`), with Day · Week ·
Month chips to switch. A period reads the Energy dashboard's meters from Home Assistant's long-term statistics, hour
by hour (a day by day over a week or a month), and allocates each hour the way the Energy dashboard does — grid energy
the house did not use went to the battery first, then the sun charged the battery, then it was exported, then the
battery exported, then the rest ran the house — and adds the hours up. The figures are the dashboard's own, rounded
only by their decimals: a cloudy day's 0.05 kWh of sun reads 0.05 kWh. On the flow, a way under 50 Wh rests, its lane
and its figure dimmed.

## Following Home Assistant's date picker

Home Assistant's Energy dashboard has one date picker for the whole view: its `energy-date-selection` card keeps a
*collection* on the connection under a key that starts with `energy_` (`collection_key`; without one, HA's cards use
`energy_<the dashboard's url path>`), and every energy card on the view reads that collection's range and the figures
HA fetched for it. Give a Fluvy energy card the same key and it follows the picker:

```yaml
type: custom:fluvy-energy-flow-card
period: day
collection_key: energy_casa       # the key of a date picker on this dashboard (HA's card, or Fluvy's Energy period card)
```

- **What follows.** The flow, the balance, the sankey and the score (set `period` to anything but `live`), the
  Energy devices card (the Energy dashboard's devices), the Grid card's totals (when it names no readouts), the
  Energy card, the Energy usage card, Production and Water & gas. History bars keep their own `period` and `days`.
- **What a follower does.** It takes the picker's range (the day, the week, the month, whatever was picked) and
  draws **Home Assistant's own figures for it** — the statistics HA fetched once for the whole view, allocated the
  way the dashboard allocates them — so a Fluvy card and HA's beside it say the same numbers and move together, and
  no follower asks the recorder again. Its Day · Week · Month chips go (`show_period` has nothing to switch), and its
  subtitle says the range: "Today", "Yesterday", "24 Oct", "17 – 23 Sep", "September", "2026". A week is HA's
  calendar week, not the last seven days.
- **Each card.** The flow, the balance, the sankey, the score and the devices card total the range (the balance's
  money too). The Grid card's three totals are the range's, and its subtitle leads with it. The Energy card draws
  the range in place of `hours`: a day on the day's axis, a longer range on its dates, with the house's power from
  the power sensors HA names (else the meters: five-minute changes for a day, hours beyond); "right now" and the
  batteries' charge are shown while the range holds now. Production and Water & gas are day cards: they draw the
  range's last day (the day so far while the range holds today), and say the date.
- **Until the picker is there.** A date picker's card may load after Fluvy's: the follower draws its own period
  (today by default) without chips until the collection appears, then follows it. The card's height never changes.
- **A key of your own.** Any word starting with `energy_` is a key; a key without that prefix is refused with a
  message, as HA's cards refuse it. Several Fluvy cards and HA's cards on one view share one picker through one key.
  Fluvy's **Energy period** card is a picker of its own that keeps the same kind of collection, so HA's cards follow
  it as well (below).

### The Energy period card

`custom:fluvy-energy-period-card` is the view's date picker as a strip: ‹ the span ›, Today (away from today) and,
when asked for, Compare. The span's words ("Today", "17 – 23 Sep", "September") open a sheet with the presets — today and
yesterday, this week, this month, this year — and a date grid for a span of your own, in whole days.

```yaml
type: custom:fluvy-energy-period-card
variant: stacked                # row (the default) · compact · stacked (the row over Day · Week · Month · Year)
periods: [day, week, month, year, custom]   # what it offers, in this order (custom: the sheet's date grid)
show_compare: true              # Compare: the period before beside the span, on the charts that draw it
```

- **The dashboard's own picker.** Without a `collection_key` the strip drives `energy_<the dashboard's url path>`,
  the key Home Assistant's own energy cards take without one: HA's cards on the dashboard follow it, and Fluvy's
  follow it given that key. Any `energy_…` key of your own works as it does for a follower.
- **Home Assistant's code, not a copy.** Where a picker already holds the key (HA's date card on the view, another
  strip), the strip drives it. Where none does, it asks Home Assistant for its own date card and keeps it hidden
  inside the strip: HA makes the collection and fetches its figures with its own code (the Energy preferences, the
  hourly refresh, yesterday until today's first hour of statistics). HA's date card on the same view moves the strip,
  and the strip moves it.
- **What it remembers.** A preset picked on the strip (Today, a chip, a preset in the sheet) is remembered in this
  browser, where HA remembers its own, so the dashboard reopens on it in HA and in Fluvy alike; walking with ‹ › or a span of your own
  is not, as in HA.
- **Narrow columns, wide bands.** Compare and Today give their words for their glyphs, the span takes its short words
  ("24 Oct", "Sep", "2026"), then Today and Compare go and, in half a section, the arrows: the sheet behind the span's
  words has them all. `stacked` keeps its periods on one line, which scrolls where the four do not hold it, so the
  strip is as tall at every width. Across a wide band the capsule and the periods run 360 at most, on the strip's
  start. `compact` is the span alone between its arrows, in a 60 strip.
- **Only on a dashboard.** The strip needs a dashboard around it to make a picker; anywhere else it says so, at its
  size, its buttons off.
- **The automatic Energy dashboard.** Its Today view leads with the strip across the view, and the day's flow,
  sankey, score and balance follow it (their chips are gone).

## The cards

- **Energy flow** — where the energy comes from and where it goes. Variants `rows` (sources left, the house right),
  `cross` (the sun above, the grid left, the house right, the battery below, with the flows between sources) and
  `list`; styles `stream` (lanes with pulses of light), `legs` (thin dashed lanes) and `rail` (one quiet track);
  `motion: full | calm | off`; `consumers` (where it goes: the house's biggest loads, and the rest of the house);
  the badge says how much of the house runs on sun (`badge: solar`), its self-sufficiency (`self_powered`), or the
  grid's way (`grid`).
- **Energy balance** — what comes in against what goes out, live or over a period, always adding up (the house is
  what is left); the grid's phases under it; over a period, what it cost and what the feed-in paid.
- **Grid** — the net import or export, what comes in and goes out, each phase with its voltage, the price now, and
  today's import, export and cost.
- **Batteries** — one state of charge for several batteries (weighted by capacity, so give each its `capacity`),
  full in / empty in while they all go the same way, the reserve, each battery on its own row, and the mode, when
  there is a select for it.
- **Car charger** — the car's charge against its target and the time it should be ready, the session's energy and
  time, how much came from the sun, the charging mode; a car that powers the house says so.
- **Where it went (sankey)** — a period from where to where, in true proportions: the grid, the battery and the sun
  into the house, the battery and the export, and the house into its devices and what is not measured.
- **Energy score** — self-powered, the sun used and low-carbon, as the Energy dashboard's own gauges compute them.
- **Water & gas** — each meter's use today against a typical day, what flows right now, and a leak sensor or a valve
  beside them.
- **Energy** — a sensor's power now and its curve today, with up to three totals under it. Where the card names no
  `tone` or `color`, its line and its head wear the colour of what the line shows: the Energy dashboard's sensor of a
  source (its power or its meter) the source's colour — the sun's, the grid's, a battery's, a generator's, a car's —,
  an individual device's the house's, and any other sensor the accent, as the Chart card's lone curve. The card reads
  it from the Energy dashboard's settings, never from a reading, so a curve keeps its colour whatever it says; every
  one is a colour of your palette. It draws one curve: several on one card are the Chart card's, in the house's
  series colours (fluvy's settings → Charts).
  The curve is its sensor's own: following a date picker, the recorder's five-minute means (hours over more than two
  days), each where Home Assistant's history draws it; without one, its history over the house's window (fluvy's
  settings → Charts, the last 12 hours from the factory) or the card's `hours` — `hours: 24` draws today on its
  00:00 … 24:00 axis. It is drawn calmly, a point on each of the house's round times as far apart as the card's width
  holds them (a day's half hours on a phone), each the mean of what the sensor read around it — or every 5, 15 or 30
  minutes or hour (`points`, the house's from the factory), each Home Assistant's reading then. Read with a finger,
  it says the reading itself: 12:00 reads the five minutes from 12:00, 2.61 kW on a cloudy noon, whatever the line
  draws there.
  A meter that reads negative while it imports takes `invert: true`: "Right now" reads 1.4 kW, not −1.4 kW, and the
  curve stands above the line. A total under the chart shows its sensor's state, and a meter that keeps counting (a
  lifetime meter, `total_increasing`) has counted everything since it was fitted: "12.5 MWh" under a day's curve.
  `period: today` on that item reads its change since midnight instead, from its statistics, as the cards that read the
  Energy dashboard do (the range's, while the card follows a date picker); the editor says so under such a sensor.
  `variant: sources` draws the house's power today by where it came from, stacked, with what went into
  the battery and out to the grid below the line. When the Energy dashboard names a power sensor for every source, the
  curve is their five-minute means — what Home Assistant's own "Power sources" graph draws — and "right now" is the
  house's own use; otherwise the meters, in blocks of 15 minutes, or 30 or 60 when a meter counts in coarse steps
  (0.1 kWh). A hybrid inverter's AC meter registered as solar counts what the battery gives back as sun: give the
  Energy dashboard its power sensors and the card draws from them.
  `variant: overview` draws the whole house today, as Home Assistant's "Power sources" graph does, plus your batteries:
  - every source's power above the line: the sun's whole production, what the battery gave and what came from the
    grid;
  - below the line, what went into the battery and out to the grid;
  - the house's use as a line;
  - the batteries' state of charge as a dashed line on its own scale: 100 % at the top, 0 % on the zero line, so it
    always sits in the positive half, above what went out of the house. It comes from the charge
    sensor the Energy dashboard names; several batteries are weighted by their capacity, and with no capacity given
    there is no line.

  At the top, "right now" and the charge now. Run a finger along the chart and the readouts and the legend show that
  moment, with a dot on each source's edge. `show_soc: false` and `show_house: false` hide the two lines. A
  generator or a car shows only when the Energy dashboard names a power sensor for every source.

  Both charts by source carry a power scale on the left (W or kW, negatives below the line) with dashed gridlines
  across, and the whole house a 0–100 % scale for the charge on the right, on the same lines. In a narrow column
  the charge's scale goes first (its readout and the "100 %" at the top still say it), then the power's.
  `show_axis: false` and `show_grid: false` turn them off. `line_width: thin` draws every line 1 px, `bold` 3 px.

  The sources are stacked: each one sits on the one before it, so the battery's band starts where the sun's ends and
  its top is the two added together (5.6 kW of sun and 4.2 kW from the battery top out at 9.8 kW). Each band keeps
  its own edge in its colour, and the legend gives each source's own value under your finger. `stack: false` draws
  every source from zero on its own instead, so their heights can be compared directly.
- **Energy usage** — the house's energy as Home Assistant's usage graph draws it: a column an hour of a day, a day of
  a week or a month, a month of a year, stacked from the line up by where it came from (the sun, the battery, the grid)
  and down by what went into the battery and out to the grid, each in its source's colour, from the Energy dashboard's
  statistics allocated bucket by bucket (an hour, a day, a month) as the dashboard allocates them — so the head's
  total and the legend's are Home Assistant's. A finger on the chart reads a slot's whole stack; `compare: true` draws the period before as ghost
  columns behind (following a picker, its own Compare does); `sources` names, colours, orders or hides the sources,
  `max_sources` folds the rest into "Other", `show_returns: false` leaves out what went out; `variant: compact` or
  `mini` keep the chart alone or a strip.

  `mode: flows` draws what each meter measured instead of what the house used: above the line the sun's whole
  production, the battery's discharge and the grid's import ("Solar production", "Battery discharge", "Grid import"),
  below it what was charged and exported as before. A morning whose sun mostly charges the battery shows a short solar
  column in the default `mode: usage` (the house's share of the sun) and a tall one in `flows`, and each series' total
  then matches its meter on the Energy flow card and the Energy dashboard. The head says the sum of the series drawn
  above the line in both modes, so a card with `sources: [solar]` says the sun's total alone. `plot_height` sets the
  chart's own height in px (48 to 480, on the 4 grid) for the full and compact layouts: the bars, the scale and the
  axis grow with it, where a taller card alone would only add room around them.
- **Energy devices** — rows can nest (`parent`), and a `total` meter shows what is not measured, at every level.
- **Production** — `arrays` stacks each array's hourly bars.
- **History bars** — a sensor's last `days` days (or weeks, or months: `period`) as bars from its long-term
  statistics, the value over each bar, the total and the average beside the title, and a strip of facts under the
  chart: the highest, the lowest and the average, or `co2`, `trees`, `km`, `money`, a `share` of another sensor and
  a `template`, each named, iconed, coloured and tappable as you like (`head` and `facts` are lists in your order).
  A counter that starts again on a cycle is read by its own readings (`reset: day`, `week`, `month`, `year`, or
  `never` for a lifetime meter) so a reset or a restart is never counted twice; a sensor with no state class reads
  the recorder's history; today is live and the average, highest and lowest are the finished bars'.
- **Gauge** — `variant: signed` for a meter that can be negative: zero at the top, "1.8 kW out".

`chart` draws a card's chart in a style of its own, or in the house's where it names none (fluvy's settings → Charts,
`classic` from the factory: the charts as 1.10 drew them), each card offered only the styles it draws:

- the energy card's line `classic`, `soft`, `glow`, `minimal` or `step` (a stepped power reads on a scale from zero,
  in the card's unit, the hours under the plot after it); its stacked charts `classic`, `soft` (lighter fills, the
  house's hairlines across) or `step` (each bucket held across it);
- the Energy usage card's columns `classic` (one column a slot, its parts flush, only its outer ends rounded, on a
  scale that hugs them on both sides of zero; a card that names `columns`, the same look, draws it) or `soft` (each
  part a step lighter);
- the history bars `classic`, `bars` (the ink, flat, rounded as the house's bars are; `highlight` lights the highest,
  the lowest or the bar in progress and quiets the rest) or `columns`; the mini row's sparkline `classic` or `minimal`;
- production `classic`, `soft` (one meter's day an hour a bar, the best hour in the ink and the rest quiet, the hours
  to come the forecast's, hollow, now marked) or `columns` (the arrays stacked in the series' colours).

The fine keys of [the cards](cards.md) change one thing of a style where it draws it, and `animate: false` draws the
chart still. A gauge's `gauge` is `ticks` (its ring as before), `dial` or `ring`, or a gauge that moves with what it
reads ([the cards](cards.md)): `pulse` or `sun` for a power, `battery` for a battery's charge, `tank` for water stored.

## A configuration each

Every card below works with nothing but its type — it reads the Energy dashboard — and takes these when you want to
say more. Its every option is in [the cards](cards.md).

```yaml
type: custom:fluvy-energy-balance-card
period: day                 # live (default) · day · week · month
show_cost: true             # over a period: cost, feed-in and net, from the Energy dashboard's prices
```

```yaml
type: custom:fluvy-grid-card
phases: [sensor.grid_l1_power, sensor.grid_l2_power, sensor.grid_l3_power]
voltages: [sensor.grid_l1_voltage, sensor.grid_l2_voltage, sensor.grid_l3_voltage]
price: sensor.electricity_price
```

```yaml
type: custom:fluvy-batteries-card
reserve: 20                 # %: the mark on the ruler, and what "empty in" counts down to
mode: select.battery_mode
batteries:
  - { power: sensor.garage_battery_power, level: sensor.garage_battery_soc, capacity: 10, name: Garage }
  - { power: sensor.basement_battery_power, level: sensor.basement_battery_soc, capacity: 10, name: Basement }
```

```yaml
type: custom:fluvy-ev-charger-card
entity: sensor.wallbox_power   # + charges the car; negative: the car powers the house
level: sensor.car_battery
target: 80                     # or an entity
ready_by: "07:00"              # or an entity
session_energy: sensor.wallbox_session_energy
status: sensor.wallbox_status
vehicle: Model 3
mode: select.wallbox_mode
```

```yaml
type: custom:fluvy-energy-card
entity: sensor.grid_meter_power   # negative while it imports
invert: true                      # "Right now" reads 1.4 kW, the curve above the line
legend:
  - { entity: sensor.grid_import_total, name: Imported, period: today }   # a lifetime meter: today's part
  - sensor.solar_energy_today
```

```yaml
type: custom:fluvy-energy-usage-card
period: month                  # day (default) · week · month · year; or collection_key: a date picker's
compare: true                  # the month before, behind this one
sources: [solar, battery, { type: grid, name: Utility }]
```

```yaml
type: custom:fluvy-energy-sankey-card
period: day
max_devices: 4                 # the rest are one "Other devices" bar
```

```yaml
type: custom:fluvy-energy-score-card
period: week
co2: sensor.grid_fossil_fuel_percentage   # the low-carbon ring; default: the first CO₂ Signal sensor
```

```yaml
type: custom:fluvy-meters-card
meters:
  - { entity: sensor.water_meter, rate: sensor.water_flow, typical: 150 }
  - { entity: sensor.gas_meter }
rows: [binary_sensor.kitchen_leak, valve.main_water]
```

```yaml
type: custom:fluvy-energy-devices-card
total: sensor.house_energy_today        # what no device accounts for
rows:
  - { entity: sensor.kitchen_energy_today, name: Kitchen }
  - { entity: sensor.oven_energy_today, name: Oven, parent: sensor.kitchen_energy_today }
```

```yaml
type: custom:fluvy-production-card
entity: sensor.solar_energy_today
arrays:
  - { entity: sensor.east_array_power, name: East }
  - { entity: sensor.west_array_power, name: West }
```

```yaml
type: custom:fluvy-gauge-card
entity: sensor.grid_power
variant: signed
max: 5000                      # in the sensor's unit; the scale runs from -max to max
```

## Units and decimals

Every figure of the family follows one rule. A set read together — a diagram's sources, a legend, a row of readouts
— is written in one unit, the one its largest figure asks for: 3,200 W beside 250 W reads "3.2 kW" and "0.25 kW",
never "3.2 kW" beside "250 W". Its decimals are three significant places at most (0.25 · 3.2 · 11.2 · 142), a
scaled figure keeping its one decimal so a live readout does not change width; a figure read alone, in the sensor's
own unit, takes the precision set for the sensor in Home Assistant.

Where you want something else, every card takes `unit` and `decimals`: `unit` is any unit of the figures' class (W,
kW, MW for power; Wh, kWh, MWh for energy; L, m³, gal, ft³ for a water or gas meter) and is ignored where it is not —
`unit: kW` on a card of energy totals changes nothing; `decimals` fixes the figures' decimals (0 to 3), so "2,308 W"
reads beside "450 W" with `unit: W` and `decimals: 0`. A legend item, a readout, a device row or a meter may ask for
its own, which wins over the card's. The editor offers both on one row, the units of the sensor's own class; a
sensor whose unit converts to nothing shows no unit to choose. The energy card's power scale follows its `unit`,
so its ticks and its legend agree.

```yaml
type: custom:fluvy-energy-flow-card
unit: W                      # every power figure in watts, whatever its size
decimals: 0
readouts:
  - { entity: sensor.grid_import_today, name: Imported, unit: Wh, decimals: 1 }
```

## Honest by design

A figure that cannot be read is "—", never a 0; a source that stops reporting is drawn as a dashed hairline and the
head says since when; readings older than ten minutes make the whole diagram rest and say how old they are; the house
is never guessed from a sum that is missing a part.

## Performance

The pulses are Web Animations of `transform` and `opacity` only, sampled once per lane: the compositor runs them
without the main thread. At most eight travel on a card, and all of them pause when the card is off screen or the tab
is hidden. The energy cards arrive as their own file, fetched as Fluvy starts: a dashboard without energy on it never
waits for them.
