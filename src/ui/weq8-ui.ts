import { LitElement, html, css, svg, ReactiveElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
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
        gap: 10px;
        min-width: 600px;
        min-height: 200px;
        padding: 20px;
        border-radius: 8px;
        overflow: hidden;
        background: #202020;
        border: 1px solid #373737;
      }
      .filters {
        display: inline-grid;
        grid-auto-flow: row;
        gap: 4px;
      }
      .filters tbody,
      .filters tr {
        display: contents;
      }
      .filters thead {
        display: grid;
        grid-auto-flow: column;
        grid-template-columns: 60px 60px 50px 40px;
        align-items: center;
        gap: 4px;
      }
      .filters thead th {
        display: grid;
        place-content: center;
        height: 20px;
        border-radius: 10px;
        font-weight: var(--font-weight);
        border: 1px solid #373737;
      }
      .filters thead th.headerFilter {
        text-align: left;
        padding-left: 18px;
        border: none;
      }
      .visualisation {
        flex: 1;
        position: relative;
        border: 1px solid #373737;
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
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #fff;
        color: black;
        transform: translate(-50%, -50%);
        display: flex;
        justify-content: center;
        align-items: center;
        user-select: none;
        cursor: grab;
        transition: background-color 0.15s ease;
      }
      .filter-handle.selected {
        background: #ffcc00;
      }
      .filter-handle.bypassed {
        background: #7d7d7d;
      }
    `,
  ];

  constructor() {
    super();
    this.addEventListener("click", (evt) => {
      if (evt.composedPath()[0] === this) this.selectedFilterIdx = -1;
    });
  }

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

  @state()
  private selectedFilterIdx = -1;

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

        this.runtime.on("filtersChanged", () => {
          this.frequencyResponse?.render();
          this.requestUpdate();
          for (let row of Array.from(
            this.shadowRoot?.querySelectorAll("weq8-ui-filter-row") ?? []
          )) {
            (row as ReactiveElement).requestUpdate();
          }
        });
      }
    }
  }

  render() {
    return html`
      <table class="filters">
        <thead>
          <tr>
            <th class="headerFilter">Filter</th>
            <th>Freq</th>
            <th>Gain</th>
            <th>Q</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 8 }).map(
            (_, i) =>
              html`<weq8-ui-filter-row
                class="${classMap({ selected: this.selectedFilterIdx === i })}"
                .runtime=${this.runtime}
                .index=${i}
                @select=${(evt: CustomEvent) => {
                  this.selectedFilterIdx =
                    this.runtime?.spec[i].type === "noop" ? -1 : i;
                  evt.stopPropagation();
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
        <canvas
          class="frequencyResponse"
          @click=${() => (this.selectedFilterIdx = -1)}
        ></canvas>
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
      <div
        class="${classMap({
          "filter-handle": true,
          bypassed: spec.bypass,
          selected: idx === this.selectedFilterIdx,
        })}"
      >
        ${idx + 1}
      </div>
    </div>`;
  }

  private startDraggingFilterHandle(evt: PointerEvent, idx: number) {
    (evt.target as Element).setPointerCapture(evt.pointerId);
    this.dragStates = { ...this.dragStates, [idx]: evt.pointerId };
    this.selectedFilterIdx = idx;
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
    }
  }
}
