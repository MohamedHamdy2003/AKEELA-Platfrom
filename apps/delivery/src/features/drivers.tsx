import { useEffect, useState, type FormEvent } from 'react';
import { Mail, Phone, ShieldAlert, UserPlus } from 'lucide-react';
import { ApiError, query } from '@akeela/portal/api';
import { DetailWorkspace } from '@akeela/portal/detail-workspace';
import type { Driver } from '@akeela/portal/models';
import {
  ActivityBadge,
  Failure,
  Field,
  Notice,
  Pager,
  PageTitle,
  ResourceState,
  TableSkeleton,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
import './drivers.css';

function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
  }
  return (parts[0] ?? 'DR').slice(0, 2).toUpperCase();
}

export function Drivers() {
  const [page, setPage] = useState(1),
    [active, setActive] = useState(''),
    [edit, setEdit] = useState<Driver | null | undefined>(undefined),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const resource = useResource<Driver[]>(
    api,
    '/delivery-company/drivers' +
      query({ page, per_page: 10, is_active: active }),
  );
  useEffect(() => {
    const last = resource.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [resource.result?.meta?.last_page, page]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    const driverName = String(values.get('driver_name') ?? '').trim();
    const driverPhone = String(values.get('driver_phone') ?? '').trim();
    const driverEmail = String(values.get('driver_email') ?? '').trim();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.request(
        '/delivery-company/drivers' + (edit ? '/' + edit.driver_id : ''),
        {
          method: edit ? 'PATCH' : 'POST',
          body: {
            driver_name: driverName,
            driver_phone: driverPhone,
            driver_email: driverEmail || null,
            is_active: values.has('is_active'),
          },
        },
      );
      setEdit(undefined);
      setNotice('تم حفظ بيانات السائق.');
      resource.reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  const fields = error instanceof ApiError ? error.fields : {};
  const selectedKey =
    edit === undefined ? null : edit === null ? 'new' : edit.driver_id;
  const sheetTitle = edit ? 'تعديل السائق' : 'سائق جديد';
  const sheetEyebrow = edit
    ? `معرّف السائق #${edit.driver_id}`
    : 'إضافة سائق جديد للأسطول';

  return (
    <>
      <PageTitle
        title="السائقون"
        description="إضافة وتعديل سائقي شركتك. لا توجد حسابات دخول للسائقين."
        action={
          <button
            className="button primary"
            data-detail-record="new"
            onClick={() => {
              setEdit(null);
              setError(null);
            }}
          >
            <UserPlus size={16} aria-hidden="true" />
            إضافة سائق
          </button>
        }
      />
      {notice && <Notice>{notice}</Notice>}
      <div className="filters">
        <Field label="نشاط السائق">
          <select
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
              setEdit(undefined);
              setError(null);
            }}
          >
            <option value="">جميع السائقين</option>
            <option value="true">نشط</option>
            <option value="false">غير نشط</option>
          </select>
        </Field>
      </div>
      <DetailWorkspace
        selectedKey={selectedKey}
        title={sheetTitle}
        eyebrow={sheetEyebrow}
        onClose={() => {
          if (busy) return;
          setEdit(undefined);
          setError(null);
        }}
        details={
          edit !== undefined ? (
            <div className="driver-sheet-body" key={edit?.driver_id ?? 'new'}>
              {edit && (
                <div className="driver-sheet-banner">
                  <span className="driver-sheet-crest" aria-hidden="true">
                    {driverInitials(edit.driver_name)}
                  </span>
                  <div className="driver-sheet-meta">
                    <div className="driver-sheet-head-row">
                      <strong>{edit.driver_name}</strong>
                      <ActivityBadge active={edit.is_active} />
                    </div>
                    <div className="driver-sheet-contact">
                      <span>
                        <Phone size={12} aria-hidden="true" />
                        <bdi>{edit.driver_phone}</bdi>
                      </span>
                      {edit.driver_email && (
                        <span>
                          <Mail size={12} aria-hidden="true" />
                          <bdi>{edit.driver_email}</bdi>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!!error && <Failure error={error} />}
              <form
                className="driver-sheet-form"
                onSubmit={(event) => void save(event)}
              >
                <fieldset disabled={busy}>
                  <div className="driver-sheet-fields">
                    <Field
                      label="اسم السائق"
                      name="driver_name"
                      errors={fields}
                    >
                      <input
                        name="driver_name"
                        defaultValue={edit?.driver_name}
                        required
                        maxLength={150}
                      />
                    </Field>
                    <Field
                      label="رقم الهاتف"
                      name="driver_phone"
                      errors={fields}
                    >
                      <input
                        name="driver_phone"
                        type="tel"
                        dir="ltr"
                        pattern={'\\+[1-9][0-9]{7,14}'}
                        defaultValue={edit?.driver_phone}
                        required
                      />
                      <small>يبدأ بـ + ورمز الدولة.</small>
                    </Field>
                    <Field
                      label="البريد (اختياري)"
                      name="driver_email"
                      errors={fields}
                    >
                      <input
                        name="driver_email"
                        type="email"
                        dir="ltr"
                        defaultValue={edit?.driver_email ?? ''}
                        maxLength={254}
                      />
                    </Field>
                  </div>
                  <div className="driver-toggle-card">
                    <label className="checkbox">
                      <input
                        name="is_active"
                        type="checkbox"
                        defaultChecked={edit?.is_active ?? true}
                      />
                      سائق نشط
                    </label>
                    {edit && (
                      <small className="driver-warning-note">
                        <ShieldAlert size={14} aria-hidden="true" />
                        <span>
                          تعطيل سائق مُسند لطلب حالي يوقف إكمال تسليمه حتى يُعاد
                          تنشيطه أو يُسند الطلب لسائق نشط آخر.
                        </span>
                      </small>
                    )}
                  </div>
                  <div className="actions driver-sheet-actions">
                    <button className="button primary">
                      {busy ? 'جار الحفظ…' : 'حفظ السائق'}
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setEdit(undefined);
                        setError(null);
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          ) : null
        }
      >
        <ResourceState
          resource={resource}
          empty={!!resource.result && !resource.result.data.length}
          skeleton={<TableSkeleton columns={6} />}
        >
          <section className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>رقم السائق</th>
                    <th>السائق</th>
                    <th>الهاتف</th>
                    <th>البريد</th>
                    <th>النشاط</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.result?.data.map((item) => {
                    const selected = edit?.driver_id === item.driver_id;
                    return (
                      <tr
                        key={item.driver_id}
                        data-selected={selected || undefined}
                      >
                        <td>
                          <bdi>#{item.driver_id}</bdi>
                        </td>
                        <td>
                          <strong>{item.driver_name}</strong>
                        </td>
                        <td>
                          <bdi>{item.driver_phone}</bdi>
                        </td>
                        <td>
                          <bdi>{item.driver_email ?? '—'}</bdi>
                        </td>
                        <td>
                          <ActivityBadge active={item.is_active} />
                        </td>
                        <td>
                          <button
                            className="button compact driver-edit-btn"
                            aria-expanded={selected}
                            data-detail-record={item.driver_id}
                            data-active={selected || undefined}
                            onClick={() => {
                              setEdit(item);
                              setError(null);
                            }}
                          >
                            تعديل السائق
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager meta={resource.result?.meta} change={setPage} />
          </section>
        </ResourceState>
      </DetailWorkspace>
    </>
  );
}
