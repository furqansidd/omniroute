import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UpsertTemplateInput {
  id?: string;
  name: string;
  eventTrigger: string;
  channel?: string;
  body: string;
  status?: string;
}

export interface DirectNotificationInput {
  customerId?: string;
  recipientPhone: string;
  body: string;
  channel?: string;
}

export interface GetLogsQuery {
  channel?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class NotificationService {
  /**
   * Seed default operational templates if tenant has no templates configured
   */
  private async ensureDefaultTemplates(tenantId: string) {
    const existingCount = await prisma.messageTemplate.count({
      where: { tenantId }
    });

    if (existingCount === 0) {
      const defaultTemplates = [
        {
          name: 'Order Out For Delivery',
          eventTrigger: 'out_for_delivery',
          channel: 'whatsapp',
          body: 'Hi {{customer_name}}, your {{company_name}} delivery for order #{{order_number}} is out for delivery with rider {{rider_name}}!'
        },
        {
          name: 'Delivery Completed Receipt',
          eventTrigger: 'delivered',
          channel: 'whatsapp',
          body: 'Hi {{customer_name}}, your delivery of {{qty}} units of {{product_name}} was completed by {{rider_name}}. Thank you for choosing {{company_name}}!'
        },
        {
          name: 'Monthly Invoice Issued',
          eventTrigger: 'invoice_generated',
          channel: 'both',
          body: 'Hi {{customer_name}}, your invoice #{{invoice_number}} for period {{billing_period}} is ready. Total: ${{total_amount}}, Due: {{due_date}}.'
        },
        {
          name: 'Payment Receipt Confirmation',
          eventTrigger: 'payment_received',
          channel: 'whatsapp',
          body: 'Thank you {{customer_name}}! Received payment of ${{paid_amount}} for Invoice #{{invoice_number}}. Outstanding Balance: ${{balance}}.'
        },
        {
          name: 'Sleeping Customer Re-engagement',
          eventTrigger: 'sleeping_alert',
          channel: 'sms',
          body: 'We miss you {{customer_name}}! Re-order your {{product_name}} today from {{company_name}} with priority route delivery.'
        }
      ];

      for (const t of defaultTemplates) {
        await prisma.messageTemplate.create({
          data: {
            tenantId,
            name: t.name,
            eventTrigger: t.eventTrigger,
            channel: t.channel,
            body: t.body,
            status: 'active'
          }
        });
      }
    }
  }

  /**
   * Interpolates dynamic tags {{tag_name}} with provided variables
   */
  renderTemplate(body: string, contextData: Record<string, any>): string {
    return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, tag) => {
      const val = contextData[tag];
      return val !== undefined && val !== null ? String(val) : match;
    });
  }

  /**
   * Get all templates for tenant
   */
  async getTemplates(tenantId: string) {
    await this.ensureDefaultTemplates(tenantId);
    return prisma.messageTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Create or update a message template
   */
  async upsertTemplate(tenantId: string, input: UpsertTemplateInput) {
    if (input.id) {
      return prisma.messageTemplate.update({
        where: { id: input.id },
        data: {
          name: input.name,
          eventTrigger: input.eventTrigger,
          channel: input.channel || 'whatsapp',
          body: input.body,
          status: input.status || 'active'
        }
      });
    } else {
      return prisma.messageTemplate.create({
        data: {
          tenantId,
          name: input.name,
          eventTrigger: input.eventTrigger,
          channel: input.channel || 'whatsapp',
          body: input.body,
          status: input.status || 'active'
        }
      });
    }
  }

  /**
   * Automated Trigger Notification Execution
   */
  async triggerEventNotification(
    tenantId: string,
    eventTrigger: string,
    payload: { customerId?: string; recipientPhone?: string; data: Record<string, any> }
  ) {
    await this.ensureDefaultTemplates(tenantId);

    const template = await prisma.messageTemplate.findFirst({
      where: { tenantId, eventTrigger, status: 'active' }
    });

    if (!template) {
      return { success: false, error: `No active template found for trigger: ${eventTrigger}` };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    // Merge context data
    const contextData = {
      company_name: tenant?.companyName || 'OmniRoute',
      ...(payload.data || {})
    };

    const renderedBody = this.renderTemplate(template.body, contextData);
    const recipientPhone = payload.recipientPhone || payload.data?.customer_phone || '+15550000000';

    const log = await prisma.messageLog.create({
      data: {
        tenantId,
        customerId: payload.customerId || null,
        templateId: template.id,
        channel: template.channel,
        recipientPhone,
        body: renderedBody,
        status: 'sent'
      }
    });

    return {
      success: true,
      log,
      renderedBody
    };
  }

  /**
   * Send a direct manual notification
   */
  async sendDirectNotification(tenantId: string, input: DirectNotificationInput) {
    if (!input.recipientPhone || !input.body) {
      throw new Error('recipientPhone and body are required');
    }

    const log = await prisma.messageLog.create({
      data: {
        tenantId,
        customerId: input.customerId || null,
        channel: input.channel || 'whatsapp',
        recipientPhone: input.recipientPhone,
        body: input.body,
        status: 'sent'
      }
    });

    return log;
  }

  /**
   * Get Message Logs with filtering & search
   */
  async getMessageLogs(tenantId: string, query: GetLogsQuery = {}) {
    const { channel, status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (channel) where.channel = channel;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { recipientPhone: { contains: search } },
        { body: { contains: search } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' }
      }),
      prisma.messageLog.count({ where })
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get notification KPI stats summary
   */
  async getNotificationStats(tenantId: string) {
    const [totalSent, totalFailed, totalWhatsapp, totalSms, activeTemplates] = await Promise.all([
      prisma.messageLog.count({ where: { tenantId, status: 'sent' } }),
      prisma.messageLog.count({ where: { tenantId, status: 'failed' } }),
      prisma.messageLog.count({ where: { tenantId, channel: 'whatsapp' } }),
      prisma.messageLog.count({ where: { tenantId, channel: 'sms' } }),
      prisma.messageTemplate.count({ where: { tenantId, status: 'active' } })
    ]);

    const successRate = totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 100;

    return {
      totalSent,
      totalFailed,
      totalWhatsapp,
      totalSms,
      activeTemplates,
      successRate: Math.round(successRate * 10) / 10
    };
  }
}
