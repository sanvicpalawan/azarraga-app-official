import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { validateOrganizations, activateAssistant, saveAssistantKey, assistantStatus, applyJob, runNextJob } from "../lib/assistant/service";
import { patchConfig, readConfig, enqueueProject, listJobs, productMetadata, sourceFingerprint, saveJob } from "../lib/assistant/store";
import { saveProject, getProject } from "../lib/catalog-store";
beforeEach(async()=>{vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");for(const job of await listJobs()) if(["waiting","processing","failed"].includes(job.status)) await saveJob({...job,status:"discarded"});await patchConfig({encryptedKey:"",testedAt:null,testedModel:"",keyFingerprint:"",connection:"inactive",autoImports:false});});
const item={id:"W1",name:"Sliding window",description:"900 Series clear glass",category:"Windows" as const,widthM:1.2,heightM:1.5,rate:5000,imageDataUrl:"data:image/png;base64,aA=="};
const proposal={id:"W1",name:"Sliding window",category:"Windows",productType:"Sliding window",series:"900",glass:"Clear",finish:"",widthMm:1200,heightMm:1500,needsReview:false,notes:""};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
test("organization cannot add foreign items or change financial fields",()=>{
 expect(()=>validateOrganizations({items:[{...proposal,rate:1}]},[item])).toThrow();
 expect(()=>validateOrganizations({items:[{...proposal,id:"OTHER"}]},[item])).toThrow();
 expect(validateOrganizations({items:[{...proposal,widthMm:1300}]},[item])[0].needsReview).toBe(true);
});
test("selection never becomes green without a successful extraction test",async()=>{
 vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");vi.stubEnv("OPENROUTER_API_KEY","");await patchConfig({selectedModel:"test:free",testedAt:null,testedModel:"",connection:"inactive"});
 expect((await assistantStatus()).connection).not.toBe("active");await expect(activateAssistant()).rejects.toThrow(/API key/);expect((await readConfig()).connection).toBe("error");
});
test("organization is a separate overlay: drawings, source prices and documents stay intact",async()=>{
 vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");
 const source=await saveProject({projectName:"AI QA",clientName:"Owner",projectAddress:"",invoiceNumber:"QA",invoiceDate:"2026-11-05",totalAmount:5000,fileName:"qa.pdf",fileType:"application/pdf",fileSize:1,items:[item],status:"historical"});
 await enqueueProject(source);await enqueueProject(source);
 const jobs=(await listJobs()).filter(j=>j.projectId===source.id);expect(jobs).toHaveLength(1);
 const job={...jobs[0],status:"ready" as const,cursor:1,proposals:validateOrganizations({items:[proposal]},source.items)};await saveJob(job);await applyJob(job.id);
 expect((await productMetadata()).find(m=>m.projectId===source.id)?.series).toBe("900");
 expect((await getProject(source.id))?.items[0]).toEqual(item);
 const changed=await saveProject({...source,items:[{...item,rate:6000}]});expect(sourceFingerprint(changed)).not.toBe(job.fingerprint);await expect(applyJob(job.id)).rejects.toThrow(/changed/);
});
test("unconfigured assistant leaves queued work untouched",async()=>{
 vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");vi.stubEnv("OPENROUTER_API_KEY","");await patchConfig({testedAt:null,connection:"inactive"});
 await expect(runNextJob()).rejects.toThrow();expect((await listJobs()).some(j=>j.status==="processing")).toBe(false);
});

test("admin key is encrypted at rest and omitted from all public status responses",async()=>{
 const secret="sk-or-test-private-key-123456789";await saveAssistantKey(secret);
 const stored=await readConfig();expect(stored.encryptedKey).not.toContain(secret);expect(stored.encryptedKey).toMatch(/^v1:/);
 const status=await assistantStatus();expect(status.keyConfigured).toBe(true);expect(JSON.stringify(status)).not.toContain(secret);expect(status).not.toHaveProperty("encryptedKey");expect(status.connection).not.toBe("active");
});
test("green activation requires a valid live extraction result",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");await patchConfig({selectedModel:"test/window:free"});
 vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.endsWith('/models')?Response.json({data:[{id:"test/window:free",name:"Free",pricing:{prompt:"0",completion:"0"},architecture:{input_modalities:["text"],output_modalities:["text"]}}]}):Response.json({choices:[{message:{content:JSON.stringify({items:[{...proposal,id:"activation-window"}]})}}],usage:{cost:0}})));
 await activateAssistant();expect((await assistantStatus()).connection).toBe("active");
 vi.stubEnv("OPENROUTER_API_KEY","different-key");expect((await assistantStatus()).connection).toBe("inactive");
});

