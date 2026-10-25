import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AiAvailability, SYSTEM_PROMPT, StoryAiError } from '../domain/storyAi';

type LanguageOptions = {
  expectedInputs: { type: 'text'; languages: string[] }[];
  expectedOutputs: { type: 'text'; languages: string[] }[];
};

type DownloadMonitor = { addEventListener(type: 'downloadprogress', listener: (e: { loaded: number }) => void): void };

type LanguageModelSession = {
  prompt(input: string, options?: { signal?: AbortSignal; responseConstraint?: object }): Promise<string>;
  destroy(): void;
};

type LanguageModelApi = {
  availability(options: LanguageOptions): Promise<Exclude<AiAvailability, 'unsupported'>>;
  create(
    options: LanguageOptions & {
      initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
      monitor?: (m: DownloadMonitor) => void;
      signal?: AbortSignal;
    },
  ): Promise<LanguageModelSession>;
};

const LANGUAGE: LanguageOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const api = (): LanguageModelApi | null =>
  (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel ?? null;

@Injectable({ providedIn: 'root' })
export class StoryAi {
  readonly availability = signal<AiAvailability>(api() ? 'unavailable' : 'unsupported');
  readonly downloadProgress = signal<number | null>(null);
  readonly busy = signal(false);

  private session: LanguageModelSession | null = null;
  private running: AbortController | null = null;

  constructor() {
    void this.refresh();
    inject(DestroyRef).onDestroy(() => {
      this.running?.abort();
      this.session?.destroy();
    });
  }

  async refresh(): Promise<void> {
    const model = api();
    if (!model) {
      this.availability.set('unsupported');
      return;
    }
    try {
      this.availability.set(await model.availability(LANGUAGE));
    } catch {
      this.availability.set('unavailable');
    }
  }

  async prepare(): Promise<void> {
    await this.ensureSession();
  }

  async run(prompt: string, schema: object): Promise<string> {
    if (this.busy()) throw new StoryAiError('The composer is already writing.');
    this.busy.set(true);
    this.running = new AbortController();
    try {
      const session = await this.ensureSession();
      return await session.prompt(prompt, { responseConstraint: schema, signal: this.running.signal });
    } catch (e) {
      throw this.explain(e);
    } finally {
      this.busy.set(false);
      this.running = null;
    }
  }

  cancel(): void {
    this.running?.abort();
  }

  private async ensureSession(): Promise<LanguageModelSession> {
    if (this.session) return this.session;
    const model = api();
    if (!model) throw new StoryAiError('This browser has no built-in AI. Use desktop Chrome with the Prompt API.');
    const status = await model.availability(LANGUAGE).catch(() => 'unavailable' as const);
    if (status === 'unavailable') {
      this.availability.set('unavailable');
      throw new StoryAiError('The built-in model cannot run on this device.');
    }
    this.availability.set(status === 'available' ? 'available' : 'downloading');
    try {
      this.session = await model.create({
        ...LANGUAGE,
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
        monitor: (m) =>
          m.addEventListener('downloadprogress', (e) => {
            this.downloadProgress.set(Math.round(e.loaded * 100));
          }),
      });
    } catch (e) {
      await this.refresh();
      throw this.explain(e);
    }
    this.downloadProgress.set(null);
    this.availability.set('available');
    return this.session;
  }

  private explain(e: unknown): StoryAiError {
    if (e instanceof StoryAiError) return e;
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'AbortError') return new StoryAiError('Stopped.');
    if (name === 'NotAllowedError') return new StoryAiError('Chrome needs a click to start the model download. Press the button again.');
    if (name === 'QuotaExceededError') return new StoryAiError('This conversation is too long for the model. Pick a later step as the cursor.');
    if (name === 'NotSupportedError') return new StoryAiError('The model does not support this request in this browser.');
    return new StoryAiError('The built-in model failed to answer. Try again.');
  }
}
