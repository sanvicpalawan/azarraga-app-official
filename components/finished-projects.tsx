"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderArchive,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FinishedProject, FinishedProjectItem } from "@/lib/catalog-types";
import type { Quotation } from "@/lib/catalog-store-types";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

type Props = {
  onUseInConfigure: (item: {
    productName: string;
    category: string;
    width: number;
    height: number;
    rate: number;
    series?: string;
    glass?: string;
    color?: string;
    lock?: string;
    description?: string;
    imageUrl?: string;
  }) => void;
  onCatalogUpdated: () => Promise<void>;
};

export function FinishedProjectsScreen({ onUseInConfigure, onCatalogUpdated }: Props) {
  const [projects, setProjects] = useState<FinishedProject[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quotation[]>([]);
  const [historyTab, setHistoryTab] = useState<"saved" | "imported">("saved");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [activeProject, setActiveProject] = useState<FinishedProject | null>(null);
  const [pendingProjects, setPendingProjects] = useState<FinishedProject[]>([]);
  const [importError, setImportError] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedSuccess, setImportedSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (!ignore && res.ok && data.projects) {
          setProjects(data.projects);
          setActiveProject((curr) => curr ?? (data.projects[0] || null));
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      }
    }
    void load();
    void fetch("/api/quotations").then(res=>res.json()).then(data=>{
      if (!ignore && Array.isArray(data.quotations)) setSavedQuotes(data.quotations);
    }).catch(err=>console.error("Failed to load saved quotes",err));
    return () => {
      ignore = true;
    };
  }, []);

  const refreshProjectsList = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (res.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error("Failed to refresh projects", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setScanning(true);
    setImportError("");
    setScanMessage(`Uploading & scanning ${files.length} invoice(s)...`);
    const extracted: FinishedProject[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setScanMessage(`Scanning ${file.name} (document ${i + 1} of ${files.length})...`);

      try {
        const fileDataUrl = await readFileAsDataUrl(file);

        // Call extraction endpoint
        const extractRes = await fetch("/api/projects/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/pdf",
            fileSize: file.size,
            fileData: fileDataUrl,
          }),
        });

        const extractData = await extractRes.json();
        if (extractRes.ok && extractData.projects?.length) {
          for (const project of extractData.projects) extracted.push({ ...project, id: -(extracted.length + 1) });
        } else {
          setImportError(prev => prev + `${file.name}: ${extractData.error || "Could not extract invoice."}\n`);
        }
      } catch (err) {
        console.error("Error parsing file", file.name, err);
        setImportError(prev => prev + `${file.name}: ${err instanceof Error ? err.message : "Upload failed."}\n`);
      }
    }
    if (extracted.length) {
      setPendingProjects(extracted);
      setActiveProject(extracted[0]);
    }
    setScanning(false);
    setScanMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const editPendingItem = (id: string, changes: Partial<FinishedProjectItem>) => {
    setPendingProjects(previous => {
      const next = previous.map((project, i) => i ? project : {
        ...project,
        items: project.items.map(item => item.id === id ? { ...item, ...changes } : item),
      });
      setActiveProject(next[0]);
      return next;
    });
  };

  const saveReviewedProject = async () => {
    const project = pendingProjects[0];
    if (!project) return;
    const options = [...new Set(project.items.map(item => item.quoteOption || 1))];
    const subtotal = project.items.reduce((sum,item) => sum + (item.total || 0),0);
    const delivery = Number(project.notes?.match(/Delivery: ₱([\d.]+)/)?.[1] || 0);
    const existingProject = projects.find(saved => saved.invoiceNumber === project.invoiceNumber && saved.fileName === project.fileName);
    const revised = { ...project, id: existingProject?.id,
      totalAmount: project.notes?.includes("No grand total printed") ? 0 : subtotal + delivery };
    if (!project.items.length || project.items.some(item => !item.name || !item.quantity || !item.rate)) {
      setImportError("Each line needs a name, quantity, and historical unit price before saving.");
      return;
    }
    setScanning(true);
    try {
      const response = await fetch("/api/projects", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(revised) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the reviewed quotation.");
      await refreshProjectsList();
      const remaining = pendingProjects.slice(1);
      setPendingProjects(remaining);
      setActiveProject(remaining[0] || data.project);
      setImportedSuccess(`Saved ${project.items.length} original items from ${options.length} quote option(s). Historical prices retained.`);
      setImportError("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not save quotation.");
    } finally { setScanning(false); }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const [savingAll, setSavingAll] = useState(false);

  const handleSaveAll = async (project: FinishedProject) => {
    setSavingAll(true);
    let ok = 0;
    const failed: string[] = [];
    for (const item of project.items) {
      if (await handleSaveToCatalog(item, project, true)) ok++;
      else failed.push(item.name);
    }
    await onCatalogUpdated();
    setSavingAll(false);
    setImportedSuccess(`Saved ${ok} of ${project.items.length} size variants to Products; original drawings attached where present.`);
    setTimeout(() => setImportedSuccess(null), 5000);
    if (failed.length) alert("Could not save: " + failed.join(", "));
  };

  const handleSaveToCatalog = async (item: FinishedProjectItem, project: FinishedProject, bulk = false): Promise<boolean> => {
    setImportingId(item.id);
    try {
      // 1. Create product in catalog
      const catRes = await fetch("/api/catalog");
      const catData = await catRes.json();
      const category = catData.categories?.find(
        (c: { name: string }) => c.name.toLowerCase() === item.category.toLowerCase(),
      ) || catData.categories?.[0];

      const productPayload = {
        name: `${item.name}${item.widthM && item.heightM ? ` — ${item.widthM} × ${item.heightM} m` : ""}`,
        categoryId: category ? category.id : 1,
        basePrice: 0,
        description: `${item.description || item.name} · Historical price ${money.format(item.rate || 0)}/set for ${project.clientName}, ${project.invoiceNumber}, ${project.invoiceDate}. Check current pricing before quoting.`,
        defaultSeriesId: null,
        defaultGlassId: null,
      };

      const addProdRes = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(productPayload),
      });

      const newProduct = await addProdRes.json();
      let productId = newProduct.id as number;
      if (!addProdRes.ok) {
        // Same family and measurements were already imported. Use that catalog entry.
        const existing = catData.products?.find((p: {id:number,name:string,categoryId:number}) =>
          p.name === productPayload.name && p.categoryId === productPayload.categoryId);
        if (existing) productId = existing.id;
        else
        throw new Error(newProduct.error || "Failed to add product");
      }

      // 2. If the item has an image, attach it to the product and media library
      if (item.imageDataUrl) {
        const response = await fetch(item.imageDataUrl);
        const blob = await response.blob();
        const form = new FormData();
        const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
        form.append("image", new File([blob], `${item.itemCode || "drawing"}.${ext}`, {type:blob.type || "image/png"}));
        const uploaded = await fetch(`/api/products/${productId}/image`, { method:"POST",body:form });
        if (!uploaded.ok) throw new Error("Product created, but its original invoice drawing could not be attached.");
      }

      if (!bulk) {
        await onCatalogUpdated();
        setImportedSuccess(`Saved "${item.name}" to Products${item.imageDataUrl ? " with its source drawing" : ""}.`);
        setTimeout(() => setImportedSuccess(null), 4000);
      }
      return true;
    } catch (err) {
      console.error("Could not import product", err);
      if (bulk) return false;
      alert("Error adding product to catalog: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImportingId(null);
    }
    return false;
  };

  const handleUseInConfigure = (item: FinishedProjectItem) => {
    onUseInConfigure({
      productName: item.name,
      category: item.category,
      width: item.widthFt || 8,
      height: item.heightFt || 5,
      rate: item.rate || 0,
      series: item.series,
      glass: item.glass,
      color: item.color,
      lock: item.lock,
      description: item.description,
      imageUrl: item.imageDataUrl,
    });
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Are you sure you want to remove this finished project?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProject?.id === id) {
          setActiveProject(projects.find((p) => p.id !== id) || null);
        }
      }
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      `${p.projectName} ${p.clientName} ${p.invoiceNumber} ${p.fileName} ${p.items.map(item=>item.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase());
    if (selectedCategory === "All") return matchesSearch;
    return (
      matchesSearch &&
      p.items.some((i) => i.category.toLowerCase() === selectedCategory.toLowerCase())
    );
  });
  const visibleProjects = pendingProjects.length ? [pendingProjects[0], ...filteredProjects] : filteredProjects;

  const totalRevenue = projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalItems = projects.reduce((sum, p) => sum + p.items.length, 0);

  return (
    <section className="finished-projects-view">
      <div className="admin-tabs" role="tablist" aria-label="Project records">
        <button role="tab" aria-selected={historyTab==="saved"} className={historyTab==="saved"?"active":""} onClick={()=>setHistoryTab("saved")}>Saved Quotes ({savedQuotes.length})</button>
        <button role="tab" aria-selected={historyTab==="imported"} className={historyTab==="imported"?"active":""} onClick={()=>setHistoryTab("imported")}>Imported PDFs ({projects.length})</button>
      </div>
      {historyTab==="saved" ? (
        <div className="admin-stack">
          <div className="admin-card"><h2>Saved Quotes</h2><p>Quotes created in New Quote are stored here by customer and project.</p></div>
          {savedQuotes.length ? savedQuotes.map(quote=>(
            <article className="admin-card" key={quote.id}>
              <div className="project-detail-header">
                <div><strong>{quote.customerName} · {quote.quotationNumber}</strong><p>{quote.projectName} · {quote.projectAddress}</p></div>
                <strong>{money.format(quote.grandTotal)}</strong>
              </div>
              <p>{quote.item.productName} · {quote.item.width} × {quote.item.height} ft · Qty {quote.item.quantity} · {money.format(quote.item.rate)} {quote.item.pricingMethod==="sqft"?"per sq. ft.":"per set"}</p>
              <small>Saved {new Date(quote.createdAt).toLocaleDateString("en-PH")}</small>
            </article>
          )) : <div className="admin-card">No quotes saved yet. Make a quote in New Quote, then select Save Draft.</div>}
        </div>
      ) : (<>
      {/* Top Banner / Intro */}
      <div className="projects-header-banner">
        <div className="banner-text">
          <div className="badge-pill">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>Historical PDF Records</span>
          </div>
          <h2>Historical Quotations & Product Drawings</h2>
          <p>
            Import past PDF quotations, check every line and its original drawing, then save
            the records. Historical prices require review before a new quote.
          </p>
        </div>

        <div className="banner-stats">
          <div className="stat-card">
            <span>Imported PDFs</span>
            <strong>{projects.length}</strong>
            <small>Historical quotations</small>
          </div>
          <div className="stat-card">
            <span>Extracted Products</span>
            <strong>{totalItems}</strong>
            <small>Drawings Ready</small>
          </div>
          <div className="stat-card">
            <span>Total Invoiced</span>
            <strong>{money.format(totalRevenue)}</strong>
            <small>All Finished Works</small>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className="invoice-dropzone"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="dropzone-content">
          <div className="icon-circle">
            {scanning ? (
              <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8 text-sky-600" />
            )}
          </div>
          <div>
            <h3>
              {scanning
                ? scanMessage
                : "Upload Historical PDF Quotations"}
            </h3>
            <p>
              Select text-based PDFs to review product drawings, dimensions, prices, and totals before saving.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            disabled={scanning}
            className="upload-trigger-btn"
          >
            {scanning ? "Scanning…" : "Select Invoices"}
          </Button>
        </div>
      </div>

      {importedSuccess && (
        <div className="success-banner" role="status">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{importedSuccess}</span>
        </div>
      )}
      {importError && <div className="drawing-help-callout" role="alert" style={{whiteSpace:"pre-wrap",color:"#9f1239"}}>{importError}</div>}
      {pendingProjects.length > 0 && (
        <div className="drawing-help-callout" role="status">
          Review ${pendingProjects.length} invoice(s) before saving. The PDF is not in your database yet.
          {pendingProjects.length > 1 && " The next invoice opens after you confirm this one."}
        </div>
      )}

      {/* Main Grid: Projects List + Invoice Detail & Extracted Items */}
      <div className="projects-workspace-grid">
        {/* Left Column: Project Invoices List */}
        <aside className="projects-sidebar-list">
          <div className="list-toolbar">
            <div className="search-wrap">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search invoices, clients, files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="category-filter-chips">
              {["All", "Windows", "Doors"].map((cat) => (
                <button
                  key={cat}
                  className={`filter-chip ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="projects-scroll-list">
            {visibleProjects.length === 0 && (
              <div className="empty-projects-state">
                <FileText className="w-8 h-8 text-slate-300" />
                <p>No invoices found matching &ldquo;{search}&rdquo;</p>
              </div>
            )}

            {visibleProjects.map((p) => {
              const isSelected = activeProject?.id === p.id;
              return (
                <article
                  key={p.id}
                  className={`project-list-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setActiveProject(p)}
                >
                  <div className="card-top-row">
                    <span className="invoice-tag">{p.invoiceNumber || "INVOICE"}</span>
                    <span className="date-tag">{p.invoiceDate}</span>
                  </div>
                  <h4>{p.projectName}</h4>
                  <p className="client-line">
                    <strong>Client:</strong> {p.clientName || "Walk-in"}
                  </p>

                  <div className="card-item-previews">
                    {p.items.map((it) => (
                      <span key={it.id} className="thumb-preview" title={it.name}>
                        {it.imageDataUrl ? (
                          <img src={it.imageDataUrl} alt={it.name} />
                        ) : (
                          <ImageIcon className="w-3 h-3 text-slate-400" />
                        )}
                      </span>
                    ))}
                    <span className="items-count">
                      {p.items.length} {p.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="card-footer-row">
                    <strong>{p.notes?.includes("No grand total printed") ? "No total printed" : money.format(p.totalAmount)}</strong>
                    <span className="status-pill">{p.status}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Active Project Details & Extracted Drawings */}
        <main className="active-project-details">
          {activeProject ? (
            <div className="project-detail-content">
              {/* Project Title Bar */}
              <div className="project-detail-header">
                <div>
                  <div className="header-meta">
                    <span className="invoice-id-badge">{activeProject.invoiceNumber}</span>
                    <span className="file-name-badge">
                      <FileText className="w-3.5 h-3.5 text-sky-600" />
                      {activeProject.fileName}
                    </span>
                  </div>
                  <h3>{activeProject.projectName}</h3>
                  <p className="detail-client-address">
                    <strong>{activeProject.clientName}</strong> · {activeProject.projectAddress}
                  </p>
                </div>

                <div className="header-project-actions">
                  {pendingProjects.length > 0 && activeProject.id === pendingProjects[0].id && (
                    <Button size="sm" disabled={scanning} onClick={saveReviewedProject}>
                      {scanning ? "Saving…" : "Confirm & Save Reviewed Invoice"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={savingAll || activeProject.items.length === 0 || activeProject.id < 0}
                    onClick={() => handleSaveAll(activeProject)}
                  >
                    {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save All ({activeProject.items.length}) to Catalog
                  </Button>
                  {activeProject.id > 0 && <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProject(activeProject.id)}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>}
                </div>
              </div>

              {/* Notice Banner */}
              <div className="drawing-help-callout">
                <Wand2 className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <strong>Window & Door Drawings Extracted from Invoice</strong>
                  <p>
                    Drawings shown below are cropped from the original PDF beside their line items.
                    Empty cells stay empty until you attach a source image.
                    Click <strong>&ldquo;Save to Products&rdquo;</strong> to add it to your catalog
                    and image library so it shows automatically in the quotation table.
                  </p>
                </div>
              </div>

              {/* Line Items Table with Drawings */}
              <div className="extracted-items-container">
                <h4>Extracted Windows & Doors ({activeProject.items.length})</h4>

                <div className="items-cards-grid">
                  {activeProject.items.map((item) => (
                    <div key={item.id} className="extracted-item-card">
                      {/* Image Box */}
                      <div className="item-drawing-box">
                        {item.imageDataUrl ? (
                          <img
                            src={item.imageDataUrl}
                            alt={`${item.name} elevation`}
                            className="drawing-img"
                          />
                        ) : (
                          <div className="no-drawing">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                            <span>No artwork in this PDF row</span>
                          </div>
                        )}
                        <span className="category-corner-tag">{item.category}</span>
                      </div>

                      {/* Item Details */}
                      <div className="item-info-col">
                        <h5>{item.itemCode && `${item.itemCode} · `}{item.name}{item.quoteOption && <small> · Option {item.quoteOption}</small>}</h5>
                        {activeProject.id < 0 && (
                          <div style={{display:"grid",gap:8,margin:"10px 0"}}>
                            {!item.imageDataUrl && <label>Attach a source drawing, if available
                              <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{
                                const image=e.target.files?.[0];
                                if (image) editPendingItem(item.id,{imageDataUrl:await readFileAsDataUrl(image)});
                              }} />
                            </label>}
                            <Input aria-label="Product name" value={item.name} onChange={e=>editPendingItem(item.id,{name:e.target.value})} />
                            <Input aria-label="Full invoice description" value={item.description || ""} onChange={e=>editPendingItem(item.id,{description:e.target.value})} />
                            <div style={{display:"flex",gap:6}}>
                              <Input aria-label="Quantity" type="number" min="1" value={item.quantity || ""} onChange={e=>{ const quantity=Number(e.target.value); editPendingItem(item.id,{quantity,total:quantity*(item.rate||0)}); }} />
                              <Input aria-label="Historical unit price" type="number" min="0" step=".01" value={item.rate || ""} onChange={e=>{ const rate=Number(e.target.value); editPendingItem(item.id,{rate,total:rate*(item.quantity||0)}); }} />
                            </div>
                          </div>
                        )}
                        <p className="item-specs-line">
                          {item.widthM && item.heightM ? `${item.widthM} × ${item.heightM} m` : "Dimensions: review source PDF"}
                          {item.series && ` · ${item.series}`}
                          {item.glass && ` · ${item.glass}`}
                          {item.color && ` · ${item.color}`}
                        </p>
                        <p className="item-desc">{item.description}</p>
                        {projects.flatMap(p=>p.items
                          .filter(saved=>saved.name===item.name && saved.widthM===item.widthM && saved.heightM===item.heightM)
                          .map(saved=>({account:p.clientName,quote:p.invoiceNumber,date:p.invoiceDate,rate:saved.rate})))
                          .filter(ref=>ref.quote!==activeProject.invoiceNumber)
                          .slice(0,5).map((ref,refIndex)=>(
                            <p key={`${ref.quote}-${refIndex}`} className="item-desc">
                              Previous account: {ref.account} · {ref.quote} · {ref.date} · {money.format(ref.rate || 0)} per set
                            </p>
                          ))}

                        <div className="item-price-row">
                          <div>
                            <small>Historical price · {item.sourceAccountName || activeProject.clientName}</small>
                            <strong>
                              {item.quantity} × {money.format(item.rate || 0)}
                            </strong>
                          </div>
                          <div className="text-right">
                            <small>Item Total</small>
                            <strong className="text-sky-800">
                              {money.format(item.total || 0)}
                            </strong>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="item-actions-row">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={importingId === item.id || activeProject.id < 0}
                            onClick={() => handleSaveToCatalog(item, activeProject)}
                            className="save-catalog-btn"
                          >
                            {importingId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4" />
                            )}
                            Save to Products
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={activeProject.id < 0}
                            onClick={() => handleUseInConfigure(item)}
                          >
                            <ArrowRight className="w-4 h-4" />
                            Use in Quote
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-detail-placeholder">
              <FolderArchive className="w-12 h-12 text-slate-300" />
              <h3>Select an imported quotation</h3>
              <p>Choose an invoice from the list or upload a new one to view extracted drawings.</p>
            </div>
          )}
        </main>
      </div>
      </>)}
    </section>
  );
}
