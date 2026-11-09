import type { HomeAssistant, LovelaceCard } from '@fluvy/core';
import { baseStyles } from '@fluvy/ui';
import { css, html, LitElement, nothing, type PropertyValues } from 'lit';

/*
 * The screensaver: a modal dialog in the browser's top layer (over every dialog of Home Assistant's), the wall's
 * background — or black — with the clock and the weather in a 480 column, or nothing. The touch that wakes the
 * wall ends here: it reaches no card. Escape does not close it (the wall has no keyboard); a touch does.
 */
export class FluvyWallScreensaver extends LitElement {
  static override properties = {
    clock: { type: Boolean },
    dim: { type: Boolean },
    weather: { attribute: false },
    hass: { attribute: false },
  };

  static override styles = [
    ...baseStyles,
    css`
      dialog {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        color: var(--fluvy-text);
        opacity: 0;
        transition: opacity 320ms ease;
        cursor: none;
      }
      dialog::backdrop {
        background: transparent;
      }
      /* a look at it from the settings panel: a desktop keeps its pointer */
      :host([preview]) dialog {
        cursor: default;
      }
      dialog.is-on {
        opacity: 1;
      }
      /* dimmed: black, the clock in white at 60 % whatever the mode (a dark ink would vanish) */
      dialog.is-dim {
        background: #000;
        color: rgb(255 255 255 / 0.6);
      }
      .column {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: min(480px, 100vw - 32px);
        min-height: 100%;
        margin: 0 auto;
        padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
        --fluvy-card: transparent;
        --fluvy-border: transparent;
      }
      dialog.is-dim .column {
        --fluvy-text: currentColor;
        --fluvy-text-secondary: currentColor;
      }
    `,
  ];

  declare clock: boolean;
  declare dim: boolean;
  declare weather: string | undefined;
  declare hass: HomeAssistant | undefined;
  /** The touch that wakes the wall. */
  onWake: () => void = () => undefined;

  private card: LovelaceCard | undefined;
  private shown = false;

  constructor() {
    super();
    this.clock = true;
    this.dim = false;
  }

  private get dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector('dialog');
  }

  protected override firstUpdated(): void {
    const dialog = this.dialog;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // the next frame: the fade runs from transparent
    requestAnimationFrame(() => {
      this.shown = true;
      this.requestUpdate();
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('hass') && this.card && this.hass) this.card.hass = this.hass;
  }

  /** The clock card, made once for its config; it ticks by itself. */
  private clockCard(): LovelaceCard | typeof nothing {
    if (!this.clock) return nothing;
    if (!this.card) {
      const card = document.createElement('fluvy-clock-card') as LovelaceCard;
      // its surface is the screensaver's (none, `.column`): never the house's see-through cards' (1.15)
      card.setConfig({
        type: 'custom:fluvy-clock-card',
        face: 'digital',
        variant: 'hero',
        show_date: true,
        card_opacity: 100,
        ...(this.weather ? { weather: this.weather, show_forecast: false } : {}),
      } as never);
      card.setAttribute('still', '');
      if (this.hass) card.hass = this.hass;
      this.card = card;
    }
    return this.card;
  }

  private readonly wake = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.onWake();
  };

  /** Fades out, then leaves the tree; resolves when gone. */
  close(): Promise<void> {
    const dialog = this.dialog;
    this.shown = false;
    this.requestUpdate();
    return new Promise((resolve) => {
      setTimeout(() => {
        if (dialog?.open) dialog.close();
        this.remove();
        resolve();
      }, 200);
    });
  }

  protected override render() {
    return html`<dialog
      class="${this.shown ? 'is-on' : ''} ${this.dim ? 'is-dim' : 'fv-bg--wall'}"
      aria-label="Screensaver"
      data-idle
      @pointerdown=${this.wake}
      @keydown=${this.wake}
      @click=${this.wake}
      @cancel=${(event: Event) => event.preventDefault()}
    >
      <div class="column">${this.clockCard()}</div>
    </dialog>`;
  }
}
