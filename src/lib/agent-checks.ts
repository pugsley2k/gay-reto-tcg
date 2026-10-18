import { createHash } from 'node:crypto';
import { EXAMPLE_CARD_ID } from './example-listing';
export type CheckCard = { id: string; name: string; price: number; available: boolean; image_url: string | null; front_image_url?: string | null; back_image_url?: string | null; condition?: string | null; grading?: { company?: string; grade?: string; confirmed?: boolean } | null; updatedAt: string; sold_at?: string | null };
export type CheckOrder = { id: string; checkout_state: string | null; created_at: string; capture_started_at: string | null; paid_at: string | null; dispatched_at: string | null; payment_issue?: string | null };
export type ProposedAction = { id: string; kind: 'withdraw_listing' | 'review_listing' | 'review_payment'; title: string; detail: string; severity: 'attention' | 'warning'; card_id?: string; order_id?: string; snapshot: Record<string, unknown> };
export function inspectStore(cards: CheckCard[], orders: CheckOrder[], now = Date.now()) {
  const actions: ProposedAction[] = [];
  const actualCards = cards.filter(card => card.id !== EXAMPLE_CARD_ID);
  function add(action: Omit<ProposedAction, 'id'>) {
    const id = createHash('sha256').update(JSON.stringify([action.kind, action.card_id, action.order_id, action.detail, action.snapshot])).digest('hex');
    actions.push({ ...action, id });
  }
  for (const card of actualCards.filter(card => card.available)) {
    const snapshot = { price: card.price, available: card.available, updatedAt: card.updatedAt };
    if (!Number.isSafeInteger(card.price) || card.price < 1 || card.sold_at) {
      add({ kind: 'withdraw_listing', title: `Review ${card.name}`, detail: card.sold_at ? 'This listing is available but has a sale date. Approval hides it from the shop; inspect the order before relisting.' : 'This listing has a zero or invalid price. Approval hides it from the shop so you can review its price.', severity: 'warning', card_id: card.id, snapshot });
    } else if (!card.front_image_url || !card.back_image_url || (!card.condition && !card.grading?.confirmed)) {
      const missing = [!card.front_image_url ? 'front photograph' : '', !card.back_image_url ? 'back photograph' : '', !card.condition && !card.grading?.confirmed ? 'confirmed condition or slab details' : ''].filter(Boolean);
      add({ kind: 'review_listing', title: `Complete ${card.name}`, detail: `Check the ${missing.join(', ')}. Nothing has been changed.`, severity: 'attention', card_id: card.id, snapshot });
    }
  }
  for (const order of orders) {
    const delayedCapture = order.checkout_state === 'capturing' && order.capture_started_at && now - Date.parse(order.capture_started_at) > 120000;
    if (order.checkout_state === 'payment_review' || delayedCapture) {
      add({ kind: 'review_payment', title: `Check payment ${order.id.slice(0, 8)}`, detail: order.payment_issue || 'The payment result is still unresolved. Keep these cards held and check PayPal before taking further payment or releasing stock.', severity: 'warning', order_id: order.id, snapshot: { checkout_state: order.checkout_state, paid_at: order.paid_at } });
    }
  }
  return { actions, summary: { inventory: actualCards.length, available: actualCards.filter(card => card.available).length, heldPayments: orders.filter(order => ['capturing','payment_review'].includes(order.checkout_state || '')).length, awaitingDispatch: orders.filter(order => order.paid_at && !order.dispatched_at && order.checkout_state !== 'payment_review').length, findings: actions.length, modelCalls: 0 } };
}
