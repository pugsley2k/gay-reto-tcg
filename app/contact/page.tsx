import SiteFooter from '@/components/SiteFooter';
import styles from '../styles/InformationPage.module.css';
import { pageMetadata } from '@/lib/page-metadata';
export const dynamic = 'force-dynamic';
export const generateMetadata = () => pageMetadata('/contact');
export default function ContactPage() {
  return <main id="main-content" className={styles.page}><p className={styles.eyebrow}>CUSTOMER INFORMATION</p><h1>Contact</h1><div className={styles.content}>
    <p>For card questions, orders or returns, email <a href="mailto:gayretrotcg@gmail.com">gayretrotcg@gmail.com</a>. Include your order reference if you have one.</p>
    <h2>GayRetroTCG</h2><address>Gay Retro TCG<br />11 Brookland Road<br />Risca, Caerphilly<br />NP11 6BH<br />United Kingdom</address>
    <p>This is our correspondence address. Please email before sending a return so we can identify your order and provide return instructions.</p>
  </div><SiteFooter /></main>;
}
