import type { Quote } from '../listings/types';
import type { RefundPreview, ReservationStatus } from './types';
export function statusLabel(status: ReservationStatus | string) {
  const labels: Record<string, string> = {
    pending: 'Awaiting host response',
    confirmed: 'Confirmed',
    checked_in: 'Checked in',
    completed: 'Completed',
    declined: 'Declined or expired',
    cancelled_by_guest: 'Cancelled by guest',
    cancelled_by_host: 'Cancelled by host',
    inquiry: 'Inquiry',
    reviewed: 'Reviewed',
    disputed: 'Disputed',
  };
  return labels[status] || status.replaceAll('_', ' ');
}
export function quoteSignature(quote: Quote) {
  return JSON.stringify([
    quote.listing_version_id,
    quote.check_in,
    quote.check_out,
    quote.guests,
    quote.currency,
    quote.instant_book,
    quote.breakdown,
    quote.cancellation_policy,
  ]);
}
export function refundSignature(preview: RefundPreview) {
  const b = preview.breakdown;
  return JSON.stringify([
    preview.status,
    preview.currency,
    preview.guest_paid_minor,
    b.refund_amount_minor,
    b.refunded_accommodation_minor,
    b.refunded_guest_fee_minor,
    b.non_refundable_minor,
    b.refund_pct,
    b.refunds_service_fee,
    b.matched_rule,
  ]);
}
export const cancellable = (status: ReservationStatus) =>
  status === 'pending' || status === 'confirmed';
