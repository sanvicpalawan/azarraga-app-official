import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import path from "node:path";
import { readFileSync } from "node:fs";
import { formatMoney } from "@/lib/currency";
import type { DocumentGraph, Settings } from "@/lib/documents";

/**
 * The PDF staff send on WhatsApp. It follows the layout of the Excel
 * quotation the shop has used for years:
 *
 *   letterhead -> Quotation # + date -> customer -> item table ->
 *   totals -> 70/30 payment block -> lead time / delivery clauses.
 *
 * Every number comes from the recomputed row totals, never from the client.
 */

Font.register({ family: "AzarragaPDF", src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "AzarragaPDF-Bold", src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf") });

const BRAND = "#0F4C81";
const LINE = "#D5DEE8";
const MUTED = "#607188";

const s = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: 34,
    paddingBottom: 40,
    fontSize: 9,
    color: "#14263D",
    fontFamily: "AzarragaPDF",
  },

  /* ---------- letterhead ---------- */
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 9,
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
  },
  headLeft: { flexDirection: "row", alignItems: "center", maxWidth: 340 },
  logo: { width: 54, height: 54, marginRight: 11, objectFit: "contain" },
  logoMark: {
    width: 54,
    height: 54,
    marginRight: 11,
    borderRadius: 6,
    backgroundColor: BRAND,
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "AzarragaPDF-Bold",
    textAlign: "center",
    lineHeight: 54,
  },
  company: { fontSize: 14, fontFamily: "AzarragaPDF-Bold", color: BRAND, marginBottom: 2 },
  address: { fontSize: 7.5, color: MUTED, lineHeight: 1.35 },
  headRight: { textAlign: "right", fontSize: 7.5, color: MUTED, lineHeight: 1.4 },

  /* ---------- title row ---------- */
  titleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  title: { fontSize: 17, fontFamily: "AzarragaPDF-Bold", color: BRAND, letterSpacing: 1.4 },
  docNo: { fontSize: 9, fontFamily: "AzarragaPDF-Bold", textAlign: "right" },
  docMeta: { fontSize: 7.5, color: MUTED, textAlign: "right", marginTop: 3, lineHeight: 1.4 },

  /* ---------- parties ---------- */
  parties: { flexDirection: "row", marginTop: 15, marginBottom: 14 },
  party: { flex: 1, paddingRight: 12 },
  partyLabel: {
    fontSize: 6.5,
    color: MUTED,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  partyName: { fontSize: 10.5, fontFamily: "AzarragaPDF-Bold", marginBottom: 2 },
  partyLine: { fontSize: 8, color: MUTED, lineHeight: 1.45 },

  /* ---------- table ---------- */
  tableHead: {
    flexDirection: "row",
    backgroundColor: BRAND,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  th: { color: "#FFFFFF", fontSize: 7, letterSpacing: 0.9, fontFamily: "AzarragaPDF-Bold" },
  groupRow: {
    flexDirection: "row",
    backgroundColor: "#EDF4FA",
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginTop: 4,
  },
  groupText: { fontSize: 7.5, fontFamily: "AzarragaPDF-Bold", color: BRAND, letterSpacing: 0.6 },
  row: {
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  rowAlt: { backgroundColor: "#FAFCFE" },
  cell: { fontSize: 8, lineHeight: 1.35 },
  cItem: { width: 40 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 44, textAlign: "right" },
  cUnit: { width: 66, textAlign: "right" },
  cSub: { width: 74, textAlign: "right" },
  bold: { fontFamily: "AzarragaPDF-Bold" },
  muted: { color: MUTED },

  /* ---------- totals ---------- */
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totals: { width: 268 },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  totalLabel: { fontSize: 8, color: MUTED },
  totalValue: { fontSize: 8.5, fontFamily: "AzarragaPDF-Bold" },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: BRAND,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 3,
  },
  grandLabel: { fontSize: 10, color: "#FFFFFF", fontFamily: "AzarragaPDF-Bold" },
  grandValue: { fontSize: 13, color: "#FFFFFF", fontFamily: "AzarragaPDF-Bold" },
  deposit: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFF6E5",
    borderLeftWidth: 3,
    borderLeftColor: "#F0A500",
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  depositLabel: { fontSize: 8.5, color: "#7A4B00", fontFamily: "AzarragaPDF-Bold" },
  depositValue: { fontSize: 10, color: "#7A4B00", fontFamily: "AzarragaPDF-Bold" },

  /* ---------- terms ---------- */
  termsBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#F8FBFE",
  },
  termsTitle: {
    fontSize: 7,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: BRAND,
    fontFamily: "AzarragaPDF-Bold",
    marginBottom: 6,
  },
  termsText: { fontSize: 7.8, lineHeight: 1.55, color: "#243B55" },
  noteTitle: {
    fontSize: 7,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: BRAND,
    fontFamily: "AzarragaPDF-Bold",
    marginTop: 10,
    marginBottom: 5,
  },

  foot: {
    position: "absolute",
    bottom: 18,
    left: 34,
    right: 34,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
    fontSize: 6.8,
    color: MUTED,
  },
});

