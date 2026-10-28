import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// This named authorization batch grants ten NEW attempts. Historical attempts are untouched.
export class NativeLucyTestBudget {
  readonly limit = 10;
  readonly batch = 'ui-10-v1';
  private readonly directory: string;
  private readonly firstFrameSeconds: 10 | 15 | 30;
  constructor(directory: string, firstFrameSeconds: 10 | 15 | 30 = 10) {
    this.directory = directory;
    this.firstFrameSeconds = firstFrameSeconds;
  }
  private file(index: number) {
    return join(this.directory, `${this.batch}-attempt-${String(index).padStart(2, '0')}.json`);
  }
  status() {
    let used = 0;
    for (let index = 1; index <= this.limit; index++) if (existsSync(this.file(index))) used++;
    return { batch: this.batch, limit: this.limit, used, remaining: this.limit - used };
  }
  async reserve() {
    await mkdir(this.directory, { recursive: true });
    for (let index = 1; index <= this.limit; index++) {
      try {
        await writeFile(
          this.file(index),
          JSON.stringify({
            batch: this.batch,
            attempt: index,
            reservedAt: new Date().toISOString(),
            maxSeconds: this.firstFrameSeconds === 30 ? 60 : 30,
            firstFrameSeconds: this.firstFrameSeconds,
          }),
          { flag: 'wx' },
        );
        return this.status();
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      }
    }
    throw new Error('ATTEMPT_USED');
  }
}
