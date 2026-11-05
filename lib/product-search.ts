import { getDb, readySchema } from "./db";
import { productMetadata, readyAssistant } from "./assistant/store";
import { getCatalogSnapshot, listProjects } from "./catalog-store";
import { historicalLineSeed } from "./historical-line";
import type { ProductSearchHit, ProductSearchOptions, ProductSearchPage, ProductSearchCategory } from "./product-search-types";

const categoryOf=(name:string):ProductSearchCategory=>/door/i.test(name)?"Doors":/window/i.test(name)?"Windows":"Others";
export function searchOptions(options:ProductSearchOptions){
 const category=["Windows","Doors","Others"].includes(options.category??"")?options.category!:"All";
 return {...options,category,all:options.pageSize==="all",page:Math.max(1,Math.floor(Number(options.page)||1)),pageSize:Math.min(250,Math.max(1,Math.floor(Number(options.pageSize)||50))),tokens:(options.q??"").slice(0,300).trim().toLowerCase().split(/\s+/).filter(Boolean)};
}
export function paginateProductHits(hits:ProductSearchHit[],options:ProductSearchOptions):ProductSearchPage {
 const o=searchOptions(options);const matches=hits.filter(hit=>(o.category==="All"||hit.category===o.category)&&(!o.kind||o.kind==="all"||hit.kind===o.kind)&&(!o.drawingsOnly||Boolean(hit.imageUrl))&&o.tokens.every(token=>[hit.name,hit.description,hit.productType,hit.series,hit.glass,hit.finish,hit.widthMm,hit.heightMm,hit.sourceName,hit.sourceFile,hit.sourceNumber].join(" ").toLowerCase().includes(token)));
 const total=matches.length,pageSize=o.all?Math.max(1,total):o.pageSize,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(o.page,totalPages);
 return {items:matches.slice((page-1)*pageSize,page*pageSize),total,page,pageSize,totalPages};
}

// Filtering/counting happens in Postgres; only the selected page's original images cross the network.
const SEARCH_CTE=`with entries as (
 select 'source:'||fp.id||':'||(it.value->>'id') as key, 'source' as kind,
   coalesce(am.data->>'category',it.value->>'category') as category, fp.id as source_project_id, it.ordinality as position,
   fp.client_name as source_name,fp.file_name as source_file,fp.invoice_number as source_number,fp.invoice_date as source_date,
   substring(fp.notes from E'SOURCE_ITEM_UNITS: ([^\\n]+)') as units_json,
   (fp.notes like '%REVIEW REQUIRED%') as review_required,(it.value || jsonb_strip_nulls(jsonb_build_object('name',am.data->>'name','description',am.data->>'description','category',am.data->>'category','series',nullif(am.data->>'series',''),'glass',nullif(am.data->>'glass',''),'color',nullif(am.data->>'finish',''),'productType',am.data->>'productType','widthM',(am.data->>'widthMm')::numeric/1000,'heightM',(am.data->>'heightMm')::numeric/1000))) as payload,
   concat_ws(' ',it.value->>'name',it.value->>'description',it.value->>'itemCode',it.value->>'series',it.value->>'glass',it.value->>'color',it.value->>'widthM',it.value->>'heightM',round(coalesce(nullif(it.value->>'widthM','')::numeric,0)*1000)::text,round(coalesce(nullif(it.value->>'heightM','')::numeric,0)*1000)::text,fp.client_name,fp.file_name,fp.invoice_number,am.data::text) as search_text,
   coalesce(it.value->>'imageDataUrl','')<>'' as has_image
 from finished_projects fp cross join lateral jsonb_array_elements(fp.items) with ordinality as it(value,ordinality) left join assistant_product_metadata am on am.project_id=fp.id and am.item_id=it.value->>'id'
 union all
 select 'catalog:'||p.id,'catalog',case when lower(c.name) like '%door%' then 'Doors' when lower(c.name) like '%window%' then 'Windows' else 'Others' end,
   null::integer,p.id::bigint,null::text,null::text,null::text,null::text,null::text,false,to_jsonb(p),
   concat_ws(' ',p.name,p.description,c.name),(p.image_key is not null or p.image_path is not null)
 from products p join categories c on c.id=p.category_id
), matches as (select * from entries where ($1='All' or category=$1) and ($2='all' or kind=$2) and (not $4::boolean or has_image)
 and not exists(select 1 from jsonb_array_elements_text($3::jsonb) as needles(token) where strpos(lower(search_text),token)=0))`;

