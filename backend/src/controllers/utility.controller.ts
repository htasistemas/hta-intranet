import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { ApiError } from "../utils/api-error.js";
import { DashboardService } from "../services/dashboard.service.js";
import { SearchService } from "../services/search.service.js";
import bcrypt from "bcryptjs";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

async function fetchJson<T>(url: string, notFoundMessage: string): Promise<T> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 404) throw new ApiError(404, notFoundMessage);
    if (!response.ok) throw new ApiError(502, "Servico externo indisponivel no momento.");
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Nao foi possivel consultar o servico externo. Verifique a conexao ou tente novamente.");
  }
}

export class UtilityController {
  public constructor(
    private readonly dashboard = new DashboardService(),
    private readonly globalSearch = new SearchService()
  ) {}

  public summary = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.dashboard.summary(userId(request)));
  };

  public search = async (request: Request, response: Response): Promise<void> => {
    const { q } = z.object({ q: z.string().trim().min(2) }).parse(request.query);
    response.json(await this.globalSearch.search(userId(request), q));
  };

  public lookupCep = async (request: Request, response: Response): Promise<void> => {
    const rawCep = z.string().parse(request.params.cep);
    const cep = z.string().regex(/^\d{8}$/).parse(rawCep.replace(/\D/g, ""));
    const data = await fetchJson<{ cep: string; logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean }>(`https://viacep.com.br/ws/${cep}/json/`, "CEP nao encontrado.");
    if (data.erro) throw new ApiError(404, "CEP nao encontrado.");
    response.json({ postalCode: data.cep, street: data.logradouro ?? "", district: data.bairro ?? "", city: data.localidade ?? "", state: data.uf ?? "" });
  };

  public lookupCnpj = async (request: Request, response: Response): Promise<void> => {
    const rawCnpj = z.string().parse(request.params.cnpj);
    const cnpj = z.string().regex(/^\d{14}$/).parse(rawCnpj.replace(/\D/g, ""));
    const data = await fetchJson<{
      cnpj: string;
      razao_social?: string;
      nome_fantasia?: string;
      descricao_tipo_logradouro?: string;
      logradouro?: string;
      numero?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
      email?: string;
      ddd_telefone_1?: string;
      cnae_fiscal_descricao?: string;
    }>(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, "CNPJ nao encontrado.");
    response.json({
      document: data.cnpj,
      name: data.nome_fantasia || data.razao_social || "",
      legalName: data.razao_social ?? "",
      email: data.email ?? "",
      phone: data.ddd_telefone_1 ?? "",
      postalCode: data.cep ?? "",
      street: [data.descricao_tipo_logradouro, data.logradouro].filter(Boolean).join(" "),
      number: data.numero ?? "",
      district: data.bairro ?? "",
      city: data.municipio ?? "",
      state: data.uf ?? "",
      segment: data.cnae_fiscal_descricao ?? ""
    });
  };

  public categories = async (_request: Request, response: Response): Promise<void> => {
    response.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
  };

  public createCategory = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await prisma.category.create({ data: request.body }));
  };

  public updateCategory = async (request: Request, response: Response): Promise<void> => {
    response.json(await prisma.category.update({ where: { id: resourceId(request) }, data: request.body }));
  };

  public deleteCategory = async (request: Request, response: Response): Promise<void> => {
    await prisma.category.delete({ where: { id: resourceId(request) } });
    response.status(204).send();
  };

  public notes = async (request: Request, response: Response): Promise<void> => {
    response.json(await prisma.note.findMany({ where: { userId: userId(request) }, include: { client: true }, orderBy: { createdAt: "desc" } }));
  };

  public createNote = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await prisma.note.create({ data: { ...request.body, userId: userId(request) } }));
  };

  public updateNote = async (request: Request, response: Response): Promise<void> => {
    const note = await prisma.note.findFirst({ where: { id: resourceId(request), userId: userId(request) } });
    if (!note) throw new ApiError(404, "Observacao nao encontrada.");
    response.json(await prisma.note.update({ where: { id: note.id }, data: request.body }));
  };

  public deleteNote = async (request: Request, response: Response): Promise<void> => {
    const result = await prisma.note.deleteMany({ where: { id: resourceId(request), userId: userId(request) } });
    if (!result.count) throw new ApiError(404, "Observacao nao encontrada.");
    response.status(204).send();
  };

  public taskColumns = async (_request: Request, response: Response): Promise<void> => {
    response.json(await prisma.taskColumn.findMany({ orderBy: { position: "asc" } }));
  };

  public profile = async (request: Request, response: Response): Promise<void> => {
    const user = await prisma.user.findUnique({ where: { id: userId(request) }, omit: { passwordHash: true } });
    response.json(user);
  };

  public updateProfile = async (request: Request, response: Response): Promise<void> => {
    response.json(await prisma.user.update({ where: { id: userId(request) }, data: request.body, omit: { passwordHash: true } }));
  };

  public users = async (_request: Request, response: Response): Promise<void> => {
    response.json(await prisma.user.findMany({ omit: { passwordHash: true }, orderBy: { createdAt: "desc" } }));
  };

  public createUser = async (request: Request, response: Response): Promise<void> => {
    const { password, ...data } = request.body as { name: string; email: string; password: string; role: "ADMIN" | "MANAGER" | "USER" };
    response.status(201).json(await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) }, omit: { passwordHash: true } }));
  };

  public updateUser = async (request: Request, response: Response): Promise<void> => {
    response.json(await prisma.user.update({ where: { id: resourceId(request) }, data: request.body, omit: { passwordHash: true } }));
  };

  public deleteUser = async (request: Request, response: Response): Promise<void> => {
    if (resourceId(request) === userId(request)) throw new ApiError(409, "Nao e possivel excluir o proprio usuario.");
    await prisma.user.delete({ where: { id: resourceId(request) } });
    response.status(204).send();
  };
}
