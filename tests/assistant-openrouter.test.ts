import { afterEach, expect, test, vi } from "vitest";
import { freeModels, callFreeModel, parseJsonReply } from "../lib/assistant/openrouter";
const model={id:"sample/window:free",name:"Window model",pricing:{prompt:"0",completion:"0",request:"0",image:"0"},architecture:{input_modalities:["text","image"],output_modalities:["text"]}};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
test("catalogue excludes paid, unknown pricing and non-free variants",()=>{
 expect(freeModels([model,{...model,id:"paid/model",pricing:{prompt:"0",completion:"0"}},{...model,id:"paid/model:free",pricing:{prompt:"0",completion:"0.01"}},{...model,id:"missing:free",pricing:{prompt:"0"}}]).map(m=>m.id)).toEqual([model.id]);
});
test("every inference rechecks the live price and sends zero-price caps without fallback models",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");let request:Record<string,unknown>={};
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
 if(url.endsWith('/models'))return Response.json({data:[model]});request=JSON.parse(String(init?.body));return Response.json({choices:[{message:{content:'{"ok":true}'}}],usage:{cost:0}});
 }));
 expect(await callFreeModel(model.id,"test",[])).toEqual({ok:true});
 expect(request.provider).toMatchObject({max_price:{prompt:0,completion:0,request:0,image:0},allow_fallbacks:false});expect(request.models).toBeUndefined();expect(request.plugins).toBeUndefined();
});
test("a removed or repriced model is blocked before inference",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");const fetcher=vi.fn(async()=>Response.json({data:[{...model,pricing:{prompt:"1",completion:"1"}}]}));vi.stubGlobal("fetch",fetcher);
 await expect(callFreeModel(model.id,"test",[])).rejects.toThrow(/free/i);expect(fetcher).toHaveBeenCalledTimes(1);
});
test("rate limits remain waiting and never invoke a different model",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");const fetcher=vi.fn(async(url:string)=>url.endsWith('/models')?Response.json({data:[model]}):new Response('{}',{status:429,headers:{'retry-after':'120'}}));vi.stubGlobal("fetch",fetcher);
 await expect(callFreeModel(model.id,"test",[])).rejects.toMatchObject({waiting:true,retrySeconds:120});expect(fetcher).toHaveBeenCalledTimes(2);
});
test("invalid model text is rejected instead of used as organization data",()=>{
 expect(parseJsonReply('```json\n{"items":[]}\n```')).toEqual({items:[]});expect(()=>parseJsonReply('do something else')).toThrow();
});
