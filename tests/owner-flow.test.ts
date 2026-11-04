import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createDocument, loadDocument, saveDocument, listDocuments, getSettings, saveSettings, listCustomers, setStatus, duplicateDocument, convertQuoteToInvoice,recordPayment,listPayments,deletePayment, type DocumentDraft } from "../lib/documents";

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("DATABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_LOCAL_PREVIEW", ""); });
afterEach(() => vi.unstubAllEnvs());

const draft = (): DocumentDraft => ({
  client: { name: `Test ${crypto.randomUUID()}` }, projectName: "House windows",
  discountType: "percent", discountPercent: 10, currency: "PHP",
  sections: [{ lines: [
    { description: "Sliding window", widthMm: 1200, heightMm: 1500, quantity: 2, unitPrice: 100000 },
    { description: "Sliding door", widthMm: 1800, heightMm: 2100, quantity: 1, unitPrice: 250000 },
  ] }],
});

test("multi-line quote saves, reopens, edits and keeps its number and customer", async () => {
  const input = draft();
  const id = await createDocument(input);
  const saved = (await loadDocument(id))!;
  expect(saved.sections[0].lines).toHaveLength(2);
  expect(saved.total).toBe(405000);
  expect(saved.number).toMatch(/^Q\d{4}-\d{3,}$/);
  input.client.id = saved.clientId;
  input.sections[0].lines[0].quantity = 3;
  await saveDocument(id, input);
  const edited = (await loadDocument(id))!;
  expect(edited.number).toBe(saved.number);
  expect(edited.clientId).toBe(saved.clientId);
  expect(edited.total).toBe(495000);
  expect((await listDocuments({ type: "quote" })).some((doc) => doc.id === id)).toBe(true);
});

test("status follows draft to sent to accepted and rejects invalid jumps", async () => {
  const id = await createDocument(draft());
  await expect(setStatus(id, "accepted")).rejects.toThrow();
  await setStatus(id, "sent");
  await setStatus(id, "accepted");
  expect((await loadDocument(id))!.status).toBe("accepted");
  await expect(setStatus(id, "draft")).rejects.toThrow();
});

test("duplicate has a new identity and number with the original customer and lines", async () => {
  const id = await createDocument(draft());
  const copyId = await duplicateDocument(id);
  const original = (await loadDocument(id))!;
  const copy = (await loadDocument(copyId))!;
  expect(copyId).not.toBe(id);
  expect(copy.number).not.toBe(original.number);
  expect(copy.clientId).toBe(original.clientId);
  expect(copy.sections[0].lines.map((line) => line.description)).toEqual(original.sections[0].lines.map((line) => line.description));
});

test("production without a database never falls back to memory", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(getSettings()).rejects.toThrow("DATABASE_URL");
});

test("area pricing, selected option adjustments and design metadata survive save and duplicate", async()=>{
  const input=draft();const line=input.sections[0].lines[0];
  Object.assign(line,{pricingMode:"per_area",areaUnit:"sqft",inputUnit:"ft-in",productId:12,seriesId:4,designJson:{shapes:[]},designSvg:"<svg/>",notes:"Site measured",options:[{groupId:"g",groupName:"Glass",optionId:"o",label:"Tempered",priceAdjustment:10000}]});
  const id=await createDocument(input);const initial=(await loadDocument(id))!;
  await saveDocument(id,{...input,client:{...input.client,id:initial.clientId}});
  const copy=(await loadDocument(await duplicateDocument(id)))!;
  expect(copy.total).toBe(initial.total);
  expect(copy.sections[0].lines[0]).toMatchObject({pricingMode:"per_area",areaUnit:"sqft",inputUnit:"ft-in",productId:12,seriesId:4,designSvg:"<svg/>",notes:"Site measured"});
});

test("currency settings apply to new quotes without changing old snapshots",async()=>{
  const original=await getSettings();const id=await createDocument(draft());
  await saveSettings({currency:"EUR"});
  const input=draft();delete input.currency;const next=await createDocument(input);
  expect((await loadDocument(id))!.currency).toBe("PHP");expect((await loadDocument(next))!.currency).toBe("EUR");
  await saveSettings(original);
});

test("reused customer is not duplicated and malformed prices never persist",async()=>{
  const input=draft();const id=await createDocument(input);const saved=(await loadDocument(id))!;
  await createDocument({...input,client:{...input.client,id:saved.clientId}});
  expect((await listCustomers()).filter(c=>c.id===saved.clientId)).toHaveLength(1);
  input.sections[0].lines[0].quantity=-2;
  await expect(createDocument(input)).rejects.toThrow();
});

test("existing invoice and payment controls work in development memory mode",async()=>{
  const quoteId=await createDocument(draft());const id=await convertQuoteToInvoice(quoteId);
  expect((await loadDocument(id))!.type).toBe("invoice");
  await recordPayment({documentId:id,amount:100000});
  expect((await loadDocument(id))!.amountPaid).toBe(100000);
  const payments=await listPayments(id);await deletePayment(payments[0].id);
  expect((await loadDocument(id))!.amountPaid).toBe(0);
});

test("duplicating selected alternatives keeps totals but creates new section identities",async()=>{
  const input=draft();const selectedId=crypto.randomUUID();
  input.sections.push({id:selectedId,kind:"alternative",title:"Option A",lines:[{description:"Tempered upgrade",quantity:1,unitPrice:20000}]});input.acceptedSectionId=selectedId;
  const original=(await loadDocument(await createDocument(input)))!;
  const copy=(await loadDocument(await duplicateDocument(original.id)))!;
  expect(copy.total).toBe(original.total);expect(copy.acceptedSectionId).not.toBe(selectedId);
  expect(copy.sections.some(section=>section.id===copy.acceptedSectionId)).toBe(true);
});
