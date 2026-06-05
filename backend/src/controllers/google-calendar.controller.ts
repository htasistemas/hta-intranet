import type { Request, Response } from "express";
import { z } from "zod";
import { GoogleCalendarService } from "../services/google-calendar.service.js";
import { env } from "../utils/env.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

export class GoogleCalendarController {
  public constructor(private readonly service = new GoogleCalendarService()) {}

  public status = async (request: Request, response: Response): Promise<void> => {
    const connection = await this.service.status(userId(request));
    response.json({ connected: Boolean(connection), connection });
  };

  public authUrl = async (request: Request, response: Response): Promise<void> => {
    response.json({ url: await this.service.authUrl(userId(request), {}) });
  };

  public manualAuthUrl = async (request: Request, response: Response): Promise<void> => {
    const body = z.object({
      clientId: z.string().trim().min(10),
      clientSecret: z.string().trim().min(6),
      redirectUri: z.string().url(),
      calendarId: z.string().trim().min(1).default("primary")
    }).parse(request.body);
    response.json({ url: await this.service.authUrl(userId(request), body) });
  };

  public callback = async (request: Request, response: Response): Promise<void> => {
    const query = z.object({ code: z.string().min(1), state: z.string().min(1) }).parse(request.query);
    await this.service.callback(query.code, query.state);
    response.redirect(`${env.FRONTEND_URL.replace(/\/$/, "")}/agenda?google=connected`);
  };

  public disconnect = async (request: Request, response: Response): Promise<void> => {
    await this.service.disconnect(userId(request));
    response.status(204).send();
  };
}