/* Column widths, kept in one place so head and body cannot drift apart. */
const COL = { item: 40, desc: 0, qty: 44, unit: 66, sub: 74 };

interface LineRow {
  code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export function DocumentPdf({
  doc,
  settings,
}: {
  doc: DocumentGraph;
  settings: Settings;
}) {
  const cur = doc.currency;
  const isQuote = doc.type === "quote";
  const logo = (settings.logoDataUrl as string | null) || `data:image/jpeg;base64,${readFileSync(path.join(process.cwd(), "public/azarraga-logo-mark.jpg")).toString("base64")}`;

  // Alternatives: only the section the owner picked (or the included one).
  const shownSections = doc.sections.filter((section) =>
    doc.acceptedSectionId
      ? section.id === doc.acceptedSectionId
      : section.kind === "included",
  );

  const rows: { group: string | null; lines: LineRow[] }[] = [];
  shownSections.forEach((section) => {
    if (section.kind === "alternative" && section.title) {
      rows.push({ group: section.title, lines: [] });
    }
    rows.push({
      group: null,
      lines: section.lines.map((l) => ({
        code: l.code,
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitPrice: Number(l.unitPrice),
        lineTotal: Number(l.lineTotal),
      })),
    });
  });

  const deposit = Math.round((Number(doc.total) * Number(doc.depositPercent)) / 100);
  const balance = Math.max(Number(doc.total) - Number(doc.amountPaid), 0);

  let rowIx = 0;

  return (
    <Document
      title={`${isQuote ? "Quotation" : "Invoice"} ${doc.number}`}
      author={String(settings.name)}
      subject={`${doc.client.name} - ${doc.number}`}
    >
      <Page size="A4" style={s.page}>
        {/* ---------------- letterhead ---------------- */}
        <View style={s.head} fixed>
          <View style={s.headLeft}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf has no alt prop
              <Image src={logo} style={s.logo} />
            ) : (
              <Text style={s.logoMark}>AG</Text>
            )}
            <View>
              <Text style={s.company}>{String(settings.name)}</Text>
              <Text style={s.address}>{String(settings.address)}</Text>
            </View>
          </View>
          <Text style={s.headRight}>
            {String(settings.phone)}
            {"\n"}
            {String(settings.email)}
            {settings.tin ? `\nTIN: ${String(settings.tin)}` : ""}
          </Text>
        </View>

        {/* ---------------- title ---------------- */}
        <View style={s.titleRow}>
          <Text style={s.title}>{isQuote ? "QUOTATION" : "INVOICE"}</Text>
          <View>
            <Text style={s.docNo}>
              {isQuote ? "Quotation # " : "Invoice # "}
              {doc.number}
            </Text>
            <Text style={s.docMeta}>Date issued: {doc.issueDate}</Text>
            {doc.dueDate && <Text style={s.docMeta}>Due date: {doc.dueDate}</Text>}
            {doc.leadTime && <Text style={s.docMeta}>Lead time: {doc.leadTime}</Text>}
          </View>
        </View>

