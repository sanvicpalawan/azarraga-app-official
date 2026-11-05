import { expect, test } from "vitest";
import { paginateProductHits } from "../lib/product-search";
import type { ProductSearchHit } from "../lib/product-search-types";
const hits=Array.from({length:1000},(_,i)=>({key:`source:${i}`,kind:"source",name:`900 Series ${i%2?"Door":"Window"}`,description:"Black frame clear glass",category:i%2?"Doors":"Windows",sourceFile:`project-${i}.pdf`,imageUrl:`data:image/png;base64,${i}`} as ProductSearchHit));
test("large libraries return one bounded page of thumbnails",()=>{const result=paginateProductHits(hits,{page:3,pageSize:12});expect(result.total).toBe(1000);expect(result.items).toHaveLength(12);expect(result.items[0].key).toBe("source:24");});
test("all search words and category must match, preserving distinct source variants",()=>{const result=paginateProductHits(hits,{q:"clear 900 black",category:"Doors",pageSize:12});expect(result.total).toBe(500);expect(result.items.every(i=>i.category==="Doors")).toBe(true);});
test("literal wildcard characters do not match unrelated products and invalid pages are bounded",()=>{expect(paginateProductHits(hits,{q:"%_"}).total).toBe(0);expect(paginateProductHits(hits,{page:99999,pageSize:9999}).items.length).toBeLessThanOrEqual(48);});
