import { serverDb } from './server-db';
import { orderEmail, type EmailOrder } from './order-email';
import { flushEmails } from './email-outbox';
export async function completePaidOrder(paypalOrder: any) {
  const unit = paypalOrder.purchase_units?.[0];
  const capture = unit?.payments?.captures?.find((value: any) => value.status === 'COMPLETED');
  if (paypalOrder.status !== 'COMPLETED' || !capture || paypalOrder.purchase_units.length !== 1 || unit.shipping?.address?.country_code !== 'GB') throw new Error('Payment is not complete for a UK order.');
  const db = serverDb();
  const { data: order, error } = await db.from('orders').select('*').eq('id', unit.custom_id).eq('paypal_order_id', paypalOrder.id).single();
  if (error || !order?.shipping) throw new Error('Order reference could not be verified.');
  const amount = capture.amount;
  if (amount?.currency_code !== 'GBP' || amount.value !== (order.shipping.total / 100).toFixed(2)) throw new Error('Payment total does not match the order.');
  const email = paypalOrder.payer?.email_address;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Customer email is unavailable.');
  const message = orderEmail(order as EmailOrder, 'confirmation');
  const { error: settled } = await db.rpc('complete_paid_order', { p_id: order.id, p_paypal_id: paypalOrder.id, p_capture_id: capture.id, p_email: email, p_message: message });
  if (settled) throw new Error('Could not save the completed order.');
  return flushEmails(order.id);
}
