import {redirect} from 'next/navigation';
import Link from 'next/link';
import {auth} from '@clerk/nextjs/server';
import {isAdmin} from '@/lib/admin';
import VideoCardAssessment from '@/components/VideoCardAssessment';
import studio from '@/components/SellerStudio.module.css';
export const metadata={title:'Video condition lab · Gay Retro TCG',robots:{index:false,follow:false}};
export default async function AssessmentPage(){if(!(await auth()).userId)redirect('/sign-in?redirect_url=%2Fadmin%2Fassess');if(!await isAdmin())redirect('/');return <main id="main-content" className={studio.studio}><header className={studio.header}><div><p className={studio.eyebrow}>Gay Retro TCG / Private prototype</p><h1>Video condition lab</h1><p>Assess visible wear from macro footage, with evidence you can inspect.</p></div><Link href="/admin" className={studio.scanLink}>Seller studio <span aria-hidden="true">↗</span></Link></header><VideoCardAssessment/></main>;}
