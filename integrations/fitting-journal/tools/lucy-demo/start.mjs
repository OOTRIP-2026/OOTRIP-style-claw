import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { createRequire } from 'node:module';
import { createLucyExperiment } from '../lucy-realtime/server.mjs';
import { NativeLucyTestBudget } from '../../server/src/native-lucy-budget.ts';

const require = createRequire(new URL('../lucy-realtime/package.json', import.meta.url));
const { build } = require('esbuild');
const web = new URL('./web/', import.meta.url);
const bundle = await build({
  entryPoints: ['client.ts', 'session.ts', 'journal.ts'].map((name) =>
    fileURLToPath(new URL(name, web)),
  ),
  outdir: 'demo-browser',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['chrome110', 'safari17'],
  nodePaths: [fileURLToPath(new URL('../lucy-realtime/node_modules/', import.meta.url))],
  write: false,
  logLevel: 'silent',
});
const javascript = (name) =>
  bundle.outputFiles.find((file) => file.path.endsWith(name))?.text ?? '';
const budget = new NativeLucyTestBudget(
  fileURLToPath(new URL('../../server/data/lucy-native/', import.meta.url)),
  15,
);
const app = createLucyExperiment({
  apiKey: process.env['DECART_API_KEY'],
  budget,
  assets: {
    shell: await readFile(new URL('phone.html', web), 'utf8'),
    journal: await readFile(new URL('journal.html', web), 'utf8'),
    html: await readFile(new URL('index.html', web), 'utf8'),
    css: await readFile(new URL('style.css', web), 'utf8'),
    javascript: javascript('client.js'),
    session: javascript('session.js'),
    worker: await readFile(
      new URL(
        './realtime/browser/frame-metadata-worker.js',
        pathToFileURL(require.resolve('@decartai/sdk')),
      ),
      'utf8',
    ),
  },
});
const serverBundle = await build({
  entryPoints: [fileURLToPath(new URL('./journal-server.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const { registerJournal } = await import(
  `data:text/javascript;base64,${Buffer.from(serverBundle.outputFiles[0].text).toString('base64')}`
);
registerJournal(app, process.env);
for (const [route, file, type] of [
  ['/phone.css', 'phone.css', 'text/css'],
  ['/phone.js', 'phone.js', 'text/javascript'],
  ['/mobile.css', 'mobile.css', 'text/css'],
]) {
  app.get(route, async (_request, reply) =>
    reply.type(`${type}; charset=utf-8`).send(await readFile(new URL(file, web), 'utf8')),
  );
}
app.get('/journal.js', async (_request, reply) =>
  reply.type('text/javascript; charset=utf-8').send(javascript('journal.js')),
);
app.get('/journal.css', async (_request, reply) =>
  reply.type('text/css; charset=utf-8').send(await readFile(new URL('journal.css', web), 'utf8')),
);
process.once('SIGINT', () => void app.close());
process.once('SIGTERM', () => void app.close());
try {
  await app.listen({ host: '127.0.0.1', port: 3100 });
  console.log('OOTRIP HTML 演示：http://127.0.0.1:3100');
  console.log('穿衣手账：http://127.0.0.1:3100/journal');
  console.log(`共用现有测试批次，剩余 ${budget.status().remaining}/10；打开网页不会调用AI。`);
} catch {
  console.error('3100端口启动失败，请先关闭旧的Lucy网页实验服务。');
  process.exitCode = 1;
}
