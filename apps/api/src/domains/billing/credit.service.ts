import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreditTransactionType } from '../../generated/prisma';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(orgId: string): Promise<number> {
    const result = await this.prisma.creditTransaction.aggregate({
      where: { orgId },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }

  async getTransactions(orgId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { orgId } }),
    ]);

    return {
      transactions,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  async addCredits(
    orgId: string,
    amount: number,
    type: CreditTransactionType,
    description?: string,
    userId?: string,
    referenceId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.getBalanceInTx(tx, orgId);

      const transaction = await tx.creditTransaction.create({
        data: {
          orgId,
          userId,
          amount,
          type,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance + amount,
          description,
          referenceId,
        },
      });

      return transaction;
    });
  }

  async deductCredits(
    orgId: string,
    amount: number,
    type: CreditTransactionType,
    description?: string,
    userId?: string,
    chatbotId?: string,
    referenceId?: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Deduction amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.getBalanceInTx(tx, orgId);

      if (currentBalance < amount) {
        throw new BadRequestException(
          `Insufficient credits. Current balance: ${currentBalance}, required: ${amount}`,
        );
      }

      const transaction = await tx.creditTransaction.create({
        data: {
          orgId,
          userId,
          chatbotId,
          amount: -amount, // Store as negative for deductions
          type,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance - amount,
          description,
          referenceId,
        },
      });

      return transaction;
    });
  }

  async hasCredits(orgId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(orgId);
    return balance >= amount;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Calculate balance inside an existing Prisma transaction to avoid
   * race conditions with concurrent credit operations.
   */
  private async getBalanceInTx(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    orgId: string,
  ): Promise<number> {
    const result = await tx.creditTransaction.aggregate({
      where: { orgId },
      _sum: { amount: true },
    });

    return result._sum.amount ?? 0;
  }
}
