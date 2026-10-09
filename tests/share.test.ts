import { describe, expect, it } from "vitest";
import { buildShareMessage, normalizePhone, shareLinks } from "../lib/share";

describe("normalizePhone", () => {
  it("turns a local mobile number into an international one", () => {
    expect(normalizePhone("0917-894-1339")).toBe("639178941339");
    expect(normalizePhone("09155355233")).toBe("639155355233");
  });

  it("keeps a number that is already international", () => {
    expect(normalizePhone("+639178941339")).toBe("639178941339");
    expect(normalizePhone("00639178941339")).toBe("639178941339");
  });

  it("adds the country code to a bare 9-prefixed number", () => {
    expect(normalizePhone("9178941339")).toBe("639178941339");
  });

  it("rejects numbers that cannot be dialled", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("buildShareMessage", () => {
  it("writes the quotation message the owner would send", () => {
    const msg = buildShareMessage({
      type: "quote",
      number: "Q2026-665",
      clientName: "Juan Dela Cruz",
      companyName: "Azarraga Glass & Aluminum",
      total: 30129000,
      currency: "PHP",
      url: "https://azarraga.vercel.app/share/abc123",
    });
    expect(msg).toBe(
      [
        "Hi Juan Dela Cruz, here is your Quotation Q2026-665 from Azarraga Glass & Aluminum.",
        "Total: ₱301,290.00",
        "View / download: https://azarraga.vercel.app/share/abc123",
      ].join("\n"),
    );
  });

  it("says Invoice for an invoice", () => {
    const msg = buildShareMessage({
      type: "invoice",
      number: "INV2026-5",
      clientName: "Ana",
      companyName: "Azarraga",
      total: 100,
      currency: "PHP",
      url: "https://x.test/share/t",
    });
    expect(msg).toContain("your Invoice INV2026-5");
  });
});

describe("shareLinks", () => {
  const opts = {
    message: "Hello from Azarraga",
    url: "https://azarraga.vercel.app/share/tok",
    subject: "Quotation Q2026-665",
  };

  it("opens the client's own WhatsApp chat when a number is known", () => {
    const links = shareLinks({ ...opts, phone: "09178941339" });
    expect(links.whatsapp).toBe(
      `https://wa.me/639178941339?text=${encodeURIComponent("Hello from Azarraga")}`,
    );
  });

  it("falls back to WhatsApp's contact picker without a number", () => {
    const links = shareLinks(opts);
    expect(links.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent("Hello from Azarraga")}`);
    expect(links.whatsapp).not.toContain("wa.me/6");
  });

  it("builds the other channels", () => {
    const links = shareLinks({ ...opts, email: "client@example.com" });
    expect(links.viber).toBe(`viber://forward?text=${encodeURIComponent("Hello from Azarraga")}`);
    expect(links.messenger).toContain("fb-messenger://share/");
    expect(links.messenger).toContain(encodeURIComponent(opts.url));
    expect(links.email).toContain("mailto:client@example.com");
    expect(links.email).toContain(encodeURIComponent("Quotation Q2026-665"));
  });
});
