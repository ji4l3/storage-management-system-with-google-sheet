import type { Item, ItemView } from "@/types/dashboard";

export function keyOf(
  item: Pick<Item, "spreadsheetId" | "sheetName" | "rowNumber">,
): string {
  // Include spreadsheetId to ensure uniqueness across different spreadsheets
  const spreadsheetId = item.spreadsheetId || "unknown";
  return `${spreadsheetId}|${item.sheetName}|${item.rowNumber}`;
}

export function normalizeLot(lot?: string): string {
  const raw = String(lot ?? "").trim();
  if (!raw) return "Unknown";

  // If already starts with "Lot", keep as is (just normalize spaces)
  if (raw.toLowerCase().startsWith("lot")) {
    return raw.replace(/\s+/g, " ");
  }

  // If it's a number or alphanumeric (like "4R", "5", "10A"), add "Lot " prefix
  if (/^[0-9]+[A-Za-z]*$/.test(raw)) {
    return `Lot ${raw}`;
  }

  // Otherwise, keep original value
  return raw.replace(/\s+/g, " ");
}

export function normalizeProjectName(projectName?: string): string {
  const s = String(projectName ?? "").trim();
  return s ? s.replace(/\s+/g, " ") : "Default";
}

export function splitBuswayNo(raw: string): {
  letters: string;
  numbers: string;
} {
  const s = String(raw ?? "").trim();
  if (!s) return { letters: "", numbers: "" };

  const cleaned = s.replace(/\s+/g, "");
  const match = cleaned.match(/^[A-Za-z]+/);
  const letters = (match?.[0] || "").toUpperCase();
  const rest = cleaned.replace(/[^A-Za-z0-9]/g, "").slice(letters.length);

  if (!letters) return { letters: s, numbers: "" };
  return { letters, numbers: rest || "" };
}

export function isCompletedRemark(remarks?: string): boolean {
  return (
    String(remarks || "")
      .trim()
      .toLowerCase() === "completed"
  );
}

export function isValidItem(data: unknown): data is Item {
  const isValid =
    data !== null &&
    typeof data === "object" &&
    "sheetName" in data &&
    "rowNumber" in data &&
    "buswayNo" in data &&
    typeof (data as any).sheetName === "string" &&
    typeof (data as any).rowNumber === "number" &&
    typeof (data as any).buswayNo === "string";

  if (!isValid && data !== null && typeof data === "object") {
    console.log("⚠️ Invalid item detected:", {
      hasSheetName: "sheetName" in data,
      hasRowNumber: "rowNumber" in data,
      hasBuswayNo: "buswayNo" in data,
      sheetNameType: typeof (data as any).sheetName,
      rowNumberType: typeof (data as any).rowNumber,
      buswayNoType: typeof (data as any).buswayNo,
    });
  }

  return isValid;
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function cleanStockCode(stockCode: string): string {
  if (!stockCode) return stockCode;

  // Remove consecutive dashes (-- or ---) and replace with single dash
  // Also remove trailing dashes
  return stockCode
    .replace(/-{2,}/g, "-") // Replace 2 or more dashes with single dash
    .replace(/-+$/, ""); // Remove trailing dashes
}

export function transformItemsToView(items: Item[]): ItemView[] {
  console.log("🔄 Transforming", items.length, "items to view format");

  const quantityGroupMap = new Map<
    string,
    {
      firstItem: Item;
      totalQuantity: number;
      rowCount: number;
      rowNumbers: number[];
      allCompleted: boolean;
    }
  >();
  const passthroughItems: Item[] = [];

  for (const item of items) {
    const rawBusway = String(item.buswayNo ?? "").trim();
    const qty = Number(item.quantity);
    const hasQuantity = Number.isFinite(qty);

    if (rawBusway || !hasQuantity) {
      passthroughItems.push(item);
      continue;
    }

    const projectNorm = normalizeProjectName(item.projectName);
    const lotNorm = normalizeLot(item.lot);
    const stockCodeNorm = String(item.stockCode ?? "").trim();
    const descNorm = String(item.description ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const quantityKey = [
      item.spreadsheetId || "unknown",
      item.sheetName,
      projectNorm,
      lotNorm,
      stockCodeNorm,
      descNorm,
    ].join("|");

    const existing = quantityGroupMap.get(quantityKey);
    if (!existing) {
      quantityGroupMap.set(quantityKey, {
        firstItem: item,
        totalQuantity: qty,
        rowCount: 1,
        rowNumbers: [item.rowNumber],
        allCompleted: isCompletedRemark(item.remarks),
      });
      continue;
    }

    existing.totalQuantity += qty;
    existing.rowCount += 1;
    existing.rowNumbers.push(item.rowNumber);
    existing.allCompleted = existing.allCompleted && isCompletedRemark(item.remarks);
  }

  const quantityAggregatedItems: Item[] = [...quantityGroupMap.values()].map(
    (group) => ({
      ...group.firstItem,
      buswayNo: `${group.totalQuantity} pcs`,
      quantity: group.totalQuantity,
      isQuantityAggregate: true,
      aggregateRowNumbers: [...new Set(group.rowNumbers)].sort((a, b) => a - b),
      remarks: group.allCompleted ? "Completed" : "To run",
    }),
  );

  const finalItems = [...passthroughItems, ...quantityAggregatedItems];

  const transformed = finalItems.map((item) => {
    const stockCodeNorm = String(
      (item as any).stockCode ?? (item as any).stockcode ?? "",
    ).trim();

    return {
      ...item,
      key: keyOf(item),
      projectNorm: normalizeProjectName(item.projectName),
      lotNorm: normalizeLot(item.lot),
      stockCodeNorm,
      buswayTrim: String(item.buswayNo ?? "").trim(),
      descTrim: String(item.description ?? "").trim(),
    };
  });

  console.log("✅ Transformed", transformed.length, "items");
  if (transformed.length > 0) {
    console.log("📝 First transformed item:", {
      key: transformed[0].key,
      projectNorm: transformed[0].projectNorm,
      lotNorm: transformed[0].lotNorm,
      buswayTrim: transformed[0].buswayTrim,
    });
  }

  return transformed;
}
