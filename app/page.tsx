"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  Download,
  FileText,
  FolderArchive,
  ImageIcon,
  LayoutGrid,
  PackagePlus,
  PencilRuler,
  Printer,
  Save,
  Search,
  Settings2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { AdminDashboard } from "@/components/admin-dashboard";
import DesignerScreen from "@/components/designer/DesignerScreen";
import { FinishedProjectsScreen } from "@/components/finished-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Attribute, Catalog, Product } from "@/lib/catalog-types";

type Screen = "catalog" | "configure" | "preview" | "projects" | "designer" | "admin";
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

function ProductPicture({ product, className = "" }: { product: Product; className?: string }) {
  return (
    <div className={`product-picture ${className}`}>
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={`${product.name} product pattern`} />
      ) : (
        <>
          <ImageIcon />
          <span>Image coming soon</span>
        </>
      )}
    </div>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Attribute[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-stack">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="app-select">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.name}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>("catalog");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [width, setWidth] = useState("8"),
    [height, setHeight] = useState("5"),
    [quantity, setQuantity] = useState("1"),
    [rate, setRate] = useState("0"),
    [discount, setDiscount] = useState("0");
  const [pricingMethod, setPricingMethod] = useState<"sqft" | "unit">("sqft");
  const [series, setSeries] = useState(""),
    [glass, setGlass] = useState(""),
    [color, setColor] = useState(""),
    [lock, setLock] = useState("");
  const [location, setLocation] = useState(""),
    [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState(""),
    [projectName, setProjectName] = useState(""),
    [projectAddress, setProjectAddress] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [chooserNotice, setChooserNotice] = useState("");
  const [chooserNudge, setChooserNudge] = useState(0);
  const productChooserRef = useRef<HTMLElement | null>(null);

  const refresh = async () => {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Catalog unavailable.");
    setCatalog(data);
    if (product) {
      const updated = data.products.find((item: Product) => item.id === product.id);
      if (updated) setProduct(updated);
      else {
        setProduct(null);
        setScreen((current) => (current === "configure" || current === "preview" ? "catalog" : current));
      }
    }
  };

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const data = (await response.json()) as Catalog & { error?: string };
        if (!response.ok) throw new Error(data.error || "Catalog unavailable.");
        if (active) setCatalog(data);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Catalog unavailable.");
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(
    () => ({
      series: catalog?.attributes.filter((item) => item.type === "series") || [],
      glass: catalog?.attributes.filter((item) => item.type === "glass") || [],
      color: catalog?.attributes.filter((item) => item.type === "color") || [],
      lock: catalog?.attributes.filter((item) => item.type === "lock") || [],
    }),
    [catalog],
  );

  const totals = useMemo(() => {
    const w = Number(width) || 0,
      h = Number(height) || 0,
      qty = Math.max(0, Number(quantity) || 0),
      itemRate = Number(rate) || 0;
    const areaEach = w * h,
      totalArea = areaEach * qty,
      subtotal = pricingMethod === "sqft" ? totalArea * itemRate : qty * itemRate;
    const discountValue = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    return { areaEach, totalArea, subtotal, discount: discountValue, grandTotal: subtotal - discountValue };
  }, [width, height, quantity, rate, pricingMethod, discount]);

  const visibleProducts = useMemo(
    () =>
      catalog?.products
        .filter(
          (item) =>
            (selectedCategory === "All" || item.categoryName === selectedCategory) &&
            `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => Number(b.isCustom) - Number(a.isCustom)) || [],
    [catalog, selectedCategory, search],
  );
  const [selectedInvoiceSizes, setSelectedInvoiceSizes] = useState<Record<string, number>>({});
  const visibleProductFamilies = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const item of visibleProducts) {
      const family = item.description.includes("Historical quote")
        ? item.name.replace(/\s*—\s*\d+(?:\.\d+)?\s*×\s*\d+(?:\.\d+)?\s*m$/, "")
        : `product-${item.id}`;
      groups.set(family, [...(groups.get(family) || []), item]);
    }
    return [...groups.entries()].map(([family, variants]) => ({ family, variants }));
  }, [visibleProducts]);

  const chooseProduct = (item: Product) => {
    setChooserNotice("");
    setProduct(item);
    setRate(String(item.basePrice || 0));
    if (item.description.includes("Historical quote")) {
      setPricingMethod("unit");
      const dimensions = item.name.match(/—\s*(\d+(?:\.\d+)?)\s*×\s*(\d+(?:\.\d+)?)\s*m$/);
      if (dimensions) {
        setWidth(String(+(Number(dimensions[1])*3.28084).toFixed(4)));
        setHeight(String(+(Number(dimensions[2])*3.28084).toFixed(4)));
      }
    }
    setSeries(item.defaultSeries || grouped.series[0]?.name || "");
    setGlass(item.defaultGlass || grouped.glass[0]?.name || "");
    setColor(grouped.color[0]?.name || "");
    setLock(grouped.lock[0]?.name || "");
    setDescription(item.description);
    setScreen("configure");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canPreview = Boolean(
    product && Number(width) > 0 && Number(height) > 0 && Number(quantity) > 0 && Number(rate) >= 0,
  );

  const goAfterChoosingProduct = (target: "configure" | "quote") => {
    if (product) {
      setChooserNotice("");
      setScreen(target === "configure" ? "configure" : "preview");
      return;
    }
    setScreen("catalog");
    setChooserNotice(
      target === "configure"
        ? "Choose a product first — click any product card below to start configuring it."
        : "Choose a product first — a quotation needs a selected product to price.",
    );
    setChooserNudge((count) => count + 1);
  };

  useEffect(() => {
    if (!chooserNotice) return;
    const node = productChooserRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }, [chooserNudge, chooserNotice]);

  const saveDraft = async () => {
    if (!product || !canPreview) return;
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quotationNumber: `Q-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
          customerName: customerName || "Walk-in Customer",
          projectName: projectName || "New Project",
          projectAddress,
          subtotal: totals.subtotal,
          discount: totals.discount,
          grandTotal: totals.grandTotal,
          totalSqft: totals.totalArea,
          item: {
            productName: product.name,
            width: Number(width),
            height: Number(height),
            quantity: Math.max(1, Math.round(Number(quantity))),
            sqft: totals.totalArea,
            rate: Number(rate),
            pricingMethod,
            sectionCompany: "Analok",
            sectionType: series || "N/A",
            glass: glass || "N/A",
            color: color || "N/A",
            lock: lock || "N/A",
            location,
            description,
            total: totals.subtotal,
          },
        }),
      });
      if (!response.ok) throw new Error();
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  if (!catalog)
    return (
      <main className="loading-screen">
        <Building2 />
        {loadError ? (
          <>
            <h1>Catalog unavailable</h1>
            <p>{loadError}</p>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </>
        ) : (
          <>
            <h1>Azarraga Quotations</h1>
            <p>Loading products…</p>
          </>
        )}
      </main>
    );

  const settings = catalog.settings;
  const companyLogoSrc = settings.logoKey ? "/api/admin/settings/logo" : "/azarraga-logo-full.jpg";
  const companyMarkSrc = settings.logoKey ? "/api/admin/settings/logo" : "/azarraga-logo-mark.jpg";
  const quoteDate = new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date());

  return (
    <main className="app-shell">
      <aside className="side-rail no-print">
        <div className="brand-lockup compact-brand">
          <span className="brand-mark">
            <img src={companyMarkSrc} alt="Azarraga logo" />
          </span>
          <span>
            <strong>AZARRAGA</strong>
            <small>GLASS & ALUMINUM</small>
          </span>
        </div>
        <nav aria-label="App sections">
          <button
            className={`rail-link ${screen === "catalog" ? "active" : ""}`}
            onClick={() => setScreen("catalog")}
          >
            <LayoutGrid />
            Choose Product
          </button>
          <button
            className={`rail-link ${screen === "configure" ? "active" : ""}`}
            onClick={() => goAfterChoosingProduct("configure")}
          >
            <Calculator />
            Configure
          </button>
          <button
            className={`rail-link ${screen === "preview" ? "active" : ""}`}
            onClick={() => goAfterChoosingProduct("quote")}
          >
            <FileText />
            Quote & Invoice
          </button>
          <button
            className={`rail-link ${screen === "projects" ? "active" : ""}`}
            onClick={() => setScreen("projects")}
          >
            <FolderArchive />
            Finished Projects
          </button>
          <button
            className={`rail-link ${screen === "designer" ? "active" : ""}`}
            onClick={() => setScreen("designer")}
          >
            <PencilRuler />
            Designer Studio
          </button>
          <button
            className={`rail-link ${screen === "admin" ? "active" : ""}`}
            onClick={() => setScreen("admin")}
          >
            <Settings2 />
            Admin Settings
          </button>
        </nav>
        <div className="rail-help">
          <strong>Simple workflow</strong>
          <span>Choose → Configure → Quote</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="app-header no-print">
          <div className="mobile-brand brand-lockup">
            <span className="brand-mark">
              <img src={companyMarkSrc} alt="Azarraga logo" />
            </span>
            <span>
              <strong>AZARRAGA</strong>
              <small>GLASS & ALUMINUM</small>
            </span>
          </div>
          <div className="title-block">
            <div>
              <p>
                {screen === "admin"
                  ? "Manage the app"
                  : screen === "designer"
                  ? "Draw windows, doors & glass works"
                  : screen === "projects"
                  ? "Finished invoices & extracted drawings"
                  : "Windows, doors & glass works"}
              </p>
              <h1>
                {screen === "catalog"
                  ? "Choose a Product"
                  : screen === "configure"
                  ? "Configure Product"
                  : screen === "preview"
                  ? "Quote & Invoice"
                  : screen === "projects"
                  ? "Finished Projects"
                  : screen === "designer"
                  ? "Designer Studio"
                  : "Admin Settings"}
              </h1>
            </div>
          </div>
          {screen !== "catalog" &&
            screen !== "admin" &&
            screen !== "designer" &&
            screen !== "projects" && (
              <div className="header-actions">
                <Button
                  variant="outline"
                  onClick={() => setScreen(screen === "preview" ? "configure" : "catalog")}
                >
                  <ArrowLeft />
                  Back
                </Button>
                {screen === "configure" && (
                  <Button disabled={!canPreview} onClick={() => setScreen("preview")}>
                    Review Quote
                    <ChevronRight />
                  </Button>
                )}
                {screen === "preview" && (
                  <Button onClick={() => window.print()}>
                    <Download />
                    Download PDF
                  </Button>
                )}
              </div>
            )}
        </header>

        <nav className="mobile-nav no-print" aria-label="Mobile navigation">
          <button
            className={screen === "catalog" ? "active" : ""}
            onClick={() => setScreen("catalog")}
          >
            <LayoutGrid />
            Products
          </button>
          <button
            className={screen === "configure" ? "active" : ""}
            onClick={() => goAfterChoosingProduct("configure")}
          >
            <Calculator />
            Configure
          </button>
          <button
            className={screen === "preview" ? "active" : ""}
            onClick={() => goAfterChoosingProduct("quote")}
          >
            <FileText />
            Quote
          </button>
          <button
            className={screen === "projects" ? "active" : ""}
            onClick={() => setScreen("projects")}
          >
            <FolderArchive />
            Projects
          </button>
          <button
            className={screen === "designer" ? "active" : ""}
            onClick={() => setScreen("designer")}
          >
            <PencilRuler />
            Designer
          </button>
          <button
            className={screen === "admin" ? "active" : ""}
            onClick={() => setScreen("admin")}
          >
            <Settings2 />
            Admin
          </button>
        </nav>

        {screen === "catalog" && (
          <section className="catalog-page" ref={productChooserRef} tabIndex={-1}>
            {chooserNotice && (
              <div className="selection-notice" role="status" aria-live="polite">
                <AlertCircle />
                <span>{chooserNotice}</span>
                <button
                  type="button"
                  aria-label="Dismiss notice"
                  onClick={() => setChooserNotice("")}
                >
                  <X />
                </button>
              </div>
            )}
            <div className="catalog-tools">
              <div className="search-box">
                <Search />
                <Input
                  aria-label="Search products"
                  placeholder="Search windows, doors, glass…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="category-tabs">
                <button
                  className={selectedCategory === "All" ? "active" : ""}
                  onClick={() => setSelectedCategory("All")}
                >
                  All
                </button>
                {catalog.categories.map((category) => (
                  <button
                    className={selectedCategory === category.name ? "active" : ""}
                    key={category.id}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="invoice-ocr-quick-callout">
              <div className="callout-left">
                <Sparkles className="w-5 h-5 text-sky-600 shrink-0" />
                <div>
                  <strong>Finished Projects & Invoice Drawing OCR</strong>
                  <p>Upload invoices to extract drawings & specs directly into Products so you never have to redraw them.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => setScreen("projects")} className="bg-sky-700 hover:bg-sky-800 text-white shrink-0">
                <UploadCloud className="w-4 h-4 mr-1" />
                Upload Invoice & Extract Drawings
              </Button>
            </div>

            <div className="catalog-summary">
              <div>
                <strong>{visibleProductFamilies.length} product families</strong>
                <span>Select a size when available, then check the price before quoting.</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setScreen("projects")}>
                  <FolderArchive />
                  Finished Invoices
                </Button>
                <Button variant="outline" onClick={() => setScreen("admin")}>
                  <PackagePlus />
                  Manage Products
                </Button>
              </div>
            </div>
            <div className="product-grid">
              {visibleProductFamilies.map(({family,variants}) => {
                const item = variants.find(p=>p.id===selectedInvoiceSizes[family]) || variants[0];
                return (
                <div key={family}>
                {variants.length > 1 && (
                  <label style={{display:"block",marginBottom:8}}>
                    <span style={{display:"block",fontSize:12}}>Select size · {family}</span>
                    <select aria-label={`Size for ${family}`} value={item.id} onChange={event=>setSelectedInvoiceSizes(previous=>({...previous,[family]:Number(event.target.value)}))}>
                      {variants.map(variant=><option key={variant.id} value={variant.id}>{variant.name.replace(family,"").replace(/^\s*—\s*/,"")}</option>)}
                    </select>
                  </label>
                )}
                <button
                  className="product-card"
                  onClick={() => chooseProduct(item)}
                >
                  <ProductPicture product={item} />
                  <span className="product-category">
                    {item.isCustom
                      ? `OWNER DESIGN · ${item.productKey || "CUSTOM"}`
                      : item.categoryName}
                  </span>
                  <h2>{item.name}</h2>
                  <p>{item.description || "Custom fabrication and installation."}</p>
                  <div>
                    <strong>
                      {item.basePrice > 0
                        ? item.description.includes("Historical quote") ? `${money.format(item.basePrice)} historical unit price` : `${money.format(item.basePrice)} base rate`
                        : "Set price in quote"}
                    </strong>
                    <span>
                      Configure <ChevronRight />
                    </span>
                  </div>
                </button>
                </div>
              );})}
            </div>
            {!visibleProducts.length && (
              <div className="empty-state">
                <Search />
                <h2>No matching products</h2>
                <p>Try another search or add the product in Admin Settings.</p>
              </div>
            )}
          </section>
        )}

        {screen === "configure" && product && (
          <section className="configure-flow">
            <div className="flow-steps no-print">
              <span className="done">
                <Check />
                Product
              </span>
              <i />
              <span className="active">2</span>
              <strong>Configure</strong>
              <i />
              <span>3</span>
              <strong>Quote</strong>
            </div>
            <div className="configure-layout">
              <section className="configure-main">
                <div className="selected-product-card">
                  <ProductPicture product={product} />
                  <div>
                    <span className="eyebrow">{product.categoryName}</span>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                    <Button variant="outline" onClick={() => setScreen("catalog")}>
                      Change product
                    </Button>
                  </div>
                </div>
                <div className="form-card">
                  <div className="form-section-title full-span">
                    <span>1</span>
                    <div>
                      <h3>Size and price</h3>
                      <p>Enter measurements in feet. Totals update instantly.</p>
                    </div>
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="width">Width (ft) *</Label>
                    <Input
                      id="width"
                      type="number"
                      min="0"
                      step="0.01"
                      value={width}
                      onChange={(event) => setWidth(event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="height">Height (ft) *</Label>
                    <Input
                      id="height"
                      type="number"
                      min="0"
                      step="0.01"
                      value={height}
                      onChange={(event) => setHeight(event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="rate">Rate *</Label>
                    <Input
                      id="rate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                    />
                  </div>
                  <fieldset className="pricing-method full-span">
                    <legend>Pricing method</legend>
                    <RadioGroup
                      value={pricingMethod}
                      onValueChange={(value) => setPricingMethod(value as "sqft" | "unit")}
                      className="pricing-options"
                    >
                      <Label
                        className={
                          pricingMethod === "sqft"
                            ? "pricing-choice active"
                            : "pricing-choice"
                        }
                      >
                        <RadioGroupItem value="sqft" />
                        Per sq. ft.
                        <small>Windows and glass work</small>
                      </Label>
                      <Label
                        className={
                          pricingMethod === "unit"
                            ? "pricing-choice active"
                            : "pricing-choice"
                        }
                      >
                        <RadioGroupItem value="unit" />
                        Per unit / set
                        <small>ED doors and fixed-price items</small>
                      </Label>
                    </RadioGroup>
                  </fieldset>
                  <div className="form-section-title full-span">
                    <span>2</span>
                    <div>
                      <h3>Product details</h3>
                      <p>Choose the materials that will appear on the invoice.</p>
                    </div>
                  </div>
                  <ChoiceField
                    label="Series"
                    value={series}
                    options={grouped.series}
                    onChange={setSeries}
                  />
                  <ChoiceField
                    label="Glass"
                    value={glass}
                    options={grouped.glass}
                    onChange={setGlass}
                  />
                  <ChoiceField
                    label="Color"
                    value={color}
                    options={grouped.color}
                    onChange={setColor}
                  />
                  <ChoiceField
                    label="Lock"
                    value={lock}
                    options={grouped.lock}
                    onChange={setLock}
                  />
                  <div className="field-stack">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Living room"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>
                  <div className="field-stack full-span">
                    <Label htmlFor="description">Description / special instructions</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                </div>
              </section>
              <aside className="price-sidebar">
                <span>Live total</span>
                <div>
                  <small>
                    {width || 0} × {height || 0} ft × {quantity || 0}
                  </small>
                  <strong>{totals.totalArea.toFixed(2)} sq. ft.</strong>
                </div>
                <div>
                  <small>
                    {pricingMethod === "sqft" ? "Rate per sq. ft." : "Rate per unit / set"}
                  </small>
                  <strong>{money.format(Number(rate) || 0)}</strong>
                </div>
                <div className="price-total">
                  <small>Item total</small>
                  <strong>{money.format(totals.subtotal)}</strong>
                </div>
                <Button disabled={!canPreview} onClick={() => setScreen("preview")}>
                  Continue to Quote <ChevronRight />
                </Button>
                <p>Nothing is final until you save the quotation.</p>
              </aside>
            </div>
          </section>
        )}

        {screen === "preview" && product && (
          <section className="quote-workspace">
            <div className="quote-controls no-print">
              <div className="customer-form">
                <div className="form-section-title">
                  <span>3</span>
                  <div>
                    <h3>Customer and project</h3>
                    <p>Add the recipient details before downloading.</p>
                  </div>
                </div>
                <div className="customer-fields">
                  <div className="field-stack">
                    <Label>Customer Name</Label>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="field-stack">
                    <Label>Project Name</Label>
                    <Input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="Project name"
                    />
                  </div>
                  <div className="field-stack full-span">
                    <Label>Project Address</Label>
                    <Input
                      value={projectAddress}
                      onChange={(event) => setProjectAddress(event.target.value)}
                      placeholder="Project address"
                    />
                  </div>
                </div>
                <div className="quote-control-actions">
                  <Button
                    variant="outline"
                    onClick={saveDraft}
                    disabled={saveStatus === "saving"}
                  >
                    <Save />
                    {saveStatus === "saving"
                      ? "Saving…"
                      : saveStatus === "saved"
                      ? "Draft saved"
                      : "Save draft"}
                  </Button>
                  <Button onClick={() => window.print()}>
                    <Printer />
                    Print / Save PDF
                  </Button>
                </div>
                {saveStatus === "error" && (
                  <p className="error-text">
                    The draft could not be saved. Your entries are still on this screen.
                  </p>
                )}
              </div>
            </div>
            <article className="quotation-page" id="quotation-document">
              <div className="pdf-header-text">{settings.pdfHeader}</div>
              <header className="quote-header">
                <img
                  className="quote-official-logo"
                  src={companyLogoSrc}
                  alt="Azarraga Glass & Aluminum"
                />
                <div className="company-contact">
                  <strong>{settings.contactNumbers}</strong>
                  <span>{settings.address}</span>
                  <span>{settings.email}</span>
                </div>
              </header>
              <div className="document-title-row">
                <div>
                  <span>QUOTATION</span>
                  <small>Supply, fabrication & installation</small>
                </div>
                <div>
                  <strong>Q-{new Date().getFullYear()}-DRAFT</strong>
                  <span>{quoteDate}</span>
                </div>
              </div>
              <div className="party-grid">
                <section>
                  <span className="quote-label">BILLED FROM</span>
                  <strong>{settings.companyName}</strong>
                  <p>
                    TIN: {settings.tin || "____________________"}
                    <br />
                    {settings.address}
                  </p>
                </section>
                <section>
                  <span className="quote-label">BILLED TO</span>
                  <strong>{customerName || "Customer Name"}</strong>
                  <p>
                    {projectName || "Project Name"}
                    <br />
                    {projectAddress || "Project Address"}
                  </p>
                </section>
              </div>
              <div className="quote-table-wrap">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Description</th>
                      <th>Width</th>
                      <th>Height</th>
                      <th>Qty</th>
                      <th>Sq. Ft.</th>
                      <th>Rate</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td data-label="Image">
                        <ProductPicture product={product} />
                      </td>
                      <td data-label="Description">
                        <strong>{product.name}</strong>
                        <span>
                          {series} · {glass}
                          <br />
                          {color} · {lock}
                          <br />
                          {location && (
                            <>
                              Location: {location}
                              <br />
                            </>
                          )}
                          {description}
                        </span>
                      </td>
                      <td data-label="Width">{width} ft</td>
                      <td data-label="Height">{height} ft</td>
                      <td data-label="Qty">{quantity}</td>
                      <td data-label="Sq. Ft.">{totals.totalArea.toFixed(2)}</td>
                      <td data-label="Rate">{money.format(Number(rate) || 0)}</td>
                      <td data-label="Total">{money.format(totals.subtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="quote-bottom-grid">
                <section className="bank-box">
                  <span className="quote-label">BANK ACCOUNT DETAILS</span>
                  <p>
                    <strong>Account Name:</strong>{" "}
                    {settings.bankAccountName || "____________________"}
                    <br />
                    <strong>Account Number:</strong>{" "}
                    {settings.bankAccountNumber || "____________________"}
                    <br />
                    <strong>Bank:</strong> {settings.bankName || "____________________"}
                    <br />
                    <strong>Branch:</strong> {settings.bankBranch || "____________________"}
                  </p>
                </section>
                <section className="totals-box">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money.format(totals.subtotal)}</strong>
                  </div>
                  <div>
                    <label htmlFor="discount">Discount</label>
                    <Input
                      id="discount"
                      className="no-print"
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                    />
                    <strong className="print-only">{money.format(totals.discount)}</strong>
                  </div>
                  <div className="grand-total">
                    <span>Grand Total</span>
                    <strong>{money.format(totals.grandTotal)}</strong>
                  </div>
                </section>
              </div>
              <section className="terms-box">
                <span className="quote-label">TERMS & CONDITIONS</span>
                <p>{settings.termsConditions}</p>
              </section>
              <footer className="signature-grid">
                <section>
                  <span>Client Approval</span>
                  <div className="signature-line" />
                  <small>Signature over printed name / Date</small>
                </section>
                <section>
                  <span>Authorized Signature</span>
                  <div className="signature-line" />
                  <small>For {settings.companyName} / Date</small>
                </section>
              </footer>
            </article>
          </section>
        )}

        {screen === "projects" && (
          <FinishedProjectsScreen
            onCatalogUpdated={refresh}
            onUseInConfigure={(configuredItem) => {
              const matchingProduct = catalog.products.find(
                (p) => p.name.toLowerCase() === configuredItem.productName.toLowerCase(),
              );
              if (matchingProduct) {
                chooseProduct(matchingProduct);
              } else {
                const transientProduct: Product = {
                  id: 99999,
                  name: configuredItem.productName,
                  categoryId: configuredItem.category === "Doors" ? 2 : 1,
                  categoryName: configuredItem.category,
                  basePrice: configuredItem.rate,
                  description: configuredItem.description || "",
                  defaultSeriesId: null,
                  defaultGlassId: null,
                  defaultSeries: configuredItem.series || null,
                  defaultGlass: configuredItem.glass || null,
                  imageKey: null,
                  imagePath: configuredItem.imageUrl || null,
                  imageUrl: configuredItem.imageUrl || null,
                  productKey: "FINISHED-EXT",
                  designId: null,
                  isCustom: true,
                  updatedAt: new Date().toISOString(),
                };
                setProduct(transientProduct);
              }
              setWidth(String(configuredItem.width || 8));
              setHeight(String(configuredItem.height || 5));
              setRate(String(configuredItem.rate || 0));
              setPricingMethod("unit");
              if (configuredItem.series) setSeries(configuredItem.series);
              if (configuredItem.glass) setGlass(configuredItem.glass);
              if (configuredItem.color) setColor(configuredItem.color);
              if (configuredItem.lock) setLock(configuredItem.lock);
              if (configuredItem.description) setDescription(configuredItem.description);
              setScreen("configure");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {screen === "admin" && (
          <AdminDashboard key={catalog.settings.updatedAt} catalog={catalog} refresh={refresh} />
        )}

        {screen === "designer" && (
          <section className="designer-page">
            <DesignerScreen onProductSaved={refresh} />
          </section>
        )}
      </section>
    </main>
  );
}
