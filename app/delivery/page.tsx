import SiteFooter from '@/components/SiteFooter';
import styles from '../styles/InformationPage.module.css';
import { pageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => pageMetadata('/delivery');
export default function DeliveryPage() {
  return <main id="main-content" className={styles.page}><p className={styles.eyebrow}>CUSTOMER INFORMATION</p><h1>UK delivery</h1><div className={styles.content}>
    <p>We dispatch from the UK within 3–5 working days of payment. Working days exclude weekends and bank holidays. Delivery time is additional to dispatch time.</p>
    <p>We currently accept UK delivery addresses only, including Northern Ireland. Channel Islands and Isle of Man delivery are not available at checkout.</p>
    <h2>Postage and packing</h2><table><thead><tr><th>Service</th><th>Charge</th><th>Delivery after dispatch</th></tr></thead><tbody>
      <tr><td>Royal Mail Tracked 48<br />Orders up to £75</td><td>£4.50</td><td>Usually 2–3 working days</td></tr>
      <tr><td>Royal Mail Tracked 24<br />Orders up to £75</td><td>£5.75</td><td>Next working day aim</td></tr>
      <tr><td>Royal Mail Special Delivery</td><td>From £11.95</td><td>Usually next working day; postcode exceptions apply</td></tr>
    </tbody></table>
    <p>The cart shows your exact delivery charge before payment. Special Delivery pricing increases with order size and the compensation band needed for the card subtotal. Postage and packing are included.</p>
    <h2>Higher-value orders</h2><p>Orders over £75 use Special Delivery. We choose a compensation band of £750, £1,000 or £2,500 to suit the order value. Orders over £2,500 need delivery arranged by email before purchase.</p>
    <p>Carrier compensation is subject to Royal Mail’s terms and evidence requirements. It protects the shipment and does not reduce your consumer rights. Contact us if a delivery is missing or damaged; we handle the carrier enquiry.</p>
    <h2>Delivery questions</h2><p>Email <a href="mailto:gayretrotcg@gmail.com">gayretrotcg@gmail.com</a>. Delivery aims vary for some postcodes and are not a promise that an order will arrive the day after you place it.</p>
  </div><SiteFooter /></main>;
}
