import { describe, expect, it } from "vitest";
import {
  computeAlternatives,
  computeDocument,
  computeLine,
  isOverdue,
  paymentStatus,
  roundMoney,
  type DocumentInput,
} from "../lib/calc";

/** Pesos -> centavos. All money in this suite is integer minor units. */
const php = (pesos: number): number => Math.round(pesos * 100);

const oneLine = (unitPrice: number, quantity = 1) => [
  { pricingMode: "per_unit" as const, unitPrice, quantity },
];

const base = (overrides: Partial<DocumentInput> = {}): DocumentInput => ({
  sections: [{ id: "s1", kind: "included", lines: oneLine(php(100_000)) }],
  vatMode: "none",
  vatRate: 0,
  ...overrides,
});

describe("computeLine", () => {
  it("multiplies unit price by quantity in whole centavos", () => {
    expect(computeLine({ pricingMode: "per_unit", unitPrice: php(28_880), quantity: 2 })).toEqual({
      area: null,
      unitTotal: php(28_880),
      lineTotal: php(57_760),
    });
  });

  it("adds flat option adjustments before multiplying", () => {
    const result = computeLine({
      pricingMode: "per_unit",
      unitPrice: php(1000),
      quantity: 3,
      options: [{ priceAdjustment: php(50) }],
    });
    expect(result.unitTotal).toBe(php(1050));
    expect(result.lineTotal).toBe(php(3150));
  });

  it("prices by area only when the line says so", () => {
    const perArea = computeLine({
      pricingMode: "per_area",
      unitPrice: php(500), // per sqm
      quantity: 1,
      widthMm: 1000,
      heightMm: 1000,
    });
    expect(perArea.area).toBe(1);
    expect(perArea.lineTotal).toBe(php(500));

    const perUnit = computeLine({
      pricingMode: "per_unit",
      unitPrice: php(500),
      quantity: 1,
      widthMm: 1000,
      heightMm: 1000,
    });
    expect(perUnit.area).toBeNull();
    expect(perUnit.lineTotal).toBe(php(500));
  });

  it("never returns a negative total", () => {
    expect(computeLine({ pricingMode: "per_unit", unitPrice: -500, quantity: 2 }).lineTotal).toBe(
      -1000,
    );
    expect(computeLine({ pricingMode: "per_unit", unitPrice: php(100), quantity: -3 }).lineTotal).toBe(
      0,
    );
  });

  it("rounds rather than carrying floats", () => {
    expect(roundMoney(100.5)).toBe(101);
    expect(roundMoney(100.4)).toBe(100);
  });
});

describe("computeDocument - the Joriz alternatives", () => {
  const sections = [
    {
      id: "opt-a",
      kind: "alternative" as const,
      lines: oneLine(php(20_880)),
    },
    {
      id: "opt-b",
      kind: "alternative" as const,
      lines: oneLine(php(55_840)),
    },
  ];

  const doc = (selected: string | null) =>
    computeDocument(base({ sections, selectedAlternativeId: selected }));

  it("counts only the alternative the client picked", () => {
    expect(doc("opt-a").subtotal).toBe(php(20_880));
    expect(doc("opt-a").total).toBe(php(20_880));

    expect(doc("opt-b").subtotal).toBe(php(55_840));
    expect(doc("opt-b").total).toBe(php(55_840));
  });

  it("counts nothing while the choice is still open", () => {
    const result = doc(null);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
    expect(result.hasUnselectedAlternatives).toBe(true);
  });

  it("prints a total against every option", () => {
    const all = computeAlternatives(base({ sections }));
    expect(Object.keys(all).sort()).toEqual(["opt-a", "opt-b"]);
    expect(all["opt-a"]!.total).toBe(php(20_880));
    expect(all["opt-b"]!.total).toBe(php(55_840));
  });

  it("adds an included section to whichever option is selected", () => {
    const mixed = computeDocument({
      sections: [
        { id: "common", kind: "included", lines: oneLine(php(1_000)) },
        { id: "opt-a", kind: "alternative", lines: oneLine(php(20_880)) },
        { id: "opt-b", kind: "alternative", lines: oneLine(php(55_840)) },
      ],
      selectedAlternativeId: "opt-a",
      vatMode: "none",
      vatRate: 0,
    });
    expect(mixed.subtotal).toBe(php(21_880));
  });
});

