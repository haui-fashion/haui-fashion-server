import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/modules/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getDashboardReport() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const validStatuses = [
      OrderStatus.PAID,
      OrderStatus.TO_DELIVERY,
      OrderStatus.DELIVERING,
      OrderStatus.COMPLETED
    ];

    const totalRevAgg = await this.prisma.order.aggregate({
      where: { status: { in: validStatuses } },
      _sum: { totalAmount: true }
    });

    const rev1mAgg = await this.prisma.order.aggregate({
      where: {
        status: { in: validStatuses },
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { totalAmount: true }
    });

    const orders1m = await this.prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    });

    const topProducts7dItems = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        order: {
          status: { in: validStatuses },
          createdAt: { gte: sevenDaysAgo }
        }
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    const variantIds = topProducts7dItems.map((i) => i.variantId);
    let topProducts7d: any[] = [];
    if (variantIds.length > 0) {
      const variants = await this.prisma.variant.findMany({
        where: { id: { in: variantIds } },
        include: {
          product: {
            include: {
              images: {
                take: 1,
                orderBy: { position: 'asc' },
                include: { file: true }
              }
            }
          },
          colorOptionValue: true,
          sizeOptionValue: true
        }
      });
      topProducts7d = topProducts7dItems.map((item) => {
        const v = variants.find((v) => v.id === item.variantId);
        return {
          variantId: item.variantId,
          productName: v?.product.name,
          color: v?.colorOptionValue.value,
          size: v?.sizeOptionValue.value,
          quantity: item._sum.quantity,
          image: v?.product.images?.[0]?.file?.url,
          price: Number(v?.price || 0)
        };
      });
    }

    const recentOrders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { fullname: true, email: true } },
        payment: true
      }
    });

    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const chartData = await Promise.all(
      dates.map(async (d) => {
        const nextDay = new Date(d);
        nextDay.setDate(d.getDate() + 1);

        const resAgg = await this.prisma.order.aggregate({
          where: {
            status: { in: validStatuses },
            createdAt: { gte: d, lt: nextDay }
          },
          _sum: { totalAmount: true }
        });
        return {
          date: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
          revenue: Number(resAgg._sum.totalAmount || 0)
        };
      })
    );

    return {
      totalRevenue: Number(totalRevAgg._sum.totalAmount || 0),
      revenue1m: Number(rev1mAgg._sum.totalAmount || 0),
      orders1m,
      topProducts7d,
      recentOrders,
      chartData
    };
  }
}
