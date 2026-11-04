export function assertQuoteTransition(from: string, to: string) {
  if (from === to) return;
  const allowed: Record<string, string[]> = { draft: ["sent"], sent: ["accepted", "declined"], accepted: [], declined: [] };
  if (!allowed[from]?.includes(to)) throw new Error(`Cannot change ${from} quotation to ${to}.`);
}
