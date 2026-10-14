import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import { auth } from '@clerk/nextjs/server';
import PhoneScanner from '@/components/PhoneScanner';

export const metadata = { title: 'Card scanner · Gay Retro TCG' };
export default async function ScanPage() {
  if (!(await auth()).userId) redirect('/sign-in?redirect_url=%2Fadmin%2Fscan');
  if (!await isAdmin()) redirect('/');
  return <PhoneScanner />;
}
