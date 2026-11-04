"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Save, Send, Sparkles, Trash2, X } from "lucide-react";
import { computeDocument, computeLine, computeAlternatives } from "@/lib/calc";
import { composeDescription, nextItemCode } from "@/lib/describe";
import { parseMeasurement, formatMeasurement, validateLineNumbers, type MeasurementUnit } from "@/lib/measurements";
import { formatMoney, parseMoneyInput } from "@/lib/currency";
import type { CategoryWithPrefix, CatalogItem, SpecGroup } from "@/lib/spec-options";
import type { DocumentGraph, Settings } from "@/lib/documents";
import type { Client } from "@/lib/db/schema";
import type { Product } from "@/lib/catalog-types";

/* ------------------------------------------------------------------ */
/* Local shapes                                                        */
/* ------------------------------------------------------------------ */

interface LineState {
  productId?: number | null;
  key: string;
  saved?: NonNullable<DocumentGraph["sections"]>[number]["lines"][number];
  selected: Record<string, string>; // groupId -> optionId
  description: string;
  manualDescription: boolean;
  measurementUnit: MeasurementUnit;
  pricingMode: "per_unit" | "per_area";
  areaUnit: "sqm" | "sqft";
  minArea: number;
  unit: string;
  options: { groupId: string; groupName: string; optionId: string; label: string; priceAdjustment: number }[];
  widthM: string;
  heightM: string;
  quantity: string;
  unitPrice: string; // pesos, as typed
  codePrefix: string;
}

interface SectionState {
  key: string;
  id?: string;
  title: string;
  kind: "included" | "alternative";
  lines: LineState[];
}

const newLineKey = () => Math.random().toString(36).slice(2, 10);

const blankLine = (codePrefix = "W"): LineState => ({
  key: newLineKey(),
  selected: {},
  measurementUnit: "m", pricingMode: "per_unit", areaUnit: "sqm", minArea: 0, unit: "set", options: [],
  description: "",
  manualDescription: false,
  widthM: "",
  heightM: "",
  quantity: "1",
  unitPrice: "",
  codePrefix,
});

const sectionTitle = (n: number) => `Option ${String.fromCharCode(65 + n)}`;

