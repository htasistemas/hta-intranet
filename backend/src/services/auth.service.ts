import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { addDays, addHours } from "date-fns";
import nodemailer from "nodemailer";
import { prisma } from "../prisma/client.js";
import { ApiError } from "../utils/api-error.js";
import { env } from "../utils/env.js";

interface Credentials {
  email: string;
  password: string;
}

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: string; partnerId: string | null };
}

interface GoogleTokenInfo {
  aud: string;
  email: string;
  email_verified: "true" | "false" | boolean;
  name?: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function smtpConfigured(): boolean {
  return Boolean(env.APP_EMAIL_HABILITADO && env.MAIL_HOST && env.MAIL_PORT && env.MAIL_USER && env.MAIL_PASS && env.APP_EMAIL_REMETENTE);
}

async function sendPasswordResetEmail(input: { email: string; name: string; link: string; token: string }): Promise<void> {
  if (!smtpConfigured()) {
    console.info(`Token de redefinicao para ${input.email}: ${input.token}`);
    return;
  }
  const host = env.MAIL_HOST;
  const port = env.MAIL_PORT;
  const user = env.MAIL_USER;
  const pass = env.MAIL_PASS;
  const fromAddress = env.APP_EMAIL_REMETENTE;
  if (!host || !port || !user || !pass || !fromAddress) throw new ApiError(500, "Servidor de e-mail SMTP incompleto.");
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  await transporter.sendMail({
    from: { address: fromAddress, name: env.APP_EMAIL_NOME ?? fromAddress },
    to: { address: input.email, name: input.name },
    subject: "Redefinicao de senha - HTA Sistemas",
    text: `Use este link para redefinir sua senha: ${input.link}`,
    html: `<p>Ola ${input.name},</p><p>Use o link abaixo para redefinir sua senha:</p><p><a href="${input.link}">${input.link}</a></p><p>Este link expira em 1 hora.</p>`
  });
}

export class AuthService {
  private issueAccessToken(user: { id: string; email: string; role: string; partnerId?: string | null }): string {
    return jwt.sign(
      { email: user.email, role: user.role, partnerId: user.partnerId ?? null },
      env.JWT_SECRET,
      { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
    );
  }

  private issueRefreshToken(user: { id: string; email: string; role: string; partnerId?: string | null }): string {
    return jwt.sign(
      { email: user.email, role: user.role, partnerId: user.partnerId ?? null },
      env.JWT_REFRESH_SECRET,
      { subject: user.id, jwtid: randomUUID(), expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] }
    );
  }

  private async createSession(user: { id: string; name: string; email: string; role: string; partnerId?: string | null }): Promise<TokenSet> {
    const refreshToken = this.issueRefreshToken(user);
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: addDays(new Date(), 7) } });
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, partnerId: user.partnerId ?? null }
    };
  }

  public async login(credentials: Credentials): Promise<TokenSet> {
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
      throw new ApiError(401, "Email ou senha invalidos.");
    }
    return this.createSession(user);
  }

  public async loginWithGoogle(credential: string): Promise<TokenSet> {
    if (!env.GOOGLE_CLIENT_ID) throw new ApiError(500, "Login com Google nao configurado.");
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new ApiError(401, "Token do Google invalido.");
    const payload = await response.json() as GoogleTokenInfo;
    if (payload.aud !== env.GOOGLE_CLIENT_ID || payload.email_verified === false || payload.email_verified === "false") {
      throw new ApiError(401, "Conta Google nao verificada para este sistema.");
    }
    const user = await prisma.user.findUnique({ where: { email: payload.email.toLowerCase() } });
    if (!user) throw new ApiError(403, "Usuario Google nao cadastrado no sistema.");
    return this.createSession(user);
  }

  public async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { sent: true };
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: addHours(new Date(), 1) }
    });
    const link = `${env.FRONTEND_URL}/login?resetToken=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail({ email: user.email, name: user.name, link, token });
    return { sent: true };
  }

  public async resetPassword(token: string, password: string): Promise<{ reset: boolean }> {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw new ApiError(400, "Token de redefinicao invalido ou expirado.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    return { reset: true };
  }

  public async refresh(refreshToken: string): Promise<TokenSet> {
    let userId: string;
    try {
      const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
      userId = typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : "";
    } catch {
      throw new ApiError(401, "Refresh token invalido.");
    }
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) }, include: { user: true } });
    if (!record || record.userId !== userId || record.revokedAt || record.expiresAt <= new Date()) {
      throw new ApiError(401, "Refresh token expirado ou revogado.");
    }
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    const nextRefreshToken = this.issueRefreshToken(record.user);
    await prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(nextRefreshToken), expiresAt: addDays(new Date(), 7) } });
    return {
      accessToken: this.issueAccessToken(record.user),
      refreshToken: nextRefreshToken,
      user: { id: record.user.id, name: record.user.name, email: record.user.email, role: record.user.role, partnerId: record.user.partnerId ?? null }
    };
  }

  public async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: new Date() } });
  }
}
