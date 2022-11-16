import { WEQ8Runtime } from "../runtime";
import { getBiquadFilterOrder } from "../functions";

export class WEQ8FrequencyResponse {
  private frequencies: Float32Array;
  private filterMagResponse: Float32Array;
  private filterPhaseResponse: Float32Array;
  private frequencyResponse: Float32Array;
  private resizeObserver: ResizeObserver;

  constructor(private runtime: WEQ8Runtime, private canvas: HTMLCanvasElement) {
    this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
    this.frequencies = this.calculateFrequencies();
    this.filterMagResponse = new Float32Array(this.frequencies.length);
    this.filterPhaseResponse = new Float32Array(this.frequencies.length);
    this.frequencyResponse = new Float32Array(this.frequencies.length);
    this.resizeObserver = new ResizeObserver(() => {
      this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
      this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
      this.frequencies = this.calculateFrequencies();
      this.filterMagResponse = new Float32Array(this.frequencies.length);
      this.filterPhaseResponse = new Float32Array(this.frequencies.length);
      this.frequencyResponse = new Float32Array(this.frequencies.length);
      this.render();
    });
    this.resizeObserver.observe(this.canvas);
  }

  dispose() {
    this.resizeObserver.disconnect();
  }

  render() {
    this.frequencyResponse.fill(1);
    for (let i = 0; i < this.runtime.spec.length; i++) {
      for (
        let j = 0;
        j < getBiquadFilterOrder(this.runtime.spec[i].type);
        j++
      ) {
        let updated = this.runtime.getFrequencyResponse(
          i,
          j,
          this.frequencies,
          this.filterMagResponse,
          this.filterPhaseResponse
        );
        if (updated) {
          for (let j = 0; j < this.frequencyResponse.length; j++) {
            this.frequencyResponse[j] *= this.filterMagResponse[j];
          }
        }
      }
    }
    this.draw();
  }

  private draw() {
    let ctx = this.canvas.getContext("2d"),
      w = this.canvas.width,
      h = this.canvas.height;
    if (!ctx) throw new Error("Could not get a canvas context!");
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let maxDb = 13;
    let minDb = -maxDb;
    for (let x = 0; x < this.frequencyResponse.length; x++) {
      let gain = this.frequencyResponse[x];
      let db = 20 * Math.log10(gain);
      let y = h - ((db - minDb) / (maxDb - minDb)) * h;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private calculateFrequencies(): Float32Array {
    let frequencies = new Float32Array(this.canvas.width);
    let nyquist = this.runtime.audioCtx.sampleRate / 2;
    let minLog = 1;
    let maxLog = Math.log10(nyquist);
    for (let x = 0; x < this.canvas.width; x++) {
      let log = minLog + (x / this.canvas.width) * (maxLog - minLog);
      let frequency = Math.pow(10, log);
      frequencies[x] = frequency;
    }
    return frequencies;
  }
}
