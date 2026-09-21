import { defaultSpec, type Design, type Section } from "@/components/designer/designer-core";
import { getDb, readySchema } from "./db";

type Row = Record<string, unknown>;

function fromRow(row: Row): Design {
  const section = String(row.section || "Windows") as Section;
  return {
    id: String(row.id),
    name: String(row.name || ""),
    code: String(row.code || ""),
    description: String(row.description || ""),
    widthMm: Number(row.width_mm),
    heightMm: Number(row.height_mm),
    shapes: (row.shapes || []) as Design["shapes"],
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    section,
    type: String(row.type || ""),
    series: String(row.series || ""),
    unit: (row.unit || "m") as Design["unit"],
    spec: { ...defaultSpec(section), ...((row.spec || {}) as Design["spec"]) },
  };
}

export async function listDesigns(): Promise<Design[]> {
  await readySchema();
  const rows = await getDb()`select * from glass_designs order by updated_at desc`;
  return rows.map((row: Row) => fromRow(row));
}

export async function saveDesign(design: Design): Promise<void> {
  await readySchema();
  const db = getDb();
  await db`
    insert into glass_designs (
      id, name, code, description, width_mm, height_mm,
      section, type, series, unit, spec, shapes, updated_at
    ) values (
      ${design.id}, ${design.name}, ${design.code}, ${design.description},
      ${design.widthMm}, ${design.heightMm}, ${design.section ?? "Windows"},
      ${design.type ?? ""}, ${design.series ?? ""}, ${design.unit ?? "m"},
      ${JSON.stringify(design.spec ?? {})}::jsonb,
      ${JSON.stringify(design.shapes)}::jsonb, ${design.updatedAt}
    )
    on conflict (id) do update set
      name = excluded.name,
      code = excluded.code,
      description = excluded.description,
      width_mm = excluded.width_mm,
      height_mm = excluded.height_mm,
      section = excluded.section,
      type = excluded.type,
      series = excluded.series,
      unit = excluded.unit,
      spec = excluded.spec,
      shapes = excluded.shapes,
      updated_at = excluded.updated_at`;
}

export async function deleteDesign(id: string): Promise<boolean> {
  await readySchema();
  const rows = await getDb()`delete from glass_designs where id = ${id} returning id`;
  return rows.length > 0;
}
