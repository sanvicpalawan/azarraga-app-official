"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";
import { DataOrganizer } from "./assistant-panel";
import { StudioSourceLibrary } from "./studio-source-library";
import { blankDesign, rescale, type Design } from "./designer/designer-core";
import type { FinishedProjectItem } from "@/lib/catalog-types";
import "./studio-source-library.css";
const DesignerScreen = dynamic(() => import("./designer/DesignerScreen"), { loading: () => <p>Opening drawing tools…</p> });
export function StudioWorkspace() {
    const [view, setView] = useState("sources");
    const [reference, setReference] = useState<{
        initial: Design;
        image?: string;
    }>();
    const fromSource = (item: FinishedProjectItem) => { const blank = blankDesign(); const initial = rescale(blank, item.widthM ? Math.round(item.widthM * 1000) : blank.widthMm, item.heightM ? Math.round(item.heightM * 1000) : blank.heightMm); setReference({ initial: { ...initial, shapes: [], name: item.name, code: item.itemCode || "", description: item.description || item.name, section: item.category, series: item.series || "" }, image: item.imageDataUrl }); setView("draw"); };
    return <div className="sl-workspace"><header className="sl-heading"><div><div className="sl-eyebrow">AZARRAGA · PRODUCT WORKSPACE</div><h1>Design Studio<span>.</span></h1><p>Real drawings. Proven details. Ready for your next project.</p></div><div className="sl-stamp"><span>BUILT FROM</span><strong>Your work</strong><span>DRAWINGS & QUOTATIONS</span></div></header><nav className="sl-tabs" aria-label="Studio views"><button type="button" aria-current={view === "sources" ? "page" : undefined} onClick={() => setView("sources")}>01 <span>From real quotations</span></button><button type="button" aria-current={view === "draw" ? "page" : undefined} onClick={() => { setReference(undefined); setView("draw"); }}>02 <span>Draw product</span></button></nav>{view === "sources" ? <><div style={{marginBottom:16}}><Link className="btn" href="/admin/assistant">Data Assistant settings</Link></div><StudioSourceLibrary onDraw={fromSource}/><DataOrganizer compact/></> : <section>{reference && <div className="sl-reference-note"><strong>Draw from the original reference</strong><p>The source image stays beside your canvas. Draw panels and symbols yourself; the original picture is not an editable drawing. Save to Products to reuse your finished design.</p></div>}<DesignerScreen key={reference?.initial.id || "new"} initial={reference?.initial} referenceImage={reference?.image}/></section>}</div>;
}
