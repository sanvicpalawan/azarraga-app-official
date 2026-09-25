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
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [activeProject, setActiveProject] = useState<FinishedProject | null>(null);
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
    setScanMessage(`Uploading & scanning ${files.length} invoice(s)...`);

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
        if (extractRes.ok && extractData.project) {
          // Save project to database / store
          const saveRes = await fetch("/api/projects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(extractData.project),
          });
          const saveData = await saveRes.json();
          if (saveRes.ok && saveData.project) {
            setActiveProject(saveData.project);
          }
        }
      } catch (err) {
        console.error("Error parsing file", file.name, err);
      }
    }

    await refreshProjectsList();
    setScanning(false);
    setScanMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSaveToCatalog = async (item: FinishedProjectItem, project: FinishedProject) => {
    setImportingId(item.id);
    try {
      // 1. Create product in catalog
      const catRes = await fetch("/api/catalog");
      const catData = await catRes.json();
      const category = catData.categories?.find(
        (c: { name: string }) => c.name.toLowerCase() === item.category.toLowerCase(),
      ) || catData.categories?.[0];

      const productPayload = {
        name: item.name,
        categoryId: category ? category.id : 1,
        basePrice: item.rate || 0,
        description: item.description || `Extracted from invoice ${project.invoiceNumber}`,
        defaultSeriesId: null,
        defaultGlassId: null,
        isCustom: true,
        productKey: `INV-${project.invoiceNumber.slice(-4)}-${item.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`,
      };

      const addProdRes = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(productPayload),
      });

      const newProduct = await addProdRes.json();
      if (!addProdRes.ok) throw new Error(newProduct.error || "Failed to add product");

      // 2. If the item has an image, attach it to the product and media library
      if (item.imageDataUrl) {
        let arrayBuffer: ArrayBuffer | null = null;
        let mime = "image/png";

        if (item.imageDataUrl.startsWith("data:")) {
          const parts = item.imageDataUrl.split(",");
          mime = parts[0].split(";")[0].replace("data:", "");
          const binary = atob(parts[1]);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else if (item.imageDataUrl.startsWith("/")) {
          const imgFetch = await fetch(item.imageDataUrl);
          arrayBuffer = await imgFetch.arrayBuffer();
          mime = item.imageDataUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";
        }

        if (arrayBuffer) {
          const mediaRes = await fetch("/api/media", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              filename: `${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.png`,
              contentType: mime,
              sizeBytes: arrayBuffer.byteLength,
              body: Array.from(new Uint8Array(arrayBuffer)),
            }),
          });
          const mediaData = await mediaRes.json();
          if (mediaRes.ok && mediaData.id) {
            await fetch(`/api/products/${newProduct.id}/image`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ mediaId: mediaData.id }),
            });
          }
        }
      }

      await onCatalogUpdated();
      setImportedSuccess(`Saved "${item.name}" to Products! Image linked.`);
      setTimeout(() => setImportedSuccess(null), 4000);
    } catch (err) {
      console.error("Could not import product", err);
      alert("Error adding product to catalog: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImportingId(null);
    }
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
      `${p.projectName} ${p.clientName} ${p.invoiceNumber} ${p.fileName}`
        .toLowerCase()
        .includes(search.toLowerCase());
    if (selectedCategory === "All") return matchesSearch;
    return (
      matchesSearch &&
      p.items.some((i) => i.category.toLowerCase() === selectedCategory.toLowerCase())
    );
  });

  const totalRevenue = projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalItems = projects.reduce((sum, p) => sum + p.items.length, 0);

  return (
    <section className="finished-projects-view">
      {/* Top Banner / Intro */}
      <div className="projects-header-banner">
        <div className="banner-text">
          <div className="badge-pill">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>Finished Projects & Invoice Scanner</span>
          </div>
          <h2>Finished Projects & Invoice Drawing OCR</h2>
          <p>
            Upload completed invoices to automatically scan, OCR, and extract the exact window
            and door drawings. Save them directly into the <strong>Product Catalog</strong> so
            clients and estimators never have to manually redraw or re-upload images for invoices again.
          </p>
        </div>

        <div className="banner-stats">
          <div className="stat-card">
            <span>Stored Projects</span>
            <strong>{projects.length}</strong>
            <small>Completed Invoices</small>
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
          accept=".pdf,image/png,image/jpeg,image/webp"
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
                : "Upload Finished Project Invoices (PDF or Images)"}
            </h3>
            <p>
              Drag and drop invoice files here, or click to browse. Automatically extracts
              window/door drawings, measurements, specs, and totals.
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
            {filteredProjects.length === 0 && (
              <div className="empty-projects-state">
                <FileText className="w-8 h-8 text-slate-300" />
                <p>No invoices found matching &ldquo;{search}&rdquo;</p>
              </div>
            )}

            {filteredProjects.map((p) => {
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
                    <strong>{money.format(p.totalAmount)}</strong>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteProject(activeProject.id)}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Notice Banner */}
              <div className="drawing-help-callout">
                <Wand2 className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <strong>Window & Door Drawings Extracted from Invoice</strong>
                  <p>
                    Each item below was extracted from this invoice with its exact elevation drawing.
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
                            <span>No drawing</span>
                          </div>
                        )}
                        <span className="category-corner-tag">{item.category}</span>
                      </div>

                      {/* Item Details */}
                      <div className="item-info-col">
                        <h5>{item.name}</h5>
                        <p className="item-specs-line">
                          {item.widthFt} × {item.heightFt} ft
                          {item.series && ` · ${item.series}`}
                          {item.glass && ` · ${item.glass}`}
                          {item.color && ` · ${item.color}`}
                        </p>
                        <p className="item-desc">{item.description}</p>

                        <div className="item-price-row">
                          <div>
                            <small>Qty & Rate</small>
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
                            disabled={importingId === item.id}
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
              <h3>Select a Finished Project</h3>
              <p>Choose an invoice from the list or upload a new one to view extracted drawings.</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
