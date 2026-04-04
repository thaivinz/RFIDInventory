import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { UsersService } from '@users/users.service';
import { PrismaService } from '@prisma/prisma.service';
import { BusinessException } from '@common/exceptions/business.exception';

/**
 * AuthService — Xử lý logic xác thực người dùng.
 *
 * Chức năng:
 * - Xác thực username/password (validateUser)
 * - Đăng nhập, tạo cặp access + refresh token (login)
 * - Làm mới token khi access token hết hạn (refresh)
 * - Đăng xuất, thu hồi refresh token (logout)
 *
 * Bảo mật:
 * - Refresh token được hash SHA-256 trước khi lưu DB
 * - Token rotation: mỗi lần refresh sẽ thu hồi token cũ, cấp token mới
 * - Không trả password hash hay dữ liệu nhạy cảm trong response
 */
@Injectable()
export class AuthService {
  /** Secret key để ký refresh token (tách biệt với access token) */
  private readonly refreshSecret: string;
  /** Số ngày refresh token có hiệu lực */
  private readonly refreshExpDays: number;
  /** Thời gian sống access token (tính bằng giây) */
  private readonly accessExpSeconds: number;
  /** Thời gian sống refresh token (tính bằng giây) */
  private readonly refreshExpSeconds: number;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.refreshSecret = this.config.get('JWT_REFRESH_SECRET', this.config.getOrThrow('JWT_SECRET') + '_refresh');
    this.refreshExpDays = Number(this.config.get('JWT_REFRESH_EXPIRATION_DAYS', '7'));
    this.accessExpSeconds = this.parseExpirationToSeconds(this.config.get('JWT_ACCESS_EXPIRATION', '15m'));
    this.refreshExpSeconds = this.refreshExpDays * 24 * 60 * 60;
  }

  /**
   * Xác thực thông tin đăng nhập.
   * So sánh password (bcrypt) và trả về user info nếu hợp lệ, null nếu sai.
   * Được gọi bởi LocalStrategy (Passport).
   */
  async validateUser(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return { id: user.id, username: user.username, role: user.role, locationId: user.locationId };
  }

  /**
   * Đăng nhập — tạo cặp access + refresh token.
   * Lưu hash của refresh token vào bảng RefreshToken.
   * Interceptor sẽ auto-wrap thành { success, message, data }.
   */
  async login(user: { id: string; username: string; role: string; locationId?: string | null }, deviceType: string = 'WEB') {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Lưu hash refresh token vào DB để có thể thu hồi sau này
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpDays);

    await this.persistRefreshToken(user.id, hashedToken, expiresAt, deviceType);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessExpSeconds,
      refresh_token: refreshToken,
      refresh_expires_in: this.refreshExpSeconds,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        locationId: user.locationId,
      },
    };
  }

  /**
   * Làm mới phiên đăng nhập — Token Rotation.
   * 1. Verify chữ ký JWT của refresh token
   * 2. Kiểm tra token chưa bị thu hồi và chưa hết hạn trong DB
   * 3. Thu hồi refresh token cũ
   * 4. Cấp cặp access + refresh token mới
   *
   * @throws AUTH_REFRESH_INVALID (401) — Token sai, hết hạn, hoặc đã bị thu hồi
   */
  async refresh(refreshToken: string) {
    // Bước 1: Verify chữ ký JWT
    let payload: { sub: string; username: string; role: string; locationId?: string | null };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new BusinessException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'AUTH_REFRESH_INVALID', HttpStatus.UNAUTHORIZED);
    }

    // Bước 2: Kiểm tra token còn hợp lệ trong DB
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await this.findStoredRefreshToken(hashedToken);

    if (!storedToken) {
      throw new BusinessException('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'AUTH_REFRESH_INVALID', HttpStatus.UNAUTHORIZED);
    }

    // Bước 3: Thu hồi refresh token cũ (token rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Bước 4: Cấp cặp token mới
    const user = { id: payload.sub, username: payload.username, role: payload.role, locationId: payload.locationId };
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    // Lưu hash refresh token mới vào DB, kế thừa deviceType
    const newHashedToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpDays);

    await this.createRefreshTokenRecord(
      newHashedToken,
      user.id,
      expiresAt,
      storedToken.deviceType || 'WEB',
    );

    return {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: this.accessExpSeconds,
      refresh_token: newRefreshToken,
      refresh_expires_in: this.refreshExpSeconds,
    };
  }

  /**
   * Đăng xuất — thu hồi refresh token.
   * Luôn trả null (interceptor wrap thành { success: true, message, data: null }).
   */
  async logout(refreshToken: string) {
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { token: hashedToken },
      data: { revoked: true },
    });
    return null;
  }

  private async persistRefreshToken(
    userId: string,
    hashedToken: string,
    expiresAt: Date,
    deviceType: string,
  ) {
    try {
      // Đảm bảo mỗi user chỉ có 1 session active cho mỗi loại thiết bị (WEB / MOBILE)
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          deviceType,
          revoked: false,
        },
        data: { revoked: true },
      });
    } catch (error) {
      if (!this.isMissingDeviceTypeColumnError(error)) {
        throw error;
      }

      // Legacy DB chưa có cột deviceType: thu hồi tất cả session active của user.
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revoked: false,
        },
        data: { revoked: true },
      });
    }

    await this.createRefreshTokenRecord(hashedToken, userId, expiresAt, deviceType);
  }

  private async createRefreshTokenRecord(
    hashedToken: string,
    userId: string,
    expiresAt: Date,
    deviceType: string,
  ) {
    try {
      await this.prisma.refreshToken.create({
        data: {
          token: hashedToken,
          userId,
          deviceType,
          expiresAt,
        },
      });
    } catch (error) {
      if (!this.isMissingDeviceTypeColumnError(error)) {
        throw error;
      }

      await this.prisma.$executeRawUnsafe(
        'INSERT INTO "RefreshToken" ("id", "token", "userId", "revoked", "expiresAt", "createdAt") VALUES ($1, $2, $3, false, $4, NOW())',
        randomUUID(),
        hashedToken,
        userId,
        expiresAt,
      );
    }
  }

  private async findStoredRefreshToken(hashedToken: string) {
    try {
      return await this.prisma.refreshToken.findFirst({
        where: {
          token: hashedToken,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      if (!this.isMissingDeviceTypeColumnError(error)) {
        throw error;
      }

      const rows = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        userId: string;
        revoked: boolean;
        expiresAt: Date;
      }>>(
        'SELECT "id", "userId", "revoked", "expiresAt" FROM "RefreshToken" WHERE "token" = $1 AND "revoked" = false AND "expiresAt" > NOW() ORDER BY "createdAt" DESC LIMIT 1',
        hashedToken,
      );

      if (rows.length === 0) return null;

      return {
        ...rows[0],
        deviceType: 'WEB',
      };
    }
  }

  private isMissingDeviceTypeColumnError(error: unknown) {
    if (!(error instanceof Error)) return false;

    return (
      error.message.includes('deviceType') &&
      (
        error.message.includes('does not exist') ||
        error.message.includes('Unknown arg') ||
        error.message.includes('Unknown field') ||
        error.message.includes('column')
      )
    );
  }

  /** Tạo access token JWT. Payload: { sub, username, role, locationId } */
  private generateAccessToken(user: { id: string; username: string; role: string; locationId?: string | null }) {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, role: user.role, locationId: user.locationId },
    );
  }

  /**
   * Chuyển đổi chuỗi expiration (vd: '15m', '7d') sang giây.
   * Dùng để trả expires_in cho client.
   */
  private parseExpirationToSeconds(exp: string): number {
    const match = exp.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  /** Tạo refresh token JWT. Dùng secret riêng, thời hạn dài hơn (7 ngày). */
  private generateRefreshToken(user: { id: string; username: string; role: string; locationId?: string | null }) {
    return this.jwtService.sign(
      { sub: user.id, username: user.username, role: user.role, locationId: user.locationId, jti: crypto.randomUUID() },
      { secret: this.refreshSecret, expiresIn: `${this.refreshExpDays}d` },
    );
  }
}
