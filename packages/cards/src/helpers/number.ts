import {
  formatNumber,
  localize,
  numberAttr,
  sliderStill,
  strings,
  type EntityView,
} from '@fluvy/core';
import { ico, stepper, type RulerChangeDetail } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { iconOf } from '../shared/domain.js';
import {
  contextOf,
  field,
  fieldContext,
  isUnusable,
  nameOf,
  type HelperHost,
  type HelperRowConfig,
} from './context.js';

const s = strings('helpers');

/** Past this many stops a scale stops being a slider (Home Assistant's own rule for `mode: auto`). */
const MAX_STOPS = 256;

interface NumberModel {
  readonly counter: boolean;
  /** Null = unbounded (a counter without a minimum or a maximum). */
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number;
  readonly digits: number;
  /** The value to draw: under the finger, else expected, else reported. Null when there is none. */
  readonly value: number | null;
  readonly unusable: boolean;
  /** Value and stepper only: a counter, `mode: box`, or a range a ruler cannot resolve. */
  readonly boxed: boolean;
}

const decimals = (step: number): number => {
  if (Number.isInteger(step)) return 0;
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : Math.min(3, text.length - dot - 1);
};

function model(host: HelperHost, view: EntityView): NumberModel {
  const counter = view.domain === 'counter';
  const min = numberAttr(view, counter ? 'minimum' : 'min') ?? (counter ? null : 0);
  const max = numberAttr(view, counter ? 'maximum' : 'max') ?? (counter ? null : 100);
  const step = Math.abs(numberAttr(view, 'step') ?? 1) || 1;
  const unusable = isUnusable(view);
  const expected = Number(host.state(view));
  const value = unusable
    ? null
    : (host.preview(view.id) ?? (Number.isFinite(expected) ? expected : view.number));
  const span = min !== null && max !== null ? max - min : 0;
  const mode = view.attr<string>('mode');
  return {
    counter,
    min,
    max,
    step,
    value,
    unusable,
    digits: decimals(step),
    boxed: counter || mode === 'box' || span <= 0 || (mode !== 'slider' && span / step > MAX_STOPS),
  };
}

/** Whether this helper is drawn as value + stepper only (what the sheet's compact card holds). */
export const isBoxedNumber = (host: HelperHost, view: EntityView): boolean =>
  model(host, view).boxed;

const text = (host: HelperHost, m: NumberModel, value: number | null = m.value): string =>
  value === null ? '—' : formatNumber(host.hass, value, { digits: m.digits, minDigits: m.digits });

/** One step from the value on screen, on the helper's own grid and inside its range. */
function nudge(host: HelperHost, view: EntityView, m: NumberModel, direction: 1 | -1): void {
  const from = m.value ?? m.min ?? 0;
  const origin = m.min ?? 0;
  const stepped = Math.round((from + direction * m.step - origin) / m.step) * m.step + origin;
  const next = Number(
    Math.min(m.max ?? Infinity, Math.max(m.min ?? -Infinity, stepped)).toFixed(m.digits),
  );
  if (next === m.value) return; // already at the end of the range
  host.expect(view.id, String(next)); // a held stepper keeps counting from here, not from the last report
  if (m.counter) host.call('counter', direction > 0 ? 'increment' : 'decrement', {}, view.id);
  else host.call(view.domain, 'set_value', { value: next }, view.id);
}

function valueAndStepper(
  host: HelperHost,
  view: EntityView,
  m: NumberModel,
  name: string,
  valueClass: string,
): TemplateResult {
  const key = `n-${view.id}`;
  return html`<div class="in-field__control">
    <span class=${valueClass}
      ><span data-baseline=${key}>${text(host, m)}</span
      >${view.unit && m.value !== null ? html`<span class="fv-unit" data-baseline=${key}>${view.unit}</span>` : nothing}</span
    >
    ${stepper((direction) => nudge(host, view, m, direction), {
      disabled: m.unusable,
      decrease: `${name} · ${localize(host.hass, 'common.decrease')}`,
      increase: `${name} · ${localize(host.hass, 'common.increase')}`,
    })}
  </div>`;
}

/** `input_number` / `number` / `counter` inside the card: title and context, the value with its stepper, the ruler under them. */
export function numberBlocks(
  host: HelperHost,
  view: EntityView,
  row: HelperRowConfig,
): TemplateResult[] {
  const m = model(host, view);
  const name = nameOf(host, view, row);
  const blocks = [
    field(
      name,
      fieldContext(host, view, row),
      valueAndStepper(host, view, m, name, 'in-field__value'),
      m.unusable,
    ),
  ];
  // the ruler keeps its place while the helper cannot be read, at rest
  if (m.boxed || m.min === null || m.max === null) return blocks;
  const { min, max } = m;
  blocks.push(
    html`<fluvy-ruler
      class=${m.unusable ? 'is-unavailable' : ''}
      .value=${m.value ?? min}
      .min=${min}
      .max=${max}
      .step=${m.step}
      .length=${host.contentWidth}
      tone="accent"
      ?inactive=${m.value === null}
      ?disabled=${m.unusable}
      .look=${host.sliderStyle}
      ?still=${sliderStill()}
      .unit=${view.unit}
      .label=${`${name} · ${s(host.hass, 'value')}`}
      .format=${(value: number) => text(host, m, value)}
      @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => host.setPreview(view.id, event.detail.value)}
      @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => {
        host.setPreview(view.id, null);
        host.expect(view.id, String(event.detail.value));
        host.call(view.domain, 'set_value', { value: event.detail.value }, view.id);
      }}
    ></fluvy-ruler>`,
  );
  return blocks;
}

/** The sheet's compact card: one counter (or one boxed number) as a 76 row with no head above it. */
export function compactNumber(
  host: HelperHost,
  view: EntityView,
  row: HelperRowConfig,
): TemplateResult {
  const m = model(host, view);
  const name = nameOf(host, view, row);
  const sub = contextOf(host, view, row);
  return html`<article
    class="fv-card in-compact ${m.unusable ? 'is-unavailable is-off' : ''}"
    data-card
  >
    ${ico(iconOf(view, row.icon), m.unusable ? 'off' : 'accent', { onTap: () => host.moreInfo(view.id), label: name })}
    <div class="fv-row__text">
      <span class="fv-row__title">${name}</span
      >${sub ? html`<span class="fv-row__sub">${sub}</span>` : nothing}
    </div>
    ${valueAndStepper(host, view, m, name, 'in-compact__value')}
  </article>`;
}
