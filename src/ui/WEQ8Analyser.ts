import { WEQ8Runtime } from "../runtime";

export class WEQ8Analyser {
  private analyser: AnalyserNode;
  private analysisData: Uint8Array;
  private analysisXs: number[];
  private disposed = false;

  private resizeObserver: ResizeObserver;

  constructor(private runtime: WEQ8Runtime, private canvas: HTMLCanvasElement) {
    this.analyser = runtime.audioCtx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.5;
    runtime.connect(this.analyser);
    this.analysisData = new Uint8Array(this.analyser.frequencyBinCount);

    let maxLog = Math.log10(runtime.audioCtx.sampleRate / 2) - 1;

    this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
    this.analysisXs = this.calculateAnalysisXs(maxLog);
    this.resizeObserver = new ResizeObserver(() => {
      this.canvas.width = this.canvas.offsetWidth * window.devicePixelRatio;
      this.canvas.height = this.canvas.offsetHeight * window.devicePixelRatio;
      this.analysisXs = this.calculateAnalysisXs(maxLog);
    });
    this.resizeObserver.observe(this.canvas);
  }

  private calculateAnalysisXs(maxLog: number): number[] {
    return Array.from(this.analysisData).map((_, i) => {
      let freq =
        (i / this.analysisData.length) * (this.runtime.audioCtx.sampleRate / 2);
      return Math.floor(((Math.log10(freq) - 1) / maxLog) * this.canvas.width);
    });
  }

  analyse() {
    let frame = () => {
      if (this.disposed) return;
      this.analyser.getByteFrequencyData(this.analysisData);
      this.draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private draw() {
    let w = this.canvas.width,
      h = this.canvas.height,
      yScale = this.canvas.height / 255;

    let ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a canvas context!");

    ctx.clearRect(0, 0, w, h);

    let path = new Path2D();
    path.moveTo(0, h);
    for (let i = 0; i < this.analysisData.length; i++) {
      let y = Math.floor(h - this.analysisData[i] * yScale);
      path.lineTo(this.analysisXs[i], y);
    }
    path.lineTo(w, h);

    ctx.fillStyle = "rgba(30, 30, 60, 0.7)";
    ctx.fill(path);

    ctx.strokeStyle = "rgb(155, 155, 255)";
    ctx.stroke(path);
  }

  dispose() {
    this.disposed = true;
    this.analyser.disconnect();
    this.resizeObserver.disconnect();
  }
}
