import {
    chunkArray,
    isCompletedRemark,
    isValidItem,
    keyOf,
    normalizeLot,
    normalizeProjectName,
    splitBuswayNo,
} from "@/utils/dashboard";

describe("Dashboard Utils", () => {
  describe("keyOf", () => {
    it("should create unique key from spreadsheetId, sheetName, and rowNumber", () => {
      const item = { sheetName: "Sheet1", rowNumber: 5 };
      expect(keyOf(item)).toBe("unknown|Sheet1|5");
      expect(
        keyOf({ spreadsheetId: "spreadsheet-1", sheetName: "Sheet1", rowNumber: 5 }),
      ).toBe("spreadsheet-1|Sheet1|5");
    });
  });

  describe("normalizeLot", () => {
    it("should normalize lot labels", () => {
      expect(normalizeLot("Lot 123")).toBe("Lot 123");
      expect(normalizeLot("123")).toBe("Lot 123");
      expect(normalizeLot("4R")).toBe("Lot 4R");
      expect(normalizeLot("Something 456 text")).toBe("Something 456 text");
      expect(normalizeLot("")).toBe("Unknown");
      expect(normalizeLot(undefined)).toBe("Unknown");
    });
  });

  describe("normalizeProjectName", () => {
    it("should normalize project names", () => {
      expect(normalizeProjectName("Project  A")).toBe("Project A");
      expect(normalizeProjectName("")).toBe("Default");
      expect(normalizeProjectName(undefined)).toBe("Default");
    });
  });

  describe("splitBuswayNo", () => {
    it("should split busway number into letters and numbers", () => {
      expect(splitBuswayNo("ABC123")).toEqual({
        letters: "ABC",
        numbers: "123",
      });
      expect(splitBuswayNo("XY 456")).toEqual({
        letters: "XY",
        numbers: "456",
      });
      expect(splitBuswayNo("123")).toEqual({ letters: "123", numbers: "" });
      expect(splitBuswayNo("")).toEqual({ letters: "", numbers: "" });
    });
  });

  describe("isCompletedRemark", () => {
    it("should identify completed remarks", () => {
      expect(isCompletedRemark("Completed")).toBe(true);
      expect(isCompletedRemark("completed")).toBe(true);
      expect(isCompletedRemark(" COMPLETED ")).toBe(true);
      expect(isCompletedRemark("To run")).toBe(false);
      expect(isCompletedRemark("")).toBe(false);
      expect(isCompletedRemark(undefined)).toBe(false);
    });
  });

  describe("isValidItem", () => {
    it("should validate item structure", () => {
      const validItem = {
        sheetName: "Sheet1",
        rowNumber: 1,
        buswayNo: "ABC123",
        lot: "Lot 1",
        description: "Test",
        stockCode: "SC001",
      };

      expect(isValidItem(validItem)).toBe(true);
      expect(isValidItem(null)).toBe(false);
      expect(isValidItem({})).toBe(false);
      expect(isValidItem({ sheetName: "test" })).toBe(false);
    });
  });

  describe("chunkArray", () => {
    it("should chunk array into specified sizes", () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      expect(chunkArray(array, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
      expect(chunkArray([], 2)).toEqual([]);
      expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
    });
  });
});
