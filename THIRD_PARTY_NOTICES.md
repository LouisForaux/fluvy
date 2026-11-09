# Third-party notices

Fluvy is licensed under the GNU General Public License v3.0 (see `LICENSE`). It is built with, and its release
ships, work by others under the licences below, all of them compatible with the GPL. Nothing else reaches a Home Assistant instance: the
release is the integration folder — Fluvy's own Python and JavaScript, Lit, and the Inter font.

## Shipped in the release

### Lit 3.3.3 — BSD-3-Clause

`lit`, `lit-html` 3.3.3, `lit-element` 4.2.2 and `@lit/reactive-element` 2.1.2 are bundled into `fluvy.js`
(pinned to the version Home Assistant's frontend uses). https://lit.dev

```
BSD 3-Clause License

Copyright (c) 2017 Google LLC. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### Inter — SIL Open Font License 1.1

The variable font by The Inter Project Authors (https://github.com/rsms/inter), shipped as a Latin + Latin
Extended subset (`inter-variable.woff2`, `inter-italic-variable.woff2`) beside its licence, `OFL-Inter.txt`. No
Reserved Font Name is declared, so the subset keeps the family name. The font may be used and redistributed under
the OFL, but not sold on its own.

```
Copyright 2020 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### Simple Icons 16.37.0 — CC0 1.0 Universal

The marks of the streaming platforms the TV remote card draws (`chunks/app-logos-*.js`, fetched only by a remote card
that shows an app) are taken from Simple Icons, release 16.37.0 (https://simpleicons.org, https://github.com/simple-icons/simple-icons),
each one's path copied as it is and scaled to sit with Fluvy's glyphs: netflix, movistar (for Movistar Plus+), appletv,
rakuten (for Rakuten TV), youtube, youtubemusic, youtubetv, youtubekids, hbomax, max, paramountplus, dazn, crunchyroll,
tubi, twitch, plex, jellyfin, emby, kodi, spotify, applemusic, applepodcasts, deezer, tidal, steam, playstation, mubi,
vimeo, dailymotion, soundcloud, audible, pocketcasts, viaplay, googletv, googleplay, channel4, itvx, zdf, starz,
showtime, now, nebula, fubo, tiktok, roku, bilibili; the brand colours beside them are the release's data. Simple Icons
is released under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/): the set's authors waive
their copyright, and no attribution is required; this notice is given for the record.

The logos themselves are the trademarks of their owners, shown only to identify each service on the person's own
television; Fluvy is not affiliated with or endorsed by any of them. Disney+, Prime Video, Peacock, Filmin,
SkyShowtime, Pluto TV, Amazon Music, ATRESplayer, RTVE Play and Mitele have no mark in an open set: Fluvy draws its own
two-letter monogram for them, no likeness of theirs.

### Material Design Icons 7.4.47 — Pictogrammers Free License (Apache License 2.0)

Three marks of the same chunk come from Material Design Icons 7.4.47 by the Pictogrammers (https://pictogrammers.com/library/mdi/,
`@mdi/js`): `mdiHulu` (Hulu), `mdiMicrosoftXbox` (Xbox) and `mdiNintendoSwitch` (Nintendo Switch), each one's path
copied as it is and scaled to the glyphs. The Pictogrammers Free License redistributes its icons under the Apache
License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0): the paths are used under that licence, as is,
without changes of substance.

```
Pictogrammers Free License
--------------------------

This icon collection is released as free, open source, and GPL friendly by
the Pictogrammers icon group. You may use it for commercial projects, open
source projects, or anything really.

Icons: Apache 2.0 (https://www.apache.org/licenses/LICENSE-2.0)
Some of the icons are redistributed under the Apache 2.0 license. All other
icons are either redistributed under their respective licenses or are
distributed under the Apache 2.0 license.
```

## Used at build time only (not in the release)

- **Home Assistant frontend** — Apache License 2.0, © the Home Assistant contributors. The type declarations of
  `hass` and the cards' contract are transcribed into `packages/core/src/ha/`, and the list of the frontend's CSS
  variable names (`packages/theme/src/__tests__/ha-vars.json`) is generated from its sources so the theme's tests can
  check that every name it writes exists. https://github.com/home-assistant/frontend
- **Material Design Icons** (`@mdi/js` 7.4.47) — Apache License 2.0, © Pictogrammers. Only 32-bit keys derived
  from the icon paths are kept (`packages/core/src/icons/mdi.ts`), so the shell can tell which Material icon Home
  Assistant is drawing and swap it for Fluvy's own glyph; no icon artwork is redistributed.
  https://github.com/Templarian/MaterialDesign-JS
- **culori** 4.0.2 — MIT, © Dan Burzo. The OKLCH maths behind the palettes; only the derived hex values reach the
  theme and the bundle. https://github.com/Evercoder/culori
- Development tooling (Vite, Rollup, terser, TypeScript, Vitest, happy-dom, tsx, ESLint, Prettier, Playwright,
  resvg, ruff) under MIT, Apache-2.0 and MPL-2.0 licences, listed with their licence texts in `node_modules` after
  `pnpm install`.

"Home Assistant" is a trademark of the Open Home Foundation; Fluvy is an independent project that works with Home
Assistant and is not affiliated with or endorsed by it.
