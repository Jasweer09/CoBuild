import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PlanType } from '../../generated/prisma';

@Injectable()
export class PlanService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  async findByType(type: PlanType) {
    const plan = await this.prisma.plan.findFirst({
      where: { type, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with type ${type} not found`);
    }

    return plan;
  }
}
