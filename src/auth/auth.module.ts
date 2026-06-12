import { Global, Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { JwtVerifier } from './verify';

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

@Global()
@Module({
  providers: [
    {
      provide: JWT_VERIFIER,
      useFactory: (): JwtVerifier => {
        const url = process.env.SUPABASE_URL;
        const anonKey = process.env.SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
          throw new Error(
            'SUPABASE_URL and SUPABASE_ANON_KEY must be set to construct the JWT verifier.',
          );
        }
        return new JwtVerifier(url, anonKey);
      },
    },
    TenantService,
  ],
  exports: [JWT_VERIFIER, TenantService],
})
export class AuthModule {}
