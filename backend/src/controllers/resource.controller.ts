import type { Request, Response } from "express";
import { z } from "zod";
import { ClientService } from "../services/client.service.js";
import { ScheduleService } from "../services/schedule.service.js";
import { TaskService } from "../services/task.service.js";
import { ProjectService } from "../services/project.service.js";
import { querySchema } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

export class ClientController {
  public constructor(private readonly service = new ClientService()) {}
  public list = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const status = z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).optional().parse(request.query.status);
    const result = await this.service.list(userId(request), query, status);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
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
}

export class ScheduleController {
  public constructor(private readonly service = new ScheduleService()) {}
  public list = async (request: Request, response: Response): Promise<void> => {
    const range = z.object({ start: z.coerce.date().optional(), end: z.coerce.date().optional(), search: z.string().optional() }).parse(request.query);
    response.json(await this.service.list(userId(request), range.start, range.end, range.search));
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
}

export class TaskController {
  public constructor(private readonly service = new TaskService()) {}
  public list = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list(userId(request), typeof request.query.search === "string" ? request.query.search : undefined));
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
}

export class ProjectController {
  public constructor(private readonly service = new ProjectService()) {}
  public list = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const status = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional().parse(request.query.status);
    const result = await this.service.list(userId(request), query, status);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
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
}
