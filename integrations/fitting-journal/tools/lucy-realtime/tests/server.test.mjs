import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLucyExperiment, mintLucyToken, EXPERIMENT_ORIGIN, LUCY_MODEL } from '../server.mjs';

const assets = {
  html: '<meta content="__NONCE__">',
  javascript: '',
  session: '',
  css: '',
  worker: '/* frame worker fixture */',
};
const host = { host: '127.0.0.1:3100' };

test('serve the bundled SDK worker at its relative same-origin URL without minting', async (t) => {
  let calls = 0;
  const { create } = await setup(t, async () => {
    calls++;
  });
  const response = await create().inject({ url: '/frame-metadata-worker.js', headers: host });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'], /javascript/);
  assert.equal(response.body, assets.worker);
  assert.equal(calls, 0);
});

async function setup(t, mint) {
  const directory = await mkdtemp(join(tmpdir(), 'ootrip-lucy-'));
  const gatePath = join(directory, 'private', 'batch.json');
  const apps = [];
  const create = () => {
    const app = createLucyExperiment({ apiKey: 'test-only-key', assets, gatePath, mint });
    apps.push(app);
    return app;
  };
  t.after(async () => {
    await Promise.all(apps.map((app) => app.close()));
    await rm(directory, { recursive: true, force: true });
  });
  return { create, gatePath };
}
async function tokenRequest(app, overrides = {}) {
  const page = await app.inject({ url: '/', headers: host });
  const nonce = /content="([a-f0-9]+)"/.exec(page.body)?.[1];
  return app.inject({
    method: 'POST',
    url: '/experiment/token',
    headers: { ...host, origin: EXPERIMENT_ORIGIN, 'x-lucy-experiment': nonce, ...overrides },
    payload: { consent: true, seconds: 30 },
  });
}

test('only one provider request across concurrent clicks and a new server instance', async (t) => {
  let calls = 0;
  const { create, gatePath } = await setup(t, async () => {
    calls++;
    return { apiKey: 'ek_test', expiresAt: '2099-01-01T00:00:00Z' };
  });
  const app = create();
  const results = await Promise.all([tokenRequest(app), tokenRequest(app)]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await tokenRequest(create())).statusCode, 409);
  assert.equal(calls, 1);
  const reservation = await readFile(gatePath, 'utf8');
  assert.equal(reservation.includes('key'), false);
  assert.equal(JSON.parse(reservation).seconds, 30);
});

test('provider failure remains reserved and never leaks provider errors', async (t) => {
  let calls = 0;
  const { create } = await setup(t, async () => {
    calls++;
    throw new Error('private-provider-key-and-body');
  });
  const first = await tokenRequest(create());
  assert.equal(first.statusCode, 502);
  assert.equal(first.body.includes('private-provider'), false);
  assert.equal((await tokenRequest(create())).statusCode, 409);
  assert.equal(calls, 1);
});

test('foreign origins, DNS rebinding hosts, missing nonce and missing consent do not mint', async (t) => {
  let calls = 0;
  const { create } = await setup(t, async () => {
    calls++;
  });
  const app = create();
  assert.equal((await tokenRequest(app, { origin: 'https://other.example' })).statusCode, 403);
  assert.equal((await tokenRequest(app, { host: 'other.example:3100' })).statusCode, 403);
  assert.equal((await tokenRequest(app, { 'x-lucy-experiment': '' })).statusCode, 403);
  const page = await app.inject({ url: '/', headers: host });
  const nonce = /content="([a-f0-9]+)"/.exec(page.body)?.[1];
  const cancelled = await app.inject({
    method: 'POST',
    url: '/experiment/token',
    headers: { ...host, origin: EXPERIMENT_ORIGIN, 'x-lucy-experiment': nonce },
    payload: { consent: false, seconds: 30 },
  });
  assert.equal(cancelled.statusCode, 400);
  assert.equal(calls, 0);
  assert.equal((await app.inject({ url: '/.env', headers: host })).statusCode, 404);
  assert.equal(
    (await app.inject({ url: '/server/data/lucy-realtime/batch-01.json', headers: host }))
      .statusCode,
    404,
  );
});

test('the only provider call requests a model, origin and thirty-second ceiling', async () => {
  let calls = 0;
  const token = await mintLucyToken('test-secret', async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.decart.ai/v1/client/tokens');
    assert.equal(options.redirect, 'error');
    const request = JSON.parse(options.body);
    assert.equal(request.constraints.realtime.maxSessionDuration, 30);
    assert.deepEqual(request.allowedModels, [LUCY_MODEL]);
    assert.deepEqual(request.allowedOrigins, [EXPERIMENT_ORIGIN]);
    assert.equal(request.expiresIn, 60);
    return {
      ok: true,
      json: async () => ({
        apiKey: 'ek_fake',
        expiresAt: '2099-01-01T00:00:00Z',
        constraints: request.constraints,
        permissions: { models: request.allowedModels, origins: request.allowedOrigins },
      }),
    };
  });
  assert.equal(calls, 1);
  assert.equal(token.apiKey, 'ek_fake');
  assert.equal('constraints' in token, false);
});

test('accept omitted optional echoes while retaining requested thirty-second constraint', async () => {
  const result = await mintLucyToken('test-secret', async (_url, options) => {
    assert.equal(JSON.parse(options.body).constraints.realtime.maxSessionDuration, 30);
    return {
      ok: true,
      json: async () => ({ apiKey: 'ek_fake', expiresAt: '2099-01-01T00:00:00Z' }),
    };
  });
  assert.equal(result.apiKey, 'ek_fake');
});

test('refuse an explicitly different duration; do not retry', async () => {
  let calls = 0;
  await assert.rejects(
    mintLucyToken('test-secret', async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          apiKey: 'ek_fake',
          expiresAt: '2099-01-01T00:00:00Z',
          constraints: { realtime: { maxSessionDuration: 20 } },
        }),
      };
    }),
    /TOKEN_CONSTRAINTS_UNCONFIRMED/,
  );
  assert.equal(calls, 1);
});

test('phone shell switches screens without minting and keeps nonce inside application pages', async (t) => {
  let calls = 0;
  const app = createLucyExperiment({
    apiKey: 'test-only-key',
    assets: {
      ...assets,
      shell: '<iframe src="__SCREEN__"></iframe>',
      journal: '<meta content="__NONCE__">journal',
    },
    mint: async () => {
      calls++;
    },
  });
  t.after(() => app.close());
  const root = await app.inject({ url: '/', headers: host });
  const journal = await app.inject({ url: '/journal', headers: host });
  assert.match(root.body, /src="\/fitting-screen"/);
  assert.match(journal.body, /src="\/journal-screen"/);
  const fittingScreen = await app.inject({ url: '/fitting-screen', headers: host });
  const journalScreen = await app.inject({ url: '/journal-screen', headers: host });
  const nonce = /content="([a-f0-9]+)"/.exec(fittingScreen.body)?.[1];
  assert.equal(nonce?.length, 64);
  assert.ok(journalScreen.body.includes(nonce));
  assert.equal(
    (await app.inject({ url: '/fitting-screen', headers: { host: 'foreign.test' } })).statusCode,
    403,
  );
  assert.equal(calls, 0);
});
