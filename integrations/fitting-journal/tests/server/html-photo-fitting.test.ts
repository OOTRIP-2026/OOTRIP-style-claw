import Fastify from 'fastify';
import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { registerPhoto } from '../../tools/lucy-demo/photo-server.js';
const env={DASHSCOPE_API_KEY:'test-only',JOURNAL_IMAGE_FREE_ONLY_CONFIRMED:'true',JOURNAL_IMAGE_FREE_QUOTA_EXPIRES:'2099-12-31'};
const image='data:image/jpeg;base64,/9j/AA==',garments='data:image/jpeg;base64,/9j/AQ==';
it('sends clothing reference then person as separate ordered images, never a comparison collage',async()=>{
 const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(768,16);png.writeUInt32BE(1152,20);
 const transport=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({output:{choices:[{finish_reason:'stop',message:{content:[{image:'https://dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com/result.png'}]}}]}}))).mockResolvedValueOnce(new Response(png));
 const app=Fastify();registerPhoto(app,env,transport);
 try{
 const payload={image,garments,consent:true,requestId:randomUUID()};
 expect((await app.inject({method:'POST',url:'/fitting/photo',payload})).statusCode).toBe(200);
 const sent=JSON.parse(String(transport.mock.calls[0]![1]!.body));
 expect(sent.input.messages[0].content.slice(0,2)).toEqual([{image:garments},{image}]);
 expect(sent.input.messages[0].content[2].text).toContain('直接修改图2人物身上的穿着');
 expect(sent.parameters.negative_prompt).toContain('拼贴');
 expect((await app.inject({method:'POST',url:'/fitting/photo',payload})).statusCode).toBe(409);
 expect(transport).toHaveBeenCalledTimes(2);
 }finally{await app.close()}
});
it('rejects missing clothes or consent without calling the provider',async()=>{
 const transport=vi.fn(),app=Fastify();registerPhoto(app,env,transport);
 try{for(const payload of [{image,consent:true,requestId:randomUUID()},{image,garments,consent:false,requestId:randomUUID()}])expect((await app.inject({method:'POST',url:'/fitting/photo',payload})).statusCode).toBe(400);expect(transport).not.toHaveBeenCalled()}finally{await app.close()}
});
