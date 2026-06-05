import jwt from "jsonwebtoken";
import type { Schedule } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import { env } from "../utils/env.js";
import { ApiError } from "../utils/api-error.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

const calendarScope = "https://www.googleapis.com/auth/calendar.events";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const oauthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const calendarEndpoint = "https://www.googleapis.com/calendar/v3";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  email?: string;
}

interface GoogleEventResponse {
  id: string;
}

interface GoogleState {
  sub: string;
  purpose: "google-calendar";
}

interface GoogleErrorBody {
  error?: string;
  error_description?: string;
  message?: string;
}

export interface GoogleCalendarAuthInput {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  calendarId?: string;
}

interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  calendarId: string;
}

function defaultRedirectUri(): string {
  return env.GOOGLE_REDIRECT_URI ?? `http://localhost:${env.PORT}/api/google-calendar/callback`;
}

function envCredentials(): OAuthCredentials {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(400, "Credenciais do Google Calendar nao configuradas no ambiente.");
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: defaultRedirectUri(),
    calendarId: "primary"
  };
}

function eventBody(schedule: Schedule): Record<string, unknown> {
  if (schedule.allDay) {
    return {
      summary: schedule.title,
      description: schedule.description ?? undefined,
      location: schedule.location ?? undefined,
      start: { date: schedule.startAt.toISOString().slice(0, 10) },
      end: { date: schedule.endAt.toISOString().slice(0, 10) }
    };
  }
  return {
    summary: schedule.title,
    description: schedule.description ?? undefined,
    location: schedule.location ?? undefined,
    start: { dateTime: schedule.startAt.toISOString() },
    end: { dateTime: schedule.endAt.toISOString() },
    reminders: { useDefault: true }
  };
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = await response.json().catch(() => null) as T | GoogleErrorBody | null;
  if (!response.ok) {
    const errorBody = body as GoogleErrorBody | null;
    const message = errorBody?.error_description ?? errorBody?.message ?? fallbackMessage;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export class GoogleCalendarService {
  public status(userId: string) {
    return prisma.googleCalendarConnection.findUnique({
      where: { userId },
      select: { googleEmail: true, calendarId: true, syncEnabled: true, connectedAt: true, updatedAt: true, expiresAt: true }
    });
  }

  public async authUrl(userId: string, input: GoogleCalendarAuthInput): Promise<string> {
    const credentials = input.clientId && input.clientSecret ? {
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      redirectUri: input.redirectUri ?? defaultRedirectUri(),
      calendarId: input.calendarId?.trim() || "primary"
    } : envCredentials();
    await prisma.googleCalendarOAuthDraft.upsert({
      where: { userId },
      create: {
        userId,
        calendarId: credentials.calendarId,
        oauthClientId: credentials.clientId,
        oauthClientSecretEncrypted: encryptSecret(credentials.clientSecret),
        redirectUri: credentials.redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      },
      update: {
        calendarId: credentials.calendarId,
        oauthClientId: credentials.clientId,
        oauthClientSecretEncrypted: encryptSecret(credentials.clientSecret),
        redirectUri: credentials.redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });
    const state = jwt.sign({ sub: userId, purpose: "google-calendar" } satisfies GoogleState, env.JWT_SECRET, { expiresIn: "10m" });
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: "code",
      scope: calendarScope,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state
    });
    return `${oauthEndpoint}?${params.toString()}`;
  }

  public async callback(code: string, state: string): Promise<void> {
    const decoded = jwt.verify(state, env.JWT_SECRET) as GoogleState;
    if (decoded.purpose !== "google-calendar") throw new ApiError(400, "Estado OAuth invalido.");
    const credentials = await this.pendingCredentials(decoded.sub);
    const token = await this.exchangeCode(code, credentials);
    const profile = await this.googleProfile(token.access_token);
    await prisma.googleCalendarConnection.upsert({
      where: { userId: decoded.sub },
      create: {
        userId: decoded.sub,
        googleEmail: profile.email,
        calendarId: credentials.calendarId,
        oauthClientId: credentials.clientId,
        oauthClientSecretEncrypted: encryptSecret(credentials.clientSecret),
        redirectUri: credentials.redirectUri,
        accessTokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        scope: token.scope,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        syncEnabled: true
      },
      update: {
        googleEmail: profile.email,
        calendarId: credentials.calendarId,
        oauthClientId: credentials.clientId,
        oauthClientSecretEncrypted: encryptSecret(credentials.clientSecret),
        redirectUri: credentials.redirectUri,
        accessTokenEncrypted: encryptSecret(token.access_token),
        ...(token.refresh_token ? { refreshTokenEncrypted: encryptSecret(token.refresh_token) } : {}),
        scope: token.scope,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        syncEnabled: true
      }
    });
    await prisma.googleCalendarOAuthDraft.deleteMany({ where: { userId: decoded.sub } });
  }

  public async disconnect(userId: string): Promise<void> {
    await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
  }

  public async syncSchedule(scheduleId: string, userId: string): Promise<void> {
    const schedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId } });
    if (!schedule) return;
    const connection = await this.connection(userId);
    if (!connection?.syncEnabled) return;
    const accessToken = await this.accessToken(userId);
    if (schedule.googleEventId) {
      await fetch(`${calendarEndpoint}/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(schedule.googleEventId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventBody(schedule))
      }).then((response) => parseJsonResponse<GoogleEventResponse>(response, "Nao foi possivel atualizar evento no Google Calendar."));
      await prisma.schedule.update({ where: { id: schedule.id }, data: { googleSyncedAt: new Date(), googleSyncStatus: "SYNCED", googleCalendarId: connection.calendarId } });
      return;
    }
    const event = await fetch(`${calendarEndpoint}/calendars/${encodeURIComponent(connection.calendarId)}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(schedule))
    }).then((response) => parseJsonResponse<GoogleEventResponse>(response, "Nao foi possivel criar evento no Google Calendar."));
    await prisma.schedule.update({ where: { id: schedule.id }, data: { googleEventId: event.id, googleCalendarId: connection.calendarId, googleSyncedAt: new Date(), googleSyncStatus: "SYNCED" } });
  }

  public async deleteScheduleEvent(schedule: Schedule): Promise<void> {
    if (!schedule.googleEventId) return;
    const connection = await this.connection(schedule.userId);
    if (!connection?.syncEnabled) return;
    const accessToken = await this.accessToken(schedule.userId);
    const response = await fetch(`${calendarEndpoint}/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(schedule.googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      throw new ApiError(response.status, "Nao foi possivel remover evento do Google Calendar.");
    }
  }

  private async exchangeCode(code: string, credentials: OAuthCredentials): Promise<GoogleTokenResponse> {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
        grant_type: "authorization_code",
        code
      })
    });
    return parseJsonResponse<GoogleTokenResponse>(response, "Nao foi possivel conectar ao Google Calendar.");
  }

  private async googleProfile(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return parseJsonResponse<GoogleUserInfo>(response, "Nao foi possivel ler perfil Google.");
  }

  private connection(userId: string) {
    return prisma.googleCalendarConnection.findUnique({ where: { userId } });
  }

  private async accessToken(userId: string): Promise<string> {
    const connection = await this.connection(userId);
    if (!connection) throw new ApiError(400, "Google Calendar nao conectado.");
    if (connection.expiresAt.getTime() > Date.now() + 60_000) return decryptSecret(connection.accessTokenEncrypted);
    if (!connection.refreshTokenEncrypted) throw new ApiError(400, "Google Calendar precisa ser reconectado.");
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: connection.oauthClientId ?? envCredentials().clientId,
        client_secret: connection.oauthClientSecretEncrypted ? decryptSecret(connection.oauthClientSecretEncrypted) : envCredentials().clientSecret,
        grant_type: "refresh_token",
        refresh_token: decryptSecret(connection.refreshTokenEncrypted)
      })
    });
    const token = await parseJsonResponse<GoogleTokenResponse>(response, "Nao foi possivel renovar token Google.");
    await prisma.googleCalendarConnection.update({
      where: { userId },
      data: {
        accessTokenEncrypted: encryptSecret(token.access_token),
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        scope: token.scope
      }
    });
    return token.access_token;
  }

  private async pendingCredentials(userId: string): Promise<OAuthCredentials> {
    const draft = await prisma.googleCalendarOAuthDraft.findUnique({ where: { userId } });
    if (!draft || draft.expiresAt.getTime() < Date.now()) {
      await prisma.googleCalendarOAuthDraft.deleteMany({ where: { userId } });
      throw new ApiError(400, "Conexao Google expirada. Inicie novamente pela tela de agenda.");
    }
    return {
      clientId: draft.oauthClientId,
      clientSecret: decryptSecret(draft.oauthClientSecretEncrypted),
      redirectUri: draft.redirectUri,
      calendarId: draft.calendarId
    };
  }
}
