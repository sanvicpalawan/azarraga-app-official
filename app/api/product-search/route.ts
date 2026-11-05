import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/product-search";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 try{return NextResponse.json(await searchProducts({q:p.get("q")??"",category:p.get("category")??"All",page:Number(p.get("page")),pageSize:p.get("pageSize")==="all"?"all":Number(p.get("pageSize")),kind:p.get("kind")==="source"?"source":p.get("kind")==="catalog"?"catalog":"all",drawingsOnly:p.get("drawingsOnly")==="1"}),{headers:{"cache-control":"no-store"}});}
 catch(error){console.error("Product search failed",error);return NextResponse.json({error:"Could not search products. Please try again."},{status:503});}
}
