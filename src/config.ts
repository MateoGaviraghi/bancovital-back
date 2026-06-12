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
