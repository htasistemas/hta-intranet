import type { Request, Response } from "express";
import { z } from "zod";
import { CommunicationService } from "../services/communication.service.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

export class CommunicationController {
  public constructor(private readonly service = new CommunicationService()) {}

  public providerConfigs = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listProviderConfigs(userId(request)));
  };

  public createProviderConfig = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.saveProviderConfig(userId(request), request.body));
  };

  public templates = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listTemplates(userId(request)));
  };

  public createTemplate = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.saveTemplate(userId(request), request.body));
  };

  public messages = async (request: Request, response: Response): Promise<void> => {
    const query = z.object({ clientId: z.string().optional(), leadId: z.string().optional() }).parse(request.query);
    response.json(await this.service.listMessages(userId(request), query.clientId, query.leadId));
  };

  public send = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.sendManual(userId(request), request.body));
  };

  public processQueue = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.processQueue(userId(request)));
  };

  public campaigns = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listCampaigns(userId(request)));
  };

  public createCampaign = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createCampaign(userId(request), request.body));
  };

  public runCampaign = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.runCampaign(userId(request), resourceId(request)));
  };

  public calculateScores = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.calculateScores(userId(request)));
  };

  public goals = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listGoals(userId(request)));
  };

  public createGoal = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.saveGoal(userId(request), request.body));
  };

  public slaRules = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listSlaRules(userId(request)));
  };

  public createSlaRule = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.saveSlaRule(userId(request), request.body));
  };

  public slaAlerts = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.slaAlerts(userId(request)));
  };

  public report = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.communicationReport(userId(request)));
  };

  public webhook = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.webhook(userId(request), request.body));
  };
}
