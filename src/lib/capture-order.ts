export type StoredCheckout = { id: string; paypal_order_id: string; shipping: { total: number }; paid_at?: string | null; checkout_state?: string | null };
export type PayPalOrder = { id: string; status: string; purchase_units?: { custom_id?: string; amount?: { currency_code?: string; value?: string }; shipping?: { address?: { country_code?: string } }; payments?: { captures?: { id: string; status: string; amount?: { currency_code?: string; value?: string } }[] } }[] };
export type CaptureResult = { success?: boolean; pending?: boolean; paid?: boolean; review?: boolean; message?: string };
type Dependencies = { getOrder(): Promise<PayPalOrder>; claim(): Promise<{ state: string }>; capture(requestId: string): Promise<PayPalOrder>; settle(order: PayPalOrder): Promise<{ review?: boolean }> };
export function validatePayPalOrder(remote: PayPalOrder, local: StoredCheckout) {
  const unit = remote.purchase_units?.[0];
  if (remote.id !== local.paypal_order_id || remote.purchase_units?.length !== 1 || unit?.custom_id !== local.id
    || unit.shipping?.address?.country_code !== 'GB' || unit.amount?.currency_code !== 'GBP'
    || unit.amount?.value !== (local.shipping.total / 100).toFixed(2)) throw new Error('Payment details do not match this UK order. Please contact the shop before paying again.');
}
export function hasCompletedCapture(remote: PayPalOrder, local: StoredCheckout) {
  const captures = remote.purchase_units?.[0]?.payments?.captures;
  return remote.status === 'COMPLETED' && captures?.length === 1 && captures[0].status === 'COMPLETED'
    && captures[0].amount?.currency_code === 'GBP' && captures[0].amount?.value === (local.shipping.total / 100).toFixed(2);
}
export async function captureCheckout(local: StoredCheckout, deps: Dependencies): Promise<CaptureResult> {
  if (local.paid_at) return local.checkout_state === 'payment_review' ? { pending: true, paid: true, review: true, message: 'Payment received. We are checking your order; please do not pay again.' } : { success: true, paid: true };
  const settle = async (remote: PayPalOrder): Promise<CaptureResult> => {
    try {
      const result = await deps.settle(remote);
      return result.review ? { pending: true, paid: true, review: true, message: 'Payment received. We are checking stock for your order; please do not pay again.' } : { success: true, paid: true };
    } catch { return { pending: true, paid: true, message: 'Payment received. Your order confirmation is still being saved. Please do not pay again.' }; }
  };
  const remote = await deps.getOrder();
  validatePayPalOrder(remote, local);
  if (hasCompletedCapture(remote, local)) return settle(remote);
  if (remote.status !== 'APPROVED') return { pending: true, message: 'Payment is not confirmed yet. Check PayPal before trying again.' };
  const claim = await deps.claim();
  if (claim.state !== 'claimed') return { pending: true, review: claim.state === 'payment_review', message: 'Your payment is being checked. Please do not start another checkout.' };
  try {
    const captured = await deps.capture(local.id);
    validatePayPalOrder(captured, local);
    if (hasCompletedCapture(captured, local)) return settle(captured);
  } catch { /* A timeout or ALREADY_CAPTURED response is not proof of failure. */ }
  try {
    const recovered = await deps.getOrder();
    validatePayPalOrder(recovered, local);
    if (hasCompletedCapture(recovered, local)) return settle(recovered);
  } catch { /* Keep the reservation until the provider outcome is known. */ }
  return { pending: true, message: 'PayPal has not confirmed the result yet. Your cards remain held while we check. Please do not pay again.' };
}
