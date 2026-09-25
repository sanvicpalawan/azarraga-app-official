"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, ImageIcon, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Attribute, Catalog, Product } from "@/lib/catalog-types";
import type { MediaAsset } from "@/lib/catalog-store-types";
import DesignerScreen from "@/components/designer/DesignerScreen";

type Props = { catalog: Catalog; refresh: () => Promise<void>; mode: "library" | "settings" };
type Tab = "overview" | "company" | "products" | "images" | "attributes" | "studio";

const tabLabels: Record<Tab, string> = {
  overview: "Overview",
  company: "Company Profile",
  products: "Products",
  images: "Image Library",
  attributes: "Dropdown Attributes",
  studio: "Custom Design",
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const emptyProduct = { name: "", categoryId: 0, basePrice: 0, description: "", defaultSeriesId: null as number | null, defaultGlassId: null as number | null };

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

async function normalizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image processing failed.")), "image/png", 0.92));
}

export function AdminDashboard({ catalog, refresh, mode }: Props) {
  const [tab, setTab] = useState<Tab>(mode === "library" ? "products" : "company");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState({ totalQuotes: 0, totalRevenue: 0, totalSqft: 0, totalProducts: catalog.products.length, totalCategories: catalog.categories.length, totalMedia: 0 });
  const [settings, setSettings] = useState(catalog.settings);
  const [editing, setEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [newAttributes, setNewAttributes] = useState<Record<Attribute["type"], string>>({ series: "", glass: "", color: "", lock: "" });
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api("/api/admin/overview").then(setOverview).catch((error) => setNotice(error.message));
  }, [catalog.products.length]);

  const loadMedia = async () => {
    try {
      const data = await api("/api/media");
      setMedia(data.media || []);
    } catch (error) { setNotice((error as Error).message); }
  };
  useEffect(() => {
    api("/api/media")
      .then((data) => setMedia(data.media || []))
      .catch((error) => setNotice(error.message));
  }, [tab]);

  const groupedAttributes = useMemo(() => ({
    series: catalog.attributes.filter((item) => item.type === "series"),
    glass: catalog.attributes.filter((item) => item.type === "glass"),
    color: catalog.attributes.filter((item) => item.type === "color"),
    lock: catalog.attributes.filter((item) => item.type === "lock"),
  }), [catalog.attributes]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };

  const saveSettings = async () => {
    try {
      await api("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      await refresh(); flash("Company profile saved.");
    } catch (error) { flash((error as Error).message); }
  };

  const uploadLogo = async (file: File) => {
    const form = new FormData(); form.append("logo", file);
    try { await api("/api/admin/settings/logo", { method: "POST", body: form }); await refresh(); flash("Company logo updated."); }
    catch (error) { flash((error as Error).message); }
  };

  const startProduct = (product?: Product) => {
    setEditing(product || null);
    setImageFile(null);
    setProductForm(product ? {
      name: product.name, categoryId: product.categoryId, basePrice: product.basePrice,
      description: product.description, defaultSeriesId: product.defaultSeriesId, defaultGlassId: product.defaultGlassId,
    } : { ...emptyProduct, categoryId: catalog.categories[0]?.id || 0 });
  };

  const saveProduct = async () => {
    try {
      const saved = await api(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(productForm),
      });
      const productId = editing?.id || saved.id;
      if (imageFile) {
        const normalized = await normalizeImage(imageFile);
        const form = new FormData(); form.append("image", normalized, "invoice-product.png");
        await api(`/api/products/${productId}/image`, { method: "POST", body: form });
      }
      await refresh(); setEditing(null); setProductForm(emptyProduct); setImageFile(null); flash("Product saved and published to the catalog.");
    } catch (error) { flash((error as Error).message); }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? Existing quotation records will remain.`)) return;
    try { await api(`/api/products/${product.id}`, { method: "DELETE" }); await refresh(); flash("Product deleted."); }
    catch (error) { flash((error as Error).message); }
  };

  const addCategory = async () => {
    try { await api("/api/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: categoryName }) }); setCategoryName(""); await refresh(); flash("Category added."); }
    catch (error) { flash((error as Error).message); }
  };

  const deleteCategory = async (id: number) => {
    try { await api(`/api/categories/${id}`, { method: "DELETE" }); await refresh(); flash("Category deleted."); }
    catch (error) { flash((error as Error).message); }
  };

  const addAttribute = async (type: Attribute["type"]) => {
    try { await api("/api/attributes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, name: newAttributes[type] }) }); setNewAttributes((value) => ({ ...value, [type]: "" })); await refresh(); flash("Dropdown option added."); }
    catch (error) { flash((error as Error).message); }
  };

  const editAttribute = async (attribute: Attribute) => {
    const name = window.prompt("Edit option name", attribute.name)?.trim();
    if (!name || name === attribute.name) return;
    try { await api(`/api/attributes/${attribute.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); await refresh(); flash("Dropdown option updated."); }
    catch (error) { flash((error as Error).message); }
  };

  const deleteAttribute = async (attribute: Attribute) => {
    if (!window.confirm(`Delete “${attribute.name}”?`)) return;
    try { await api(`/api/attributes/${attribute.id}`, { method: "DELETE" }); await refresh(); flash("Dropdown option deleted."); }
    catch (error) { flash((error as Error).message); }
  };

  const uploadMedia = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append("image", file, file.name);
        await api("/api/media", { method: "POST", body: form });
      }
      await loadMedia();
      flash(`${files.length} image${files.length > 1 ? "s" : ""} added to the library.`);
    } catch (error) { flash((error as Error).message); }
    finally { setUploading(false); }
  };

  const deleteMediaAsset = async (asset: MediaAsset) => {
    if (asset.usedBy.length) { flash("This image is used by a product. Remove it from that product first."); return; }
    if (!window.confirm(`Delete ${asset.filename || "this image"} from the library?`)) return;
    try { await api(`/api/media/${asset.id}`, { method: "DELETE" }); await loadMedia(); flash("Image deleted from the library."); }
    catch (error) { flash((error as Error).message); }
  };

  /** Matches library filenames to product names, e.g. "Sliding-Door.png" -> "Sliding Door". */
  const slug = (value: string) =>
    value.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();

  const autoAssignByFilename = async () => {
    const free = media.filter((asset) => asset.usedBy.length === 0);
    if (!free.length) { flash("Every image in the library is already used by a product."); return; }
    if (!window.confirm(`Match ${free.length} unused image(s) to products by file name? Products that already have an image are skipped.`)) return;
    let matched = 0; const unmatched: string[] = [];
    for (const asset of free) {
      const base = slug(asset.filename || "");
      if (!base) { unmatched.push(asset.filename || "image"); continue; }
      const target = catalog.products.find((product) => {
        if (product.imageUrl) return false;
        const name = slug(product.name);
        return base === name || base.startsWith(`${name} `);
      });
      if (!target) { unmatched.push(asset.filename || "image"); continue; }
      try {
        await api(`/api/products/${target.id}/image`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId: asset.id }) });
        matched += 1;
      } catch { unmatched.push(asset.filename || "image"); }
    }
    await Promise.all([refresh(), loadMedia()]);
    flash(`${matched} image(s) matched to products${unmatched.length ? ` — ${unmatched.length} could not be matched: ${unmatched.slice(0, 3).join(", ")}${unmatched.length > 3 ? "…" : ""}` : "."}`);
  };

  const attachMedia = async (mediaId: number, productId: number) => {
    try {
      await api(`/api/products/${productId}/image`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId }) });
      await Promise.all([refresh(), loadMedia()]);
      flash("Image assigned to the product.");
    } catch (error) { flash((error as Error).message); }
  };

  const unlinkProductImage = async (productId: number) => {
    try { await api(`/api/products/${productId}/image`, { method: "DELETE" }); await Promise.all([refresh(), loadMedia()]); flash("Image removed from the product (still in the library)."); }
    catch (error) { flash((error as Error).message); }
  };

  return <section className="admin-page">
    <div className="admin-heading"><div><span className="eyebrow">{mode === "library" ? "Reusable designs and images" : "Business setup"}</span><h2>{mode === "library" ? "Product Library" : "Settings"}</h2><p>{mode === "library" ? "Add products, manage their images, or draw a custom design. Saved products appear in New Quote." : "Update the company profile and quotation options."}</p></div></div>
    <div className="admin-tabs" role="tablist">
      {(mode === "library" ? ["products", "images", "studio"] : ["company", "attributes", "overview"]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item as Tab)}>{tabLabels[item as Tab]}</button>)}
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {tab === "studio" && <DesignerScreen onProductSaved={refresh} />}

    {tab === "overview" && <div className="stats-grid">
      <article><span>Total Quotes</span><strong>{overview.totalQuotes}</strong><small>Saved quotations</small></article>
      <article><span>Total Revenue</span><strong>{money.format(overview.totalRevenue)}</strong><small>Grand total quoted</small></article>
      <article><span>Total Sq. Ft.</span><strong>{Number(overview.totalSqft).toFixed(2)}</strong><small>Across saved quotations</small></article>
      <article><span>Catalog</span><strong>{overview.totalProducts}</strong><small>{overview.totalCategories} categories</small></article>
      <article><span>Image Library</span><strong>{overview.totalMedia}</strong><small>Images ready to reuse</small></article>
    </div>}

    {tab === "company" && <div className="admin-card settings-layout">
      <div className="logo-manager">
        <div className="logo-preview"><img src={settings.logoKey ? "/api/admin/settings/logo" : "/azarraga-logo-full.jpg"} alt="Azarraga Glass & Aluminum logo" /></div>
        <Label className="file-button"><Upload /> Upload logo<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && uploadLogo(event.target.files[0])} /></Label>
        <small>PNG, JPG or WebP, up to 5 MB.</small>
      </div>
      <div className="settings-form">
        {([[
          "Company Name", "companyName"], ["Email", "email"], ["Contact Numbers", "contactNumbers"], ["TIN", "tin"], ["Company Address", "address"], ["PDF Header", "pdfHeader"], ["Account Name", "bankAccountName"], ["Account Number", "bankAccountNumber"], ["Bank Name", "bankName"], ["Bank Branch", "bankBranch"]] as const).map(([label, key]) => <div className="field-stack" key={key}><Label>{label}</Label><Input value={settings[key]} onChange={(event) => setSettings((value) => ({ ...value, [key]: event.target.value }))} /></div>)}
        <div className="field-stack full-span"><Label>Terms & Conditions</Label><Textarea value={settings.termsConditions} onChange={(event) => setSettings((value) => ({ ...value, termsConditions: event.target.value }))} /></div>
        <Button className="full-span" onClick={saveSettings}><Save /> Save Company Profile</Button>
      </div>
    </div>}

    {tab === "products" && <div className="admin-stack">
      <div className="admin-card category-manager"><div><h3>Categories</h3><p>Add another catalog section anytime.</p></div><div className="inline-create"><Input placeholder="New category" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><Button onClick={addCategory}><Plus />Add</Button></div><div className="chip-row">{catalog.categories.map((category) => <span key={category.id}>{category.name}<button aria-label={`Delete ${category.name}`} onClick={() => deleteCategory(category.id)}><Trash2 /></button></span>)}</div></div>
      <div className="admin-card product-table-card"><div className="section-title"><div><h3>Products</h3><p>{catalog.products.length} products appear automatically in Choose a Product.</p></div><Button onClick={() => startProduct()}><Plus />Add Product</Button></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Base Price</th><th>Defaults</th><th>Actions</th></tr></thead><tbody>{[...catalog.products].sort((a, b) => Number(b.isCustom) - Number(a.isCustom)).map((product) => <tr key={product.id}><td data-label="Image"><div className="table-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <ImageIcon />}</div></td><td data-label="Product"><strong>{product.name}</strong>{product.isCustom && <small>Owner design · {product.productKey}</small>}<small>{product.description}</small></td><td data-label="Category">{product.categoryName}</td><td data-label="Base Price">{money.format(product.basePrice)}</td><td data-label="Defaults">{product.defaultSeries || "—"}<br />{product.defaultGlass || "—"}</td><td data-label="Actions"><div className="row-actions"><Button size="icon" variant="outline" title="Edit product" onClick={() => startProduct(product)}><Pencil /></Button>{product.imageUrl && <Button size="icon" variant="outline" title="Download invoice image" asChild><a href={product.imageKey ? `/api/products/${product.id}/image?download=1` : product.imageUrl} download><Download /></a></Button>}<Button size="icon" variant="outline" title="Delete product" onClick={() => deleteProduct(product)}><Trash2 /></Button></div></td></tr>)}</tbody></table></div>
      </div>
      {(editing || productForm.categoryId > 0) && <div className="admin-card product-editor"><div className="section-title"><div><h3>{editing ? `Edit ${editing.name}` : "Add Product"}</h3><p>Its image will be normalized to the same 4:3 invoice thumbnail.</p></div><Button variant="outline" onClick={() => { setEditing(null); setProductForm(emptyProduct); }}>Close</Button></div><div className="settings-form">
        <div className="field-stack"><Label>Name</Label><Input value={productForm.name} onChange={(event) => setProductForm((value) => ({ ...value, name: event.target.value }))} /></div>
        <div className="field-stack"><Label>Category</Label><Select value={String(productForm.categoryId)} onValueChange={(value) => setProductForm((form) => ({ ...form, categoryId: Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{catalog.categories.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack"><Label>Base Price</Label><Input type="number" min="0" value={productForm.basePrice} onChange={(event) => setProductForm((value) => ({ ...value, basePrice: Number(event.target.value) }))} /></div>
        <div className="field-stack"><Label>Default Series</Label><Select value={String(productForm.defaultSeriesId || "none")} onValueChange={(value) => setProductForm((form) => ({ ...form, defaultSeriesId: value === "none" ? null : Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{groupedAttributes.series.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack"><Label>Default Glass</Label><Select value={String(productForm.defaultGlassId || "none")} onValueChange={(value) => setProductForm((form) => ({ ...form, defaultGlassId: value === "none" ? null : Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{groupedAttributes.glass.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack product-image-field"><Label>Product Image</Label>
          <div className="product-image-picker">
            {editing?.imageUrl ? <img src={editing.imageUrl} alt={editing.name} className="product-image-preview" /> : <div className="product-image-preview empty"><ImageIcon /></div>}
            <div className="product-image-actions">
              <Label className="file-button"><Upload /> {editing?.imageUrl ? "Replace from device" : "Upload from device"}<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; event.target.value = ""; if (!file || !editing) { setImageFile(file); return; } const form = new FormData(); form.append("image", file, file.name); setImageFile(null); normalizeImage(file).then((normalized) => { const body = new FormData(); body.append("image", normalized, file.name); return api(`/api/products/${editing.id}/image`, { method: "POST", body }); }).then(() => Promise.all([refresh(), loadMedia()])).then(() => flash("Image uploaded to the product and saved in the library.")).catch((error) => flash((error as Error).message)); }} /></Label>
              <Select value="" disabled={!editing} onValueChange={(value) => { if (value && editing) void attachMedia(Number(value), editing.id); }}>
                <SelectTrigger className="media-attach"><SelectValue placeholder={editing ? "Choose from library…" : "Save product first"} /></SelectTrigger>
                <SelectContent>{media.map((asset) => <SelectItem key={asset.id} value={String(asset.id)}>{asset.filename || `Image ${asset.id}`}</SelectItem>)}</SelectContent>
              </Select>
              {editing?.imageUrl && <Button variant="outline" onClick={() => void unlinkProductImage(editing.id)}><X /> Remove image</Button>}
              {!editing && imageFile && <small>“{imageFile.name}” will be added to the library when you save.</small>}
            </div>
          </div>
        </div>
        <div className="field-stack full-span"><Label>Description</Label><Textarea value={productForm.description} onChange={(event) => setProductForm((value) => ({ ...value, description: event.target.value }))} /></div>
        <Button className="full-span" onClick={saveProduct}><Save />Save Product</Button>
      </div></div>}
    </div>}

    {tab === "images" && <div className="admin-stack">
      <div className="admin-card">
        <div className="section-title">
          <div><h3>Image Library</h3><p>Upload photos from your device once, then use them on any product.</p></div>
          <div className="header-actions-inline">
            <Button variant="outline" onClick={() => void autoAssignByFilename()}><Check /> Match names to products</Button>
            <Label className="file-button"><Upload /> Upload images<Input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadMedia(files); }} /></Label>
          </div>
        </div>
        <small>{uploading ? "Uploading…" : "PNG, JPG or WebP, up to 8 MB each. Select several files at once if you like."}</small>
      </div>
      {media.length === 0
        ? <div className="admin-card empty-state"><ImageIcon /><p>No images yet. Upload the first one above.</p></div>
        : <div className="media-grid">{media.map((asset) => <article className="media-card" key={asset.id}>
            <div className="media-thumb"><img src={asset.url} alt={asset.filename} /></div>
            <div className="media-meta">
              <strong title={asset.filename}>{asset.filename || "image"}</strong>
              <small>{formatSize(asset.sizeBytes)} · {asset.usedBy.length ? `Used by ${asset.usedBy.map((item) => item.name).join(", ")}` : "Not used yet"}</small>
            </div>
            <div className="row-actions">
              <Select value="" onValueChange={(value) => { if (value) void attachMedia(asset.id, Number(value)); }}>
                <SelectTrigger className="media-attach"><SelectValue placeholder="Use for product…" /></SelectTrigger>
                <SelectContent>{catalog.products.map((product) => <SelectItem key={product.id} value={String(product.id)}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="icon" variant="outline" title="Download image" asChild><a href={`${asset.url}?download=1`} download><Download /></a></Button>
              <Button size="icon" variant="outline" title={asset.usedBy.length ? "In use by a product" : "Delete from library"} onClick={() => deleteMediaAsset(asset)}><Trash2 /></Button>
            </div>
          </article>)}</div>}
    </div>}

    {tab === "attributes" && <div className="attribute-grid">{(Object.keys(groupedAttributes) as Attribute["type"][]).map((type) => <article className="admin-card" key={type}><h3>{type === "glass" ? "Glass Types" : type[0].toUpperCase() + type.slice(1)}</h3><div className="attribute-list">{groupedAttributes[type].map((attribute) => <div key={attribute.id}><span>{attribute.name}</span><span><button onClick={() => editAttribute(attribute)} aria-label={`Edit ${attribute.name}`}><Pencil /></button><button onClick={() => deleteAttribute(attribute)} aria-label={`Delete ${attribute.name}`}><Trash2 /></button></span></div>)}</div><div className="inline-create"><Input placeholder={`Add ${type}`} value={newAttributes[type]} onChange={(event) => setNewAttributes((value) => ({ ...value, [type]: event.target.value }))} /><Button onClick={() => addAttribute(type)}><Plus />Add</Button></div></article>)}</div>}
  </section>;
}
