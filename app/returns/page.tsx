import SiteFooter from '@/components/SiteFooter';
import styles from '../styles/InformationPage.module.css';
export const metadata = { title: 'Returns | Gay Retro TCG' };
export default function ReturnsPage() {
  return <main id="main-content" className={styles.page}><p className={styles.eyebrow}>CUSTOMER INFORMATION</p><h1>Returns</h1><div className={styles.content}>
    <p>Email <a href="mailto:gayretrotcg@gmail.com?subject=Return%20request">gayretrotcg@gmail.com</a> with your order reference and the cards you wish to return.</p>
    <h2>Changed your mind?</h2><p>Tell us within 14 days after delivery that you want to cancel. You then have another 14 days to send the cards back. No reason is required. You pay return postage for a change-of-mind return.</p>
    <p>Handle cards only as needed to inspect them and pack them securely for return. We may reduce a refund for loss in value caused by handling beyond what is necessary to inspect the cards.</p>
    <h2>Refunds</h2><p>We refund returned cards and the standard outward delivery charge for a cancelled whole order. An optional delivery upgrade is not refundable beyond the standard charge. Refunds go to the original payment method within 14 days of receiving the return or evidence of posting, whichever is earlier.</p>
    <h2>Damaged or not as described?</h2><p>Email us so we can resolve the issue and arrange reasonable return postage at our cost. Photos can help, but do not replace your statutory rights. This policy does not limit your rights for faulty or misdescribed goods.</p>
    <h2>Optional cancellation form</h2><p>You may use this text in an email; it is not required.</p><pre>{'To: GayRetroTCG, 11 Brookland Road, Risca, Caerphilly, NP11 6BH\ngayretrotcg@gmail.com\n\nI give notice that I cancel my contract for the following goods:\nOrder reference:\nOrdered on / received on:\nCustomer name:\nCustomer address:\nDate:\nSignature (only if submitted on paper):'}</pre>
  </div><SiteFooter /></main>;
}
