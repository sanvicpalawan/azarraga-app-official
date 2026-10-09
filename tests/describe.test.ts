import { describe, expect, it } from "vitest";
import {
  composeDescription,
  formatDocumentNumber,
  formatMeters,
  formatQuantity,
  formatSize,
  makeSpecKey,
  nextItemCode,
  nextSequence,
  parseMetersToMm,
} from "../lib/describe";

describe("formatMeters", () => {
  it("keeps two decimals when the third is zero", () => {
    expect(formatMeters(1500)).toBe("1.50");
    expect(formatMeters(10700)).toBe("10.70");
    expect(formatMeters(2100)).toBe("2.10");
  });

  it("keeps three decimals when they carry information", () => {
    expect(formatMeters(3345)).toBe("3.345");
    expect(formatMeters(1005)).toBe("1.005");
    expect(formatMeters(4605)).toBe("4.605");
  });

  it("round-trips through parseMetersToMm", () => {
    expect(parseMetersToMm("1.50")).toBe(1500);
    expect(parseMetersToMm("3,345")).toBe(3345);
    expect(parseMetersToMm("abc")).toBeNull();
    expect(parseMetersToMm("-1")).toBeNull();
  });
});

describe("formatSize", () => {
  it("renders width x height in metres", () => {
    expect(formatSize({ widthMm: 1500, heightMm: 2100 })).toBe("1.50 x 2.10");
  });

  it("renders linear stock as LM", () => {
    expect(formatSize({ lengthMm: 10700 })).toBe("10.70 LM");
  });

  it("returns null when nothing is measured", () => {
    expect(formatSize({})).toBeNull();
  });
});

describe("composeDescription", () => {
  it("matches the way Azarraga writes a window line by hand", () => {
    const text = composeDescription(
      [
        { label: "798 Series" },
        { label: "2 Panel Sliding Window", joinWithPrevious: true },
        { label: "HA Frame" },
        { label: "6mm Annealed Ref Bronze Glass" },
      ],
      { widthMm: 1500, heightMm: 2100 },
    );
    expect(text).toBe(
      "798 Series 2 Panel Sliding Window, HA Frame, 6mm Annealed Ref Bronze Glass, 1.50 x 2.10",
    );
  });

  it("joins only the group marked joinWithPrevious with a space", () => {
    const text = composeDescription([
      { label: "Double Leaf ED Door" },
      { label: "HA" },
      { label: "10mm Annealed Clear Glass" },
    ]);
    expect(text).toBe("Double Leaf ED Door, HA, 10mm Annealed Clear Glass");
  });

  it("skips blank labels", () => {
    expect(composeDescription([{ label: "" }, { label: "Awning Window" }])).toBe("Awning Window");
  });

  it("appends linear size with LM", () => {
    const text = composeDescription([{ label: "Stainless Railings" }], { lengthMm: 10700 });
    expect(text).toBe("Stainless Railings, 10.70 LM");
  });
});

describe("formatQuantity", () => {
  it("pluralises the unit", () => {
    expect(formatQuantity(1, "set")).toBe("1 set");
    expect(formatQuantity(2, "set")).toBe("2 sets");
    expect(formatQuantity(10.5, "set")).toBe("10.50 sets");
  });
});

describe("item codes", () => {
  it("continues from the highest existing number for a prefix", () => {
    expect(nextItemCode("W", ["W1", "W2", "W3"])).toBe("W4");
    expect(nextItemCode("W", [])).toBe("W1");
    expect(nextItemCode("D", ["D1", "D9"])).toBe("D10");
  });

  it("ignores codes belonging to other prefixes", () => {
    expect(nextItemCode("W", ["D1", "D2", "W1"])).toBe("W2");
  });

  it("leaves singleton groups unnumbered by using an empty prefix", () => {
    expect(nextItemCode("", [])).toBe("1");
  });
});

describe("spec keys", () => {
  it("is stable regardless of selection order", () => {
    const a = makeSpecKey(["g1", "g2", "g3"], "item-1");
    const b = makeSpecKey(["g3", "g1", "g2"], "item-1");
    expect(a).toBe(b);
  });
});

describe("document numbering", () => {
  it("steps by 5 and formats as {prefix}{year}-{seq}", () => {
    const seq = nextSequence(660, 5);
    expect(formatDocumentNumber({ prefix: "Q", year: 2026, seq, pad: 0 })).toBe("Q2026-665");
  });

  it("starts the year at the first step", () => {
    expect(nextSequence(0, 5)).toBe(5);
    expect(formatDocumentNumber({ prefix: "Q", year: 2026, seq: nextSequence(0, 5) })).toBe(
      "Q2026-5",
    );
  });

  it("honours a custom pattern and padding", () => {
    expect(
      formatDocumentNumber({
        pattern: "{prefix}/{year}/{seq}",
        prefix: "INV",
        year: 2026,
        seq: 7,
        pad: 4,
      }),
    ).toBe("INV/2026/0007");
  });

  it("suffixes revisions", () => {
    expect(
      formatDocumentNumber({ prefix: "Q", year: 2026, seq: 665, revision: 1 }),
    ).toBe("Q2026-665-R1");
  });
});