export async function searchProducts(options:ProductSearchOptions):Promise<ProductSearchPage>{
 const o=searchOptions(options);
 if(!process.env.DATABASE_URL){
  const [catalog,projects]=await Promise.all([getCatalogSnapshot(),listProjects({includeFiles:false})]);
  const annotations=await productMetadata();
  const sources:ProductSearchHit[]=projects.flatMap(project=>project.items.map(original=>{const annotation=annotations.find(a=>a.projectId===project.id&&a.id===original.id);const item=annotation?{...original,name:annotation.name,description:annotation.description||original.description,category:annotation.category,series:annotation.series||original.series,glass:annotation.glass||original.glass,color:annotation.finish||original.color,widthM:annotation.widthMm==null?original.widthM:annotation.widthMm/1000,heightM:annotation.heightMm==null?original.heightM:annotation.heightMm/1000}:original;const seed=historicalLineSeed(project,item);return {key:`source:${project.id}:${item.id}`,kind:"source",name:item.name,description:item.description??item.name,category:item.category,imageUrl:item.imageDataUrl??null,widthMm:seed.widthMm,heightMm:seed.heightMm,unitPrice:seed.unitPrice,currency:"PHP",unit:seed.unit,historical:true,sourceProjectId:project.id,sourceItemId:item.id,sourceName:project.clientName,sourceFile:project.fileName,sourceNumber:project.invoiceNumber,sourceDate:project.invoiceDate,reviewRequired:seed.reviewRequired,itemCode:item.itemCode,series:item.series,glass:item.glass,finish:item.color,productType:annotation?.productType};}));
  const products:ProductSearchHit[]=catalog.products.map(product=>({key:`catalog:${product.id}`,kind:"catalog",productId:product.id,name:product.name,description:product.description,category:categoryOf(product.categoryName),imageUrl:product.imageUrl,widthMm:null,heightMm:null,unitPrice:Math.round(product.basePrice*100),currency:"PHP",unit:"set",historical:false,sourceName:null,sourceFile:null,sourceNumber:null,sourceDate:null,reviewRequired:false}));
  return paginateProductHits([...sources,...products],options);
 }
 await readySchema();await readyAssistant();const db=getDb();const parameters=[o.category,o.kind??"all",JSON.stringify(o.tokens),Boolean(o.drawingsOnly)];
 const counts=await db.query(`${SEARCH_CTE} select count(*)::integer as total from matches`,parameters);
 const total=Number(counts[0]?.total??0),pageSize=o.all?Math.max(1,total):o.pageSize,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(o.page,totalPages);
 const rows=await db.query(`${SEARCH_CTE} select * from matches order by kind desc,source_project_id desc nulls last,position limit $5 offset $6`,[...parameters,pageSize,(page-1)*pageSize]);
 const items:ProductSearchHit[]=rows.map(row=>{
  const payload=row.payload as Record<string,unknown>;const source=row.kind==="source";
  let units:Record<string,string>={};try{units=JSON.parse(String(row.units_json??"{}"));}catch{/* No source unit map on older records. */}
  return {key:String(row.key),kind:source?"source":"catalog",name:String(payload.name??"Product"),description:String(payload.description??payload.name??""),category:row.category as ProductSearchCategory,
   imageUrl:source?(payload.imageDataUrl as string??null):payload.image_key?`/api/products/${payload.id}/image`:(payload.image_path as string??null),
   widthMm:source&&payload.widthM!=null?Math.round(Number(payload.widthM)*1000):null,heightMm:source&&payload.heightM!=null?Math.round(Number(payload.heightM)*1000):null,
   unitPrice:Math.round(Number(source?payload.rate??0:payload.base_price??0)*100),currency:"PHP",unit:source?units[String(payload.id)]??"set":"set",historical:source,
   ...(source?{sourceProjectId:Number(row.source_project_id),sourceItemId:String(payload.id)}:{productId:Number(payload.id)}),
   sourceName:row.source_name as string|null,sourceFile:row.source_file as string|null,sourceNumber:row.source_number as string|null,sourceDate:row.source_date as string|null,reviewRequired:Boolean(row.review_required),series:payload.series as string|undefined,glass:payload.glass as string|undefined,finish:payload.color as string|undefined,productType:payload.productType as string|undefined,itemCode:payload.itemCode as string|undefined};
 });
 return {items,total,page,pageSize,totalPages};
}
