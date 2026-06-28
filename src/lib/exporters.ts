import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportXlsx<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  sheetName = "Report",
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportPdf<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  title: string,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), 14, 20);
  const head = rows.length ? [Object.keys(rows[0])] : [["No data"]];
  const body = rows.map((r) => Object.values(r).map((v) => (v == null ? "" : String(v))));
  autoTable(doc, { head, body, startY: 26, styles: { fontSize: 8 } });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function exportCsv<T extends Record<string, unknown>>(rows: T[], filename: string) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
