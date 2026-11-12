import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Invoice } from '@/src/api/types';
import { formatPkr } from '@/src/utils/currency';
import { formatDateTime } from '@/src/utils/date';

export function buildInvoiceHtml(invoice: Invoice): string {
  const { gym, member, payment } = invoice;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Segoe UI, sans-serif; padding: 24px; color: #111; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .muted { color: #666; font-size: 12px; }
    .row { display: flex; justify-content: space-between; margin: 6px 0; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 16px; }
    .total { font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${gym.name}</h1>
  <div class="muted">${gym.address}, ${gym.city}</div>
  <div class="muted">${gym.phone}${gym.email ? ' · ' + gym.email : ''}</div>
  <hr />
  <div class="row"><strong>Invoice</strong><span>${payment.invoiceNumber}</span></div>
  <div class="row"><span>Date</span><span>${formatDateTime(payment.paidAt)}</span></div>
  <div class="row"><span>Member</span><span>${member.name} (${member.phone})</span></div>
  <div class="row"><span>Plan</span><span>${member.planName}</span></div>
  <div class="box">
    <div class="row"><span>Amount</span><span>${formatPkr(payment.amountPkr)}</span></div>
    <div class="row"><span>Discount</span><span>${formatPkr(payment.discountPkr)}</span></div>
    <div class="row"><span>Paid (${payment.method})</span><span>${formatPkr(payment.paidPkr)}</span></div>
    <div class="row total"><span>Due</span><span>${formatPkr(payment.duePkr)}</span></div>
  </div>
  <p class="muted">Collected by ${payment.collectedBy}. Currency PKR · Asia/Karachi</p>
</body>
</html>`;
}

export async function printAndShareInvoice(invoice: Invoice) {
  const html = buildInvoiceHtml(invoice);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Invoice ${invoice.payment.invoiceNumber}`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}
