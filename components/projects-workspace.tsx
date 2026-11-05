"use client";
import { useRouter } from "next/navigation";
import { FinishedProjectsScreen } from "@/components/finished-projects";
export function ProjectsWorkspace() {
  const router=useRouter();
  return <FinishedProjectsScreen onCatalogUpdated={async()=>router.refresh()} onUseInConfigure={item=>{
    const params = item.sourceProjectId && item.sourceProjectId > 0 && item.sourceItemId
      ? new URLSearchParams({sourceProject:String(item.sourceProjectId),sourceItem:item.sourceItemId})
      : new URLSearchParams({description:item.description||item.productName});
    router.push(`/quotes/new?${params}`);
  }}/>;
}
