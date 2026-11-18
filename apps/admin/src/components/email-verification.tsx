import { ShieldCheck, ShieldAlert } from 'lucide-react';
import './email-verification.css';

export function EmailVerification({ verified }: { verified: boolean }) {
  const Icon = verified ? ShieldCheck : ShieldAlert;
  return (
    <span
      className={`email-verification ${verified ? 'verified' : 'unverified'}`}
    >
      <Icon size={14} aria-hidden="true" />
      {verified ? 'بريد موثّق' : 'بريد غير موثّق'}
    </span>
  );
}
