export function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function emptyCsvCellToNull(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  return text ? text : null;
}

export function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    const next = line[index + 1] ?? "";
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

export function csvSeparator(headerLine: string): string {
  return headerLine.split(";").length >= headerLine.split(",").length ? ";" : ",";
}

export function downloadCsv(filename: string, rows: string[]): void {
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
