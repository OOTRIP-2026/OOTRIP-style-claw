import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { createRequire } from 'node:module';
import { createLucyExperiment } from '../lucy-realtime/server.mjs';
import { NativeLucyTestBudget } from '../../server/src/native-lucy-budget.ts';

const require = createRequire(new URL('../lucy-realtime/package.json', import.meta.url));
const { build } = require('esbuild');
const web = new URL('./web/', import.meta.url);
const bundle = await build({
  entryPoints: ['client.ts', 'session.ts', 'journal.ts', 'photo.ts'].map((name) =>
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
  process.env['OOTRIP_LUCY_BUDGET_DIR'] || fileURLToPath(new URL('../../server/data/lucy-native/', import.meta.url)),
  30,
  // Keep the current project's existing ten-attempt ledger and limit.
);
export const app = createLucyExperiment({
  apiKey: process.env['DECART_API_KEY'],
  budget,
  assets: {
    // Every public entry uses the host application, never the standalone demo shell.
    shell: (await readFile(new URL('../../../../dist/index.html', import.meta.url), 'utf8'))
      .replace(/(<html[^>]*>)/i, '$1<base href="/app/">'),
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
const photoBundle=await build({entryPoints:[fileURLToPath(new URL('./photo-server.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {registerPhoto}=await import('data:text/javascript;base64,'+Buffer.from(photoBundle.outputFiles[0].text).toString('base64'));
registerPhoto(app,process.env);
app.get('/photo-screen',async(_request,reply)=>{const {nonce}=await (await app.inject({method:'GET',url:'/destinations/session',headers:{host:'127.0.0.1:3100'}})).json();return reply.type('text/html; charset=utf-8').send((await readFile(new URL('photo.html',web),'utf8')).replace('__NONCE__',nonce))});
app.get('/photo.js',async(_request,reply)=>reply.type('text/javascript; charset=utf-8').send(javascript('photo.js')));
for (const [route, file, type] of [
  ['/phone.css', 'phone.css', 'text/css'],
  ['/phone.js', 'phone.js', 'text/javascript'],
  ['/mobile.css', 'mobile.css', 'text/css'],
  ['/module-theme.css', 'module-theme.css', 'text/css'],
  ['/photo.css', 'photo.css', 'text/css'],
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
// Serve the existing project from the same trusted origin as its AI modules.
const appRoot = fileURLToPath(new URL('../../../../dist/', import.meta.url));
const contentTypes = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
app.get('/app/', async (_request,reply) => reply.redirect('/app/index.html'));
app.get('/app/*', async (request,reply) => {
  const path = resolve(appRoot, request.params['*']);
  if (!path.startsWith(resolve(appRoot)+sep)) return reply.code(403).send({message:'路径无效'});
  try { return reply.type(contentTypes[extname(path)] || 'application/octet-stream').send(await readFile(path)); }
  catch { return reply.code(404).send({message:'文件不存在，请先构建项目'}); }
});
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
process.once('SIGINT', () => void app.close());
process.once('SIGTERM', () => void app.close());
try {
  await app.listen({ host: '127.0.0.1', port: 3100 });
  console.log('OOTRIP 项目：http://127.0.0.1:3100/app/index.html');
  console.log('试衣间与穿衣手账均在主页内打开，不弹出新标签页。');
  console.log(`共用现有测试批次，剩余 ${budget.status().remaining}/${budget.limit}；打开网页不会调用AI。`);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? '3100端口已被占用，请先关闭旧的OOTRIP服务后重试。' : '本机服务启动失败（'+(error.code || 'UNKNOWN')+'），请检查运行权限与服务配置。');
  process.exitCode = 1;
}

}
