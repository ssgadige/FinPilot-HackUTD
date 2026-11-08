import type { Metadata } from 'next';
import { requireVerifiedSession } from '@/server/auth/session';
import { CreditScreen } from '@/components/credit/credit-screen';
export const metadata:Metadata={title:'Credit health'};
export default async function Page(){await requireVerifiedSession();return <CreditScreen/>;}
