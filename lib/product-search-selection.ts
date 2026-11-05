import type { FinishedProject, FinishedProjectItem } from "./catalog-types";
import type { ProductSearchHit } from "./product-search-types";

export function sourceReference(hit:ProductSearchHit):{project:FinishedProject;item:FinishedProjectItem}{
 const item:FinishedProjectItem={id:hit.sourceItemId??hit.key,name:hit.name,description:hit.description,category:hit.category,itemCode:hit.itemCode,widthM:hit.widthMm==null?undefined:hit.widthMm/1000,heightM:hit.heightMm==null?undefined:hit.heightMm/1000,rate:hit.unitPrice==null?undefined:hit.unitPrice/100,imageDataUrl:hit.imageUrl??undefined,series:hit.series,glass:hit.glass,color:hit.finish};
 const project:FinishedProject={id:hit.sourceProjectId??0,projectName:hit.sourceFile??"",clientName:hit.sourceName??"",projectAddress:"",invoiceNumber:hit.sourceNumber??"",invoiceDate:hit.sourceDate??"",totalAmount:0,fileName:hit.sourceFile??"",fileType:"application/pdf",fileSize:0,items:[item],status:"historical",createdAt:"",updatedAt:"",notes:`${hit.reviewRequired?"OWNER REVIEW REQUIRED\n":""}SOURCE_ITEM_UNITS: ${JSON.stringify({[item.id]:hit.unit})}`};
 return {project,item};
}

/** Freeze a catalog drawing onto a document instead of retaining a mutable catalog URL. */
export async function snapshotProductImage(url:string):Promise<string>{
 if(url.startsWith("data:image/png;base64,"))return url;
 const img=new Image();img.crossOrigin="anonymous";
 await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("The product drawing could not be loaded."));img.src=url;});
 const scale=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext("2d")!.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/png");
}
