"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, Pencil, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Attribute, Catalog, Product } from "@/lib/catalog-types";

type Props = { catalog: Catalog; refresh: () => Promise<void> };
type Tab = "overview" | "company" | "products" | "attributes";

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

export function AdminDashboard({ catalog, refresh }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState({ totalQuotes: 0, totalRevenue: 0, totalSqft: 0, totalProducts: catalog.products.length, totalCategories: catalog.categories.length });
  const [settings, setSettings] = useState(catalog.settings);
  const [editing, setEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [newAttributes, setNewAttributes] = useState<Record<Attribute["type"], string>>({ series: "", glass: "", color: "", lock: "" });

  useEffect(() => { setSettings(catalog.settings); }, [catalog.settings]);
  useEffect(() => {
    api("/api/admin/overview").then(setOverview).catch((error) => setNotice(error.message));
  }, [catalog.products.length]);

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

  return <section className="admin-page">
    <div className="admin-heading"><div><span className="eyebrow">No login required</span><h2>Admin Settings</h2><p>Every saved change updates the product chooser and quotation form.</p></div></div>
    <div className="admin-tabs" role="tablist">
      {(["overview", "company", "products", "attributes"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "company" ? "Company Profile" : item === "attributes" ? "Dropdown Attributes" : item[0].toUpperCase() + item.slice(1)}</button>)}
    </div>
    {notice && <div className="notice" role="status">{notice}</div>}

    {tab === "overview" && <div className="stats-grid">
      <article><span>Total Quotes</span><strong>{overview.totalQuotes}</strong><small>Saved quotations</small></article>
      <article><span>Total Revenue</span><strong>{money.format(overview.totalRevenue)}</strong><small>Grand total quoted</small></article>
      <article><span>Total Sq. Ft.</span><strong>{Number(overview.totalSqft).toFixed(2)}</strong><small>Across saved quotations</small></article>
      <article><span>Catalog</span><strong>{overview.totalProducts}</strong><small>{overview.totalCategories} categories</small></article>
    </div>}

    {tab === "company" && <div className="admin-card settings-layout">
      <div className="logo-manager">
        <div className="logo-preview">{settings.logoKey ? <img src="/api/admin/settings/logo" alt="Company logo" /> : <ImageIcon />}</div>
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
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Image</th><th>Product</th><th>Category</th><th>Base Price</th><th>Defaults</th><th>Actions</th></tr></thead><tbody>{catalog.products.map((product) => <tr key={product.id}><td><div className="table-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <ImageIcon />}</div></td><td><strong>{product.name}</strong><small>{product.description}</small></td><td>{product.categoryName}</td><td>{money.format(product.basePrice)}</td><td>{product.defaultSeries || "—"}<br />{product.defaultGlass || "—"}</td><td><div className="row-actions"><Button size="icon" variant="outline" title="Edit product" onClick={() => startProduct(product)}><Pencil /></Button>{product.imageUrl && <Button size="icon" variant="outline" title="Download invoice image" asChild><a href={product.imageKey ? `/api/products/${product.id}/image?download=1` : product.imageUrl} download><Download /></a></Button>}<Button size="icon" variant="outline" title="Delete product" onClick={() => deleteProduct(product)}><Trash2 /></Button></div></td></tr>)}</tbody></table></div>
      </div>
      {(editing || productForm.categoryId > 0) && <div className="admin-card product-editor"><div className="section-title"><div><h3>{editing ? `Edit ${editing.name}` : "Add Product"}</h3><p>Its image will be normalized to the same 4:3 invoice thumbnail.</p></div><Button variant="outline" onClick={() => { setEditing(null); setProductForm(emptyProduct); }}>Close</Button></div><div className="settings-form">
        <div className="field-stack"><Label>Name</Label><Input value={productForm.name} onChange={(event) => setProductForm((value) => ({ ...value, name: event.target.value }))} /></div>
        <div className="field-stack"><Label>Category</Label><Select value={String(productForm.categoryId)} onValueChange={(value) => setProductForm((form) => ({ ...form, categoryId: Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{catalog.categories.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack"><Label>Base Price</Label><Input type="number" min="0" value={productForm.basePrice} onChange={(event) => setProductForm((value) => ({ ...value, basePrice: Number(event.target.value) }))} /></div>
        <div className="field-stack"><Label>Default Series</Label><Select value={String(productForm.defaultSeriesId || "none")} onValueChange={(value) => setProductForm((form) => ({ ...form, defaultSeriesId: value === "none" ? null : Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{groupedAttributes.series.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack"><Label>Default Glass</Label><Select value={String(productForm.defaultGlassId || "none")} onValueChange={(value) => setProductForm((form) => ({ ...form, defaultGlassId: value === "none" ? null : Number(value) }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{groupedAttributes.glass.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="field-stack"><Label>Product Image</Label><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></div>
        <div className="field-stack full-span"><Label>Description</Label><Textarea value={productForm.description} onChange={(event) => setProductForm((value) => ({ ...value, description: event.target.value }))} /></div>
        <Button className="full-span" onClick={saveProduct}><Save />Save Product</Button>
      </div></div>}
    </div>}

    {tab === "attributes" && <div className="attribute-grid">{(Object.keys(groupedAttributes) as Attribute["type"][]).map((type) => <article className="admin-card" key={type}><h3>{type === "glass" ? "Glass Types" : type[0].toUpperCase() + type.slice(1)}</h3><div className="attribute-list">{groupedAttributes[type].map((attribute) => <div key={attribute.id}><span>{attribute.name}</span><span><button onClick={() => editAttribute(attribute)} aria-label={`Edit ${attribute.name}`}><Pencil /></button><button onClick={() => deleteAttribute(attribute)} aria-label={`Delete ${attribute.name}`}><Trash2 /></button></span></div>)}</div><div className="inline-create"><Input placeholder={`Add ${type}`} value={newAttributes[type]} onChange={(event) => setNewAttributes((value) => ({ ...value, [type]: event.target.value }))} /><Button onClick={() => addAttribute(type)}><Plus />Add</Button></div></article>)}</div>}
  </section>;
}
