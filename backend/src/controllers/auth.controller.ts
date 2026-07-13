import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";

export class AuthController {
  public constructor(private readonly service = new AuthService()) {}

  public login = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.login(request.body));
  };

  public google = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.loginWithGoogle(request.body.credential as string));
  };

  public forgotPassword = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.requestPasswordReset(request.body.email as string));
  };

  public resetPassword = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.resetPassword(request.body.token as string, request.body.password as string));
  };

  public refresh = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.refresh(request.body.refreshToken as string));
  };

  public logout = async (request: Request, response: Response): Promise<void> => {
    await this.service.logout(request.body.refreshToken as string);
    response.status(204).send();
  };
}
