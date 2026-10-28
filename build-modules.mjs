import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('./integrations/fitting-journal/tools/lucy-realtime/package.json', import.meta.url));
const output = new URL('./src/modules/', import.meta.url);
let build;
try { ({ build } = require('esbuild')); } catch (error) {
  if (!['photo-screen.html','fitting-screen.html','journal-screen.html','photo.js','client.js','journal.js','static-api.js'].every(name=>existsSync(new URL(name,output)))) throw error;
  console.log('Using checked-in static module bundles.');
}
if (build) {
 const web = new URL('./integrations/fitting-journal/tools/lucy-demo/web/', import.meta.url);
 mkdirSync(output, { recursive: true });
 for (const file of ['photo.css','style.css','mobile.css','module-theme.css','journal.css']) writeFileSync(new URL(file,output),readFileSync(new URL(file,web)));
 for (const [source,target] of [['photo.html','photo-screen.html'],['index.html','fitting-screen.html'],['journal.html','journal-screen.html']]) {
  const html=readFileSync(new URL(source,web),'utf8').replace(/((?:src|href)=")\/app\/modules\//g,'$1./').replace(/((?:src|href)=")\/(?!\/)/g,'$1./').replace('content="__NONCE__"','content=""').replace('</head>','<script src="./static-api.js"></script></head>');
  writeFileSync(new URL(target,output),html);
 }
 writeFileSync(new URL('static-api.js',output),`(()=>{const original=window.fetch.bind(window);window.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.origin===location.origin&&/^\\/(experiment|fitting|journal|destinations)\\//.test(url.pathname)){const status=url.pathname.endsWith('/status');return Promise.resolve(new Response(JSON.stringify({configured:false,available:false,message:'当前为静态展示，可使用上传、选衣和本机手账；AI功能需要已配置的后端。'}),{status:status?200:503,headers:{'Content-Type':'application/json'}}))}return original(input,options)}})();`);
 await build({entryPoints:['photo.ts','client.ts','journal.ts'].map(file=>fileURLToPath(new URL(file,web))),outdir:fileURLToPath(output),bundle:true,platform:'browser',format:'esm',target:['chrome110','safari17'],nodePaths:[fileURLToPath(new URL('./integrations/fitting-journal/tools/lucy-realtime/node_modules/',import.meta.url))]});
 console.log('Built fitting and journal modules → src/modules');
}
