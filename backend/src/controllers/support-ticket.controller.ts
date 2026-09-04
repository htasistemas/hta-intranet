import type { Request, Response } from "express";
import path from "node:path";
import { z } from "zod";
import { SupportTicketService } from "../services/support-ticket.service.js";
import { ApiError } from "../utils/api-error.js";
import { supportTicketFilterSchema } from "../validations/entities.validation.js";

function auth(request: Request) {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

export class SupportTicketController {
  public constructor(private readonly service = new SupportTicketService()) {}

  public list = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list(auth(request), supportTicketFilterSchema.parse(request.query)));
  };

  public dashboard = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.dashboard(auth(request), supportTicketFilterSchema.parse(request.query)));
  };

  public get = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.get(resourceId(request), auth(request)));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.create(request.body, auth(request)));
  };

  public reply = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.reply(resourceId(request), request.body, auth(request)));
  };

  public assign = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.assign(resourceId(request), request.body, auth(request)));
  };

  public changeStatus = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.changeStatus(resourceId(request), request.body, auth(request)));
  };

  public downloadAttachment = async (request: Request, response: Response): Promise<void> => {
    const attachment = await this.service.attachmentPath(resourceId(request), auth(request));
    response.type(attachment.mimeType);
    response.download(path.resolve(attachment.path), attachment.name);
  };

  public listSlaRules = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listSlaRules(auth(request)));
  };

  public listAnalysts = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listAnalysts(auth(request)));
  };

  public createSlaRule = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createSlaRule(request.body, auth(request)));
  };

  public deleteSlaRule = async (request: Request, response: Response): Promise<void> => {
    await this.service.deleteSlaRule(resourceId(request), auth(request));
    response.status(204).send();
  };

  public listArticles = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listArticles(auth(request), typeof request.query.search === "string" ? request.query.search : undefined));
  };

  public createArticle = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createArticle(request.body, auth(request)));
  };
}
