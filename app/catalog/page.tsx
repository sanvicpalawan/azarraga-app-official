import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CatalogBrowser } from "@/components/catalog-browser";
import { ProjectsWorkspace } from "@/components/projects-workspace";
import { StudioWorkspace } from "@/components/studio-workspace";
export const dynamic="force-dynamic";
export default async function CatalogPage({searchParams}:{searchParams:Promise<{view?:string}>}){
  const {view}=await searchParams;
  if(view==="admin")redirect("/admin");
  if(view==="studio")return <AppShell wide catalogScreen="studio"><StudioWorkspace/></AppShell>;
  if(view==="projects")return <AppShell wide catalogScreen="projects"><ProjectsWorkspace/></AppShell>;
  return <AppShell wide catalogScreen="library"><CatalogBrowser/></AppShell>;
}