/* ------------------------------------------------------------------ */
/* Small field helpers                                                 */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div className={`field${span ? " field--span" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

export function QuoteEditor({
  document: doc,
  specGroups,
  categories,
  items,
  settings,
  customers = [],
  initialCustomerId,
  initialProduct,
  initialDescription,
}: {
  document?: DocumentGraph | null;
  specGroups: SpecGroup[];
  categories: CategoryWithPrefix[];
  items: CatalogItem[];
  settings: Settings;
  customers?: Client[];
  initialCustomerId?: string;
  initialProduct?: Product;
  initialDescription?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(doc);
  const snapshot = { currency: doc?.currency ?? settings.currency, vatMode: doc?.vatMode ?? settings.vatMode, vatRate: Number(doc?.vatRate ?? settings.vatRate) };

  const firstPrefix = categories[0]?.codePrefix || "W";
  const today = new Date().toISOString().slice(0, 10);
  const initialCustomer = doc?.client ?? customers.find((customer) => customer.id === initialCustomerId);

  const [client, setClient] = useState(() => ({
    id: initialCustomer?.id,
    name: initialCustomer?.name ?? "",
    contactPerson: initialCustomer?.contactPerson ?? "",
    phone: initialCustomer?.phone ?? "",
    email: initialCustomer?.email ?? "",
    address: initialCustomer?.address ?? "",
    tin: initialCustomer?.tin ?? "",
  }));
  const [meta, setMeta] = useState({
    projectName: doc?.projectName ?? "",
    projectAddress: doc?.projectAddress ?? "",
    issueDate: doc?.issueDate ?? today,
    dueDate: doc?.dueDate ?? "",
    leadTime: doc?.leadTime ?? settings.defaultLeadTime ?? "",
    notes: doc?.notes ?? "",
    terms: doc?.terms ?? settings.defaultQuoteTerms ?? "",
  });
  const [pricing, setPricing] = useState({
    discountType: (doc?.discountType ?? "percent") as "percent" | "fixed",
    discountPercent: String(Number(doc?.discountPercent ?? 0)),
    discountFixed: String(Number(doc?.discountFixed ?? 0) / 100),
    depositPercent: String(Number(doc?.depositPercent ?? settings.defaultDepositPercent ?? 70)),
    charges: (doc?.extraCharges ?? []) as { label: string; amount: number }[],
    chargeLabel: "",
    chargeAmount: "",
  });
  const [acceptedSectionId, setAcceptedSectionId] = useState<string | null>(
    doc?.acceptedSectionId ?? null,
  );
  const [sections, setSections] = useState<SectionState[]>(() => {
    if (!doc?.sections?.length) {
      return [{ key: "s0", title: "", kind: "included", lines: [{ ...blankLine(firstPrefix), productId: initialProduct?.id, description: initialProduct ? `${initialProduct.name}${initialProduct.description ? `, ${initialProduct.description}` : ""}` : initialDescription ?? "", manualDescription: Boolean(initialProduct || initialDescription) }] }];
    }
    return doc.sections.map((s, i) => ({
      key: s.id,
      id: s.id,
      title: s.title ?? (s.kind === "alternative" ? sectionTitle(i) : ""),
      kind: s.kind,
      lines: s.lines.map((l) => {
        const selected: Record<string, string> = {};
        (l.options ?? []).forEach((o) => {
          selected[o.groupId] = o.optionId;
        });
        return {
          key: l.id,
          saved: l,
          selected,
          measurementUnit: (["m", "mm", "ft-in"].includes(l.inputUnit) ? l.inputUnit : "m") as MeasurementUnit, pricingMode: l.pricingMode, areaUnit: l.areaUnit, minArea: Number(l.minArea), unit: l.unit, options: l.options ?? [],
          description: l.description,
          manualDescription: true, // a loaded line keeps its exact text
          widthM: formatMeasurement(l.widthMm, (["m", "mm", "ft-in"].includes(l.inputUnit) ? l.inputUnit : "m") as MeasurementUnit),
          heightM: formatMeasurement(l.heightMm, (["m", "mm", "ft-in"].includes(l.inputUnit) ? l.inputUnit : "m") as MeasurementUnit),
          quantity: String(Number(l.quantity)),
          unitPrice: String(Number(l.unitPrice) / 100),
          codePrefix: l.code?.match(/^[A-Za-z]+/)?.[0] ?? firstPrefix,
        };
      }),
    }));
  });

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ---------------- line helpers ---------------- */

  const updateLine = (sKey: string, lKey: string, patch: Partial<LineState>) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key !== sKey
          ? s
          : {
              ...s,
              lines: s.lines.map((l) => (l.key === lKey ? { ...l, ...patch } : l)),
            },
      ),
    );
  };

  const selectedLabels = (line: LineState): { label: string; join: boolean }[] =>
    specGroups
      .map((g) => {
        const opt = g.options.find((o) => o.id === line.selected[g.id]);
        return opt ? { label: opt.label, join: g.joinWithPrevious } : null;
      })
      .filter((x): x is { label: string; join: boolean } => x !== null);

  /** Rebuild the description from the dropdowns + size. */
  const autoDescription = (line: LineState): string => {
    const widthMm = parseMeasurement(line.widthM, line.measurementUnit);
    const heightMm = parseMeasurement(line.heightM, line.measurementUnit);
    const parts = selectedLabels(line).map((p) => ({ label: p.label, joinWithPrevious: p.join }));
    return composeDescription(parts, { widthMm, heightMm });
  };

  const changeOption = (sKey: string, line: LineState, groupId: string, optionId: string) => {
    const selected = { ...line.selected };
    if (selected[groupId] === optionId) delete selected[groupId];
    else selected[groupId] = optionId;

    const group = specGroups.find((g) => g.id === groupId);
    const option = group?.options.find((o) => o.id === selected[groupId]);
    const options = line.options.filter((o) => o.groupId !== groupId);
    if (group && option) options.push({ groupId, groupName: group.name, optionId: option.id, label: option.label, priceAdjustment: option.priceAdjustment });
    const next: LineState = { ...line, selected, options };
    if (!line.manualDescription) next.description = autoDescription(next);
    updateLine(sKey, line.key, next);
  };

  const changeSize = (sKey: string, line: LineState, patch: Partial<LineState>) => {
    const next: LineState = { ...line, ...patch };
    if (!line.manualDescription) next.description = autoDescription(next);
    updateLine(sKey, line.key, next);
  };

  const addLine = (sKey: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === sKey ? { ...s, lines: [...s.lines, blankLine(firstPrefix)] } : s)),
    );
  };

  const removeLine = (sKey: string, lKey: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sKey ? { ...s, lines: s.lines.filter((l) => l.key !== lKey) } : s,
      ),
    );
  };

  const duplicateLine = (sKey: string, line: LineState) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key === sKey
          ? {
              ...s,
              lines: [...s.lines, { ...line, key: newLineKey(), saved: line.saved ? { ...line.saved, id: "" } : undefined, manualDescription: true }],
            }
          : s,
      ),
    );
  };

  const addSection = (kind: "included" | "alternative") => {
    setSections((prev) => [
      ...prev,
      {
        key: `s${Date.now()}`,
        title: kind === "alternative" ? sectionTitle(prev.filter((s) => s.kind === "alternative").length) : "",
        kind,
        lines: [blankLine(firstPrefix)],
      },
    ]);
  };

  const removeSection = (sKey: string) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.key !== sKey);
      if (acceptedSectionId === sKey) setAcceptedSectionId(null);
      return next;
    });
  };

  /* ---------------- totals ---------------- */

  const calcSections = useMemo(
    () =>
      sections.map((s) => ({
        id: s.key,
        kind: s.kind,
        lines: s.lines.map((l) => {
          const widthMm = parseMeasurement(l.widthM, l.measurementUnit);
          const heightMm = parseMeasurement(l.heightM, l.measurementUnit);
          const adjustments = l.options.reduce((sum, o) => sum + o.priceAdjustment, 0);
          return {
            pricingMode: l.pricingMode,
            unitPrice: parseMoneyInput(l.unitPrice || "0"),
            quantity: Number(l.quantity || 0),
            widthMm,
            heightMm,
            areaUnit: l.areaUnit,
            minArea: l.minArea,
            options: [{ priceAdjustment: adjustments }],
          };
        }),
      })),
    [sections],
  );

  const totals = useMemo(
    () =>
      computeDocument({
        sections: calcSections,
        selectedAlternativeId: acceptedSectionId,
        charges: pricing.charges.map((c) => ({ label: c.label, amount: c.amount })),
        discount:
          pricing.discountType === "percent"
            ? { type: "percent", value: Number(pricing.discountPercent || 0) }
            : { type: "fixed", value: parseMoneyInput(pricing.discountFixed || "0") },
        vatMode: snapshot.vatMode,
        vatRate: snapshot.vatRate,
        depositPercent: Number(pricing.depositPercent || 0),
      }),
    [calcSections, acceptedSectionId, pricing, snapshot.vatMode, snapshot.vatRate],
  );

  const altTotals = useMemo(
    () => computeAlternatives({ sections: calcSections, selectedAlternativeId: null, vatMode: snapshot.vatMode, vatRate: snapshot.vatRate }),
    [calcSections, snapshot.vatMode, snapshot.vatRate],
  );

  /** Codes are assigned in line order: W1, W2, D1 ... */
  const codedLines = useMemo(() => {
    const seen: Record<string, string[]> = {};
    return sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => {
        const prefix = l.codePrefix || "";
        const code = nextItemCode(prefix, seen[prefix] ?? []);
        seen[prefix] = [...(seen[prefix] ?? []), code];
        return { ...l, code };
      }),
    }));
  }, [sections]);

  /* ---------------- persistence ---------------- */

  const buildDraft = () => ({
    type: "quote" as const,
    client: {
      id: client.id,
      name: client.name.trim(),
      contactPerson: client.contactPerson || null,
      phone: client.phone || null,
      email: client.email || null,
      address: client.address || null,
      tin: client.tin || null,
    },
    projectName: meta.projectName || null,
    projectAddress: meta.projectAddress || null,
    issueDate: meta.issueDate,
    dueDate: meta.dueDate || null,
    currency: snapshot.currency,
    vatMode: snapshot.vatMode,
    vatRate: snapshot.vatRate,
    discountType: pricing.discountType,
    discountPercent: Number(pricing.discountPercent || 0),
    discountFixed: parseMoneyInput(pricing.discountFixed || "0"),
    extraCharges: pricing.charges,
    depositPercent: Number(pricing.depositPercent || 0),
    leadTime: meta.leadTime || null,
    acceptedSectionId,
    notes: meta.notes || null,
    terms: meta.terms || null,
    sections: codedLines
      .filter((s) => s.lines.length > 0)
      .map((s) => ({
        id: s.id,
        title: s.kind === "alternative" ? s.title || null : null,
        kind: s.kind,
        note: null,
        lines: s.lines.map((l) => {
          const optionIds = Object.values(l.selected);
          const snaps = l.options;
          return {
            id: l.saved?.id || undefined,
            productId: l.productId ?? l.saved?.productId ?? null,
            seriesId: l.saved?.seriesId ?? null,
            inputUnit: l.measurementUnit,
            glass: l.saved?.glass ?? null,
            finish: l.saved?.finish ?? null,
            notes: l.saved?.notes ?? null,
            designJson: l.saved?.designJson ?? null,
            designSvg: l.saved?.designSvg ?? null,
            lengthMm: l.saved?.lengthMm ?? null,
            itemId: l.saved?.itemId ?? items.find((i) => i.name === l.description.split(",")[0])?.id ?? null,
            code: l.code,
            description: l.description || "Item",
            unit: l.unit,
            minArea: l.minArea,
            pricingMode: l.pricingMode,
            areaUnit: l.areaUnit,
            widthMm: parseMeasurement(l.widthM, l.measurementUnit),
            heightMm: parseMeasurement(l.heightM, l.measurementUnit),
            quantity: Number(l.quantity),
            unitPrice: parseMoneyInput(l.unitPrice || "0"),
            options: snaps,
            specKey: optionIds.length ? optionIds.sort().join("|") : null,
          };
        }),
      })),
  });

  const save = async (): Promise<boolean> => {
    if (!client.name.trim()) {
      setNotice("Enter the customer name first.");
      return false;
    }
    const invalid = sections.flatMap((s) => s.lines).map((l, i) => {
      const error = validateLineNumbers(l.quantity, l.unitPrice || "0", l.widthM, l.heightM, l.measurementUnit, l.pricingMode === "per_area");
      return error ? `Line ${i + 1}: ${error}` : null;
    }).find(Boolean);
    if (invalid) { setNotice(invalid); return false; }
    const empty = sections.some((s) => s.lines.length === 0);
    if (empty) {
      setNotice("Every section needs at least one line - or remove the section.");
      return false;
    }

    setSaving(true);
    setNotice(null);
    try {
      const draft = buildDraft();
      if (isEdit) {
        const res = await fetch(`/api/documents/${doc!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
        setNotice("Saved.");
        router.refresh();
      } else {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
        const { id } = await res.json();
        router.push(`/quotes/${id}`);
        return true;
      }
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const action = async (body: Record<string, unknown>) => {
    if (!doc || busy || saving) return;
    if (!(await save())) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      if (body.action === "duplicate") {
        if (!json.id) throw new Error("The copied quotation could not be opened.");
        router.push(`/quotes/${encodeURIComponent(json.id)}`);
      }
      else {
        setNotice("Done.");
        router.refresh();
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const currency = snapshot.currency;

  /* ---------------- render ---------------- */

  return (
    <div className="editor-grid">
      <div className="editor__main">
        {/* ---------------- customer ---------------- */}
        <section className="card">
          <div className="card__head">
            <h2>Customer & project</h2>
          </div>
          <div className="field-grid">
            <label className="field field--span">Reuse customer
              <select aria-label="Reuse customer" value={client.id ?? ""} onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value);
                setClient(customer ? { id:customer.id,name:customer.name,contactPerson:customer.contactPerson??"",phone:customer.phone??"",email:customer.email??"",address:customer.address??"",tin:customer.tin??"" } : { id:undefined,name:"",contactPerson:"",phone:"",email:"",address:"",tin:"" });
              }}><option value="">New customer</option>{customers.map((customer)=><option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select>
            </label>
            <Field label="Customer name *">
              <input
                value={client.name}
                onChange={(e) => setClient({ ...client, name: e.target.value })}
                placeholder="Juan Dela Cruz"
                autoComplete="off"
              />
            </Field>
            <Field label="Mobile">
              <input
                value={client.phone}
                onChange={(e) => setClient({ ...client, phone: e.target.value })}
                placeholder="0917 000 0000"
                inputMode="tel"
              />
            </Field>
            <Field label="Email">
              <input
                value={client.email}
                onChange={(e) => setClient({ ...client, email: e.target.value })}
                placeholder="optional"
                inputMode="email"
              />
            </Field>
            <Field label="Project name">
              <input
                value={meta.projectName}
                onChange={(e) => setMeta({ ...meta, projectName: e.target.value })}
                placeholder="Tara Hostel"
              />
            </Field>
            <Field label="Site / address">
              <input
                value={meta.projectAddress}
                onChange={(e) => setMeta({ ...meta, projectAddress: e.target.value })}
                placeholder="Lio, El Nido"
              />
            </Field>
            <Field label="Issue date">
              <input
                type="date"
                value={meta.issueDate}
                onChange={(e) => setMeta({ ...meta, issueDate: e.target.value })}
              />
            </Field>
            <Field label="Lead time (working days)">
              <input
                value={meta.leadTime}
                onChange={(e) => setMeta({ ...meta, leadTime: e.target.value })}
                placeholder={settings.defaultLeadTime as string}
              />
            </Field>
          </div>
        </section>

        {/* ---------------- lines ---------------- */}
        {sections.map((section, sIdx) => {
          const coded = codedLines[sIdx]!;
          const isAlternative = section.kind === "alternative";
          const chosen = acceptedSectionId === section.key;
          const alt = isAlternative ? altTotals[section.key] : null;

          return (
            <section
              key={section.key}
              className={`section-card${isAlternative ? " section-card--alternative" : ""}${
                chosen ? " section-card--chosen" : ""
              }`}
            >
              <div className="section-card__head">
                <h3>
                  {isAlternative
                    ? section.title || sectionTitle(sIdx)
                    : "Items"}
                </h3>
                <div className="spacer" style={{ flex: 1 }} />
                {isAlternative && (
                  <>
                    <button
                      type="button"
                      className="btn btn--sm"
                      aria-pressed={chosen}
                      onClick={() => setAcceptedSectionId(chosen ? null : section.key)}
                      style={
                        chosen
                          ? { background: "#0f4c81", color: "#fff", borderColor: "#0f4c81" }
                          : undefined
                      }
                    >
                      {chosen ? "Selected" : "Use this option"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => removeSection(section.key)}
                      aria-label="Remove option"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>

              <div className="section-card__body">
                {isAlternative && (
                  <div className="field">
                    <label>Option label</label>
                    <input
                      value={section.title}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.key === section.key ? { ...s, title: e.target.value } : s,
                          ),
                        )
                      }
                      placeholder={sectionTitle(sectionTitleCount(sections, sIdx))}
                    />
                  </div>
                )}

                {section.lines.map((line, lIdx) => {
                  const code = coded.lines[lIdx]?.code ?? "";
                  const calculated = calcSections[sIdx].lines[lIdx];
                  const lineTotal = computeLine(calculated).lineTotal;
                  const sqft = calculated.widthMm && calculated.heightMm ? (calculated.widthMm * calculated.heightMm / 92903.04).toFixed(2) : "—";
                  return (
                    <div className="line-row" key={line.key}>
                      <div className="option-pick" style={{ marginBottom: 9 }}>
                        <span className="line-code">{code}</span>
                        {specGroups.map((group) => {
                          const active = line.selected[group.id];
                          const label = active
                            ? group.options.find((o) => o.id === active)?.label
                            : group.name;
                          return (
                            <select
                              key={group.id}
                              value={active ?? ""}
                              onChange={(e) =>
                                e.target.value &&
                                changeOption(section.key, line, group.id, e.target.value)
                              }
                              style={{
                                border: "1px solid var(--az-line)",
                                borderRadius: 999,
                                padding: "5px 9px",
                                fontSize: ".74rem",
                                fontWeight: 700,
                                background: active ? "#0f4c81" : "#fff",
                                color: active ? "#fff" : "var(--az-muted)",
                                cursor: "pointer",
                              }}
                              aria-label={group.name}
                            >
                              <option value="">{label}</option>
                              {group.options.map((o) => (
                                <option key={o.id} value={o.id} style={{ color: "#14263d" }}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          );
                        })}
                      </div>

                      <div className="line-row__grid">
                        <div className="field line-row__desc">
                          <label>
                            Description{" "}
                            {!line.manualDescription && (
                              <span style={{ color: "#0f4c81" }}>(auto)</span>
                            )}
                          </label>
                          <input
                            value={line.description}
                            onChange={(e) =>
                              updateLine(section.key, line.key, {
                                description: e.target.value,
                                manualDescription: true,
                              })
                            }
                            placeholder="Pick a series and type, or type it yourself"
                          />
                        </div>
                        <Field label="Dimension unit">
                          <select aria-label="Dimension unit" value={line.measurementUnit} onChange={(e) => {
                            const unit = e.target.value as MeasurementUnit;
                            const width = parseMeasurement(line.widthM, line.measurementUnit);
                            const height = parseMeasurement(line.heightM, line.measurementUnit);
                            if ((line.widthM.trim() && width === null) || (line.heightM.trim() && height === null)) { setNotice("Correct the dimensions before changing units."); return; }
                            changeSize(section.key, line, { measurementUnit: unit, widthM: formatMeasurement(width, unit), heightM: formatMeasurement(height, unit) });
                          }}><option value="m">Metres (m)</option><option value="mm">Millimetres (mm)</option><option value="ft-in">Feet / inches</option></select>
                        </Field>
                        <Field label={`Width (${line.measurementUnit})`}>
                          <input
                            value={line.widthM}
                            inputMode="decimal"
                            onChange={(e) =>
                              changeSize(section.key, line, { widthM: e.target.value })
                            }
                            placeholder="1.50"
                          />
                        </Field>
                        <Field label={`Height (${line.measurementUnit})`}>
                          <input
                            value={line.heightM}
                            inputMode="decimal"
                            onChange={(e) =>
                              changeSize(section.key, line, { heightM: e.target.value })
                            }
                            placeholder="2.10"
                          />
                        </Field>
                        <Field label="Qty">
                          <input
                            value={line.quantity}
                            inputMode="decimal"
                            onChange={(e) =>
                              updateLine(section.key, line.key, { quantity: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Rate basis">
                          <select aria-label="Rate basis" value={line.pricingMode === "per_unit" ? "set" : line.areaUnit} onChange={(e) => updateLine(section.key, line.key, e.target.value === "set" ? { pricingMode: "per_unit" } : { pricingMode: "per_area", areaUnit: e.target.value as "sqm" | "sqft" })}>
                            <option value="set">Per {line.unit}</option><option value="sqft">Per square foot</option><option value="sqm">Per square metre</option>
                          </select>
                        </Field>
                        <Field label={`Rate / ${line.pricingMode === "per_unit" ? line.unit : line.areaUnit}`}>
                          <div className="money-input">
                            <input
                              value={line.unitPrice}
                              inputMode="decimal"
                              onChange={(e) =>
                                updateLine(section.key, line.key, { unitPrice: e.target.value })
                              }
                              placeholder="0.00"
                            />
                          </div>
                        </Field>
                      </div>

                      <div className="line-row__foot">
                        <select
                          value={line.codePrefix}
                          onChange={(e) =>
                            updateLine(section.key, line.key, { codePrefix: e.target.value })
                          }
                          aria-label="Item code prefix"
                          style={{
                            border: "1px solid var(--az-line)",
                            borderRadius: 8,
                            padding: "4px 7px",
                            fontSize: ".74rem",
                            fontWeight: 700,
                          }}
                        >
                          {categories
                            .filter((c) => c.codePrefix)
                            .map((c) => (
                              <option key={c.id} value={c.codePrefix}>
                                {c.codePrefix} - {c.name}
                              </option>
                            ))}
                        </select>

                        {!line.manualDescription && line.description && (
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() =>
                              updateLine(section.key, line.key, { manualDescription: true })
                            }
                          >
                            <Sparkles size={13} /> Keep this text
                          </button>
                        )}
                        {line.manualDescription && (
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => {
                              const next = { ...line, manualDescription: false };
                              updateLine(section.key, line.key, {
                                manualDescription: false,
                                description: autoDescription(next),
                              });
                            }}
                          >
                            Rebuild
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => duplicateLine(section.key, line)}
                        >
                          <Copy size={13} /> Copy
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => removeLine(section.key, line.key)}
                          aria-label="Remove line"
                        >
                          <Trash2 size={13} />
                        </button>

                        <span className="inline-note">Area: {sqft} sqft{line.minArea > 0 ? ` · Minimum billable area: ${line.minArea} ${line.areaUnit}` : ""}</span>
                        <span className="line-row__total">{formatMoney(lineTotal, currency)}</span>
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn--sm" onClick={() => addLine(section.key)}>
                    <Plus size={14} /> Add line
                  </button>
                  {alt && (
                    <span className="inline-note">
                      Total for this option: {formatMoney(alt.total, currency)}
                    </span>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            onClick={() => addSection("alternative")}
            title="Add Option A / Option B"
          >
            <Plus size={14} /> Add option A/B
          </button>
        </div>

        {/* ---------------- terms ---------------- */}
        <section className="card">
          <div className="card__head">
            <h2>Payment terms</h2>
          </div>
          <p className="card__hint">
            Printed on the quotation exactly as written here.
          </p>
          <div className="field" style={{ marginTop: 10 }}>
            <textarea
              value={meta.terms}
              onChange={(e) => setMeta({ ...meta, terms: e.target.value })}
              rows={9}
            />
          </div>
        </section>
      </div>

      {/* ---------------- side panel ---------------- */}
      <aside className="editor__side">
        <div className="totals-card">
          <div className="total-line">
            <span>Sub total</span>
            <strong>{formatMoney(totals.subtotal, currency)}</strong>
          </div>
          {totals.discountAmount > 0 && (
            <div className="total-line">
              <span>Discount</span>
              <strong>-{formatMoney(totals.discountAmount, currency)}</strong>
            </div>
          )}
          {totals.chargesTotal > 0 && (
            <div className="total-line">
              <span>Delivery & installation</span>
              <strong>{formatMoney(totals.chargesTotal, currency)}</strong>
            </div>
          )}
          {totals.vatAmount > 0 && (
            <div className="total-line">
              <span>VAT ({snapshot.vatRate}%)</span>
              <strong>{formatMoney(totals.vatAmount, currency)}</strong>
            </div>
          )}
          <div className="total-line total-line--grand">
            <span>Total</span>
            <strong>{formatMoney(totals.total, currency)}</strong>
          </div>
          <div className="total-line total-line--deposit">
            <span>{Number(pricing.depositPercent || 0)}% down payment</span>
            <strong>{formatMoney(totals.deposit, currency)}</strong>
          </div>

          {totals.hasUnselectedAlternatives && (
            <div className="totals-warn">
              Choose which option counts before sending - totals show 0 until then.
            </div>
          )}
        </div>

        <section className="card">
          <div className="card__head">
            <h2>Adjustments</h2>
          </div>
          <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Discount type">
              <select
                value={pricing.discountType}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    discountType: e.target.value as "percent" | "fixed",
                  })
                }
              >
                <option value="percent">Percent</option>
                <option value="fixed">Amount</option>
              </select>
            </Field>
            <Field label={pricing.discountType === "percent" ? "Percent off" : "Amount off"}>
              <div className={pricing.discountType === "fixed" ? "money-input" : undefined}>
                <input
                  value={pricing.discountType === "percent" ? pricing.discountPercent : pricing.discountFixed}
                  inputMode="decimal"
                  onChange={(e) =>
                    setPricing({
                      ...pricing,
                      ...(pricing.discountType === "percent"
                        ? { discountPercent: e.target.value }
                        : { discountFixed: e.target.value }),
                    })
                  }
                />
              </div>
            </Field>
            <Field label="Deposit %">
              <input
                value={pricing.depositPercent}
                inputMode="decimal"
                onChange={(e) => setPricing({ ...pricing, depositPercent: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div className="field-grid">
              <Field label="Delivery / installation label">
                <input
                  value={pricing.chargeLabel}
                  onChange={(e) => setPricing({ ...pricing, chargeLabel: e.target.value })}
                  placeholder="Delivery and Installation"
                />
              </Field>
              <Field label="Amount">
                <div className="money-input">
                  <input
                    value={pricing.chargeAmount}
                    inputMode="decimal"
                    onChange={(e) => setPricing({ ...pricing, chargeAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </Field>
            </div>
            <button
              type="button"
              className="btn btn--sm"
              disabled={!pricing.chargeLabel.trim() || !pricing.chargeAmount.trim()}
              onClick={() => {
                const amount = parseMoneyInput(pricing.chargeAmount || "0");
                if (!amount) return;
                setPricing({
                  ...pricing,
                  charges: [
                    ...pricing.charges,
                    { label: pricing.chargeLabel.trim(), amount },
                  ],
                  chargeLabel: "",
                  chargeAmount: "",
                });
              }}
            >
              <Plus size={14} /> Add charge
            </button>

            {pricing.charges.map((c, i) => (
              <div key={`${c.label}-${i}`} className="total-line">
                <span>{c.label}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>{formatMoney(c.amount, currency)}</strong>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    aria-label={`Remove ${c.label}`}
                    onClick={() =>
                      setPricing({
                        ...pricing,
                        charges: pricing.charges.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>

        {notice && <div className="inline-note">{notice}</div>}

        <div className="sticky-save">
          <button type="button" className="btn btn--primary" onClick={() => void save()} disabled={saving || busy}>
            <Save size={16} /> {saving ? "Saving..." : isEdit ? "Save quote" : "Save & review"}
          </button>
          {isEdit && (
            <button
              type="button"
              className="btn"
              disabled={busy || saving}
              onClick={() => action({ action: "duplicate" })}
              title="Duplicate into a fresh quote"
            >
              <Copy size={16} />
            </button>
          )}
          {isEdit && doc?.status === "sent" && (["accepted", "rejected"] as const).map((status) => (
            <button key={status} type="button" className="btn" disabled={busy || saving} onClick={() => action({ action: "status", status })}>Mark {status}</button>
          ))}
          {isEdit && doc?.status === "draft" && (
            <button
              type="button"
              className="btn"
              disabled={busy || saving}
              onClick={() => action({ action: "status", status: "sent" })}
            >
              <Send size={16} /> Mark sent
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

/** "Option A" numbering only counts alternative sections. */
function sectionTitleCount(sections: SectionState[], index: number): number {
  return sections.slice(0, index + 1).filter((s) => s.kind === "alternative").length - 1;
}
