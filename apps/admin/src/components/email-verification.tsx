import { ShieldCheck, ShieldAlert } from 'lucide-react';
import './email-verification.css';

export function EmailVerification({ verified }: { verified: boolean }) {
  const Icon = verified ? ShieldCheck : ShieldAlert;
  const label = verified ? 'بريد موثّق' : 'بريد غير موثّق';
  return (
    <span
      className={`email-verification ${verified ? 'verified' : 'unverified'}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}
