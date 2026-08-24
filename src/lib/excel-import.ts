import ExcelJS from "exceljs";

/** Reads header aliases case-insensitively, mirroring the reference prototype's getField(). */
export function getField(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias.toUpperCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function parseSheet(sheet: ExcelJS.Worksheet): Record<string, string>[] {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim().toUpperCase();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const raw = cell.value;
      obj[header] =
        raw instanceof Date
          ? raw.toISOString().slice(0, 10)
          : typeof raw === "object" && raw !== null && "hyperlink" in raw
            ? String((raw as { hyperlink: string }).hyperlink)
            : typeof raw === "object" && raw !== null && "text" in raw
              ? String((raw as { text: string }).text)
              : String(raw ?? "");
    });
    if (Object.values(obj).some((v) => v.trim() !== "")) rows.push(obj);
  });

  return rows;
}

/** Parses the first worksheet of an uploaded workbook into header-keyed row objects (headers upper-cased). */
export async function parseFirstSheet(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  return sheet ? parseSheet(sheet) : [];
}

/** Parses every worksheet in the workbook (e.g. a conference tracker split across tabs) into one row list. */
export async function parseAllSheets(buffer: ArrayBuffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.flatMap(parseSheet);
}

/** Normalizes common date formats to an ISO "YYYY-MM-DD" string, or null. */
export function normalizeDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
