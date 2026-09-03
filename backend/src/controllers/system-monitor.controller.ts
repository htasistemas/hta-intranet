import type { Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../utils/api-error.js";
import { SystemMonitorService } from "../services/system-monitor.service.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

export class SystemMonitorController {
  public constructor(private readonly service = new SystemMonitorService()) {}

  public list = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list(userId(request)));
  };

  public checkAll = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.checkAll(userId(request)));
  };

  public checkOne = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.checkOne(resourceId(request), userId(request)));
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
