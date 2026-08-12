import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

function resolveJwtSecret(config: ConfigService) {
  const value = config.get<string>('JWT_ACCESS_SECRET');
  if (value) return value;
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_ACCESS_SECRET precisa estar configurado em producao.');
  }
  return 'dev-secret';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config)
    });
  }
  validate(payload: any) {
    return { id: payload.sub, email: payload.email, name: payload.name, isSuperAdmin: payload.isSuperAdmin };
  }
}
