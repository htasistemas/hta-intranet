import type { Request, Response } from "express";
import { z } from "zod";
import { ProductService } from "../services/product.service.js";
import { querySchema } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

export class ProductController {
  public constructor(private readonly service = new ProductService()) {}

  public list = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const result = await this.service.list(userId(request), query);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public insights = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.insights(userId(request)));
  };

  public get = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.get(resourceId(request), userId(request)));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.create(request.body, userId(request)));
  };

  public update = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.update(resourceId(request), request.body, userId(request)));
  };

  public delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(resourceId(request), userId(request));
    response.status(204).send();
  };

  public listClientProducts = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const clientId = typeof request.query.clientId === "string" ? request.query.clientId : undefined;
    const result = await this.service.listClientProducts(userId(request), query, clientId);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public createClientProduct = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createClientProduct(request.body, userId(request)));
  };

  public updateClientProduct = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.updateClientProduct(resourceId(request), request.body, userId(request)));
  };

  public deleteClientProduct = async (request: Request, response: Response): Promise<void> => {
    await this.service.deleteClientProduct(resourceId(request), userId(request));
    response.status(204).send();
  };
}
