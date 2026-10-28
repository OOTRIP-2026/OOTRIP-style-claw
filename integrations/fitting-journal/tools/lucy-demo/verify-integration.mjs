import assert from 'node:assert/strict';
import { app } from './start.mjs';

// In-process requests test the assembled service without occupying port 3100
// or sending photos, minting credentials, or consuming provider quota.
const get = (url) => app.inject({ method: 'GET', url, headers: { host: '127.0.0.1:3100' } });
try {
  for (const path of ['/', '/journal', '/app/index.html']) {
    const response = await get(path);
    assert.equal(response.statusCode, 200, path);
    assert.match(response.body, /module-integration\.js/);
    assert.doesNotMatch(response.body, /id="app-screen"/);
  }
  for (const path of ['/fitting-screen?integrated=1', '/journal-screen?integrated=1', '/photo-screen?integrated=1']) {
    const response = await get(path);
    assert.equal(response.statusCode, 200, path);
    assert.doesNotMatch(response.body, /__NONCE__/);
    if (!path.startsWith('/photo-screen')) assert.match(response.body, /ootrip-integrated/);
  }
  for (const path of ['/client.js', '/journal.js', '/session.js', '/frame-metadata-worker.js', '/style.css', '/journal.css', '/mobile.css']) {
    const response = await get(path);
    assert.equal(response.statusCode, 200, path);
    assert.ok(response.body.length > 0, path);
  }
  for (const path of ['/experiment/status', '/journal/status', '/journal/artwork/status', '/fitting/photo/status']) {
    const response = await get(path);
    assert.equal(response.statusCode, 200, path);
    assert.equal(typeof response.json().configured, 'boolean', path);
  }
  const bridge = await get('/app/module-integration.js');
  assert.doesNotMatch(bridge.body, /window\.open\(/);
  const rejected = await app.inject({ method: 'POST', url: '/experiment/token', headers: { host: '127.0.0.1:3100', origin: 'https://foreign.invalid' }, payload: { consent: true, seconds: 30 } });
  assert.equal(rejected.statusCode, 403);
  console.log('Unified app, embedded modules, AI status, nonce, Worker and origin protection: PASS. No provider calls.');
} finally {
  await app.close();
}
