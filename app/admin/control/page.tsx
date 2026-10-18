import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import AgentControlCentre from '@/components/AgentControlCentre';
import studio from '@/components/SellerStudio.module.css';
export const metadata = { title:'Agent control centre · Gay Retro TCG',robots:{index:false,follow:false} };
export default async function ControlPage(){
  if(!await isAdmin())redirect('/sign-in');
  return <main id="main-content" className={studio.studio}><p><Link href="/admin">← Seller Studio</Link></p><AgentControlCentre/></main>;
}
