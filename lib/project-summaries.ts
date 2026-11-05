import { getDb, readySchema } from "./db";
import { listProjects } from "./catalog-store";
export type ProjectSummary={id:number;fileName:string;invoiceNumber:string;hash:string|null;items:number;drawings:number};
export async function listProjectSummaries():Promise<ProjectSummary[]>{
 if(!process.env.DATABASE_URL)return (await listProjects({includeFiles:false})).map(project=>({id:project.id,fileName:project.fileName,invoiceNumber:project.invoiceNumber,hash:project.notes?.match(/(?:Original source SHA256|SOURCE_SHA256):\s*([a-f0-9]+)/)?.[1]??null,items:project.items.length,drawings:project.items.filter(item=>item.imageDataUrl).length}));
 await readySchema();const rows=await getDb().query(`select id,file_name,invoice_number,substring(notes from '(?:Original source SHA256|SOURCE_SHA256):[[:space:]]*([a-f0-9]+)') as hash,jsonb_array_length(items) as item_count,(select count(*) from jsonb_array_elements(items) as item where coalesce(item->>'imageDataUrl','')<>'') as drawing_count from finished_projects order by updated_at desc,id desc`);
 return rows.map(row=>({id:Number(row.id),fileName:String(row.file_name),invoiceNumber:String(row.invoice_number),hash:row.hash as string|null,items:Number(row.item_count),drawings:Number(row.drawing_count)}));
}
