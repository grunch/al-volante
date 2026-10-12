/** A resource ledger, not a signal emulator: offline-browser tests verify the generated PCM. */
export function fakeAudio() {
  const param = () => ({
    value: 0,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const newNode = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setPeriodicWave: vi.fn(),
    gain: param(),
    frequency: param(),
    Q: param(),
    pan: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    onended: null as (() => void) | null,
  });
  const nodes: ReturnType<typeof newNode>[] = [];
  const node = () => {
    const n = newNode();
    nodes.push(n);
    return n;
  };
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    createGain: node,
    createOscillator: node,
    createStereoPanner: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createDynamicsCompressor: node,
    createPeriodicWave: vi.fn(),
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  return { context: context as unknown as AudioContext, nodes, calls: context };
}
