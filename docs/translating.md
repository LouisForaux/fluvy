# Translating Fluvy

Fluvy speaks the languages below in every card, page, dialog and editor form. Home Assistant's own words — entity
states, attribute values, its dialogs — come from Home Assistant's translations; Fluvy's words come from one
catalogue per language, and a person may choose theirs in the panel's *Preferences* whatever Home Assistant speaks.
What an entity lists to choose from (a thermostat's fan speeds and presets, a fan's presets, a vacuum's suction) is
said in Home Assistant's words for it, its integration's own included, then in Fluvy's for low, mid and high, then as
the integration sends it; where a person chose a language of their own, Home Assistant's words are the page's
language, so the card starts from Fluvy's.

| Code | Language | Catalogue | Maintainer |
| --- | --- | --- | --- |
| `en` | English | `packages/core/src/i18n/locales/en/` — the source every other language mirrors, in parts | — |
| `es` | Spanish | `packages/core/src/i18n/locales/es.json` | — |
| `de` | German | `packages/core/src/i18n/locales/de.json` | — |
| `nl` | Dutch | `packages/core/src/i18n/locales/nl.json` | — |
| `fr` | French | `packages/core/src/i18n/locales/fr.json` | — |
| `it` | Italian | `packages/core/src/i18n/locales/it.json` | — |
| `pt-BR` | Portuguese (Brazil) | `packages/core/src/i18n/locales/pt-BR.json` | — |
| `pt-PT` | Portuguese (Portugal) | `packages/core/src/i18n/locales/pt-PT.json` — `pt`, Home Assistant's code for Portugal, reads it; the integration's file is `translations/pt.json` | — |
| `tr` | Turkish | `packages/core/src/i18n/locales/tr.json` | — |
| `ja` | Japanese | `packages/core/src/i18n/locales/ja.json` | [@vinjex](https://github.com/vinjex) |
| `hu` | Hungarian | `packages/core/src/i18n/locales/hu.json` | [@wickdj](https://github.com/wickdj) |
| `sk` | Slovak | `packages/core/src/i18n/locales/sk.json` | — |
| `pl` | Polish | `packages/core/src/i18n/locales/pl.json` | [@paproh](https://github.com/paproh) |
| `zh-Hans` | Chinese (Simplified) | `packages/core/src/i18n/locales/zh-Hans.json` — `zh`, `zh-CN` and `zh-SG` read it; Traditional Chinese (`zh-Hant`, `zh-TW`, `zh-HK`) is not it | — |

## How a language works

- **One catalogue per language**, `packages/core/src/i18n/locales/<code>.json`: a table per namespace (the shared
  words — `common`, `climate`, `editor` — and one per card or page — `cover`, `panel`, `history`), each key with its
  text. Placeholders are `{name}`; every key of English exists in every other language, with the same placeholders.
- **A count** is a key in its forms by number, CLDR's plural categories: English writes `devices_one` ("{n} device")
  beside `devices` ("{n} devices", the form of every other number), or `days_other` alone for a count it only ever
  says of two or more. A language adds the forms its own rules give a whole number, beside English's: Slovak writes
  `devices_few` for 2 to 4 ("3 zariadenia") and keeps the bare key for 5 and more ("5 zariadení"); Japanese says
  every number one way, in the bare key. A card says every count through `plural()`, which picks the form.
- **English is in parts**, `packages/core/src/i18n/locales/en/`: `core.json` ships inline and is behind every
  lookup; each lazy family's words (`panel.json`, `history.json`, `energy.json`, `media.json`, …) travel with that
  family's chunk, so a page that never opens the settings panel never carries the panel's words, and the editors'
  (`editor.json`) with the fields every editor is built of. A new key goes in
  the part that already holds its namespace; a new namespace goes in `core.json` unless only one family says it.
  Every other language is fetched whole the first time it is needed (a chunk of its own), so a dashboard pays for
  the language it speaks and no other.
- **The naming words**, `packages/core/src/i18n/words/<code>.json`: the stems the automatic dashboard reads a house
  by (what people call their lights, their garden, the solar inverter, the grid meter), and the `appliance_*` stems
  an appliance card tells a washer from a dishwasher by (plain lower-case letters: a name is read with its accents
  taken off and in ordinary width, so "Kühlschrank" is `kuhlschrank`, "Płyta" is `plyta` and "ＬＥＤ" is `led`). A
  stem in Latin letters is matched as its category asks (a light's as a whole word, a place's noise as whole words, the
  rest as a substring);
  a stem in Han or kana is always matched as a substring, since Chinese and Japanese write no spaces between words. The words
  that join a place's noise to the place (`place_joins`: an article, a preposition, the language's "and", an elision
  such as `d'`) are written as the language writes them, marks and all, since a mark makes another word (`és` is
  Hungarian's "and", "là" is no `la`); the dashboard takes one out of a place's name beside a sensor word or at the
  name's end, and keeps one between two words that stay ("Sala de estar", "Fürdő és Konyha"). Where
  lists compete for one name (a light's against the appliances' kinds, the kinds against each other, the energy
  roles), every list is run and of two words that overlap in the name the longer wins, whatever the lists' order —
  電気ケトル is a kettle, not the light 電気; ガスレンジ a hob, not the microwave レンジ; オーブントースター a toaster —
  so a stem needs no lookaround against a longer word another list carries (a stem may still carry one against a
  word no list has: `電気(?!毛布)`, a blanket is no light); words that stand apart each hold, and the first list wins
  ("wine fridge" is the wine cooler, listed before the fridge). An appliance card reads what is never an appliance
  first: a name with one of those words is none, whatever kind's word overlaps it. Inside one list the build orders
  the stems: a stem is tried after any longer stem that begins with it (温度計 before 温度, "frigorifero" before
  "frigo"), so stems that nest need no care in the list; a stem carrying regex of its own keeps its place among the
  others like it. They never ship: every language's stems are merged into
  `packages/cards/src/strategy/words.generated.ts` and `packages/cards/src/appliance/words.generated.ts`
  (`pnpm i18n build`), because a house is named in its own language, not the UI's.
- **The registry**, `packages/core/src/i18n/languages.ts`: the code (as Home Assistant reports `hass.language`), the
  language's own name, its English name, when its day's parts begin (the greeting's "morning", "afternoon",
  "evening", "night"), and, for a language that writes it short beside a day's number, `weekday: 'short'` (the
  calendar's 17日（木）); a language with a mark of its own between two parts of a line names it as `joiner`
  (Japanese 「・」: 17日（木）・イベント4件, where " · " after the bracket would read doubled). A language written in
  more than one script names its own as `script`: Simplified Chinese is `Hans`, so a tag in the other one, said or
  by its region (`zh-Hant`, `zh-TW`, `zh-HK`), never falls to it by the base language they share. A Traditional
  Chinese house reads Fluvy in English, and Home Assistant's own words in Traditional, unless a person chooses
  Simplified Chinese in the panel.
- **The integration** has a translation of its own texts (the Repairs it raises, its setup dialog) in
  `custom_components/fluvy/translations/<code>.json`, key for key with `strings.json` — under Home Assistant's code
  for the language where it is not ours (`pt.json` for Portugal's Portuguese).

## Improving a translation

Edit the language's catalogue and open a pull request. `pnpm i18n` checks every language against English (missing
keys, keys English lacks, empty texts, placeholders, a count's form its language says of a whole number, the word
stems) and prints how many keys each language has;
`pnpm i18n --release` refuses a release with anything missing. The playground shows any sheet in any language:
`http://127.0.0.1:5183/?sheet=climate&lang=de`. Keep a card's words short — a chip, a tile label and a readout have
a fixed width — and keep Home Assistant's register: the same word Home Assistant uses on the same screen, the same
form of address.

## Japanese: where it departs from Home Assistant's words, on purpose

Japanese keeps Home Assistant's register, and in a few places a different word, chosen by its maintainer because
Home Assistant's says something else to a Japanese reader. These are not slips to fix:

- **運転中** for an appliance that is running: Home Assistant's 実行中 is what software does.
- **除湿**, **送風**, **風量** and **弱・中・強** on a thermostat and a fan, the words on every air conditioner's remote
  (Home Assistant writes ドライ, ファンのみ, ファンモード and 低・中・高).
- **重大** for a critical alert: Home Assistant's 致命的 means fatal.
- **利用不可** on a label and **利用できません** in a sentence for what is unavailable: Home Assistant's 切断 says the
  thing was disconnected, which an unavailable entity may not be.

And two that look like departures and are Home Assistant's own words: **買電** and **売電** (energy bought from and
sold to the grid, as its energy settings say), and **アップデート** beside **更新** (Home Assistant writes both: the
update of a device or an add-on, and saving or refreshing a page).

## Adding a language

1. `pnpm i18n scaffold <code>` writes `<code>.json` key for key from English (every part of it), in English, and an
   empty `words/<code>.json`: translate the one, fill the other. A language with more forms of a count than English
   (Slovak's few, Czech's or Polish's) writes them beside English's: `pnpm i18n` names each one missing.
2. Add the language to `LANGUAGE_CODES` and `LANGUAGES` in `packages/core/src/i18n/languages.ts` (its names and its
   day parts), and its loader to `LOADERS` in `packages/core/src/i18n/index.ts`.
3. Fill `words/<code>.json` with the stems people use in that language, then `pnpm i18n build`.
4. Add `custom_components/fluvy/translations/<code>.json`, key for key with `strings.json`.
5. Add the language to the table above. `pnpm i18n` is the check; `pnpm check` runs it.

A right-to-left language needs a design pass first (the rulers and the layouts are written for left-to-right
reading); none ships yet.
