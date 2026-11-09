import { describe, expect, it } from 'vitest';
import { MONOGRAMS, normalise, platform, PLATFORMS, platformOf } from './platforms.js';

describe('the platforms the remote knows by name (#143)', () => {
  it('matches a player’s source whatever its case and spacing', () => {
    expect(platformOf('Netflix')?.id).toBe('netflix');
    expect(platformOf('NETFLIX')?.id).toBe('netflix');
    expect(platformOf('net flix')?.id).toBe('netflix');
    expect(platformOf('Disney+')?.id).toBe('disneyplus');
    expect(platformOf('disney plus')?.id).toBe('disneyplus');
    expect(platformOf('Prime Video')?.id).toBe('primevideo');
    expect(platformOf('Amazon Prime Video')?.id).toBe('primevideo');
    expect(platformOf('YouTube Music')?.id).toBe('youtubemusic');
    expect(platformOf('Movistar Plus+')?.id).toBe('movistarplus');
    expect(platformOf('Rakuten TV')?.id).toBe('rakutentv');
  });

  it('matches an Android package and a platform’s id', () => {
    expect(platformOf('com.netflix.ninja')?.id).toBe('netflix');
    expect(platformOf('com.google.android.youtube.tv')?.id).toBe('youtube');
    expect(platformOf('hbomax')?.title).toBe('HBO Max');
    expect(platform('spotify')?.hex).toBe('#1ED760');
  });

  it('names no platform answers to are nobody’s: a tuner, an input, nothing', () => {
    expect(platformOf('TV')).toBeUndefined();
    expect(platformOf('HDMI 1')).toBeUndefined();
    expect(platformOf('')).toBeUndefined();
    expect(platformOf(undefined)).toBeUndefined();
  });

  it('every platform answers to its own id and title, each id once; the monograms are platforms without a mark’s colour', () => {
    const ids = PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLATFORMS) {
      expect(platformOf(p.id)?.id, p.id).toBe(p.id);
      expect(platformOf(p.title)?.id, p.title).toBe(p.id);
      expect(p.id).toBe(normalise(p.id));
    }
    for (const id of Object.keys(MONOGRAMS)) {
      expect(platform(id), id).toBeDefined();
      expect(platform(id)?.hex, id).toBe('');
    }
  });
});
