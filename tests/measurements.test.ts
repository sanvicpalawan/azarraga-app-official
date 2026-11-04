import { describe, expect, it } from "vitest";
import { parseMeasurement, formatMeasurement, validateLineNumbers } from "../lib/measurements";
describe("canonical measurements", () => {
 it("converts metres, millimetres and fractional feet/inches", () => {
  expect(parseMeasurement("1.5", "m")).toBe(1500);
  expect(parseMeasurement("1500", "mm")).toBe(1500);
  expect(parseMeasurement(`5' 6 1/2"`, "ft-in")).toBe(1689);
  expect(parseMeasurement("6 1/2", "ft-in")).toBe(165);
  expect(parseMeasurement("5'", "ft-in")).toBe(1524);
 });
 it("rejects malformed and unsafe dimensions", () => {
  for (const value of ["-1", "Infinity", "2abc", "1/0", "1.2.3"]) expect(parseMeasurement(value, "m")).toBeNull();
  for (const value of [`5' 12\"`, "1/0", "-3", "1/2/3"]) expect(parseMeasurement(value, "ft-in")).toBeNull();
  expect(parseMeasurement("", "m")).toBeNull();
  expect(parseMeasurement("0", "mm")).toBeNull();
 });
 it("round trips integer mm without changing saved dimensions", () => {
  for (const unit of ["m", "mm", "ft-in"] as const) for (const mm of [1, 1500, 1689, 3345]) expect(parseMeasurement(formatMeasurement(mm, unit), unit)).toBe(mm);
 });
 it("validates quantity, rates and dimensions before saving", () => {
  expect(validateLineNumbers("0", "20", "", "", "m", false)).toMatch(/Quantity/);
  expect(validateLineNumbers("1", "-2", "", "", "m", false)).toMatch(/Rate/);
  expect(validateLineNumbers("1", "20", "abc", "2", "m", false)).toMatch(/Width/);
  expect(validateLineNumbers("1", "20", "", "", "m", true)).toMatch(/Width/);
  expect(validateLineNumbers("1", "0", "", "", "m", false)).toBeNull();
 });
});
