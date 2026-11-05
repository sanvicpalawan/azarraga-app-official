"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { FinishedProject, FinishedProjectInput, FinishedProjectItem } from "@/lib/catalog-types";
import type { ProjectSummary } from "@/lib/project-summaries";
import { ProductFinder } from "./product-finder";
import { sourceReference } from "@/lib/product-search-selection";
const money=(value:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(value);
const fileHash=(notes?:string)=>notes?.match(/(?:Original source SHA256|SOURCE_SHA256):\s*([a-f0-9]+)/)?.[1];
function Reconciliation({project}:{project:FinishedProjectInput}){
 let totals:{computed?:number;printed?:number;reconciled?:boolean}={};try{totals=JSON.parse(project.notes?.match(/^SOURCE_RECONCILIATION: (.+)$/m)?.[1]||"{}");}catch{/* Source notes from older imports have no structured reconciliation. */}
 return <div className="sl-reconciliation"><strong>{totals.reconciled?"Totals match the source quotation.":"Owner review required: check the original total."}</strong><p>Calculated: {totals.computed==null?"Not available":money(totals.computed)} · Printed: {totals.printed==null?"Not identified":money(totals.printed)}</p></div>;
}
export function StudioSourceLibrary({onDraw,onUse,selectionLabel="Add to document"}:{onDraw?:(item:FinishedProjectItem)=>void;onUse?:(project:FinishedProject,item:FinishedProjectItem)=>void;selectionLabel?:string}){
 const [sources,setSources]=useState<ProjectSummary[]>([]),[pending,setPending]=useState<FinishedProjectInput[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 const picker=useRef<HTMLInputElement>(null);
 useEffect(()=>{const controller=new AbortController();fetch("/api/projects?summary=1",{signal:controller.signal,cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not load source counts.");setSources(data.sources||[]);}).catch(error=>{if(error.name!=="AbortError")setError(error.message);});return()=>controller.abort();},[refresh]);
 async function parseFiles(files:FileList|null){
  if(!files?.length)return;setBusy(true);setError("");setPending([]);const extracted:FinishedProjectInput[]=[];const failures:string[]=[];
  try{const {extractHistoricalPdf}=await import("@/lib/browser-history-extractor");for(const file of Array.from(files)){try{setNotice(`Reading ${file.name}…`);const project=await extractHistoricalPdf(file);const hash=fileHash(project.notes);if(hash&&(sources.some(source=>source.hash===hash)||extracted.some(source=>fileHash(source.notes)===hash))){failures.push(`${file.name}: already imported.`);continue;}extracted.push(project);}catch(error){failures.push(`${file.name}: ${error instanceof Error?error.message:"Could not read PDF."}`);}}setPending(extracted);setNotice(extracted.length?"Review the extracted products and original drawings before saving.":"No new PDFs ready to import.");setError(failures.join(" "));}finally{setBusy(false);if(picker.current)picker.current.value="";}
 }
 async function savePending(){
  setBusy(true);setError("");const remaining=[...pending];let count=0;
  try{for(const project of pending){const response=await fetch("/api/projects",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(project)});if(!response.ok)throw new Error((await response.json()).error||"Could not save source PDF.");remaining.shift();count++;}setNotice(`${count} source PDFs saved to Studio.`);}catch(error){setError(error instanceof Error?error.message:"Could not save source PDF.");}finally{setPending(remaining);setRefresh(value=>value+1);setBusy(false);}
 }
 return <section className="sl-library"><div className="sl-library-intro"><div><h2>Your quotation library</h2><p>Original drawings and specifications, with editable prices for each new project.</p></div><button type="button" className="sl-primary" disabled={busy} onClick={()=>picker.current?.click()}>{busy?"Reading PDFs…":"Import quotation PDFs"}</button><input hidden multiple type="file" accept="application/pdf,.pdf" ref={picker} onChange={event=>void parseFiles(event.target.files)}/></div>
 <div className="sl-metrics"><div><strong>{sources.length}</strong><span>Source documents</span></div><div><strong>{sources.reduce((sum,source)=>sum+source.items,0)}</strong><span>Reusable products</span></div><div><strong>{sources.reduce((sum,source)=>sum+source.drawings,0)}</strong><span>Original drawings</span></div><p>Choose 50, 100, 250 or all products. Original documents stay unchanged.</p></div>
 {notice&&<p role="status" className="sl-notice">{notice}</p>}{error&&<p role="alert" className="sl-error">{error}</p>}
 {pending.length>0&&<section className="sl-review" aria-label="Review PDF import"><h3>Review your import</h3>{pending.map((project,index)=><article key={`${project.fileName}-${index}`}><strong>{project.fileName}</strong><p>{project.clientName} · {project.invoiceNumber} · {project.invoiceDate}</p><p>{project.items.length} items · {project.items.filter(item=>item.imageDataUrl).length} drawings · {money(project.totalAmount)}</p><Reconciliation project={project}/><details><summary>Check extracted products and drawings</summary><div className="sl-review-items">{project.items.map(item=><div className="sl-review-item" key={item.id}><div className="sl-review-thumb">{item.imageDataUrl?<img src={item.imageDataUrl} alt={`Original drawing ${item.itemCode??""}`} loading="lazy"/>:<span>No drawing in source</span>}</div><div><strong>{item.itemCode} {item.name}</strong><p>{item.description}</p><p>{item.widthM??"?"} × {item.heightM??"?"} m · Qty {item.quantity} · {money(item.rate??0)}</p></div></div>)}</div></details></article>)}<div className="sl-review-actions"><button type="button" className="sl-primary" disabled={busy} onClick={()=>void savePending()}>Save to Studio</button><button type="button" disabled={busy} onClick={()=>setPending([])}>Cancel import</button></div></section>}
 <ProductFinder embedded kind="source" refreshKey={refresh} selectionLabel={selectionLabel} onChoose={onUse?hit=>{const reference=sourceReference(hit);onUse(reference.project,reference.item);}:undefined} onDraw={onDraw?hit=>onDraw(sourceReference(hit).item):undefined}/>
 </section>;
}
