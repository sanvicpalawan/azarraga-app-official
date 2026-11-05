"use client";
import Link from "next/link";
import { ProductFinder } from "./product-finder";
export function CatalogBrowser(){
 return <><div className="page-head"><div><h1>Product library</h1><p className="page-sub">Find real quotation products and catalog products. Review the price for each new project.</p></div><Link className="btn" href="/admin/catalog?tab=products">Manage products</Link></div><ProductFinder embedded/></>;
}
