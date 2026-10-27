import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { NativeLucyTestBudget } from '../../server/src/native-lucy-budget.js';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
it('allows exactly ten durable reservations across instances and concurrency without changing history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ootrip-lucy-budget-'));
  directories.push(directory);
  await writeFile(join(directory, 'attempt-01.json'), 'historical');
  const budget = new NativeLucyTestBudget(directory);
  expect(budget.status().remaining).toBe(10);
  const reservations = await Promise.allSettled(
    Array.from({ length: 16 }, () => new NativeLucyTestBudget(directory).reserve()),
  );
  expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
  expect(reservations.filter((result) => result.status === 'rejected')).toHaveLength(6);
  expect(new NativeLucyTestBudget(directory).status()).toMatchObject({
    limit: 10,
    remaining: 0,
    used: 10,
  });
  await expect(budget.reserve()).rejects.toThrow('ATTEMPT_USED');
  expect(await readFile(join(directory, 'attempt-01.json'), 'utf8')).toBe('historical');
});
it('never refunds a reserved attempt on a provider failure or process restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ootrip-lucy-budget-'));
  directories.push(directory);
  await new NativeLucyTestBudget(directory).reserve();
  expect(new NativeLucyTestBudget(directory).status().remaining).toBe(9);
});

it('records the HTML fifteen-second allowance while sharing the existing batch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ootrip-lucy-budget-'));
  directories.push(directory);
  await new NativeLucyTestBudget(directory, 15).reserve();
  const record = JSON.parse(await readFile(join(directory, 'ui-10-v1-attempt-01.json'), 'utf8'));
  expect(record).toMatchObject({ maxSeconds: 30, firstFrameSeconds: 15 });
  expect(new NativeLucyTestBudget(directory).status().remaining).toBe(9);
});
