
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from '../../users/users.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    role: string;
  }) {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'User account is inactive or does not exist',
      );
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role.name,

      permissions: user.role.rolePermissions.map(
        (rp) => rp.permission.name,
      ),
    };
  }
}
