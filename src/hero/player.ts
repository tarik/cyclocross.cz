/**
 * The browser side of the hero animation: loads the scenery layers and the
 * sprite sheets, runs the sequencer at up to 30 frames a second and draws
 * the rider between the occluder layers by draw depth (SPEC.md 5.1 and 5.6).
 * It stops when the canvas is off screen or the page is hidden, and resumes
 * where it was, without racing through the time in between.
 */
import { pitchDegrees, project } from './scene.ts';
import { cellFor, sheetName, type Body, type Kit, type Sheets } from './sprites.ts';
import { buildTimeline, posterTime, riderFor, sample, type RiderState, type Timeline } from './timeline.ts';

export interface SceneLayer {
  id: string;
  s?: number;
  url: string;
}

export interface PlayerData {
  width: number;
  height: number;
  layers: SceneLayer[];
  sheets: Sheets;
  /** URL of a sheet by file name. */
  sheetUrl: (name: string) => string;
}

export interface PlayerOptions {
  seed: number;
  kit: Kit;
  /** Force one rider instead of alternating. */
  body?: Body;
  autoplay?: boolean;
  fps?: number;
  speed?: number;
  onFrame?: (info: FrameInfo) => void;
}

export interface FrameInfo {
  loop: number;
  time: number;
  duration: number;
  body: Body;
  kit: Kit;
  state: RiderState | null;
  playing: boolean;
}

const COS = Math.cos((pitchDegrees * Math.PI) / 180);

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

