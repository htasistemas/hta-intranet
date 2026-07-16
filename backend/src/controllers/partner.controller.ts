import type { Request, Response } from "express";
import { z } from "zod";
import { PartnerService } from "../services/partner.service.js";
import { querySchema } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

function ensureCanManagePartners(request: Request): void {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  if (request.auth.role === "PARTNER") throw new ApiError(403, "Usuario parceiro pode consultar a propria carteira e registrar interacoes, mas nao alterar cadastros comerciais.");
}

export class PartnerController {
  public constructor(private readonly service = new PartnerService()) {}

  public list = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const result = await this.service.list(userId(request), query);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public get = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.get(resourceId(request), userId(request)));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    ensureCanManagePartners(request);
    response.status(201).json(await this.service.create(request.body, userId(request)));
  };

  public update = async (request: Request, response: Response): Promise<void> => {
    ensureCanManagePartners(request);
    response.json(await this.service.update(resourceId(request), request.body, userId(request)));
  };

  public delete = async (request: Request, response: Response): Promise<void> => {
    ensureCanManagePartners(request);
    await this.service.delete(resourceId(request), userId(request));
    response.status(204).send();
  };

  public createInteraction = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createInteraction(resourceId(request), request.body, userId(request)));
  };
}
