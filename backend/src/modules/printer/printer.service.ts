import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PrinterSettingsInput {
  headerNote?: string;
  footerNote?: string;
  supportPhone?: string;
}

export class PrinterService {
  /**
   * Helper: Pad text for 32-character 58mm thermal paper width
   */
  private padLine(left: string, right: string, width = 32): string {
    const leftStr = left.slice(0, width - right.length - 1);
    const spaceCount = Math.max(1, width - leftStr.length - right.length);
    return leftStr + ' '.repeat(spaceCount) + right;
  }

  private centerText(text: string, width = 32): string {
    if (text.length >= width) return text.slice(0, width);
    const leftPadding = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPadding) + text;
  }

  private divider(char = '-', width = 32): string {
    return char.repeat(width);
  }

  /**
   * Helper: Convert string to ESC/POS Hex Bytes
   */
  private textToEscPosHex(text: string, header: string, footer: string): string {
    // ESC/POS Command Hex Codes:
    // 1b40 = Init Printer
    // 1b6101 = Center Align
    // 1b4501 = Bold ON
    // 1b4500 = Bold OFF
    // 1b6100 = Left Align
    // 1d564200 = Paper Cut
    let hex = '1b40'; // Init
    hex += '1b6101'; // Center align
    hex += '1b4501'; // Bold ON

    const cleanHeader = header.replace(/[\r\n]+/g, ' ');
    hex += Buffer.from(`${cleanHeader}\n\n`, 'utf-8').toString('hex');
    hex += '1b4500'; // Bold OFF
    hex += '1b6100'; // Left align

    hex += Buffer.from(`${text}\n\n`, 'utf-8').toString('hex');

    hex += '1b6101'; // Center align
    const cleanFooter = footer.replace(/[\r\n]+/g, ' ');
    hex += Buffer.from(`${cleanFooter}\n\n\n`, 'utf-8').toString('hex');
    hex += '1d564200'; // Cut paper

    return hex;
  }

  /**
   * Generate 58mm Thermal Receipt Template, Text, HTML Preview, and ESC/POS Hex Stream
   */
  async generateReceiptTemplate(tenantId: string, receiptType: string, payload: Record<string, any>) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });

    if (!tenant) throw new Error('Tenant not found');

    const companyName = tenant.companyName;
    const phone = tenant.settings?.supportPhone || tenant.city || 'Customer Support';
    const headerNote = tenant.settings?.receiptHeader || `${companyName}\nDelivery Operations`;
    const footerNote = tenant.settings?.receiptFooter || 'Thank you for your business!\nPowered by OmniRoute SaaS';

    const nowStr = new Date().toLocaleString();
    let lines: string[] = [];

    lines.push(this.centerText(companyName.toUpperCase()));
    lines.push(this.centerText(`Ph: ${phone}`));
    lines.push(this.divider('='));

    if (receiptType === 'delivery_receipt') {
      lines.push(this.centerText('*** DELIVERY RECEIPT ***'));
      lines.push(this.divider('-'));
      lines.push(`Date: ${nowStr}`);
      lines.push(`Order #: ${payload.orderNumber || 'ORD-1001'}`);
      lines.push(`Customer: ${payload.customerName || 'Valued Customer'}`);
      if (payload.customerPhone) lines.push(`Phone: ${payload.customerPhone}`);
      if (payload.address) lines.push(`Addr: ${payload.address}`);
      lines.push(this.divider('-'));

      lines.push(this.padLine('ITEM / PRODUCT', 'QTY   TOTAL'));
      lines.push(this.divider('-'));

      const items = payload.items || [
        { name: '19L Water Bottle', qty: 2, price: 5.00, total: 10.00 }
      ];

      let subtotal = 0;
      for (const item of items) {
        const lineTot = item.total !== undefined ? item.total : item.qty * item.price;
        subtotal += lineTot;
        lines.push(this.padLine(item.name, `${item.qty}x $${lineTot.toFixed(2)}`));
      }

      lines.push(this.divider('-'));
      lines.push(this.padLine('SUBTOTAL:', `$${subtotal.toFixed(2)}`));
      if (payload.emptiesReturned !== undefined) {
        lines.push(this.padLine('EMPTIES RETURNED:', `${payload.emptiesReturned} Units`));
      }
      lines.push(this.padLine('CASH COLLECTED:', `$${(payload.cashCollected || subtotal).toFixed(2)}`));
      lines.push(this.divider('='));
      lines.push(this.padLine('NET BALANCE DUE:', `$${(payload.balanceDue || 0).toFixed(2)}`));
      lines.push(this.divider('-'));
      lines.push(`Rider: ${payload.riderName || 'Field Rider'}`);
      lines.push('\nSign: _______________________');

    } else if (receiptType === 'payment_voucher') {
      lines.push(this.centerText('*** PAYMENT COLLECTION VOUCHER ***'));
      lines.push(this.divider('-'));
      lines.push(`Voucher #: ${payload.voucherNumber || 'VCH-1001'}`);
      lines.push(`Date: ${nowStr}`);
      lines.push(`Customer: ${payload.customerName || 'Valued Customer'}`);
      lines.push(`Payment Method: ${(payload.paymentMethod || 'cash').toUpperCase()}`);
      lines.push(this.divider('-'));
      lines.push(this.padLine('AMOUNT PAID:', `$${Number(payload.amount || 0).toFixed(2)}`));
      if (payload.invoiceNumber) lines.push(this.padLine('APPLIED TO INV:', payload.invoiceNumber));
      lines.push(this.padLine('REMAINING BALANCE:', `$${Number(payload.remainingBalance || 0).toFixed(2)}`));
      lines.push(this.divider('-'));
      lines.push(`Collected By: ${payload.collectedBy || 'Rider'}`);

    } else if (receiptType === 'empties_receipt') {
      lines.push(this.centerText('*** CONTAINER DEPOSIT TICKET ***'));
      lines.push(this.divider('-'));
      lines.push(`Date: ${nowStr}`);
      lines.push(`Customer: ${payload.customerName || 'Valued Customer'}`);
      lines.push(this.divider('-'));
      lines.push(this.padLine('CONTAINERS ISSUED:', `${payload.bottlesIssued || 0} Units`));
      lines.push(this.padLine('CONTAINERS RETURNED:', `${payload.bottlesReturned || 0} Units`));
      lines.push(this.divider('-'));
      lines.push(this.padLine('NET CONTAINERS HELD:', `${(payload.bottlesIssued || 0) - (payload.bottlesReturned || 0)} Units`));
      lines.push(this.padLine('SECURITY DEPOSIT HELD:', `$${Number(payload.depositAmount || 0).toFixed(2)}`));
    }

    lines.push(this.divider('='));
    lines.push(this.centerText(footerNote));

    const formattedText = lines.join('\n');
    const escposCommandsHex = this.textToEscPosHex(formattedText, headerNote, footerNote);

    // Thermal HTML Preview generator
    const htmlPreview = `
      <div style="font-family: monospace; width: 280px; padding: 12px; background: #fff; color: #000; font-size: 12px; line-height: 1.4; border: 1px dashed #aaa; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
        <pre style="margin: 0; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace;">${formattedText}</pre>
      </div>
    `;

    return {
      receiptType,
      formattedText,
      htmlPreview,
      escposCommandsHex
    };
  }

  /**
   * Get tenant printer header/footer settings
   */
  async getPrinterSettings(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true }
    });

    return {
      companyName: tenant?.companyName || 'Delivery Business',
      receiptHeader: tenant?.settings?.receiptHeader || `${tenant?.companyName}\nDelivery Operations`,
      receiptFooter: tenant?.settings?.receiptFooter || 'Thank you for choosing us!\nPowered by OmniRoute',
      supportPhone: tenant?.settings?.supportPhone || tenant?.city || ''
    };
  }

  /**
   * Update tenant receipt printer settings
   */
  async updatePrinterSettings(tenantId: string, input: PrinterSettingsInput) {
    const existing = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (existing) {
      return prisma.tenantSettings.update({
        where: { tenantId },
        data: {
          receiptHeader: input.headerNote !== undefined ? input.headerNote : existing.receiptHeader,
          receiptFooter: input.footerNote !== undefined ? input.footerNote : existing.receiptFooter,
          supportPhone: input.supportPhone !== undefined ? input.supportPhone : existing.supportPhone
        }
      });
    } else {
      return prisma.tenantSettings.create({
        data: {
          tenantId,
          receiptHeader: input.headerNote || 'Delivery Operations',
          receiptFooter: input.footerNote || 'Thank you!',
          supportPhone: input.supportPhone || ''
        }
      });
    }
  }
}
