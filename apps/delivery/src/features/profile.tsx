import { useState, type FormEvent } from 'react';
import { ApiError } from '@akeela/portal/api';
import type { Company } from '@akeela/portal/models';
import {
  Failure,
  Field,
  Notice,
  PageTitle,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
export function CompanyProfile() {
  const resource = useResource<Company>(api, '/delivery-company/profile');
  return (
    <>
      <PageTitle
        title="بيانات الشركة"
        description="بيانات التواصل الخاصة بالشركة، مستقلة عن حساب الدخول."
      />
      <ResourceState resource={resource}>
        {resource.result && (
          <CompanyForm
            company={resource.result.data}
            reload={resource.reload}
          />
        )}
      </ResourceState>
    </>
  );
}
export function CompanyForm({
  company,
  reload,
}: {
  company: Company;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(null);
    try {
      await api.request('/delivery-company/profile', {
        method: 'PATCH',
        body: { ...values, company_email: values.company_email || null },
      });
      setNotice('تم حفظ بيانات الشركة.');
      reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel panel-pad">
      <h2>{company.company_name}</h2>
      {!!error && <Failure error={error} />}
      {notice && <Notice>{notice}</Notice>}
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            {(
              [
                'company_name',
                'company_phone',
                'company_email',
                'company_address',
              ] as const
            ).map((name, index) => (
              <Field
                key={name}
                label={
                  [
                    'اسم الشركة',
                    'هاتف الشركة',
                    'البريد (اختياري)',
                    'عنوان الشركة',
                  ][index]!
                }
                name={name}
                errors={error instanceof ApiError ? error.fields : {}}
              >
                <input
                  name={name}
                  defaultValue={company[name] ?? ''}
                  required={name !== 'company_email'}
                  type={
                    name === 'company_email'
                      ? 'email'
                      : name === 'company_phone'
                        ? 'tel'
                        : 'text'
                  }
                  maxLength={
                    name === 'company_address'
                      ? 2000
                      : name === 'company_email'
                        ? 254
                        : 150
                  }
                />
              </Field>
            ))}
          </div>
          <button className="button primary">
            {busy ? 'جار الحفظ…' : 'حفظ البيانات'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
