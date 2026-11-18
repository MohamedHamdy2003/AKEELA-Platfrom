import { useRef, useState, type FormEvent } from 'react';
import { ApiError, query } from '@akeela/portal/api';
import type { User } from '@akeela/portal/models';
import {
  Confirm,
  Failure,
  Field,
  Notice,
  Pager,
  PageTitle,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
import { ProfileDetails } from './profile-details';
import { EmailVerification } from '../components/email-verification';
import { EmailVerificationDialog } from '../components/email-verification-dialog';
const roles: Record<string, string> = {
  Customer: 'عميل',
  Restaurant: 'مطعم',
  Delivery_Company: 'شركة توصيل',
  Admin: 'إدارة',
};
export function Users({
  companyOnly = false,
  revision = 0,
}: {
  companyOnly?: boolean;
  revision?: number;
}) {
  const resendDeadlines = useRef(new Map<string, number>());
  const [page, setPage] = useState(1),
    [role, setRole] = useState(''),
    [active, setActive] = useState(''),
    [id, setId] = useState<string | null>(null),
    [verifyTarget, setVerifyTarget] = useState<User | null>(null),
    [tick, setTick] = useState(0);
  const resource = useResource<User[]>(
      api,
      '/admin/users' +
        query({
          page,
          per_page: 10,
          role: companyOnly ? 'Delivery_Company' : role,
          is_active: active,
        }),
      revision + tick,
    ),
    detail = useResource<User>(
      api,
      id ? '/admin/users/' + id : null,
      revision + tick,
    );
  const selected = detail.result?.data;
  return (
    <>
      <div className="filters">
        {!companyOnly && (
          <Field label="نوع الحساب">
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">جميع الأدوار</option>
              {Object.entries(roles).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="نشاط الحساب">
          <select
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <option value="">الكل</option>
            <option value="true">نشط</option>
            <option value="false">غير نشط</option>
          </select>
        </Field>
      </div>
      <ResourceState
        resource={resource}
        empty={!!resource.result && !resource.result.data.length}
      >
        <section className="panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="user-id-column">الرقم</th>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>الحساب</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {resource.result?.data.map((row) => (
                  <tr key={row.user_id}>
                    <td className="user-id-column">
                      <bdi>#{row.user_id}</bdi>
                    </td>
                    <td>
                      <strong>{row.full_name}</strong>
                    </td>
                    <td>
                      <div className="email-cell">
                        <bdi>{row.email}</bdi>
                        <EmailVerification
                          verified={!!row.email_verified_at}
                          onClick={
                            row.role === 'Delivery_Company'
                              ? () => setVerifyTarget(row)
                              : undefined
                          }
                        />
                      </div>
                    </td>
                    <td>{roles[row.role]}</td>
                    <td>{row.is_active ? 'نشط' : 'غير نشط'}</td>
                    <td>
                      <button
                        className="button compact"
                        onClick={() => setId(row.user_id)}
                      >
                        عرض الحساب
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager meta={resource.result?.meta} change={setPage} />
        </section>
      </ResourceState>
      {id && (
        <section className="panel panel-pad">
          <ResourceState resource={detail}>
            {selected && (
              <>
                <h2>{selected.full_name}</h2>
                <ProfileDetails user={selected} />
                <div className="account-meta">
                  <span className="email-cell">
                    <bdi>{selected.email}</bdi>
                    <EmailVerification
                      verified={!!selected.email_verified_at}
                      onClick={
                        selected.role === 'Delivery_Company'
                          ? () => setVerifyTarget(selected)
                          : undefined
                      }
                    />
                  </span>
                  <bdi>{selected.phone}</bdi>
                </div>
                <p>
                  {roles[selected.role]} ·{' '}
                  {selected.is_active ? 'نشط' : 'غير نشط'}
                </p>
                {selected.role === 'Delivery_Company' && selected.profile && (
                  <>
                    <h3>{String(selected.profile.company_name)}</h3>
                    <p>{String(selected.profile.company_address)}</p>
                    <p>
                      <bdi>
                        {String(selected.profile.company_phone)} ·{' '}
                        {String(selected.profile.company_email ?? '')}
                      </bdi>
                    </p>
                    <p>
                      رقم الشركة:{' '}
                      <bdi>{String(selected.profile.company_id)}</bdi>
                    </p>
                    <Notice>
                      {selected.email_verified_at
                        ? 'بريد تسجيل الدخول موثّق. '
                        : 'البريد يحتاج إلى التوثيق قبل دخول الشركة. '}
                      رقم الشركة يُستخدم في إعداد إسناد الطلبات على الخادم.
                    </Notice>
                  </>
                )}
                {['Customer', 'Restaurant'].includes(selected.role) ? (
                  <Confirm
                    danger={selected.is_active}
                    label={selected.is_active ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                    description="سيتم تغيير نشاط الحساب. هذا الإجراء منفصل عن تفعيل المطعم."
                    run={() =>
                      api.request(
                        '/admin/users/' + selected.user_id + '/activity',
                        {
                          method: 'PATCH',
                          body: { is_active: !selected.is_active },
                        },
                      )
                    }
                    done={() => setTick((n) => n + 1)}
                  />
                ) : (
                  <p className="muted">
                    لا يمكن تعطيل حساب الإدارة أو شركة التوصيل.
                  </p>
                )}
              </>
            )}
          </ResourceState>
        </section>
      )}
      {verifyTarget && (
        <EmailVerificationDialog
          key={verifyTarget.user_id}
          user={verifyTarget}
          retryAt={resendDeadlines.current.get(verifyTarget.email) ?? 0}
          onRetryAt={(deadline) =>
            resendDeadlines.current.set(verifyTarget.email, deadline)
          }
          onClose={() => setVerifyTarget(null)}
          onVerified={() => setTick((value) => value + 1)}
        />
      )}
    </>
  );
}
export function Companies() {
  const [revision, setRevision] = useState(0),
    [open, setOpen] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError(null);
    try {
      await api.request('/admin/users', {
        method: 'POST',
        body: {
          full_name: values.full_name,
          email: values.email,
          password: values.password,
          phone: values.phone,
          role: 'Delivery_Company',
          profile: {
            company_name: values.company_name,
            company_phone: values.company_phone,
            company_email: values.company_email || null,
            company_address: values.company_address,
            is_active: true,
          },
        },
      });
      form.reset();
      setOpen(false);
      setRevision((n) => n + 1);
      setNotice('تم إنشاء حساب الشركة. يجب توثيق البريد قبل تسجيل الدخول.');
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const fields = error instanceof ApiError ? error.fields : {};
  return (
    <>
      <PageTitle
        title="شركات التوصيل"
        description="إنشاء حساب الشركة ومراجعة بياناته."
        action={
          <button className="button primary" onClick={() => setOpen(!open)}>
            {open ? 'إغلاق النموذج' : 'إنشاء حساب شركة'}
          </button>
        }
      />
      {notice && <Notice>{notice}</Notice>}
      {open && (
        <section className="panel panel-pad">
          <h2>حساب شركة جديد</h2>
          {!!error && <Failure error={error} />}
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                {[
                  ['full_name', 'اسم المسؤول', 'text'],
                  ['email', 'بريد تسجيل الدخول', 'email'],
                  ['phone', 'هاتف المسؤول', 'tel'],
                  ['password', 'كلمة المرور', 'password'],
                  ['company_name', 'اسم الشركة', 'text'],
                  ['company_phone', 'هاتف الشركة', 'tel'],
                  ['company_email', 'بريد الشركة (اختياري)', 'email'],
                  ['company_address', 'عنوان الشركة', 'text'],
                ].map(([name, label, type]) => (
                  <Field
                    key={name}
                    label={label!}
                    name={
                      name?.startsWith('company_') ? 'profile.' + name : name
                    }
                    errors={fields}
                  >
                    <input
                      name={name}
                      type={type}
                      required={name !== 'company_email'}
                      minLength={type === 'password' ? 8 : undefined}
                      maxLength={
                        type === 'password'
                          ? 128
                          : name === 'company_address'
                            ? 2000
                            : type === 'email'
                              ? 254
                              : 150
                      }
                      dir={
                        ['email', 'tel', 'password'].includes(type!)
                          ? 'ltr'
                          : undefined
                      }
                      autoComplete={
                        type === 'password' ? 'new-password' : undefined
                      }
                    />
                  </Field>
                ))}
              </div>
              <p className="muted">
                الهاتف يبدأ بـ + ورمز الدولة. كلمة المرور 8 أحرف على الأقل
                وتتضمن حرفًا ورقمًا. بيانات الشركة مستقلة عن بيانات تسجيل الدخول.
              </p>
              <button className="button primary">
                {busy ? 'جار الإنشاء…' : 'إنشاء الشركة'}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      <Users companyOnly revision={revision} />
    </>
  );
}
