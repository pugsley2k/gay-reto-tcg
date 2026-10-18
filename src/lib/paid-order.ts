import { serverDb } from './server-db';
import { orderEmail, type EmailOrder } from './order-email';
import { flushEmails } from './email-outbox';
import { hasCompletedCapture, validatePayPalOrder } from './capture-order';
export async function completePaidOrder(paypalOrder: any) {
  const unit = paypalOrder.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((value: any) => value.status === 'COMPLETED');
  if (paypalOrder.status !== 'COMPLETED' || !capture || paypalOrder.purchase_units.length !== 1 || unit.shipping?.address?.country_code !== 'GB') throw new Error('Payment is not complete for a UK order.');
  const db = serverDb();
  const { data: order, error } = await db.from('orders').select('*').eq('id', unit.custom_id).eq('paypal_order_id', paypalOrder.id).single();
  if (error || !order?.shipping) throw new Error('Order reference could not be verified.');
  validatePayPalOrder(paypalOrder, order);
  if (!hasCompletedCapture(paypalOrder, order)) throw new Error('Completed payment could not be verified.');
  const email = paypalOrder.payer?.email_address;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Customer email is unavailable.');
  const message = orderEmail(order as EmailOrder, 'confirmation');
  const { data: state, error: settled } = await db.rpc('settle_checkout_payment', { p_id: order.id, p_paypal_id: paypalOrder.id, p_capture_id: capture.id, p_email: email, p_message: message, p_details: {address:unit.shipping,fee:capture.seller_receivable_breakdown?.paypal_fee?.currency_code === "GBP" && /^\d+(\.\d{1,2})?$/.test(capture.seller_receivable_breakdown.paypal_fee.value) ? Math.round(Number(capture.seller_receivable_breakdown.paypal_fee.value)*100) : null} });
  if (settled) throw new Error('Could not save the completed order.');
  if (state === 'payment_review') return { processed: 0, failed: 0, review: true };
  return { ...await flushEmails(order.id), review: false };
}
