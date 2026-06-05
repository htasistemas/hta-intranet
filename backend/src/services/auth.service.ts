import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { addDays } from "date-fns";
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
  user: { id: string; name: string; email: string; role: string };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  private issueAccessToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      { email: user.email, role: user.role },
      env.JWT_SECRET,
      { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
    );
  }

  private issueRefreshToken(user: { id: string; email: string; role: string }): string {
    return jwt.sign(
      { email: user.email, role: user.role },
      env.JWT_REFRESH_SECRET,
      { subject: user.id, jwtid: randomUUID(), expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] }
    );
  }

  public async login(credentials: Credentials): Promise<TokenSet> {
    const user = await prisma.user.findUnique({ where: { email: credentials.email } });
    if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
      throw new ApiError(401, "Email ou senha invalidos.");
    }
    const refreshToken = this.issueRefreshToken(user);
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: addDays(new Date(), 7) } });
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
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
      user: { id: record.user.id, name: record.user.name, email: record.user.email, role: record.user.role }
    };
  }

  public async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: new Date() } });
  }
}
