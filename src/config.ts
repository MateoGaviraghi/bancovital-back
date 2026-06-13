import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  MAIL_NOTIFY_TO: z.string().optional(),
  OTP_DEV_LOG: z.string().optional(),
  // Google Calendar (F4 — reserva de reuniones)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

@Injectable()
export class AppConfig {
  private readonly cached: Env;

  constructor(private readonly config: ConfigService) {
    this.cached = loadEnv({
      NODE_ENV: this.config.get('NODE_ENV'),
      PORT: this.config.get('PORT'),
      DATABASE_URL: this.config.get('DATABASE_URL'),
      SUPABASE_URL: this.config.get('SUPABASE_URL'),
      SUPABASE_ANON_KEY: this.config.get('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: this.config.get('SUPABASE_SERVICE_ROLE_KEY'),
      SUPABASE_JWT_SECRET: this.config.get('SUPABASE_JWT_SECRET'),
      CORS_ALLOWED_ORIGINS: this.config.get('CORS_ALLOWED_ORIGINS'),
      APP_URL: this.config.get('APP_URL'),
      RESEND_API_KEY: this.config.get('RESEND_API_KEY'),
      MAIL_FROM: this.config.get('MAIL_FROM'),
      MAIL_NOTIFY_TO: this.config.get('MAIL_NOTIFY_TO'),
      OTP_DEV_LOG: this.config.get('OTP_DEV_LOG'),
      GOOGLE_CLIENT_ID: this.config.get('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: this.config.get('GOOGLE_CLIENT_SECRET'),
      GOOGLE_REFRESH_TOKEN: this.config.get('GOOGLE_REFRESH_TOKEN'),
      GOOGLE_CALENDAR_ID: this.config.get('GOOGLE_CALENDAR_ID'),
    } as NodeJS.ProcessEnv);
  }

  get env(): Env {
    return this.cached;
  }

  get corsOrigins(): string[] {
    return this.cached.CORS_ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get isProd(): boolean {
    return this.cached.NODE_ENV === 'production';
  }
}
