"use client";

import { useSyncExternalStore } from "react";
import type { ProductPageSize } from "@/lib/product-search-types";

const KEY = "azarraga:product-page-size";
const EVENT = "azarraga:product-page-size-changed";
function snapshot(): ProductPageSize {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "all" ? "all" : saved === "100" ? 100 : saved === "250" ? 250 : 50;
  } catch { return 50; }
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useProductPageSize() {
  const value = useSyncExternalStore(subscribe, snapshot, () => 50 as const);
  const change = (next: ProductPageSize) => {
    try { localStorage.setItem(KEY, String(next)); } catch { /* Storage may be unavailable in private browsing. */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, change] as const;
}
export function ProductPageSizeControl({ value, onChange }: { value: ProductPageSize; onChange: (value: ProductPageSize) => void }) {
  return <label className="pf-display">Show <select aria-label="Products to display" value={value} onChange={event => onChange(event.target.value === "all" ? "all" : Number(event.target.value) as ProductPageSize)}>
    <option value="50">50 products</option><option value="100">100 products</option><option value="250">250 products</option><option value="all">All products</option>
  </select></label>;
}
