import type { FinishedProject } from "./catalog-types";

/** Keep original source identity: different files can share a quotation number and item code. */
export function findSourceDrawings(projects: FinishedProject[], query: string, category: string) {
  const term=query.trim().toLowerCase();
  return projects.flatMap(project=>project.items.map(item=>({project,item}))).filter(({project,item})=>
    Boolean(item.imageDataUrl) && (category==="All" || category===item.category) &&
    [item.name,item.description,item.itemCode,item.series,project.fileName,project.invoiceNumber,project.clientName].join(" ").toLowerCase().includes(term));
}