describe("computeDocument - the Shena total", () => {
  it("adds the delivery charge on top of the subtotal", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(295_290)) }],
        charges: [{ label: "Delivery and Installation", amount: php(6_000) }],
      }),
    );
    expect(result.subtotal).toBe(php(295_290));
    expect(result.chargesTotal).toBe(php(6_000));
    expect(result.total).toBe(php(301_290));
  });

  it("adds charges after the discount, not before", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(100_000)) }],
        discount: { type: "percent", value: 10 },
        charges: [{ label: "Delivery", amount: php(6_000) }],
      }),
    );
    expect(result.discountAmount).toBe(php(10_000));
    expect(result.chargesTotal).toBe(php(6_000));
    // 100,000 - 10,000 + 6,000
    expect(result.total).toBe(php(96_000));
  });

  it("supports a fixed discount", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(50_000)) }],
        discount: { type: "fixed", value: php(5_000) },
      }),
    );
    expect(result.discountAmount).toBe(php(5_000));
    expect(result.total).toBe(php(45_000));
  });

  it("never lets a discount exceed the subtotal", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(1_000)) }],
        discount: { type: "fixed", value: php(999_999) },
      }),
    );
    expect(result.total).toBe(0);
  });
});

describe("computeDocument - VAT", () => {
  it("adds VAT when it is charged on top", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(100_000)) }],
        vatMode: "exclusive",
        vatRate: 12,
      }),
    );
    expect(result.vatableSales).toBe(php(100_000));
    expect(result.vatAmount).toBe(php(12_000));
    expect(result.total).toBe(php(112_000));
  });

  it("extracts VAT when it is already included", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(112_000)) }],
        vatMode: "inclusive",
        vatRate: 12,
      }),
    );
    expect(result.vatAmount).toBe(php(12_000));
    expect(result.vatableSales).toBe(php(100_000));
    expect(result.total).toBe(php(112_000));
  });

  it("charges nothing when VAT is off - the default for Azarraga", () => {
    const result = computeDocument(base());
    expect(result.vatAmount).toBe(0);
    expect(result.total).toBe(php(100_000));
  });
});

describe("computeDocument - deposit", () => {
  it("shows the 70% down payment", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(301_290)) }],
        depositPercent: 70,
      }),
    );
    expect(result.deposit).toBe(php(210_903));
    expect(result.balance).toBe(php(301_290));
  });

  it("tracks the balance after a payment", () => {
    const result = computeDocument(
      base({
        sections: [{ id: "s1", kind: "included", lines: oneLine(php(100_000)) }],
        amountPaid: php(40_000),
      }),
    );
    expect(result.amountPaid).toBe(php(40_000));
    expect(result.balance).toBe(php(60_000));
  });
});

describe("paymentStatus", () => {
  it("moves from unpaid to partial to paid", () => {
    expect(paymentStatus(php(100_000), 0)).toBe("unpaid");
    expect(paymentStatus(php(100_000), php(50_000))).toBe("partial");
    expect(paymentStatus(php(100_000), php(100_000))).toBe("paid");
    expect(paymentStatus(php(100_000), php(120_000))).toBe("paid");
  });
});

describe("isOverdue", () => {
  it("only flags money documents past their due date", () => {
    expect(isOverdue("2026-01-01", "unpaid", "2026-06-01")).toBe(true);
    expect(isOverdue("2026-12-01", "unpaid", "2026-06-01")).toBe(false);
    expect(isOverdue("2026-01-01", "paid", "2026-06-01")).toBe(false);
    expect(isOverdue(null, "unpaid", "2026-06-01")).toBe(false);
  });
});
