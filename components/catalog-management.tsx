"use client";
import {useState} from "react";
import {AdminDashboard} from "@/components/admin-dashboard";
import type {Catalog} from "@/lib/catalog-types";
export function CatalogManagement({initial,products}:{initial:Catalog;products:boolean}){const[catalog,setCatalog]=useState(initial);return <AdminDashboard mode={products?"library":"settings"} catalog={catalog} refresh={async()=>{const res=await fetch("/api/catalog",{cache:"no-store"});if(!res.ok)throw new Error("Catalog unavailable");setCatalog(await res.json());}}/>;}
