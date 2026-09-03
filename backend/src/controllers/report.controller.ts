import type { Request, Response } from "express";
import { prisma } from "../prisma/client.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function escapePdf(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function createPdf(lines: string[]): Buffer {
  const stream = lines.map((line, index) => `BT /F1 12 Tf 50 ${790 - index * 20} Td (${escapePdf(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let document = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(document);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(document);
  const xref = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

export class ReportController {
  public clientsCsv = async (request: Request, response: Response): Promise<void> => {
    const clients = await prisma.client.findMany({ where: { ownerId: userId(request) }, include: { category: true } });
    const rows = ["Nome;Documento;Status;Categoria;Email;Receita"];
    clients.forEach((client) => rows.push([client.name, client.document ?? "", client.status, client.category?.name ?? "", client.email ?? "", client.expectedValue?.toString() ?? "0"].join(";")));
    response.header("Content-Type", "text/csv; charset=utf-8");
    response.header("Content-Disposition", "attachment; filename=clientes.csv");
    response.send(`\uFEFF${rows.join("\n")}`);
  };

  public clientsPdf = async (request: Request, response: Response): Promise<void> => {
    const clients = await prisma.client.findMany({ where: { ownerId: userId(request) }, take: 25, orderBy: { name: "asc" } });
    response.header("Content-Type", "application/pdf");
    response.header("Content-Disposition", "attachment; filename=clientes.pdf");
    response.send(createPdf(["Torresoft - Relatorio de clientes", ...clients.map((client) => `${client.name} - ${client.status}`)]));
  };
}
