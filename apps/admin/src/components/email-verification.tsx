import { ShieldCheck, ShieldAlert } from 'lucide-react';
import './email-verification.css';
export function EmailVerification({
  verified,
  onClick,
}: {
  verified: boolean;
  onClick?: () => void;
}) {
  const Icon = verified ? ShieldCheck : ShieldAlert;
  const label = verified ? 'بريد موثّق' : 'بريد غير موثّق';
  const className = `email-verification ${verified ? 'verified' : 'unverified'}${onClick ? ' is-clickable' : ''}`;
  return onClick ? (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
      title={`${label} — إدارة التوثيق`}
      onClick={onClick}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  ) : (
    <span className={className} role="img" aria-label={label} title={label}>
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}
