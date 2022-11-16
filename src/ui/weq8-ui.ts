import { LitElement, html, css, svg, ReactiveElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { WEQ8Runtime } from "../runtime";
import { WEQ8Filter } from "../spec";
import { WEQ8Analyser } from "./WEQ8Analyser";
import { WEQ8FrequencyResponse } from "./WEQ8FrequencyResponse";
import { sharedStyles } from "./styles";
import { clamp, filterHasGain, toLin, toLog10 } from "../functions";

import "./weq8-ui-filter-row";

@customElement("weq8-ui")
export class WEQ8UIElement extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        min-width: 600px;
        min-height: 200px;
        padding: 5px;
        overflow: hidden;
      }

      .filters {
        width: 170px;
        border-spacing: 0;
        margin-right: 5px;
      }
      .filters thead th {
        padding-bottom: 10px;
      }

      .visualisation {
        flex: 1;
        position: relative;
      }
      canvas,
      svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      svg {
        overflow: visible;
      }
      .grid-x,
      .grid-y {
        stroke: #333;
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .filter-handle-positioner {
        position: absolute;
        top: 0;
        left: 0;
        width: 30px;
        height: 30px;
        touch-action: none;
      }
      .filter-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        background-color: #fff;
        color: black;
        transform: translate(-50%, -50%);
        display: flex;
        justify-content: center;
        align-items: center;
        user-select: none;
        cursor: grab;
      }
    `,
  ];

  @property({ attribute: false })
  runtime?: WEQ8Runtime;

  @state()
  private analyser?: WEQ8Analyser;

  @state()
  private frequencyResponse?: WEQ8FrequencyResponse;

  @state()
  private gridXs: number[] = [];

  @state()
  private dragStates: { [filterIdx: number]: number | null } = {};

  @query(".analyser")
  private analyserCanvas?: HTMLCanvasElement;

  @query(".frequencyResponse")
  private frequencyResponseCanvas?: HTMLCanvasElement;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("runtime")) {
      this.analyser?.dispose();
      this.frequencyResponse?.dispose();
      if (this.runtime && this.analyserCanvas && this.frequencyResponseCanvas) {
        this.analyser = new WEQ8Analyser(this.runtime, this.analyserCanvas);
        this.analyser.analyse();
        this.frequencyResponse = new WEQ8FrequencyResponse(
          this.runtime,
          this.frequencyResponseCanvas
        );
        this.frequencyResponse.render();

        let newGridXs: number[] = [];
        let nyquist = this.runtime.audioCtx.sampleRate / 2;
        let xLevelsOfScale = Math.floor(Math.log10(nyquist));
        for (let los = 0; los < xLevelsOfScale; los++) {
          let step = Math.pow(10, los + 1);
          for (let i = 1; i < 10; i++) {
            let freq = step * i;
            if (freq > nyquist) break;
            newGridXs.push(
              ((Math.log10(freq) - 1) / (Math.log10(nyquist) - 1)) * 100
            );
          }
        }
        this.gridXs = newGridXs;
      }
    }
  }

  render() {
    return html`
      <table class="filters">
        <thead>
          <tr>
            <th></th>
            <th>Filter</th>
            <th>Freq</th>
            <th>Gain</th>
            <th>Q</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 8 }).map(
            (_, i) =>
              html`<weq8-ui-filter-row
                .runtime=${this.runtime}
                .index=${i}
                @change=${() => {
                  this.frequencyResponse?.render();
                  this.specUpdate();
                }}
              />`
          )}
        </tbody>
      </table>
      <div class="visualisation">
        <svg
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          ${this.gridXs.map(this.renderGridX)}
          ${[12, 6, 0, -6, -12].map(this.renderGridY)}
        </svg>
        <canvas class="analyser"></canvas>
        <canvas class="frequencyResponse"></canvas>
        ${this.runtime?.spec
          .filter((s) => s.type !== "noop")
          .map((s, i) => this.renderFilterHandle(s, i))}
      </div>
    `;
  }

  private renderGridX(x: number) {
    return svg`<line
      class="grid-x"
      x1=${x}
      y1="0"
      x2=${x}
      y2="10"
    />`;
  }

  private renderGridY(db: number) {
    let relY = (db + 15) / 30;
    let y = relY * 10;
    return svg`<line
      class="grid-y"
      x1="0"
      y1=${y}
      x2="100"
      y2=${y}
    />`;
  }

  private renderFilterHandle(spec: WEQ8Filter, idx: number) {
    if (!this.runtime) return;
    let filterType = this.runtime.spec[idx].type;
    let width = this.analyserCanvas?.offsetWidth ?? 0;
    let height = this.analyserCanvas?.offsetHeight ?? 0;
    let x =
      toLog10(spec.frequency, 10, this.runtime.audioCtx.sampleRate / 2) * width;
    let y = height - ((spec.gain + 15) / 30) * height;
    if (!filterHasGain(filterType)) {
      y = height - toLog10(spec.Q, 0.1, 18) * height;
    }
    return html`<div
      class="filter-handle-positioner"
      style="transform: translate(${x}px,${y}px)"
      @pointerdown=${(evt: PointerEvent) =>
        this.startDraggingFilterHandle(evt, idx)}
      @pointerup=${(evt: PointerEvent) =>
        this.stopDraggingFilterHandle(evt, idx)}
      @pointermove=${(evt: PointerEvent) => this.dragFilterHandle(evt, idx)}
    >
      <div class="filter-handle">${idx + 1}</div>
    </div>`;
  }

  private startDraggingFilterHandle(evt: PointerEvent, idx: number) {
    (evt.target as Element).setPointerCapture(evt.pointerId);
    this.dragStates = { ...this.dragStates, [idx]: evt.pointerId };
    evt.preventDefault();
  }

  private stopDraggingFilterHandle(evt: PointerEvent, idx: number) {
    if (this.dragStates[idx] === evt.pointerId) {
      (evt.target as Element).releasePointerCapture(evt.pointerId);
      this.dragStates = { ...this.dragStates, [idx]: null };
    }
  }

  private dragFilterHandle(evt: PointerEvent, idx: number) {
    if (this.runtime && this.dragStates[idx] === evt.pointerId) {
      let filterType = this.runtime.spec[idx].type;
      let canvasBounds =
        this.frequencyResponseCanvas?.getBoundingClientRect() ?? {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
        };
      let pointerX = evt.clientX - canvasBounds.left;
      let pointerY = evt.clientY - canvasBounds.top;
      let pointerFreq = toLin(
        pointerX / canvasBounds.width,
        10,
        this.runtime.audioCtx.sampleRate / 2
      );
      this.runtime.setFilterFrequency(idx, pointerFreq);

      let relY = 1 - pointerY / canvasBounds.height;
      if (!filterHasGain(filterType)) {
        let pointerQ = toLin(relY, 0.1, 18);
        this.runtime.setFilterQ(idx, pointerQ);
      } else {
        let pointerGain = clamp(relY * 30 - 15, -15, 15);
        this.runtime.setFilterGain(idx, pointerGain);
      }

      this.specUpdate();
      this.frequencyResponse?.render();
    }
  }

  private specUpdate() {
    this.requestUpdate();
    for (let row of Array.from(
      this.shadowRoot?.querySelectorAll("weq8-ui-filter-row") ?? []
    )) {
      (row as ReactiveElement).requestUpdate();
    }
    this.dispatchEvent(
      new CustomEvent("filterschanged", { bubbles: true, composed: true })
    );
  }
}