        {/* ---------------- customer ---------------- */}
        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyLabel}>Customer</Text>
            <Text style={s.partyName}>{doc.client.name}</Text>
            {doc.client.address && <Text style={s.partyLine}>{doc.client.address}</Text>}
            {doc.client.phone && <Text style={s.partyLine}>{doc.client.phone}</Text>}
            {doc.client.email && <Text style={s.partyLine}>{doc.client.email}</Text>}
          </View>
          <View style={[s.party, { paddingRight: 0 }]}>
            <Text style={s.partyLabel}>Project</Text>
            <Text style={s.partyName}>{doc.projectName ?? "-"}</Text>
            {doc.projectAddress && <Text style={s.partyLine}>{doc.projectAddress}</Text>}
            <Text style={s.partyLine}>
              Currency: {doc.currency}
              {doc.vatMode === "none" ? " · VAT not applied" : ` · VAT ${Number(doc.vatRate)}%`}
            </Text>
          </View>
        </View>

        {/* ---------------- table ---------------- */}
        <View style={s.tableHead} fixed>
          <Text style={[s.th, { width: COL.item }]}>ITEM #</Text>
          <Text style={[s.th, { flex: 1, paddingHorizontal: 8 }]}>DESCRIPTION</Text>
          <Text style={[s.th, { width: COL.qty, textAlign: "right" }]}>QTY</Text>
          <Text style={[s.th, { width: COL.unit, textAlign: "right" }]}>UNIT COST</Text>
          <Text style={[s.th, { width: COL.sub, textAlign: "right" }]}>SUBTOTAL</Text>
        </View>

        {rows.map((block, bi) => (
          <View key={`${bi}`} wrap={false}>
            {block.group && (
              <View style={s.groupRow}>
                <Text style={s.groupText}>{block.group}</Text>
              </View>
            )}
            {block.lines.map((l, li) => {
              rowIx += 1;
              const alt = rowIx % 2 === 0;
              return (
                <View style={[s.row, alt ? s.rowAlt : undefined]} key={`${bi}-${li}`}>
                  <Text style={[s.cell, s.cItem, s.bold]}>
                    {l.code ?? `${bi + 1}.${li + 1}`}
                  </Text>
                  <Text style={[s.cell, s.cDesc]}>{l.description}</Text>
                  <Text style={[s.cell, s.cQty]}>
                    {l.quantity} {l.unit}
                  </Text>
                  <Text style={[s.cell, s.cUnit]}>
                    {formatMoney(l.unitPrice, cur)}
                  </Text>
                  <Text style={[s.cell, s.cSub, s.bold]}>
                    {formatMoney(l.lineTotal, cur)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* ---------------- totals ---------------- */}
        <View style={s.totals} wrap={false}>
          <View style={s.totalLine}>
            <Text style={s.totalLabel}>Sub total</Text>
            <Text style={s.totalValue}>{formatMoney(Number(doc.subtotal), cur)}</Text>
          </View>
          {Number(doc.discountAmount) > 0 && (
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>Discount</Text>
              <Text style={s.totalValue}>
                -{formatMoney(Number(doc.discountAmount), cur)}
              </Text>
            </View>
          )}
          {Number(doc.chargesTotal) > 0 && (
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>Delivery and Installation</Text>
              <Text style={s.totalValue}>
                {formatMoney(Number(doc.chargesTotal), cur)}
              </Text>
            </View>
          )}
          {Number(doc.vatAmount) > 0 && (
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>VAT ({Number(doc.vatRate)}%)</Text>
              <Text style={s.totalValue}>
                {formatMoney(Number(doc.vatAmount), cur)}
              </Text>
            </View>
          )}
          <View style={s.grand}>
            <Text style={s.grandLabel}>{isQuote ? "TOTAL" : "AMOUNT DUE"}</Text>
            <Text style={s.grandValue}>{formatMoney(Number(doc.total), cur)}</Text>
          </View>
          <View style={s.deposit}>
            <Text style={s.depositLabel}>
              {Number(doc.depositPercent)}% Down Payment{isQuote ? " (on approval)" : ""}
            </Text>
            <Text style={s.depositValue}>{formatMoney(deposit, cur)}</Text>
          </View>
          {!isQuote && (
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>Paid to date</Text>
              <Text style={s.totalValue}>
                {formatMoney(Number(doc.amountPaid), cur)}
              </Text>
            </View>
          )}
          {!isQuote && (
            <View style={s.totalLine}>
              <Text style={[s.totalLabel, s.bold]}>Balance due</Text>
              <Text style={s.totalValue}>{formatMoney(balance, cur)}</Text>
            </View>
          )}
        </View>

        {/* ---------------- terms ---------------- */}
        {doc.terms ? (
          <View style={s.termsBox} wrap={false}>
            <Text style={s.termsTitle}>Payment Terms</Text>
            <Text style={s.termsText}>{doc.terms}</Text>
          </View>
        ) : null}

        {doc.notes ? (
          <View wrap={false}>
            <Text style={s.noteTitle}>Notes</Text>
            <Text style={s.termsText}>{doc.notes}</Text>
          </View>
        ) : null}

        {(settings.paymentInstructions as string) ? (
          <View style={[s.termsBox, { marginTop: 10, backgroundColor: "#FFFFFF" }]} wrap={false}>
            <Text style={s.termsTitle}>Payment Instructions</Text>
            <Text style={s.termsText}>{String(settings.paymentInstructions)}</Text>
          </View>
        ) : null}

        <View style={s.foot} fixed>
          <Text>
            {String(settings.name)} · {String(settings.address)}
          </Text>
          <Text>
            {doc.number} · {doc.issueDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
