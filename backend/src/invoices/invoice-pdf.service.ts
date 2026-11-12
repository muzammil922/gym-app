import { Injectable } from '@nestjs/common';
import { Invoice, InvoiceItem, Member, Gym } from '@prisma/client';

// pdfkit CJS default
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

type InvoiceWithRelations = Invoice & {
  items: InvoiceItem[];
  member: Member;
  gym: Gym;
};

@Injectable()
export class InvoicePdfService {
  async generate(invoice: InvoiceWithRelations): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(invoice.gym.name, { align: 'left' });
      doc.fontSize(10).fillColor('#555').text('Gym Invoice', { align: 'left' });
      doc.moveDown();
      doc.fillColor('#000').fontSize(14).text(`Invoice ${invoice.invoiceNumber}`);
      doc.fontSize(10);
      doc.text(`Status: ${invoice.status}`);
      doc.text(`Issue date: ${invoice.issueDate.toISOString().slice(0, 10)}`);
      doc.text(`Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`);
      doc.moveDown();
      doc.text(`Bill to: ${invoice.member.fullName}`);
      doc.text(`Phone: ${invoice.member.phone}`);
      if (invoice.member.memberCode) doc.text(`Member: ${invoice.member.memberCode}`);
      doc.moveDown();

      doc.fontSize(11).text('Items', { underline: true });
      doc.moveDown(0.5);
      for (const item of invoice.items) {
        doc
          .fontSize(10)
          .text(
            `${item.description}  x${item.quantity}  @ ${item.unitPrice}  =  ${item.amount} ${invoice.currency}`,
          );
      }
      doc.moveDown();
      doc.text(`Subtotal: ${invoice.subtotal} ${invoice.currency}`);
      doc.text(`Discount: ${invoice.discount} ${invoice.currency}`);
      doc.text(`Tax: ${invoice.tax} ${invoice.currency}`);
      doc.fontSize(12).text(`Total: ${invoice.total} ${invoice.currency}`);
      doc.fontSize(10).text(`Paid: ${invoice.paidAmount} ${invoice.currency}`);
      doc.text(`Due: ${invoice.dueAmount} ${invoice.currency}`);
      if (invoice.notes) {
        doc.moveDown();
        doc.text(`Notes: ${invoice.notes}`);
      }
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#888').text('All amounts in PKR. Timestamps stored in UTC.', {
        align: 'center',
      });
      doc.end();
    });
  }
}
