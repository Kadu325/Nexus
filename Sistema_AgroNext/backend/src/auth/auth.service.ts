import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as argon2 from "argon2";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) return null;

    const isPasswordValid = await argon2.verify(user.passwordHash, pass);
    if (!isPasswordValid) return null;

    const { passwordHash, ...result } = user;
    return result;
  }
}
