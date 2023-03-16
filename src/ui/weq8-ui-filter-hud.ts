import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { WEQ8Runtime } from "../runtime";
import { FilterType } from "../spec";
import {
  clamp,
  filterHasFrequency,
  filterHasGain,
  filterHasQ,
  formatFrequency,
  formatFrequencyUnit,
  toLin,
  toLog10,
} from "../functions";
import { sharedStyles } from "./styles";
import { TYPE_OPTIONS } from "./constants";

type DragState = {
  pointer: number;
  startY: number;
  startValue: number;
};

@customElement("weq8-ui-filter-hud")
export class EQUIFilterHUDElement extends LitElement {
  static styles = [
    sharedStyles,
    css`
      .root {
        position: absolute;
        display: grid;
        grid-auto-flow: column;
        width: 210px;
        grid-template-columns: 60px 60px 50px 40px;
        align-items: center;
        gap: 4px;
        background-color: black;
        border-radius: 22px;
      }
      input,
      select {
        padding: 0;
        border: 0;
      }
      input {
        border-bottom: 1px solid transparent;
        transition: border-color 0.15s ease;
      }
      input:focus,
      input:active {
        border-color: white;
      }
      .chip {
        display: inline-grid;
        grid-auto-flow: column;
        gap: 3px;
        height: 20px;
        padding-right: 6px;
        border-radius: 10px;
        background: #373737;
        transition: background-color 0.15s ease;
      }
      .chip.disabled:hover {
        background: #444444;
      }
      .filterTypeSelect {
        width: 30px;
        appearance: none;
        outline: none;
        background-color: transparent;
        color: white;
        cursor: pointer;
        text-align: center;
        font-family: var(--font-stack);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
      }
      .filterTypeSelect.bypassed {
        color: #7d7d7d;
      }
      .chip.disabled .filterTypeSelect {
        pointer-events: all;
      }
      .frequencyInput {
        width: 28px;
      }
      .gainInput {
        width: 26px;
      }
      .qInput {
        width: 30px;
      }
      .numberInput {
        appearance: none;
        outline: none;
        background-color: transparent;
        color: white;
        text-align: right;
        -moz-appearance: textfield;
        font-family: var(--font-stack);
        font-size: var(--font-size);
        font-weight: var(--font-weight);
        touch-action: none;
      }
      .numberInput:disabled,
      .disabled {
        color: #7d7d7d;
        pointer-events: none;
      }
      .bypassed {
        color: #7d7d7d;
      }
      .numberInput::-webkit-inner-spin-button,
      .numberInput::-webkit-outer-spin-button {
        -webkit-appearance: none !important;
        margin: 0 !important;
      }
    `,
  ];

  @property({ attribute: false })
  runtime?: WEQ8Runtime;

  @property()
  index?: number;

  @property()
  x?: number = 0;

  @property()
  y?: number = 0;

  @state()
  private frequencyInputFocused = false;

  @state()
  private dragStates: {
    frequency: DragState | null;
    gain: DragState | null;
    Q: DragState | null;
  } = { frequency: null, gain: null, Q: null };

  @state()
  private posOnDragStart: { x: number; y: number } | null = null;

  render() {
    if (!this.runtime || this.index === undefined) return;

    let typeOptions = TYPE_OPTIONS.filter((o) =>
      this.runtime!.supportedFilterTypes.includes(o[0] as FilterType)
    );

    let spec = this.runtime.spec[this.index];

    let x = (this.posOnDragStart?.x ?? this.x!) - 100;
    let y = (this.posOnDragStart?.y ?? this.y!) + 20;

    console.log("hi", x, y);
    return html`
      <div class="root" style="transform: translate(${x}px, ${y}px);">
        <div>
          <div
            class=${classMap({
              chip: true,
              disabled: !filterHasFrequency(spec.type),
              bypassed: spec.bypass,
            })}
          >
            <select
              class=${classMap({
                filterTypeSelect: true,
                bypassed: spec.bypass,
              })}
              @change=${(evt: { target: HTMLSelectElement }) =>
                this.setFilterType(evt.target.value as FilterType | "noop")}
            >
              ${typeOptions.map(
                ([type, label]) =>
                  html`<option value=${type} ?selected=${spec.type === type}>
                    ${label}
                  </option>`
              )}
            </select>
          </div>
        </div>
        <div>
          <input
            class=${classMap({
              frequencyInput: true,
              numberInput: true,
              bypassed: spec.bypass,
            })}
            type="number"
            step="0.1"
            lang="en_EN"
            .value=${formatFrequency(
              spec.frequency,
              this.frequencyInputFocused
            )}
            ?disabled=${!filterHasFrequency(spec.type)}
            @focus=${() => (this.frequencyInputFocused = true)}
            @blur=${() => {
              this.frequencyInputFocused = false;
              this.setFilterFrequency(clamp(spec.frequency, 10, this.nyquist));
            }}
            @input=${(evt: { target: HTMLInputElement }) =>
              this.setFilterFrequency(evt.target.valueAsNumber)}
            @pointerdown=${(evt: PointerEvent) =>
              this.startDraggingValue(evt, "frequency")}
            @pointerup=${(evt: PointerEvent) =>
              this.stopDraggingValue(evt, "frequency")}
            @pointermove=${(evt: PointerEvent) =>
              this.dragValue(evt, "frequency")}
          />
          <span
            class=${classMap({
              frequencyUnit: true,
              disabled: !filterHasFrequency(spec.type),
              bypassed: spec.bypass,
            })}
            >${formatFrequencyUnit(
              spec.frequency,
              this.frequencyInputFocused
            )}</span
          >
        </div>
        <div>
          <input
            class=${classMap({
              gainInput: true,
              numberInput: true,
              bypassed: spec.bypass,
            })}
            type="number"
            min="-15"
            max="15"
            step="0.1"
            lang="en_EN"
            .value=${spec.gain.toFixed(1)}
            ?disabled=${!filterHasGain(spec.type)}
            @input=${(evt: { target: HTMLInputElement }) =>
              this.setFilterGain(evt.target.valueAsNumber)}
            @pointerdown=${(evt: PointerEvent) =>
              this.startDraggingValue(evt, "gain")}
            @pointerup=${(evt: PointerEvent) =>
              this.stopDraggingValue(evt, "gain")}
            @pointermove=${(evt: PointerEvent) => this.dragValue(evt, "gain")}
          />
          <span
            class=${classMap({
              gainUnit: true,
              disabled: !filterHasGain(spec.type),
              bypassed: spec.bypass,
            })}
            >dB</span
          >
        </div>
        <div>
          <input
            class=${classMap({
              qInput: true,
              numberInput: true,
              bypassed: spec.bypass,
            })}
            type="number"
            min="0.1"
            max="18"
            step="0.1"
            .value=${spec.Q.toFixed(2)}
            ?disabled=${!filterHasQ(spec.type)}
            @input=${(evt: { target: HTMLInputElement }) =>
              this.setFilterQ(evt.target.valueAsNumber)}
            @pointerdown=${(evt: PointerEvent) =>
              this.startDraggingValue(evt, "Q")}
            @pointerup=${(evt: PointerEvent) =>
              this.stopDraggingValue(evt, "Q")}
            @pointermove=${(evt: PointerEvent) => this.dragValue(evt, "Q")}
          />
        </div>
      </div>
    `;
  }

