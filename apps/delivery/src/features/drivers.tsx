import { useState, type FormEvent } from 'react';
import { ApiError, query } from '@akeela/portal/api';
import type { Driver } from '@akeela/portal/models';
import {
  ActivityBadge,
  Failure,
  Field,
  Notice,
  Pager,
  PageTitle,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
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
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.request(
        '/delivery-company/drivers' + (edit ? '/' + edit.driver_id : ''),
        {
          method: edit ? 'PATCH' : 'POST',
          body: {
            driver_name: values.get('driver_name'),
            driver_phone: values.get('driver_phone'),
            driver_email: values.get('driver_email') || null,
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
  return (
    <>
      <PageTitle
        title="السائقون"
        description="إضافة وتعديل سائقي شركتك. لا توجد حسابات دخول للسائقين."
        action={
          <button
            className="button primary"
            onClick={() => {
              setEdit(null);
              setError(null);
            }}
          >
            إضافة سائق
          </button>
        }
      />
      {notice && <Notice>{notice}</Notice>}
      {edit !== undefined && (
        <section className="panel panel-pad" key={edit?.driver_id ?? 'new'}>
          <h2>{edit ? 'تعديل السائق' : 'سائق جديد'}</h2>
          {!!error && <Failure error={error} />}
          <form onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <Field label="اسم السائق" name="driver_name" errors={fields}>
                  <input
                    name="driver_name"
                    defaultValue={edit?.driver_name}
                    required
                    maxLength={150}
                  />
                </Field>
                <Field label="رقم الهاتف" name="driver_phone" errors={fields}>
                  <input
                    name="driver_phone"
                    type="tel"
                    dir="ltr"
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
              <label className="checkbox">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={edit?.is_active ?? true}
                />
                سائق نشط
              </label>
              <div className="actions">
                <button className="button primary">
                  {busy ? 'جار الحفظ…' : 'حفظ السائق'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setEdit(undefined)}
                >
                  إلغاء
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <div className="filters">
        <Field label="نشاط السائق">
          <select
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <option value="">جميع السائقين</option>
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
                  <th>رقم السائق</th>
                  <th>السائق</th>
                  <th>الهاتف</th>
                  <th>البريد</th>
                  <th>النشاط</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {resource.result?.data.map((item) => (
                  <tr key={item.driver_id}>
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
                        className="button compact"
                        onClick={() => {
                          setEdit(item);
                          setError(null);
                        }}
                      >
                        تعديل السائق
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
    </>
  );
}
