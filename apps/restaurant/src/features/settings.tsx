import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import type { Profile, User } from '../lib/models';
import { useResource } from '../lib/use-resource';
import {
  Check,
  ButtonContent,
  Failure,
  Field,
  FieldErrors,
  Loading,
  Notice,
  PageHeading,
  TextArea,
} from '../components/ui';
import { ImagePicker } from './catalog';

const LocationMap = lazy(() =>
  import('../components/location-map').then((m) => ({
    default: m.LocationMap,
  })),
);

function normalizeClock(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 5 ? trimmed + ':00' : trimmed;
}

export function RestaurantProfile({
  canManage,
  onSaved,
}: {
  canManage: boolean;
  onSaved: () => void;
}) {
  const resource = useResource<Profile>('/restaurant/profile');
  const [savedNotice, setSavedNotice] = useState('');
  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);
  return (
    <>
      <PageHeading title="ملف المطعم" subtitle="هوية مطعمك، ومواعيد يومك." />
      {!resource.result && resource.loading ? (
        <Loading />
      ) : !resource.result && resource.error ? (
        <Failure error={resource.error} retry={resource.reload} />
      ) : (
        resource.result && (
          <ProfileForm
            profile={resource.result.data}
            canManage={canManage}
            message={savedNotice}
            onMessage={setSavedNotice}
            onSaved={() => {
              resource.reload();
              onSaved();
            }}
          />
        )
      )}
    </>
  );
}
function ProfileForm({
  profile,
  canManage,
  message,
  onMessage,
  onSaved,
}: {
  profile: Profile;
  canManage: boolean;
  message: string;
  onMessage: (value: string) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(profile.rest_title);
  const [address, setAddress] = useState(profile.rest_address);
  const [opensAt, setOpensAt] = useState(profile.opens_at);
  const [closesAt, setClosesAt] = useState(profile.closes_at);
  const [description, setDescription] = useState(
    profile.rest_description ?? '',
  );
  const [coordinates, setCoordinates] = useState({
    longitude: profile.longitude,
    latitude: profile.latitude,
  });
  const [active, setActive] = useState(profile.is_active);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setTitle(profile.rest_title);
    setAddress(profile.rest_address);
    setOpensAt(profile.opens_at);
    setClosesAt(profile.closes_at);
    setDescription(profile.rest_description ?? '');
    setCoordinates({
      longitude: profile.longitude,
      latitude: profile.latitude,
    });
    setActive(profile.is_active);
  }, [
    profile.rest_title,
    profile.rest_address,
    profile.opens_at,
    profile.closes_at,
    profile.rest_description,
    profile.longitude,
    profile.latitude,
    profile.is_active,
  ]);

  const err = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    onMessage('');
    try {
      const normalizedOpen = normalizeClock(opensAt);
      const normalizedClose = normalizeClock(closesAt);
      if (normalizedOpen === normalizedClose)
        throw new Error('وقت الفتح والإغلاق يجب أن يختلفا.');
      await api.request('/restaurant/profile', {
        method: 'PATCH',
        body: {
          rest_title: title.trim(),
          rest_address: address.trim(),
          longitude: coordinates.longitude.trim(),
          latitude: coordinates.latitude.trim(),
          opens_at: normalizedOpen,
          closes_at: normalizedClose,
          rest_description: description.trim() || null,
          is_active: active,
        },
      });
      if (file) {
        setUploading(true);
        const data = new FormData();
        data.append('file', file);
        try {
          await api.request('/restaurant/profile/image', {
            method: 'PUT',
            body: data,
          });
          setFile(null);
        } catch (cause) {
          onMessage(
            'تم حفظ بيانات المطعم، لكن تعذّر رفع الصورة. حاول رفعها مجددًا.',
          );
          onSaved();
          throw cause;
        }
      }
      onMessage('تم حفظ بيانات المطعم.');
      onSaved();
    } catch (cause) {
      setError(cause);
    } finally {
      setUploading(false);
      setBusy(false);
    }
  }
  return (
    <div className="panel settings-panel">
      {!canManage && (
        <Notice>
          يمكنك الاطلاع على بيانات المطعم. التعديل متاح بعد التفعيل من الإدارة.
        </Notice>
      )}
      <Notice error={error} />
      <Notice>{message}</Notice>
      <form onSubmit={save}>
        <fieldset disabled={busy || !canManage}>
          <div className="form-grid">
            <Field
              label="اسم المطعم"
              name="rest_title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              error={err('rest_title')}
            />
            <Field
              label="عنوان الاستلام"
              name="rest_address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              maxLength={2000}
              error={err('rest_address')}
            />
            <TextArea
              label="الوصف"
              name="rest_description"
              value={description}
              onChange={setDescription}
              error={err('rest_description')}
            />
            <Suspense
              fallback={
                <div className="location-picker full" aria-busy="true">
                  <div className="location-map skel-block" />
                </div>
              }
            >
              <LocationMap
                coordinates={coordinates}
                onChoose={setCoordinates}
                editable={canManage && !busy}
              />
            </Suspense>
            <Field
              label="خط الطول"
              name="longitude"
              value={coordinates.longitude}
              onChange={(event) =>
                setCoordinates((old) => ({
                  ...old,
                  longitude: event.target.value,
                }))
              }
              dir="ltr"
              pattern="-?[0-9]{1,3}(\.[0-9]{1,7})?"
              required
              error={err('longitude')}
            />
            <Field
              label="خط العرض"
              name="latitude"
              value={coordinates.latitude}
              onChange={(event) =>
                setCoordinates((old) => ({
                  ...old,
                  latitude: event.target.value,
                }))
              }
              dir="ltr"
              pattern="-?[0-9]{1,2}(\.[0-9]{1,7})?"
              required
              error={err('latitude')}
            />
            <Field
              label="وقت الفتح (القاهرة)"
              name="opens_at"
              type="time"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
              step={1}
              required
              error={err('opens_at')}
            />
            <Field
              label="وقت الإغلاق (القاهرة)"
              name="closes_at"
              type="time"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              step={1}
              required
              error={err('closes_at')}
            />
            <div className="full">
              <Check
                label="استقبال مبيعات جديدة"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <small className="muted">
                إيقاف الخدمة لا يمنع التعامل مع الطلبات القائمة.
              </small>
            </div>
            <ImagePicker
              uploading={uploading}
              src={profile.rest_image_url_mobile}
              file={file}
              onFile={setFile}
            />
          </div>
          <FieldErrors error={error} />
          {canManage && (
            <div className="actions">
              <button className="button primary" disabled={busy}>
                <ButtonContent busy={busy} pending="جارٍ الحفظ…">
                  حفظ بيانات المطعم
                </ButtonContent>
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  );
}
export function Account({
  user,
  canManage,
  onSaved,
  onPasswordChanged,
}: {
  user: User;
  canManage: boolean;
  onSaved: (user: User) => void;
  onPasswordChanged?: () => void;
}) {
  const [profileError, setProfileError] = useState<unknown>(null);
  const [passwordError, setPasswordError] = useState<unknown>(null);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone);

  useEffect(() => {
    setFullName(user.full_name);
    setPhone(user.phone);
  }, [user.full_name, user.phone]);

  useEffect(() => {
    if (!profileMessage) return;
    const timer = window.setTimeout(() => setProfileMessage(''), 5000);
    return () => window.clearTimeout(timer);
  }, [profileMessage]);

  const profileFieldError = (name: string) =>
    profileError instanceof ApiError
      ? profileError.fields[name]?.join(' ')
      : undefined;
  const passwordFieldError = (name: string) =>
    passwordError instanceof ApiError
      ? passwordError.fields[name]?.join(' ')
      : undefined;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileError(null);
    setProfileMessage('');
    try {
      const response = await api.request<User>('/me', {
        method: 'PATCH',
        body: { full_name: fullName.trim(), phone: phone.trim() },
      });
      onSaved(response.data);
      setProfileMessage('تم حفظ بيانات الحساب.');
    } catch (cause) {
      setProfileError(cause);
    } finally {
      setProfileBusy(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordBusy) return;
    setPasswordBusy(true);
    setPasswordError(null);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.request('/me/password', { method: 'PATCH', body });
      onPasswordChanged?.();
      api.clearSession();
    } catch (cause) {
      setPasswordError(cause);
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="حسابي" subtitle="بياناتك الشخصية وأمان حسابك." />
      <div className="panel settings-panel">
        <h2>بيانات المالك</h2>
        <p className="muted">
          البريد الإلكتروني: <bdi>{user.email}</bdi>
        </p>
        <Notice error={profileError} />
        <Notice>{profileMessage}</Notice>
        <form onSubmit={saveProfile}>
          <fieldset disabled={profileBusy || !canManage}>
            <div className="form-grid">
              <Field
                label="الاسم الكامل"
                name="full_name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                maxLength={150}
                error={profileFieldError('full_name')}
              />
              <Field
                label="رقم الهاتف"
                name="phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                pattern="\+[1-9][0-9]{7,14}"
                required
                error={profileFieldError('phone')}
              />
            </div>
            <FieldErrors error={profileError} />
            {canManage && (
              <div className="actions">
                <button className="button primary">
                  <ButtonContent busy={profileBusy} pending="جارٍ الحفظ…">
                    حفظ بيانات الحساب
                  </ButtonContent>
                </button>
              </div>
            )}
          </fieldset>
        </form>
        {!canManage && (
          <p className="muted">تعديل البيانات متاح بعد تفعيل المطعم.</p>
        )}
      </div>
      <div className="panel settings-panel">
        <h2>تغيير كلمة المرور</h2>
        <p className="muted">سيتم إنهاء جميع الجلسات بعد تغيير كلمة المرور.</p>
        <Notice error={passwordError} />
        <form onSubmit={savePassword}>
          <fieldset disabled={passwordBusy}>
            <div className="form-grid">
              <Field
                label="كلمة المرور الحالية"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                error={passwordFieldError('current_password')}
              />
              <Field
                label="كلمة المرور الجديدة"
                name="new_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                pattern="(?=.*\p{L})(?=.*\p{Nd}).{8,128}"
                error={passwordFieldError('new_password')}
                hint="٨–١٢٨ حرفًا، تتضمن حرفًا ورقمًا."
              />
            </div>
            <FieldErrors error={passwordError} />
            <div className="actions">
              <button className="button secondary">
                <ButtonContent busy={passwordBusy}>
                  تغيير كلمة المرور
                </ButtonContent>
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </>
  );
}
