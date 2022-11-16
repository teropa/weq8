import { WEQ8Spec, FilterType, DEFAULT_SPEC } from "./spec";
import { getBiquadFilterOrder, getBiquadFilterType } from "./functions";

export class WEQ8Runtime {
  public readonly input: AudioNode;
  private readonly output: AudioNode;

  private filterbank: { idx: number; filters: BiquadFilterNode[] }[] = [];

  constructor(
    public readonly audioCtx: BaseAudioContext,
    public readonly spec: WEQ8Spec = DEFAULT_SPEC
  ) {
    this.input = audioCtx.createGain();
    this.output = audioCtx.createGain();
    this.buildFilterChain(spec);
  }

  connect(node: AudioNode): void {
    this.output.connect(node);
  }

  disconnect(node: AudioNode): void {
    this.output.disconnect(node);
  }

  setFilterType(idx: number, type: FilterType | "noop"): void {
    if (
      type === "noop" &&
      this.spec[idx].type !== "noop" &&
      !this.spec[idx].bypass
    ) {
      this.disconnectFilter(idx);
    } else if (
      type !== "noop" &&
      this.spec[idx].type === "noop" &&
      !this.spec[idx].bypass
    ) {
      this.connectFilter(idx, type);
    }
    this.spec[idx].type = type;
    if (type !== "noop" && !this.spec[idx].bypass) {
      let filters = this.filterbank.find((f) => f.idx === idx)?.filters;
      if (!filters) {
        throw new Error("Assertion failed: No filters in filterbank");
      }
      for (let filter of filters) {
        filter.type = getBiquadFilterType(type);
      }
      let order = getBiquadFilterOrder(type);
      while (filters.length > order) {
        let indexToRemove = filters.length - 1;
        let filterToRemove = filters[indexToRemove];
        let previous = filters[indexToRemove - 1];
        let next = this.getNextInChain(idx);
        filterToRemove.disconnect();
        previous.disconnect(filterToRemove);
        previous.connect(next);
        filters.splice(indexToRemove, 1);
      }
      while (filters.length < order) {
        let newFilter = this.audioCtx.createBiquadFilter();
        newFilter.type = getBiquadFilterType(type);
        newFilter.frequency.value = this.spec[idx].frequency;
        newFilter.Q.value = this.spec[idx].Q;
        newFilter.gain.value = this.spec[idx].gain;
        let previous = filters[filters.length - 1];
        let next = this.getNextInChain(idx);
        previous.disconnect(next);
        previous.connect(newFilter);
        newFilter.connect(next);
        filters.push(newFilter);
      }
    }
  }

  toggleBypass(idx: number, bypass: boolean): void {
    if (bypass && !this.spec[idx].bypass && this.spec[idx].type !== "noop") {
      this.disconnectFilter(idx);
    } else if (
      !bypass &&
      this.spec[idx].bypass &&
      this.spec[idx].type !== "noop"
    ) {
      this.connectFilter(idx, this.spec[idx].type as FilterType);
    }
    this.spec[idx].bypass = bypass;
  }

  private disconnectFilter(idx: number) {
    let filters = this.filterbank.find((f) => f.idx === idx)?.filters;
    if (!filters) {
      throw new Error(
        "Assertion failed: No filters in filterbank when disconnecting filter. Was it connected?"
      );
    }
    let previous = this.getPreviousInChain(idx);
    let next = this.getNextInChain(idx);
    previous.disconnect(filters[0]);
    filters[filters.length - 1].disconnect(next);
    previous.connect(next);
    this.filterbank = this.filterbank.filter((f) => f.idx !== idx);
  }

  private connectFilter(idx: number, type: FilterType) {
    let filters = Array.from({ length: getBiquadFilterOrder(type) }, () => {
      let newFilter = this.audioCtx.createBiquadFilter();
      newFilter.type = getBiquadFilterType(type);
      newFilter.frequency.value = this.spec[idx].frequency;
      newFilter.Q.value = this.spec[idx].Q;
      newFilter.gain.value = this.spec[idx].gain;
      return newFilter;
    });
    let previous = this.getPreviousInChain(idx);
    let next = this.getNextInChain(idx);
    previous.disconnect(next);
    previous.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(next);
    this.filterbank.push({ idx, filters });
  }

  setFilterFrequency(idx: number, frequency: number): void {
    this.spec[idx].frequency = frequency;
    let bankEntry = this.filterbank.find((f) => f.idx === idx);
    if (bankEntry) {
      for (let filter of bankEntry.filters) {
        filter.frequency.value = frequency;
      }
    }
  }

  setFilterQ(idx: number, Q: number): void {
    this.spec[idx].Q = Q;
    let bankEntry = this.filterbank.find((f) => f.idx === idx);
    if (bankEntry) {
      for (let filter of bankEntry.filters) {
        filter.Q.value = Q;
      }
    }
  }

  setFilterGain(idx: number, gain: number): void {
    this.spec[idx].gain = gain;
    let bankEntry = this.filterbank.find((f) => f.idx === idx);
    if (bankEntry) {
      for (let filter of bankEntry.filters) {
        filter.gain.value = gain;
      }
    }
  }

  getFrequencyResponse(
    idx: number,
    filterIdx: number,
    frequencies: Float32Array,
    magResponse: Float32Array,
    phaseResponse: Float32Array
  ): boolean {
    let filter = this.filterbank.find((f) => f.idx === idx);
    if (filter) {
      filter.filters[filterIdx].getFrequencyResponse(
        frequencies,
        magResponse,
        phaseResponse
      );
      return true;
    } else {
      return false;
    }
  }

  private buildFilterChain(specs: WEQ8Spec): void {
    this.filterbank = [];
    for (let i = 0; i < specs.length; i++) {
      let spec = specs[i];
      if (spec.type === "noop" || spec.bypass) continue;
      let filters = Array.from(
        { length: getBiquadFilterOrder(spec.type) },
        () => {
          let filter = this.audioCtx.createBiquadFilter();
          filter.type = getBiquadFilterType(spec.type as FilterType);
          filter.frequency.value = spec.frequency;
          filter.Q.value = spec.Q;
          filter.gain.value = spec.gain;
          return filter;
        }
      );
      this.filterbank.push({ idx: i, filters });
    }
    if (this.filterbank.length === 0) {
      this.input.connect(this.output);
    } else {
      for (let i = 0; i < this.filterbank.length; i++) {
        let { filters } = this.filterbank[i];
        if (i === 0) {
          this.input.connect(filters[0]);
        } else {
          this.filterbank[i - 1].filters[
            this.filterbank[i - 1].filters.length - 1
          ].connect(filters[0]);
        }
        for (let j = 0; j < filters.length - 1; j++) {
          filters[j].connect(filters[j + 1]);
        }
        if (i === this.filterbank.length - 1) {
          filters[filters.length - 1].connect(this.output);
        }
      }
    }
  }

  private getPreviousInChain(idx: number): AudioNode {
    let prev = this.input,
      prevIndex = -1;
    for (let filter of this.filterbank) {
      if (filter.idx < idx && filter.idx > prevIndex) {
        prev = filter.filters[filter.filters.length - 1];
        prevIndex = filter.idx;
      }
    }
    return prev;
  }

  private getNextInChain(idx: number): AudioNode {
    let next = this.output,
      nextIndex: number = this.spec.length;
    for (let filter of this.filterbank) {
      if (filter.idx > idx && filter.idx < nextIndex) {
        next = filter.filters[0];
        nextIndex = filter.idx;
      }
    }
    return next;
  }
}
