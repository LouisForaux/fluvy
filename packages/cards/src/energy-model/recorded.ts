import type { EntityView, HomeAssistant } from '@fluvy/core';

/**
 * What the recorder keeps of a sensor that is no longer in the house (renamed, removed, its integration gone): its
 * statistics and what they are, a meter's sum or a measurement's mean, in a unit. A card that draws a sensor's past
 * reads a missing sensor so, as Home Assistant's own statistics card does, and keeps its anatomy: the bars or the day
 * it had, in the unit it had (the owner's rule, 1.9: an unavailable card keeps its configured size).
 */
export interface Recorded {
  readonly statistic_id: string;
  readonly has_sum?: boolean;
  /** Before 2025.4; `mean_type` (0 none, 1 arithmetic, 2 circular) since. */
  readonly has_mean?: boolean;
  readonly mean_type?: number;
  readonly display_unit_of_measurement?: string | null;
  readonly statistics_unit_of_measurement?: string | null;
  /** An imported statistic's name; none for a sensor's. */
  readonly name?: string | null;
}

/** A statistic an integration imports (`linky:consumption`): it has no entity behind it, whose id has a dot. */
export const isImported = (id: string): boolean => id.includes(':');

/** Asked once per connection and statistic, kept for five minutes (the cards of a view ask the same). */
const cache = new WeakMap<object, Map<string, { at: number; promise: Promise<Recorded | null> }>>();
const TTL = 5 * 60_000;

/** The recorder's metadata of one statistic; null where it keeps none, or it cannot be read. */
export function fetchRecorded(hass: HomeAssistant, id: string): Promise<Recorded | null> {
  const key = (hass.connection as object | undefined) ?? hass;
  const asked = cache.get(key) ?? new Map();
  cache.set(key, asked);
  const hit = asked.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass
    .callWS<Recorded[]>({ type: 'recorder/get_statistics_metadata', statistic_ids: [id] })
    .then((list) => list?.find((meta) => meta.statistic_id === id) ?? null)
    .catch(() => null);
  asked.set(id, { at: Date.now(), promise });
  return promise;
}

/**
 * A missing sensor as the recorder describes it: its unit, and the state class its statistics were kept by (a sum
 * counts, a mean measures). Any other sensor, or one the recorder knows nothing of, is handed back as it is.
 */
export function recordedView(view: EntityView, meta: Recorded | null | undefined): EntityView {
  if (view.status !== 'missing' || !meta) return view;
  const unit = meta.display_unit_of_measurement ?? meta.statistics_unit_of_measurement ?? '';
  const stateClass = meta.has_sum
    ? 'total'
    : meta.has_mean || meta.mean_type
      ? 'measurement'
      : undefined;
  return {
    ...view,
    name: meta.name || view.name,
    unit,
    attr: <T>(key: string) =>
      (key === 'state_class'
        ? stateClass
        : key === 'unit_of_measurement'
          ? unit
          : view.attr(key)) as T | undefined,
  };
}

/**
 * A card's sensors as they are read: one missing from the house as the recorder describes it, asked once per sensor
 * (the card drawn again on the answer). A card asks the recorder for a sensor's past once it is `ready`.
 */
export class RecordedSensors {
  /** By sensor: undefined while asked, null when the recorder keeps nothing of it. */
  private readonly meta = new Map<string, Recorded | null | undefined>();

  constructor(
    private readonly host: { readonly hass?: HomeAssistant | undefined; requestUpdate(): void },
  ) {}

  /** The sensor dressed as the recorder describes it, once it has answered; asked here the first time it is missing. */
  view(view: EntityView): EntityView {
    const hass = this.host.hass;
    if (hass && view.status === 'missing' && view.id && !this.meta.has(view.id)) {
      this.meta.set(view.id, undefined);
      void fetchRecorded(hass, view.id).then((meta) => {
        this.meta.set(view.id, meta);
        this.host.requestUpdate();
      });
    }
    return recordedView(view, this.meta.get(view.id));
  }

  /** Whether this is an imported statistic the recorder has not said it lacks: with no entity behind it, it is not missing. */
  imported(view: EntityView): boolean {
    return isImported(view.id) && this.meta.get(view.id) !== null;
  }

  /** Whether the sensor's past can be asked: it has an id and, missing, the recorder has said what it keeps of it. */
  ready(view: EntityView): boolean {
    return Boolean(view.id) && (view.status !== 'missing' || this.meta.get(view.id) !== undefined);
  }
}
