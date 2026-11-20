import { lazy, Suspense, useState, type FormEvent } from 'react';
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

export function RestaurantProfile({
  canManage,
  onSaved,
}: {
  canManage: boolean;
  onSaved: () => void;
}) {
  const resource = useResource<Profile>('/restaurant/profile');
  return (
    <>
      <PageHeading title="ملف المطعم" subtitle="هوية مطعمك، ومواعيد يومك." />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Failure error={resource.error} retry={resource.reload} />
      ) : (
        resource.result && (
          <ProfileForm
            key={JSON.stringify(resource.result.data)}
            profile={resource.result.data}
            canManage={canManage}
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
  onSaved,
}: {
  profile: Profile;
  canManage: boolean;
  onSaved: () => void;
}) {
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
  const [message, setMessage] = useState('');
  const err = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const form = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      if (form.opens_at === form.closes_at)
        throw new Error('وقت الفتح والإغلاق يجب أن يختلفا.');
      for (const key of ['opens_at', 'closes_at'])
        if (form[key].length === 5) form[key] += ':00';
      await api.request('/restaurant/profile', {
        method: 'PATCH',
        body: {
          ...form,
          rest_description: description || null,
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
        } catch (cause) {
          setMessage(
            'تم حفظ بيانات المطعم، لكن تعذّر رفع الصورة. حاول رفعها مجددًا.',
          );
          throw cause;
        }
      }
      setMessage('تم حفظ بيانات المطعم.');
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
              defaultValue={profile.rest_title}
              required
              maxLength={150}
              error={err('rest_title')}
            />
            <Field
              label="عنوان الاستلام"
              name="rest_address"
              defaultValue={profile.rest_address}
              required
              maxLength={2000}
              error={err('rest_address')}
            />
            <TextArea
              label="الوصف"
              name="rest_description"
              value={description}
              onChange={setDescription}
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
              defaultValue={profile.opens_at}
              step={1}
              required
              error={err('opens_at')}
            />
            <Field
              label="وقت الإغلاق (القاهرة)"
              name="closes_at"
              type="time"
              defaultValue={profile.closes_at}
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
}: {
  user: User;
  canManage: boolean;
  onSaved: (user: User) => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldError = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;
  async function save(event: FormEvent<HTMLFormElement>, password = false) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await api.request<User>(
        password ? '/me/password' : '/me',
        { method: 'PATCH', body },
      );
      if (password) api.clearSession();
      else {
        onSaved(response.data);
        setMessage('تم حفظ بيانات الحساب.');
      }
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading title="حسابي" subtitle="بياناتك الشخصية وأمان حسابك." />
      <Notice error={error} />
      <Notice>{message}</Notice>
      <div className="panel settings-panel">
        <h2>بيانات المالك</h2>
        <p className="muted">
          البريد الإلكتروني: <bdi>{user.email}</bdi>
        </p>
        <form onSubmit={(event) => save(event)}>
          <fieldset disabled={busy || !canManage}>
            <div className="form-grid">
              <Field
                label="الاسم الكامل"
                name="full_name"
                defaultValue={user.full_name}
                required
                maxLength={150}
                error={fieldError('full_name')}
              />
              <Field
                label="رقم الهاتف"
                name="phone"
                type="tel"
                dir="ltr"
                defaultValue={user.phone}
                pattern="\+[1-9][0-9]{7,14}"
                required
                error={fieldError('phone')}
              />
            </div>
            {canManage && (
              <div className="actions">
                <button className="button primary">
                  <ButtonContent busy={busy} pending="جارٍ الحفظ…">
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
        <form onSubmit={(event) => save(event, true)}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Field
                label="كلمة المرور الحالية"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                error={fieldError('current_password')}
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
                error={fieldError('new_password')}
                hint="٨–١٢٨ حرفًا، تتضمن حرفًا ورقمًا."
              />
            </div>
            <FieldErrors error={error} />
            <div className="actions">
              <button className="button secondary">
                <ButtonContent busy={busy}>تغيير كلمة المرور</ButtonContent>
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </>
  );
}
