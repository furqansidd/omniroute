import { prisma } from '../../utils/prisma.js';

export interface CreateZoneDto {
  name: string;
  description?: string;
  geoBoundary?: string;
  assignedSupervisorId?: string;
}

export interface CreateRouteDto {
  zoneId: string;
  name: string;
  sequenceOrder?: number;
}

export interface CreateVisitPlanDto {
  routeId: string;
  riderId: string;
  dayOfWeek: number; // 0-6
  scheduleType?: 'daily' | 'alternate_day' | 'weekly';
}

export class ZoneService {
  static async listZones(tenantId: string) {
    return prisma.zone.findMany({
      where: { tenantId },
      include: {
        supervisor: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { routes: true, customers: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  static async createZone(tenantId: string, dto: CreateZoneDto) {
    return prisma.zone.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        geoBoundary: dto.geoBoundary,
        assignedSupervisorId: dto.assignedSupervisorId
      },
      include: { supervisor: true }
    });
  }

  static async updateZone(tenantId: string, id: string, dto: Partial<CreateZoneDto>) {
    const existing = await prisma.zone.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Zone not found');

    return prisma.zone.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.geoBoundary !== undefined && { geoBoundary: dto.geoBoundary }),
        ...(dto.assignedSupervisorId !== undefined && { assignedSupervisorId: dto.assignedSupervisorId })
      },
      include: { supervisor: true }
    });
  }

  static async listRoutes(tenantId: string, zoneId?: string) {
    const where: any = { tenantId };
    if (zoneId) where.zoneId = zoneId;

    return prisma.route.findMany({
      where,
      include: {
        zone: true,
        _count: { select: { visitPlans: true } }
      },
      orderBy: { sequenceOrder: 'asc' }
    });
  }

  static async createRoute(tenantId: string, dto: CreateRouteDto) {
    const zone = await prisma.zone.findFirst({ where: { id: dto.zoneId, tenantId } });
    if (!zone) throw new Error('Zone not found');

    return prisma.route.create({
      data: {
        tenantId,
        zoneId: dto.zoneId,
        name: dto.name,
        sequenceOrder: dto.sequenceOrder || 1
      },
      include: { zone: true }
    });
  }

  static async updateRouteSequence(tenantId: string, routeId: string, sequenceOrder: number) {
    const route = await prisma.route.findFirst({ where: { id: routeId, tenantId } });
    if (!route) throw new Error('Route not found');

    return prisma.route.update({
      where: { id: routeId },
      data: { sequenceOrder }
    });
  }

  static async listVisitPlans(tenantId: string, query: { routeId?: string; riderId?: string; dayOfWeek?: number }) {
    const where: any = { tenantId };
    if (query.routeId) where.routeId = query.routeId;
    if (query.riderId) where.riderId = query.riderId;
    if (query.dayOfWeek !== undefined) where.dayOfWeek = Number(query.dayOfWeek);

    return prisma.visitPlan.findMany({
      where,
      include: {
        route: { include: { zone: true } },
        rider: { select: { id: true, name: true, phone: true } }
      },
      orderBy: [{ dayOfWeek: 'asc' }, { route: { sequenceOrder: 'asc' } }]
    });
  }

  static async createVisitPlan(tenantId: string, dto: CreateVisitPlanDto) {
    const route = await prisma.route.findFirst({ where: { id: dto.routeId, tenantId } });
    if (!route) throw new Error('Route not found');

    const rider = await prisma.user.findFirst({ where: { id: dto.riderId, tenantId } });
    if (!rider) throw new Error('Rider user not found');

    return prisma.visitPlan.create({
      data: {
        tenantId,
        routeId: dto.routeId,
        riderId: dto.riderId,
        dayOfWeek: dto.dayOfWeek,
        scheduleType: dto.scheduleType || 'daily'
      },
      include: {
        route: true,
        rider: { select: { id: true, name: true, phone: true } }
      }
    });
  }

  static async deleteRoute(tenantId: string, id: string) {
    const route = await prisma.route.findFirst({ where: { id, tenantId } });
    if (!route) throw new Error('Route not found');

    await prisma.visitPlan.deleteMany({ where: { routeId: id } });
    return prisma.route.delete({ where: { id } });
  }

  static async deleteZone(tenantId: string, id: string) {
    const zone = await prisma.zone.findFirst({ where: { id, tenantId } });
    if (!zone) throw new Error('Zone not found');

    // Unlink customers
    await prisma.customer.updateMany({ where: { zoneId: id }, data: { zoneId: null } });
    // Delete routes and visit plans in this zone
    const routes = await prisma.route.findMany({ where: { zoneId: id } });
    for (const r of routes) {
      await prisma.visitPlan.deleteMany({ where: { routeId: r.id } });
      await prisma.route.delete({ where: { id: r.id } });
    }
    return prisma.zone.delete({ where: { id } });
  }
}

