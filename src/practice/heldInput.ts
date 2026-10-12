import type { Action } from './bindings.ts';

/** Retains short presses until a fixed simulation step samples them. */
export class HeldInput {
  private held = new Map<string, Action>();
  private pending = new Set<Action>();

  press(source: string, action: Action): void {
    this.held.set(source, action);
    this.pending.add(action);
  }

  release(source: string): void {
    this.held.delete(source);
  }

  peek(): ReadonlySet<Action> {
    return new Set([...this.held.values(), ...this.pending]);
  }

  sample(): ReadonlySet<Action> {
    const actions = this.peek();
    this.pending.clear();
    return actions;
  }

  clear(): void {
    this.held.clear();
    this.pending.clear();
  }
}
