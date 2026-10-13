import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/guards/auth.guard.js';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { LoginResponseDto } from './dto/login-response.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Faz login e devolve o token de acesso' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha inválidos' })
  @ApiForbiddenResponse({ description: 'Conta desativada' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Encerra a sessão (invalida todos os tokens do usuário)',
  })
  @ApiNoContentResponse({ description: 'Sessão encerrada' })
  logout(@CurrentUser() user: JwtPayload) {
    return this.authService.logout(user.sub);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devolve os dados do usuário logado' })
  @ApiOkResponse({ type: User })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado',
  })
  me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(user.sub);
  }
}
