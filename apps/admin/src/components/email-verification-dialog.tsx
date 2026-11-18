import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Mail,
  X,
  CheckCircle2,
  KeyRound,
  RotateCw,
  ArrowLeft,
} from 'lucide-react';
import { ApiError } from '@akeela/portal/api';
import { Failure, Notice } from '@akeela/portal/ui';
import type { User } from '@akeela/portal/models';
import { api } from '../lib/api';
import { latinDigits } from '../lib/arabic-fields';
import './email-verification-dialog.css';

export function EmailVerificationDialog({
  user,
  retryAt,
  onRetryAt,
  onClose,
  onVerified,
}: {
  user: User;
  retryAt: number;
  onRetryAt: (deadline: number) => void;
  onClose: () => void;
  onVerified: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const alive = useRef(false);
  const titleId = useId();
  const emailId = useId();
  const otpId = useId();
  const [step, setStep] = useState<'idle' | 'otp' | 'done'>('idle');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [deadline, setDeadline] = useState(retryAt);
  const [now, setNow] = useState(Date.now);
  const cooldown = Math.max(0, Math.ceil((deadline - now) / 1000));
  const isVerified = !!user.email_verified_at || step === 'done';

  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => {
      alive.current = false;
      dialog.close();
      if (previous?.isConnected) previous.focus();
      else document.getElementById('main-content')?.focus();
    };
  }, []);
  useEffect(() => {
    if (deadline <= Date.now()) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (step === 'otp' && !busy) otpRef.current?.focus();
  }, [step, busy]);

  const wait = (seconds: number) => {
    const until = Date.now() + seconds * 1000;
    setNow(Date.now());
    setDeadline(until);
    onRetryAt(until);
  };
  const close = () => {
    if (!pending.current) dialogRef.current?.close();
  };
  const requestOtp = async () => {
    if (pending.current || deadline > Date.now() || isVerified) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.request('/auth/resend-verification', {
        method: 'POST',
        public: true,
        body: { email: user.email },
      });
      if (!alive.current) return;
      setOtp('');
      setStep('otp');
      wait(60);
      setNotice('إذا كان الحساب مؤهلًا، سيصل رمز التحقق إلى بريد الشركة.');
    } catch (cause) {
      if (!alive.current) return;
      setError(cause);
      if (cause instanceof ApiError && cause.status === 429) {
        wait(
          Number.isFinite(cause.retryAfter) && cause.retryAfter > 0
            ? cause.retryAfter
            : 60,
        );
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !/^\d{6}$/.test(otp) || isVerified) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.request('/auth/verify-email', {
        method: 'POST',
        public: true,
        body: { email: user.email, otp },
      });
      if (!alive.current) return;
      setOtp('');
      setStep('done');
      onVerified();
    } catch (cause) {
      if (alive.current) setError(cause);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="email-verify-dialog"
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      onCancel={(event) => {
        if (pending.current) event.preventDefault();
      }}
      aria-labelledby={titleId}
      aria-busy={busy}
    >
      <div className="dialog-head">
        <div className="dialog-title-group">
          <span
            className={`dialog-badge ${isVerified ? 'verified' : 'unverified'}`}
          >
            {isVerified ? (
              <ShieldCheck size={20} aria-hidden="true" />
            ) : (
              <ShieldAlert size={20} aria-hidden="true" />
            )}
          </span>
          <h2 id={titleId}>توثيق بريد شركة التوصيل</h2>
        </div>
        <button
          type="button"
          className="dialog-close-btn"
          aria-label="إغلاق النافذة"
          disabled={busy}
          onClick={close}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body">
        <div className="verify-state-card">
          <div
            className={`verify-icon-wrap ${isVerified ? 'verified-icon' : 'unverified-icon'}`}
          >
            {isVerified ? (
              <CheckCircle2 size={38} aria-hidden="true" />
            ) : (
              <ShieldAlert size={38} aria-hidden="true" />
            )}
          </div>
          <h3>
            {isVerified
              ? 'البريد الإلكتروني موثّق'
              : 'البريد الإلكتروني غير موثّق'}
          </h3>
          <p className="verify-desc">
            {isVerified
              ? 'تم توثيق بريد هذا الحساب. لا تحتاج إلى إرسال رمز جديد.'
              : 'أرسل رمز التحقق إلى بريد الشركة، ثم أدخل الرمز لإتمام التوثيق.'}
          </p>
          <div className="verify-info-box">
            <div className="verify-info-row">
              <span className="info-label">اسم الحساب</span>
              <strong className="info-val">{user.full_name}</strong>
            </div>
            <div className="verify-info-row">
              <span className="info-label">البريد الإلكتروني</span>
              <bdi className="info-val email-val">{user.email}</bdi>
            </div>
          </div>
        </div>
        {!!error && <Failure error={error} />}
        {notice && <Notice>{notice}</Notice>}
        {isVerified ? (
          <div className="dialog-actions">
            <button type="button" className="button primary" onClick={close}>
              إغلاق
            </button>
          </div>
        ) : step === 'idle' ? (
          <div className="dialog-actions">
            <button
              type="button"
              className="button primary full"
              disabled={busy || cooldown > 0}
              onClick={() => void requestOtp()}
            >
              <Mail size={16} aria-hidden="true" />
              {busy
                ? 'جارٍ إرسال الرمز…'
                : cooldown > 0
                  ? `إعادة الإرسال بعد ${cooldown} ث`
                  : 'إرسال رمز التحقق إلى بريد الشركة'}
            </button>
            <button
              type="button"
              className="text-btn-secondary"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep('otp');
              }}
            >
              لديّ رمز تحقق بالفعل
            </button>
          </div>
        ) : (
          <form
            className="verify-form"
            onSubmit={(event) => void verifyOtp(event)}
          >
            <fieldset disabled={busy} className="dialog-fieldset">
              <div className="dialog-field">
                <label htmlFor={emailId}>البريد الإلكتروني للشركة</label>
                <div className="input-with-icon">
                  <Mail size={16} className="field-icon" aria-hidden="true" />
                  <input
                    id={emailId}
                    type="email"
                    value={user.email}
                    readOnly
                    dir="ltr"
                    className="email-read-field"
                  />
                </div>
              </div>
              <div className="dialog-field">
                <label htmlFor={otpId}>رمز التأكيد (OTP)</label>
                <div className="input-with-icon">
                  <KeyRound
                    size={16}
                    className="field-icon"
                    aria-hidden="true"
                  />
                  <input
                    ref={otpRef}
                    id={otpId}
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(event) =>
                      setOtp(latinDigits(event.target.value).replace(/\D/g, ''))
                    }
                    required
                    dir="ltr"
                    className="otp-code-field"
                    aria-describedby={`${otpId}-hint`}
                  />
                </div>
                <small id={`${otpId}-hint`} className="field-hint">
                  أدخل الرمز المكوّن من 6 أرقام الذي وصل إلى بريد الشركة.
                </small>
              </div>
              <div className="dialog-actions">
                <button
                  type="submit"
                  className="button primary full"
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? 'جارٍ التوثيق…' : 'تأكيد توثيق البريد'}
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="dialog-sub-actions">
                <button
                  type="button"
                  className="text-btn-secondary"
                  disabled={busy || cooldown > 0}
                  onClick={() => void requestOtp()}
                >
                  <RotateCw size={14} aria-hidden="true" />
                  {cooldown > 0
                    ? `إعادة إرسال الرمز بعد ${cooldown} ث`
                    : 'إعادة إرسال رمز جديد'}
                </button>
                <button
                  type="button"
                  className="text-btn-cancel"
                  disabled={busy}
                  onClick={close}
                >
                  إلغاء
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </dialog>
  );
}