  private get nyquist() {
    return (this.runtime?.audioCtx.sampleRate ?? 48000) / 2;
  }

  private setFilterType(type: FilterType | "noop") {
    if (!this.runtime || this.index === undefined) return;
    this.runtime.setFilterType(this.index, type);
  }

  private setFilterFrequency(frequency: number) {
    if (!this.runtime || this.index === undefined) return;
    if (!isNaN(frequency)) {
      this.runtime.setFilterFrequency(this.index, frequency);
    }
  }

  private setFilterGain(gain: number) {
    if (!this.runtime || this.index === undefined) return;
    if (!isNaN(gain)) {
      this.runtime.setFilterGain(this.index, gain);
    }
  }

  private setFilterQ(Q: number) {
    if (!this.runtime || this.index === undefined) return;
    if (!isNaN(Q)) {
      this.runtime.setFilterQ(this.index, Q);
    }
  }

  private startDraggingValue(
    evt: PointerEvent,
    property: "frequency" | "gain" | "Q"
  ) {
    if (!this.runtime || this.index === undefined) return;

    (evt.target as Element).setPointerCapture(evt.pointerId);
    this.dragStates = {
      ...this.dragStates,
      [property]: {
        pointer: evt.pointerId,
        startY: evt.clientY,
        startValue: this.runtime.spec[this.index][property],
      },
    };
    this.posOnDragStart = { x: this.x!, y: this.y! };
  }

  private stopDraggingValue(
    evt: PointerEvent,
    property: "frequency" | "gain" | "Q"
  ) {
    if (!this.runtime || this.index === undefined) return;

    if (this.dragStates[property]?.pointer === evt.pointerId) {
      (evt.target as Element).releasePointerCapture(evt.pointerId);
      this.dragStates = { ...this.dragStates, [property]: null };
    }
    if (
      this.dragStates.frequency === null &&
      this.dragStates.gain === null &&
      this.dragStates.Q === null
    ) {
      this.posOnDragStart = null;
    }
  }

  private dragValue(evt: PointerEvent, property: "frequency" | "gain" | "Q") {
    if (!this.runtime || this.index === undefined) return;
    let dragState = this.dragStates[property];
    if (dragState && dragState.pointer === evt.pointerId) {
      let startY = dragState.startY;
      let currentY = evt.clientY;
      let yDelta = -(currentY - startY);
      let relYDelta = clamp(yDelta / 150, -1, 1);
      if (property === "frequency") {
        let minFreq = 10;
        let maxFreq = this.runtime.audioCtx.sampleRate / 2;
        let startFreqLog = toLog10(dragState.startValue, minFreq, maxFreq);
        let newFreq = toLin(startFreqLog + relYDelta, minFreq, maxFreq);
        this.runtime.setFilterFrequency(this.index, newFreq);
      } else if (property === "gain") {
        let gainDelta = relYDelta * 15;
        this.runtime.setFilterGain(
          this.index,
          clamp(dragState.startValue + gainDelta, -15, 15)
        );
      } else if (property === "Q") {
        let minQ = 0.1;
        let maxQ = 18;
        let startQLog = toLog10(dragState.startValue, minQ, maxQ);
        let newQ = toLin(startQLog + relYDelta, minQ, maxQ);
        this.runtime.setFilterQ(this.index, newQ);
      }
      (evt.target as HTMLInputElement).blur();
    }
  }
}
