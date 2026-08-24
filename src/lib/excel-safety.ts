/**
 * Neutralizes CSV/XLSX formula injection: Excel (and Sheets) treats a cell
 * starting with =, +, -, @, tab, or CR as a formula to evaluate on open. Since
 * these values originate from user-entered contact/task/event fields, prefix
 * with a single quote so spreadsheet apps render them as literal text.
 */
export function safeCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
