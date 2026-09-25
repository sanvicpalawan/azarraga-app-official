// One-off regression check against the 13 real historical invoices used to
// validate this parser. Not part of the app; safe to delete or keep for CI.
import { parseInvoicePdf } from "../lib/invoice-parser";
import fs from "fs";
import path from "path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: tsx scripts/verify-invoice-parser.ts <dir-of-pdfs>");
  process.exit(1);
}
const expected: Record<string, number> = {
  "Abinnew.pdf": 311530, "TaraLouverWindow.pdf": 71150, "Joriz.pdf": 76720,
  "Pajara.pdf": 15600, "Ranchero.pdf": 24800, "Shena.pdf": 301290,
  "Tara_GiftShop.pdf": 28020, "OlieAcc.pdf": 21320, "TCCPOWER.pdf": 53720,
  "ArMark.pdf": 86800, "ReyFelizarde.pdf": 58300, "Charlie.pdf": 57200,
  "MarlonBiFold.pdf": 539910,
};
async function main() {
  let allPass = true;
  for (const [f, exp] of Object.entries(expected)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const r = await parseInvoicePdf(fs.readFileSync(p));
    const got = r.subtotal + r.delivery;
    const pass = Math.abs(got - exp) < 1;
    if (!pass) allPass = false;
    console.log(`${pass ? "PASS" : "FAIL"} ${f}: expected ${exp}, got ${got} (${r.items.length} items)`);
  }
  console.log(allPass ? "\nALL PASS" : "\nSOME FAILED");
}
main();
