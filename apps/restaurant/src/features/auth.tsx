import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, MapPin } from 'lucide-react';
import logo from '@akeela/brand/logo.png';
import logoWebp from '@akeela/brand/logo.webp';
import botanical from '@akeela/brand/botanical.png';
import botanicalWebp from '@akeela/brand/botanical.webp';
import { api, ApiError } from '../lib/api';
import type { User } from '../lib/models';
import { useDeviceLocation } from '../lib/use-device-location';
import { ButtonContent, Field, FieldErrors, Notice } from '../components/ui';

const LocationMap = lazy(() =>
  import('../components/location-map').then((m) => ({
    default: m.LocationMap,
  })),
);

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
const titles: Record<Mode, string> = {
  login: 'أهلًا بعودتك',
  register: 'ابدأ حكاية مطعمك',
  verify: 'تأكيد البريد الإلكتروني',
  forgot: 'نسيت كلمة المرور؟',
  reset: 'كلمة مرور جديدة',
};
export function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [throttle, setThrottle] = useState(0);
  const {
    coordinates,
    locating,
    message: locationMessage,
    mapUrl,
    editCoordinate,
    chooseCoordinates,
    retry,
  } = useDeviceLocation(mode === 'register');
  useEffect(() => {
    if (!throttle) return;
    const timer = window.setTimeout(() => setThrottle((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [throttle]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const changeMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setMessage('');
    setVisible(false);
  };
  const duplicateAccount =
    mode === 'register' &&
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'CONFLICT' &&
    error.message === 'An account with this email or phone already exists.';
  const fieldError = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage('');
    setBusy(true);
    const data = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      if (mode === 'login') {
        onLogin(await api.login(email, data.password));
        return;
      }
      if (mode === 'register') {
        const {
          rest_title,
          rest_address,
          longitude,
          latitude,
          opens_at,
          closes_at,
          ...account
        } = data;
        if (opens_at === closes_at)
          throw new Error('وقت الفتح والإغلاق يجب أن يختلفا.');
        const response = await api.request('/auth/register/restaurant', {
          method: 'POST',
          public: true,
          body: {
            ...account,
            email,
            profile: {
              rest_title,
              rest_address,
              longitude,
              latitude,
              opens_at: opens_at.length === 5 ? opens_at + ':00' : opens_at,
              closes_at: closes_at.length === 5 ? closes_at + ':00' : closes_at,
            },
          },
        });
        setMode('verify');
        setCooldown(60);
        setMessage(
          response.message.includes('failed')
            ? 'تم إنشاء الحساب، لكن تعذّر إرسال البريد. اطلب رمزًا جديدًا بعد انتهاء الانتظار.'
            : 'تم إنشاء الحساب. أدخل الرمز المرسل إلى بريدك. موافقة الإدارة مطلوبة بعد التأكيد.',
        );
      } else if (mode === 'verify') {
        await api.request('/auth/verify-email', {
          method: 'POST',
          public: true,
          body: { email, otp: data.otp },
        });
        setMode('login');
        setMessage('تم تأكيد البريد. يمكنك تسجيل الدخول.');
      } else if (mode === 'forgot') {
        await api.request('/auth/forgot-password', {
          method: 'POST',
          public: true,
          body: { email },
        });
        setMode('reset');
        setCooldown(60);
        setMessage('إذا كان الحساب مؤهلًا، أرسلنا رمز استعادة إلى بريدك.');
      } else {
        await api.request('/auth/reset-password', {
          method: 'POST',
          public: true,
          body: { email, otp: data.otp, new_password: data.new_password },
        });
        setMode('login');
        setMessage('تم تغيير كلمة المرور وإنهاء الجلسات. سجّل الدخول مجددًا.');
      }
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError && cause.status === 429)
        setThrottle(cause.retryAfter || 60);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await api.request(
        mode === 'reset'
          ? '/auth/forgot-password'
          : '/auth/resend-verification',
        { method: 'POST', public: true, body: { email } },
      );
      setCooldown(60);
      setMessage('إذا كان الحساب مؤهلًا، أرسلنا رمزًا جديدًا إلى بريدك.');
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError && cause.status === 429)
        setThrottle(cause.retryAfter || 60);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-main">
        <div
          className={'auth-form ' + (mode === 'register' ? 'registration' : '')}
        >
          <picture>
            <source srcSet={logoWebp} type="image/webp" />
            <img
              className="mobile-brand"
              src={logo}
              alt="أكيلة"
              width="120"
              height="110"
              decoding="async"
            />
          </picture>
          <h1>{titles[mode]}</h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'سجّل دخولك لإدارة مطعمك.'
              : mode === 'register'
                ? 'بياناتك وبيانات مطعمك، لبداية جديدة.'
                : 'خطوة بسيطة للحفاظ على أمان حسابك.'}
          </p>
          <Notice error={error}>
            {duplicateAccount
              ? 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل. سجّل الدخول إذا كان لديك حساب، أو أكّد بريدك إذا لم تؤكده بعد. لإنشاء حساب جديد، استخدم بريدًا ورقم هاتف غير مسجّلين.'
              : undefined}
          </Notice>
          <Notice>{message}</Notice>
          {throttle > 0 && (
            <Notice>يمكنك المحاولة مجددًا بعد {throttle} ثانية.</Notice>
          )}
          <form onSubmit={submit} key={mode}>
            <fieldset disabled={busy || throttle > 0}>
              <div className={mode === 'register' ? 'form-grid' : 'form-stack'}>
                {mode === 'register' && (
                  <Field
                    label="اسم المالك"
                    name="full_name"
                    required
                    maxLength={150}
                    autoComplete="name"
                    error={fieldError('full_name')}
                  />
                )}
                <Field
                  label="البريد الإلكتروني"
                  name="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                  autoComplete="email"
                  error={fieldError('email')}
                />
                {mode === 'register' && (
                  <Field
                    label="رقم الهاتف"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    placeholder="+201000000000"
                    pattern="\+[1-9][0-9]{7,14}"
                    autoComplete="tel"
                    required
                    error={fieldError('phone')}
                  />
                )}
                {(mode === 'login' ||
                  mode === 'register' ||
                  mode === 'reset') && (
                  <div className="password-field">
                    <Field
                      label={
                        mode === 'reset' ? 'كلمة المرور الجديدة' : 'كلمة المرور'
                      }
                      name={mode === 'reset' ? 'new_password' : 'password'}
                      type={visible ? 'text' : 'password'}
                      required
                      minLength={mode === 'login' ? 1 : 8}
                      maxLength={128}
                      pattern={
                        mode === 'login'
                          ? undefined
                          : '(?=.*\\p{L})(?=.*\\p{Nd}).{8,128}'
                      }
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                      error={fieldError(
                        mode === 'reset' ? 'new_password' : 'password',
                      )}
                      hint={
                        mode === 'login'
                          ? undefined
                          : '٨–١٢٨ حرفًا، تتضمن حرفًا ورقمًا.'
                      }
                      inputAction={
                        <button
                          className="icon-button eye"
                          type="button"
                          aria-label={
                            visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
                          }
                          aria-pressed={visible}
                          onClick={() => setVisible(!visible)}
                        >
                          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      }
                    />
                  </div>
                )}
                {(mode === 'verify' || mode === 'reset') && (
                  <Field
                    label="رمز التحقق"
                    name="otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    dir="ltr"
                    error={fieldError('otp')}
                    hint="٦ أرقام من بريدك الإلكتروني."
                  />
                )}
                {mode === 'register' && (
                  <>
                    <h2 className="full form-section-title">عن المطعم</h2>
                    <Field
                      label="اسم المطعم"
                      name="rest_title"
                      required
                      maxLength={150}
                      error={fieldError('profile.rest_title')}
                    />
                    <Field
                      label="عنوان المطعم"
                      name="rest_address"
                      required
                      maxLength={2000}
                      error={fieldError('profile.rest_address')}
                    />
                    <div className="registration-location full">
                      <p role="status">
                        <MapPin size={18} />
                        {locationMessage}
                      </p>
                      {mapUrl && (
                        <a
                          className="text-button"
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                        >
                          مراجعة الموقع على الخريطة
                        </a>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        disabled={locating}
                        onClick={retry}
                      >
                        {locating ? 'جارٍ تحديد الموقع…' : 'تحديث الموقع'}
                      </button>
                    </div>
                    <Suspense
                      fallback={
                        <div className="location-picker full" aria-busy="true">
                          <div className="location-map skel-block" />
                        </div>
                      }
                    >
                      <LocationMap
                        coordinates={coordinates}
                        onChoose={chooseCoordinates}
                      />
                    </Suspense>
                    <Field
                      label="خط الطول"
                      name="longitude"
                      dir="ltr"
                      inputMode="decimal"
                      required
                      value={coordinates.longitude}
                      onChange={(event) =>
                        editCoordinate('longitude', event.target.value)
                      }
                      pattern="-?[0-9]{1,3}(\.[0-9]{1,7})?"
                      error={fieldError('profile.longitude')}
                    />
                    <Field
                      label="خط العرض"
                      name="latitude"
                      dir="ltr"
                      inputMode="decimal"
                      required
                      value={coordinates.latitude}
                      onChange={(event) =>
                        editCoordinate('latitude', event.target.value)
                      }
                      pattern="-?[0-9]{1,2}(\.[0-9]{1,7})?"
                      error={fieldError('profile.latitude')}
                    />
                    <Field
                      label="وقت الفتح (القاهرة)"
                      name="opens_at"
                      type="time"
                      required
                      error={fieldError('profile.opens_at')}
                    />
                    <Field
                      label="وقت الإغلاق (القاهرة)"
                      name="closes_at"
                      type="time"
                      required
                      error={fieldError('profile.closes_at')}
                    />
                  </>
                )}
              </div>
              {mode === 'login' && (
                <button
                  className="text-button forgot"
                  type="button"
                  onClick={() => changeMode('forgot')}
                >
                  نسيت كلمة المرور؟
                </button>
              )}
              <FieldErrors error={error} />
              <button
                className="button primary auth-submit"
                disabled={busy || throttle > 0}
              >
                <ButtonContent busy={busy}>
                  {mode === 'login'
                    ? 'تسجيل الدخول'
                    : mode === 'register'
                      ? 'إنشاء حساب مطعم'
                      : mode === 'verify'
                        ? 'تأكيد البريد'
                        : mode === 'forgot'
                          ? 'إرسال رمز الاستعادة'
                          : 'حفظ كلمة المرور'}
                </ButtonContent>
              </button>
            </fieldset>
          </form>
          {(mode === 'verify' || mode === 'reset') && (
            <button
              className="text-button resend"
              disabled={busy || cooldown > 0 || throttle > 0 || !email}
              onClick={resend}
            >
              {cooldown
                ? `إعادة الإرسال بعد ${cooldown} ثانية`
                : 'إرسال رمز جديد'}
            </button>
          )}
          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <span>
                  ليس لديك حساب؟{' '}
                  <button
                    className="text-button"
                    onClick={() => changeMode('register')}
                  >
                    إنشاء حساب مطعم
                  </button>
                </span>
                <button
                  className="text-button muted-link"
                  onClick={() => changeMode('verify')}
                >
                  تأكيد البريد الإلكتروني
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-button"
                  onClick={() => changeMode('login')}
                >
                  العودة لتسجيل الدخول
                </button>
                {duplicateAccount && (
                  <button
                    className="text-button"
                    onClick={() => changeMode('verify')}
                  >
                    تأكيد البريد الإلكتروني
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      <aside className="auth-brand">
        <picture>
          <source srcSet={logoWebp} type="image/webp" />
          <img
            className="auth-logo"
            src={logo}
            alt="أكيلة — AKEELA"
            width={150}
            height={160}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <h2>مساحة هادئة ليومٍ حافل.</h2>
        <p>من قائمة الطعام إلى آخر طلب.</p>
        <picture>
          <source srcSet={botanicalWebp} type="image/webp" />
          <img
            className="botanical"
            src={botanical}
            alt=""
            width={960}
            height={960}
            decoding="async"
          />
        </picture>
      </aside>
    </main>
  );
}
