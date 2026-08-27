import { prisma } from '../../utils/prisma.js';

export interface RecordPingDto {
  geoLat: number;
  geoLng: number;
  speed?: number;
  batteryLevel?: number;
  heading?: number;
}

export class TrackboardService {
  static async recordPing(tenantId: string, riderId: string, dto: RecordPingDto) {
    const rider = await prisma.user.findFirst({ where: { id: riderId, tenantId } });
    if (!rider) throw new Error('Rider user not found');

    const created = await prisma.riderLocationPing.create({
      data: {
        tenantId,
        riderId,
        lat: dto.geoLat,
        lng: dto.geoLng,
        speed: dto.speed || 0,
        batteryLevel: dto.batteryLevel || 100,
        timestamp: new Date()
      }
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      riderId: created.riderId,
      geoLat: created.lat,
      geoLng: created.lng,
      speed: created.speed,
      batteryLevel: created.batteryLevel,
      timestamp: created.timestamp
    };
  }

  static async getLiveRiders(tenantId: string) {
    // Fetch all users with Rider or Driver role for this tenant
    const riders = await prisma.user.findMany({
      where: {
        tenantId,
        role: {
          name: { in: ['Rider/Driver', 'Rider', 'Driver'] }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true
      }
    });

    const result = [];
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const rider of riders) {
      // Get latest ping
      const latestPing = await prisma.riderLocationPing.findFirst({
        where: { tenantId, riderId: rider.id },
        orderBy: { timestamp: 'desc' }
      });

      // Get count of pending/assigned deliveries today
      const pendingDeliveries = await prisma.delivery.count({
        where: {
          tenantId,
          riderId: rider.id,
          status: 'pending'
        }
      });

      // Get delivered stops today with GPS coordinates
      const deliveredStops = await prisma.delivery.findMany({
        where: {
          tenantId,
          riderId: rider.id,
          status: 'delivered',
          deliveredAt: { gte: startOfToday }
        },
        include: {
          order: {
            include: { customer: true }
          }
        },
        orderBy: { deliveredAt: 'desc' }
      });

      const isOnline = latestPing ? new Date(latestPing.timestamp) >= fiveMinsAgo : false;

      result.push({
        rider,
        isOnline,
        status: isOnline ? 'online' : 'offline',
        pendingDeliveriesCount: pendingDeliveries,
        deliveredStops: deliveredStops.map(d => ({
          deliveryId: d.id,
          customerName: d.order?.customer?.name || 'Customer',
          customerAddress: d.order?.customer?.address || '',
          stopNumber: d.order?.customer?.stopNumber,
          geoLat: d.geoLat || d.order?.customer?.geoLat,
          geoLng: d.geoLng || d.order?.customer?.geoLng,
          deliveredQty: d.deliveredQty,
          cashCollected: d.cashCollected,
          deliveredAt: d.deliveredAt
        })),
        latestPing: latestPing ? {
          geoLat: latestPing.lat,
          geoLng: latestPing.lng,
          speed: latestPing.speed,
          batteryLevel: latestPing.batteryLevel,
          timestamp: latestPing.timestamp
        } : null
      });
    }

    return result;
  }

  static async getRiderHistory(tenantId: string, riderId: string, query: { startDate?: string; endDate?: string }) {
    const where: any = { tenantId, riderId };

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = new Date(query.startDate);
      if (query.endDate) where.timestamp.lte = new Date(query.endDate);
    }

    const pings = await prisma.riderLocationPing.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: 1000
    });

    return pings.map(p => ({
      id: p.id,
      tenantId: p.tenantId,
      riderId: p.riderId,
      geoLat: p.lat,
      geoLng: p.lng,
      speed: p.speed,
      batteryLevel: p.batteryLevel,
      timestamp: p.timestamp
    }));
  }
}
