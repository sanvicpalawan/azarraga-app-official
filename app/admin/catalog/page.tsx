import {AppShell} from "@/components/app-shell";
import {CatalogManagement} from "@/components/catalog-management";
import {getCatalogSnapshot} from "@/lib/catalog-store";
export const dynamic="force-dynamic";
export default async function AdminCatalog({searchParams}:{searchParams:Promise<{tab?:string}>}){const{tab}=await searchParams;return <AppShell wide><CatalogManagement initial={await getCatalogSnapshot()} products={tab==="products"}/></AppShell>;}
