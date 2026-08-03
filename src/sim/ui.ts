/**
 * Management UI support (Section 11 — tasks 11.5, 11.6, 11.8).
 *
 * - A message log with severity/category and anti-spam (identical messages are
 *   grouped and rate-limited so they don't flood).
 * - A camera controller state (pan/zoom/focus/return-to-center) for the view.
 * - An options/accessibility store (graphics, audio mix, gameplay, text size)
 *   that persists round-trip.
 * Self-contained; the Phaser scenes read these models.
 */
export type MessageSeverity = 'info' | 'warning' | 'critical';
export type MessageCategory = 'food' | 'water' | 'labor' | 'trade' | 'finance' | 'risks' | 'government' | 'general';

export interface LogMessage {
  id: number;
  tick: number;
  severity: MessageSeverity;
  category: MessageCategory;
  text: string;
  count: number;
}

export class MessageLog {
  private messages: LogMessage[] = [];
  private nextId = 1;
  private lastTickByText = new Map<string, number>();

  constructor(private readonly antiSpamCooldown = 30, private readonly capacity = 50, private readonly tickNow = () => 0) {}

  push(text: string, severity: MessageSeverity = 'info', category: MessageCategory = 'general'): LogMessage {
    const tick = this.tickNow();
    const last = this.lastTickByText.get(text) ?? -Infinity;
    // Anti-spam: bump the count of an identical message within the cooldown.
    const match = this.messages.find((m) => m.text === text && tick - last <= this.antiSpamCooldown);
    if (match && tick - last <= this.antiSpamCooldown) {
      match.count += 1;
      match.tick = tick;
      return match;
    }
    this.lastTickByText.set(text, tick);
    const msg: LogMessage = { id: this.nextId++, tick, severity, category, text, count: 1 };
    this.messages.push(msg);
    if (this.messages.length > this.capacity) this.messages.splice(0, this.messages.length - this.capacity);
    return msg;
  }

  items(): LogMessage[] {
    return [...this.messages];
  }

  count(): number {
    return this.messages.length;
  }
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  pan(dx: number, dy: number): void;
  setZoom(z: number): void;
  returnToCenter(width: number, height: number): void;
}

export function createCamera(initialZoom = 1): CameraState {
  let x = 0;
  let y = 0;
  let zoom = initialZoom;
  return {
    get x() { return x; },
    get y() { return y; },
    get zoom() { return zoom; },
    pan(dx, dy) { x += dx; y += dy; },
    setZoom(z) { zoom = Math.max(0.25, Math.min(4, z)); },
    returnToCenter(w, h) { x = w / 2; y = h / 2; zoom = 1; },
  };
}

export interface OptionsSchema {
  graphicsQuality: 'low' | 'medium' | 'high';
  audioMusic: number; // 0..1
  audioSfx: number; // 0..1
  gameSpeedDefault: number;
  textSize: 'small' | 'normal' | 'large';
  reducedMotion: boolean;
}

export const DEFAULT_OPTIONS: OptionsSchema = {
  graphicsQuality: 'medium',
  audioMusic: 0.6,
  audioSfx: 0.8,
  gameSpeedDefault: 1,
  textSize: 'normal',
  reducedMotion: false,
};

export function mergeOptions(raw: Partial<OptionsSchema>): OptionsSchema {
  return { ...DEFAULT_OPTIONS, ...raw };
}

export function serializeOptions(o: OptionsSchema): string {
  return JSON.stringify(o);
}

export function deserializeOptions(raw: string | null): OptionsSchema {
  if (!raw) return { ...DEFAULT_OPTIONS };
  try {
    const parsed = JSON.parse(raw) as Partial<OptionsSchema>;
    return mergeOptions(parsed);
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}
