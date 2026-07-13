import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const googleLoginSchema = z.object({
  credential: z.string().min(20)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(6)
});
