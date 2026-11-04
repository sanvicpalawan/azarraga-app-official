"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/db/schema";

const empty = { id: undefined as string | undefined, name: "", phone: "", email: "", address: "" };
export function CustomerManager({ customers }: { customers: Client[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  return <div className="editor-grid"><div className="doc-list"><label className="field">Find a customer<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone or email" /></label>
    {customers.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(search.toLowerCase())).map((c) => <article className="card" key={c.id}>
      <h2>{c.name}</h2><p className="page-sub">{[c.phone,c.email,c.address].filter(Boolean).join(" · ") || "No contact details yet"}</p>
      <div className="header-actions-inline" style={{ marginTop:12 }}><Link className="btn btn--primary" href={`/quotes/new?customer=${c.id}`}>New quotation</Link><button className="btn" onClick={() => setForm({ id:c.id,name:c.name,phone:c.phone??"",email:c.email??"",address:c.address??"" })}>Edit customer</button></div>
    </article>)}
    {!customers.length && <div className="empty-state">Add a customer once, then reuse their details on future quotes.</div>}
  </div><form className="card" onSubmit={async(e) => { e.preventDefault();setBusy(true);setNotice("");try { const res=await fetch("/api/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const result=await res.json();if(!res.ok)throw new Error(result.error);setForm(empty);setNotice("Customer saved.");router.refresh();} catch(error){setNotice((error as Error).message);}finally{setBusy(false);} }}>
    <h2>{form.id ? "Edit customer" : "New customer"}</h2>
    <div className="field-grid">{(["name","phone","email","address"] as const).map((key)=><label className="field field--span" key={key}>{key === "name" ? "Customer name *" : key[0].toUpperCase()+key.slice(1)}<input required={key==="name"} type={key==="email"?"email":"text"} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} /></label>)}</div>
    {notice && <p role="status">{notice}</p>}<div className="header-actions-inline" style={{marginTop:16}}><button className="btn btn--primary" disabled={busy}>{busy?"Saving…":"Save customer"}</button>{form.id&&<button type="button" className="btn" onClick={()=>setForm(empty)}>Cancel</button>}</div>
  </form></div>;
}