test("six real source items resume across batches and remain unchanged when labels are applied",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");const model={id:"batch/window:free",name:"Free",vision:false,contextLength:32000};await patchConfig({selectedModel:model.id,models:[model]});
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/models'))return Response.json({data:[{...model,pricing:{prompt:"0",completion:"0"},architecture:{input_modalities:["text"],output_modalities:["text"]}}]});
  const request=JSON.parse(String(init?.body));const input=JSON.parse(request.messages[1].content[0].text);
  return Response.json({choices:[{message:{content:JSON.stringify({items:input.items.map((i:{id:string;widthMm:number;heightMm:number})=>({...proposal,id:i.id,widthMm:i.widthMm,heightMm:i.heightMm}))})}}],usage:{cost:0}});
 }));
 await activateAssistant();
 const source=await saveProject({projectName:"Batch QA",clientName:"Owner",projectAddress:"",invoiceNumber:"QA",invoiceDate:"2026-11-05",totalAmount:30000,fileName:"batch.pdf",fileType:"application/pdf",fileSize:1,items:Array.from({length:6},(_,index)=>({...item,id:`W${index+1}`})),status:"historical"});
 await enqueueProject(source);const first=await runNextJob();expect(first?.cursor).toBe(5);expect(first?.status).toBe("waiting");
 const second=await runNextJob();expect(second?.cursor).toBe(6);expect(second?.status).toBe("review");expect(second?.proposals[0].similar.length).toBeGreaterThan(0);
 await applyJob(second!.id);expect((await getProject(source.id))?.items).toEqual(source.items);expect((await productMetadata()).filter(m=>m.projectId===source.id)).toHaveLength(6);
});

test("invalid document fields do not mark a healthy connection offline or block the next document",async()=>{
 vi.stubEnv("OPENROUTER_API_KEY","test-key");const model={id:"quality/window:free",name:"Free",vision:false,contextLength:32000};await patchConfig({selectedModel:model.id,models:[model]});
 vi.stubGlobal("fetch",vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/models'))return Response.json({data:[{...model,pricing:{prompt:"0",completion:"0"},architecture:{input_modalities:["text"],output_modalities:["text"]}}]});
  const input=JSON.parse(JSON.parse(String(init?.body)).messages[1].content[0].text);
  return Response.json({choices:[{message:{content:JSON.stringify({items:input.items.map((i:{id:string;widthMm:number;heightMm:number})=>({...proposal,id:i.id,category:input.file==='uncertain.pdf'?'UNKNOWN':'Windows',widthMm:i.widthMm,heightMm:i.heightMm}))})}}],usage:{cost:0}});
 }));
 await activateAssistant();
 for(const fileName of ['uncertain.pdf','valid.pdf']){const source=await saveProject({projectName:fileName,clientName:'Owner',projectAddress:'',invoiceNumber:'QA',invoiceDate:'2026-11-05',totalAmount:5000,fileName,fileType:'application/pdf',fileSize:1,items:[item],status:'historical'});await enqueueProject(source);}
 const first=await runNextJob();expect(first?.status).toBe('failed');expect(first?.error).toContain('category');expect((await assistantStatus()).connection).toBe('active');
 expect((await runNextJob())?.cursor).toBe(1);
});