export class HeroPlayer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly data: PlayerData;
  private readonly images = new Map<string, HTMLImageElement>();
  private layers: (SceneLayer & { image: HTMLImageElement })[] = [];
  private options: Required<Omit<PlayerOptions, 'body' | 'onFrame'>> & Pick<PlayerOptions, 'body' | 'onFrame'>;
  private loop = 0;
  private timeline: Timeline;
  private time = 0;
  private playing = false;
  private onScreen = true;
  private frameRequest = 0;
  private last: number | null = null;
  private observer?: IntersectionObserver;

  constructor(canvas: HTMLCanvasElement, data: PlayerData, options: PlayerOptions) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.context.imageSmoothingEnabled = false;
    this.data = data;
    this.options = { autoplay: true, fps: 30, speed: 1, ...options };
    this.timeline = buildTimeline(this.loopSeed(0));
  }

  get body(): Body {
    return this.options.body ?? riderFor(this.options.seed, this.loop);
  }

  get duration(): number {
    return this.timeline.duration + this.timeline.config.gap;
  }

  get current(): Timeline {
    return this.timeline;
  }

  private loopSeed(loop: number): number {
    return (this.options.seed * 7919 + loop * 104729) >>> 0;
  }

  /** Loads the scenery and the sheets of the current kit, then draws the first frame. */
  async start(): Promise<void> {
    this.layers = await Promise.all(this.data.layers.map(async (layer) => ({ ...layer, image: await this.image(layer.url) })));
    await this.loadKit(this.options.kit);
    this.observer = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      this.schedule();
    });
    this.observer.observe(this.canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.options.autoplay) this.play();
    else this.seek(posterTime(this.timeline));
  }

  private async image(url: string): Promise<HTMLImageElement> {
    const cached = this.images.get(url);
    if (cached) return cached;
    const image = await load(url);
    this.images.set(url, image);
    return image;
  }

  private async loadKit(kit: Kit): Promise<void> {
    const names = (['female', 'male'] as Body[]).flatMap((body) => [sheetName('ride', body, kit), sheetName('hop', body, kit)]);
    await Promise.all(names.map((name) => this.image(this.data.sheetUrl(name))));
  }

  async setKit(kit: Kit): Promise<void> {
    await this.loadKit(kit);
    this.options.kit = kit;
    this.render();
  }

  setBody(body: Body | undefined): void {
    this.options.body = body;
    this.render();
  }

  setSpeed(speed: number): void {
    this.options.speed = speed;
  }

  async setLayers(layers: SceneLayer[]): Promise<void> {
    this.layers = await Promise.all(layers.map(async (layer) => ({ ...layer, image: await this.image(layer.url) })));
    this.render();
  }

  play(): void {
    this.playing = true;
    this.schedule();
    this.render();
  }

  pause(): void {
    this.playing = false;
    this.schedule();
    this.render();
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Moves to a time in the current loop and draws it. */
  seek(time: number): void {
    this.time = Math.max(0, Math.min(this.duration - 0.001, time));
    this.render();
  }

  /** Steps a number of animation frames forwards or backwards. */
  step(frames: number): void {
    this.advance(frames / this.options.fps, false);
    this.render();
  }

  private advance(seconds: number, scaled = true): void {
    this.time += seconds * (scaled ? this.options.speed : 1);
    if (this.time < 0) this.time = 0;
    while (this.time >= this.duration) {
      this.time -= this.duration;
      this.loop += 1;
      this.timeline = buildTimeline(this.loopSeed(this.loop));
    }
  }

  /** Runs the frame loop only while playing, on screen and visible. */
  private schedule(): void {
    const run = this.playing && this.onScreen && !document.hidden;
    if (run && !this.frameRequest) {
      this.last = null;
      this.frameRequest = requestAnimationFrame(this.tick);
    } else if (!run && this.frameRequest) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = 0;
    }
  }

  private onVisibility = (): void => this.schedule();

  private tick = (now: number): void => {
    this.frameRequest = requestAnimationFrame(this.tick);
    const interval = 1000 / this.options.fps;
    if (this.last !== null && now - this.last < interval - 1) return;
    // Never jump more than a few frames, so a slow device does not race.
    const elapsed = this.last === null ? 0 : Math.min(now - this.last, interval * 3);
    this.last = now;
    this.advance(elapsed / 1000);
    this.render();
  };

  render(): void {
    const { context: c, data } = this;
    const state = sample(this.timeline, this.time);
    c.clearRect(0, 0, data.width, data.height);
    let drawn = !state;
    for (const layer of this.layers) {
      if (!drawn && layer.s !== undefined && state!.depth < layer.s) {
        this.drawRider(state!);
        drawn = true;
      }
      c.drawImage(layer.image, 0, 0);
    }
    if (!drawn) this.drawRider(state!);
    this.options.onFrame?.({
      loop: this.loop, time: this.time, duration: this.duration, body: this.body, kit: this.options.kit, state, playing: this.playing,
    });
  }

  private drawRider(state: RiderState): void {
    const c = this.context;
    const cell = cellFor(this.data.sheets, state, this.body, this.options.kit);
    const image = this.images.get(this.data.sheetUrl(cell.sheet));
    if (!image) return;
    const at = project(state.ground);
    // A contact shadow along the bike on the surface, fainter and smaller in the air.
    const angle = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315 }[state.facing] * (Math.PI / 180);
    const half = 15;
    const a = project({ e: state.ground.e - Math.cos(angle) * half, s: state.ground.s - Math.sin(angle) * half, h: state.ground.h });
    const b = project({ e: state.ground.e + Math.cos(angle) * half, s: state.ground.s + Math.sin(angle) * half, h: state.ground.h });
    const k = Math.max(0.35, 1 - state.lift / 50);
    c.fillStyle = `rgba(42, 37, 32, ${(0.24 * k).toFixed(3)})`;
    c.beginPath();
    c.ellipse((a.x + b.x) / 2 + 1, (a.y + b.y) / 2, (Math.hypot(b.x - a.x, b.y - a.y) / 2 + 3) * k, 2.5 * k, Math.atan2(b.y - a.y, b.x - a.x), 0, Math.PI * 2);
    c.fill();
    const x = Math.round(at.x - cell.anchor.x);
    const y = Math.round(at.y - state.lift * COS - cell.anchor.y);
    c.drawImage(image, cell.x, cell.y, cell.width, cell.height, x, y, cell.width, cell.height);
  }

  destroy(): void {
    this.playing = false;
    this.schedule();
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
