// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawBar, drawFill, drawLiquid, type StyleDrawing } from '../controls/slider-styles.js';
import { FluvyRuler } from '../controls/ruler.js';

if (!customElements.get('fluvy-ruler')) customElements.define('fluvy-ruler', FluvyRuler);

/**
 * The slider styles (1.18, #144): the bar, the liquid and a tile's fill, drawn by the ruler in its own band when asked
 * (`look`), with the ruler's gestures but the fine scale; a tile's fill forwards a still press as the tile's tap or
 * hold. The drawings are read from what they write; the ruler from what it renders and says.
 */
const drawing = (more: Partial<StyleDrawing> = {}): StyleDrawing => ({
  len: 320,
  band: 44,
  vertical: false,
  fraction: 0.65,
  tint: '',
  dot: '',
  inactive: false,
  disabled: false,
  dragging: false,
  ...more,
});

const drawn = (template: unknown): HTMLElement => {
  const host = document.createElement('div');
  render(template, host);
  return host;
};

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, { bubbles: true, button: 0, pointerType: 'mouse', ...init });

async function ruler(look: string, more: Partial<FluvyRuler> = {}): Promise<FluvyRuler> {
  const el = document.createElement('fluvy-ruler') as FluvyRuler;
  el.look = look as FluvyRuler['look'];
  el.value = 65;
  el.length = 320;
  Object.assign(el, more);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('the bar', () => {
  it('fills to the level in the tone’s ink, its handle 8 inside the fill’s end', () => {
    const host = drawn(drawBar(drawing()));
    const fill = host.querySelector<HTMLElement>('.sb-bar__fill')!;
    const handle = host.querySelector<HTMLElement>('.sb-bar__handle')!;
    expect(fill.style.width).toBe('208px');
    // 4 × 20 on a 44 band, its right end 8 inside the 208
    expect(handle.style.left).toBe('196px');
    expect(handle.style.width).toBe('4px');
    expect(handle.style.height).toBe('20px');
    expect(handle.style.top).toBe('12px');
  });

  it('keeps its handle 8 from the ends, and is 18 long on a tile’s 40', () => {
    expect(
      drawn(drawBar(drawing({ fraction: 0 }))).querySelector<HTMLElement>('.sb-bar__handle')!.style
        .left,
    ).toBe('8px');
    expect(
      drawn(drawBar(drawing({ fraction: 1 }))).querySelector<HTMLElement>('.sb-bar__handle')!.style
        .left,
    ).toBe('308px');
    const tile = drawn(drawBar(drawing({ band: 40, len: 140 }))).querySelector<HTMLElement>(
      '.sb-bar__handle',
    )!;
    expect(tile.style.height).toBe('20px');
    expect(tile.style.top).toBe('10px');
  });

  it('is the gradient itself when tinted, the handle alone at the level; asleep, the track alone', () => {
    const tinted = drawn(drawBar(drawing({ tint: 'warm-cool' })));
    expect(tinted.querySelector('.sb-bar--warm-cool')).not.toBeNull();
    expect(tinted.querySelector('.sb-bar__fill')).toBeNull();
    expect(tinted.querySelector<HTMLElement>('.sb-bar__handle')!.style.left).toBe('206px');
    expect(drawn(drawBar(drawing({ tint: 'hue' }))).querySelector('.sb-bar--hue')).not.toBeNull();
    const asleep = drawn(drawBar(drawing({ inactive: true })));
    expect(asleep.querySelector('.sb-bar__fill')).toBeNull();
    expect(asleep.querySelector('.sb-bar__handle')).toBeNull();
    expect(
      drawn(drawBar(drawing({ disabled: true }))).querySelector('.sb-bar.is-disabled'),
    ).not.toBeNull();
  });

  it('stands vertical, lit from the foot', () => {
    const host = drawn(drawBar(drawing({ vertical: true, len: 160, fraction: 0.5 })));
    expect(host.querySelector('.sb-bar--vertical')).not.toBeNull();
    expect(host.querySelector<HTMLElement>('.sb-bar__fill')!.style.height).toBe('80px');
    const handle = host.querySelector<HTMLElement>('.sb-bar__handle')!;
    // 20 × 4, 8 under the fill's top edge (160 − 80 + 8), centred on the band
    expect(handle.style.top).toBe('88px');
    expect(handle.style.left).toBe('12px');
    expect(handle.style.width).toBe('20px');
    expect(handle.style.height).toBe('4px');
  });
});

describe('the liquid', () => {
  it('draws two waves at the level, travelling along the edge; asleep, the ground alone', () => {
    const host = drawn(drawLiquid(drawing()));
    const layers = host.querySelectorAll('g');
    expect(layers).toHaveLength(2);
    for (const layer of layers)
      expect(layer.getAttribute('style')).toContain('translate(208px,0px)');
    expect(host.querySelector('.lq-b.lq-y26')).not.toBeNull();
    expect(host.querySelector('.lq-a.lq-y20')).not.toBeNull();
    expect(drawn(drawLiquid(drawing({ inactive: true }))).querySelector('g')).toBeNull();
  });

  it('takes the colour under its edge when tinted, and the waves cross the band when vertical', () => {
    const tinted = drawn(drawLiquid(drawing({ tint: 'warm-cool', dot: 'rgb(1, 2, 3)' })));
    expect(tinted.querySelector<HTMLElement>('.sb-liq')!.getAttribute('style')).toContain(
      '--tone-ink:rgb(1, 2, 3)',
    );
    const vertical = drawn(drawLiquid(drawing({ vertical: true, len: 160, fraction: 0.25 })));
    expect(vertical.querySelector('g')!.getAttribute('style')).toContain('translate(0px,120px)');
    expect(vertical.querySelector('.lq-x26')).not.toBeNull();
  });
});

describe('the fill', () => {
  it('washes the tile to the level with a 2 px edge there; asleep, nothing', () => {
    const host = drawn(drawFill(drawing({ len: 172 })));
    expect(host.querySelector<HTMLElement>('.sb-fill')!.style.width).toBe('112px');
    expect(host.querySelector<HTMLElement>('.sb-fill__edge')!.style.translate).toBe('111px 0');
    expect(drawn(drawFill(drawing({ inactive: true }))).children).toHaveLength(0);
  });
});

describe('the ruler asked for a style', () => {
  it('draws it from its first frame, and the ruler where none is asked', async () => {
    const bar = await ruler('bar');
    expect(bar.shadowRoot!.querySelector('.sb-bar__fill')).not.toBeNull();
    expect(bar.shadowRoot!.querySelector('svg')).toBeNull();
    expect(bar.getAttribute('look')).toBe('bar');
    const plain = await ruler('ruler');
    expect(plain.shadowRoot!.querySelector('svg line')).not.toBeNull();
    expect(plain.shadowRoot!.querySelector('.sb-bar')).toBeNull();
    // the style changes under it: the ruler follows
    plain.look = 'liquid';
    await plain.updateComplete;
    expect(plain.shadowRoot!.querySelector('.sb-liq')).not.toBeNull();
    expect(plain.shadowRoot!.querySelector('svg line')).toBeNull();
  });

  it('draws its face on the band’s foot and keeps the band for the finger', async () => {
    const bar = await ruler('bar', { band: 44, face: 40, length: 140 });
    expect(bar.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!.style.height).toBe('44px');
    expect(bar.shadowRoot!.querySelector<HTMLElement>('.sb-bar')!.style.height).toBe('40px');
    // centred on the 40 it draws, not on the band
    expect(bar.shadowRoot!.querySelector<HTMLElement>('.sb-bar__handle')!.style.top).toBe('10px');
    const liquid = await ruler('liquid', { band: 44, face: 40, length: 140 });
    expect(liquid.shadowRoot!.querySelector<HTMLElement>('.sb-liq')!.style.height).toBe('40px');
    expect(liquid.shadowRoot!.querySelector('svg')!.getAttribute('height')).toBe('40');
    // no face: the band's own thickness
    const full = await ruler('bar');
    expect(full.shadowRoot!.querySelector<HTMLElement>('.sb-bar')!.style.height).toBe('44px');
  });

  it('is a control of a control’s height everywhere but on a tile’s fill, whose band is the tile', async () => {
    const band = (el: FluvyRuler) => el.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    expect(band(await ruler('bar')).hasAttribute('data-control')).toBe(true);
    const fill = band(await ruler('fill', { band: 168 }));
    expect(fill.hasAttribute('data-control')).toBe(false);
    expect(fill.hasAttribute('data-target')).toBe(true);
  });

  it('keeps the fine scale to the ruler: a still press on a bar raises none', async () => {
    vi.useFakeTimers();
    const bar = await ruler('bar');
    const windows: Event[] = [];
    bar.addEventListener('fluvy-window', (e) => windows.push(e));
    const band = bar.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    band.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 20 }));
    vi.advanceTimersByTime(600);
    expect(windows).toHaveLength(0);
    band.dispatchEvent(pointer('pointerup', { clientX: 100, clientY: 20 }));
  });

  it('says a tile’s tap and hold from its fill, never a jump to the value', async () => {
    vi.useFakeTimers();
    const fill = await ruler('fill', { band: 168 });
    const said: string[] = [];
    for (const event of ['fluvy-tap', 'fluvy-hold', 'fluvy-change'])
      fill.addEventListener(event, () => said.push(event));
    const band = fill.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    expect(fill.shadowRoot!.querySelector('.fv-bubble')).toBeNull();
    // a still press and its release: the tap
    band.dispatchEvent(pointer('pointerdown', { clientX: 40, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap']);
    // a still press of 500 ms: the hold, and no tap on its release
    band.dispatchEvent(pointer('pointerdown', { clientX: 40, clientY: 80 }));
    vi.advanceTimersByTime(520);
    band.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap', 'fluvy-hold']);
    // a press that travels: the slide, committed on release
    band.dispatchEvent(pointer('pointerdown', { clientX: 40, clientY: 80 }));
    band.dispatchEvent(pointer('pointermove', { clientX: 72, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 72, clientY: 80 }));
    expect(said).toEqual(['fluvy-tap', 'fluvy-hold', 'fluvy-change']);
  });

  it('takes every press on a fill that cannot slide, so the tile keeps its tap', async () => {
    const fill = await ruler('fill', { band: 168, disabled: true });
    const said: string[] = [];
    fill.addEventListener('fluvy-tap', () => said.push('tap'));
    fill.addEventListener('fluvy-change', () => said.push('change'));
    const band = fill.shadowRoot!.querySelector<HTMLElement>('.fv-ruler')!;
    band.dispatchEvent(pointer('pointerdown', { clientX: 40, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 40, clientY: 80 }));
    band.dispatchEvent(pointer('pointerdown', { clientX: 40, clientY: 80 }));
    band.dispatchEvent(pointer('pointermove', { clientX: 90, clientY: 80 }));
    band.dispatchEvent(pointer('pointerup', { clientX: 90, clientY: 80 }));
    expect(said).toEqual(['tap']);
  });
});
