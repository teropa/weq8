import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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

const TYPE_OPTIONS: [FilterType | "noop", string][] = [
  ["noop", "-"],
  ["lowpass12", "LP12"],
  ["lowpass24", "LP24"],
  ["highpass12", "HP12"],
  ["highpass24", "HP24"],
  ["lowshelf12", "LS12"],
  ["lowshelf24", "LS24"],
  ["highshelf12", "HS12"],
  ["highshelf24", "HS24"],
  ["peaking12", "PK12"],
  ["peaking24", "PK24"],
  ["notch12", "NT12"],
  ["notch24", "NT24"],
];
@customElement("weq8-ui-filter-row")
export class EQUIFilterRowElement extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: table-row;
      }
      input,
      select {
        padding: 0;
        border: 0;
      }
      .filterNumber {
        width: 10px;
        cursor: pointer;
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
      }
      .frequencyInput {
        width: 20px;
      }
      .gainInput {
        width: 23px;
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
        touch-action: none;
      }
      .numberInput:disabled,
      .disabled {
        color: #555;
        pointer-events: none;
      }
      .bypassed {
        color: #555;
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

  @state()
  private frequencyInputFocused = false;

  @state()
  private dragStates: {
    frequency: { pointer: number; startY: number; startValue: number } | null;
    gain: { pointer: number; startY: number; startValue: number } | null;
    Q: { pointer: number; startY: number; startValue: number } | null;
  } = { frequency: null, gain: null, Q: null };

  render() {
    if (!this.runtime || this.index === undefined) return;

    let spec = this.runtime.spec[this.index];
    return html`
      <th
        class=${classMap({ filterNumber: true, bypassed: spec.bypass })}
        @click=${() => this.toggleBypass()}
      >
        ${this.index + 1}
      </th>
      <td>
        <select
          class=${classMap({ filterTypeSelect: true, bypassed: spec.bypass })}
          @change=${(evt: { target: HTMLSelectElement }) =>
            this.setFilterType(evt.target.value as FilterType | "noop")}
        >
          ${TYPE_OPTIONS.map(
            ([type, label]) =>
              html`<option value=${type} ?selected=${spec.type === type}>
                ${label}
              </option>`
          )}
        </select>
      </td>
      <td>
        <input
          class=${classMap({
            frequencyInput: true,
            numberInput: true,
            bypassed: spec.bypass,
          })}
          type="number"
          step="0.1"
          lang="en_EN"
          .value=${formatFrequency(spec.frequency, this.frequencyInputFocused)}
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
      </td>
      <td>
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
      </td>
      <td>
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
          @pointerup=${(evt: PointerEvent) => this.stopDraggingValue(evt, "Q")}
          @pointermove=${(evt: PointerEvent) => this.dragValue(evt, "Q")}
        />
      </td>
    `;
  }

  private get nyquist() {
    return (this.runtime?.audioCtx.sampleRate ?? 48000) / 2;
  }

  private toggleBypass() {
    if (!this.runtime || this.index === undefined) return;
    this.runtime.toggleBypass(
      this.index,
      !this.runtime.spec[this.index].bypass
    );
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
    evt.preventDefault();
    this.dragStates = {
      ...this.dragStates,
      [property]: {
        pointer: evt.pointerId,
        startY: evt.clientY,
        startValue: this.runtime.spec[this.index][property],
      },
    };
  }

  private stopDraggingValue(
    evt: PointerEvent,
    property: "frequency" | "gain" | "Q"
  ) {
    if (!this.runtime || this.index === undefined) return;

    if (this.dragStates[property]?.pointer === evt.pointerId) {
      (evt.target as Element).releasePointerCapture(evt.pointerId);
      if (
        this.dragStates[property]!.startValue !==
        this.runtime.spec[this.index][property]
      ) {
        (evt.target as HTMLInputElement).blur();
      }
      this.dragStates = { ...this.dragStates, [property]: null };
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
    }
  }
}
