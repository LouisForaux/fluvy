#!/usr/bin/env node
/**
 * Interaction tests for the TV remote card (#143) on the playground's `remote` sheet: the heights are the ones the
 * family declares at a 360 column (572 full, 144 compact, 276 pad, 76 row), out of reach the same; a D-pad key goes to
 * the remote as its integration takes it (`remote.send_command` DPAD_CENTER on an Android TV, `webostv.button` ENTER
 * on an LG), the power round to the player's own service (`media_player.turn_on` on a television that is off), the
 * mute to the receiver the volume is routed to (`media_player.volume_mute`), an app to the player's source
 * (`media_player.select_source`); a grid's OK is its middle cell; out of reach nothing answers; the apps' logos land
 * from their chunk. Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5193/ node interactions-remote.mjs
 */
import { calls, frame, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const page = await suite.sheet('remote');

/** The card of a frame (its `n`th). */
const card = (title, n = 0) => frame(page, title).locator('fluvy-remote-card').nth(n);
const height = (of) => of.evaluate((el) => Math.round(el.getBoundingClientRect().height));
/** A key by its name (its aria-label). */
const key = (of, label) => of.locator(`[aria-label="${label}"]`).first();
const services = async () =>
  (await calls(page)).map(
    (c) => `${c.s}${c.d?.command ? `:${c.d.command}` : ''}${c.d?.button ? `:${c.d.button}` : ''}`,
  );

/* ---------- the heights: the family's, by the config alone ---------- */
{
  const drawn = [
    await height(card('Full')),
    await height(card('Compact')),
    await height(card('Pad')),
    await height(card('Row')),
    await height(card('Out of reach')),
  ];
  // the living room's six apps keep their names five a row (two rows: 648 where one row would be 572)
  check(
    'full 648 with six apps in two rows, compact 144, pad 276, row 76; out of reach the full 648',
    drawn.join(' ') === '648 144 276 76 648',
    drawn.join(' '),
  );
}

/* ---------- off with power alone: read before any key wakes the shared television ---------- */
{
  const faded = await key(card('Off · power alone'), 'Home').isDisabled();
  const alive = await key(card('Off'), 'Home').isDisabled();
  check('off_keys: power fades the keys; live keeps them', faded && !alive, `${faded} ${alive}`);
}

/* ---------- the keys go where the device takes them ---------- */
{
  await reset(page);
  await key(card('Full'), 'OK').click();
  await key(card('Full'), 'Home').click();
  await settle(page, 300);
  let c = await services();
  check(
    'OK and Home on an Android TV: remote.send_command DPAD_CENTER, HOME',
    c.join() === 'remote.send_command:DPAD_CENTER,remote.send_command:HOME',
    c.join(),
  );
  await reset(page);
  await key(card('LG webOS'), 'OK').click();
  await settle(page, 300);
  c = await services();
  check(
    'OK on an LG: webostv.button ENTER on the player',
    c.join() === 'webostv.button:ENTER',
    c.join(),
  );
  await reset(page);
  await key(card('Off'), 'Turn on').click();
  await settle(page, 300);
  c = await services();
  check(
    'the power round on a television that is off: media_player.turn_on',
    c.join() === 'media_player.turn_on',
    c.join(),
  );
  await reset(page);
  await key(card('Full'), 'Mute').click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'the mute goes to the receiver the volume is routed to',
    c.length === 1 &&
      c[0].s === 'media_player.volume_mute' &&
      c[0].t?.entity_id === 'media_player.rm_receiver',
    JSON.stringify(c),
  );
  await reset(page);
  await card('Full').locator('.rm-app__circle').nth(1).click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'an app of the row opens its source on the player',
    c.length === 1 && c[0].s === 'media_player.select_source' && typeof c[0].d.source === 'string',
    JSON.stringify(c),
  );
  await reset(page);
  await card('Full · grid').locator('.rm-okcell').click();
  await settle(page, 300);
  c = await services();
  check('the grid’s middle cell is OK', c.join() === 'remote.send_command:DPAD_CENTER', c.join());
}

/* ---------- out of reach ---------- */
{
  await reset(page);
  const gone = card('Out of reach');
  await gone.locator('.rm-ok').click({ force: true });
  await gone.locator('.rm-arrow').first().click({ force: true });
  await settle(page, 300);
  const c = await calls(page);
  check('out of reach nothing answers', c.length === 0, JSON.stringify(c));
  check(
    'out of reach the keys wear the dashed skin',
    (await gone.locator('.is-off .rm-ok').count()) === 1,
  );
}

/* ---------- the apps' logos land from their chunk ---------- */
{
  await settle(page, 800);
  // the list's seven: four marks of the sets (Netflix, HBO Max, Movistar, Plex), two monograms (Disney+, Prime
  // Video) and one icon of the person's own
  const own = card('Apps · own list');
  const marks = await own.locator('.rm-app__circle svg path[transform]').count();
  const monograms = await own.locator('.rm-app__circle svg text').allTextContents();
  check(
    'the apps draw their logos once the chunk has landed, the monograms as Fluvy’s own tiles',
    marks === 4 && monograms.join() === 'D+,PV',
    `${marks} marks, ${monograms.join()}`,
  );
  // six apps in cells of 50: the full names do not all hold ("Prime Video"), the short ones do
  const names = await card('Full').locator('.rm-app__name').allTextContents();
  check(
    'the apps say their platforms’ names, the short ones where the full would not hold',
    names.includes('Netflix') && names.includes('Disney+') && names.includes('Prime'),
    names.join(', '),
  );
}

await suite.finish();
