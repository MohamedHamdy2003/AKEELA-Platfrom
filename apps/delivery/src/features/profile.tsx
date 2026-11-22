import { useState, type FormEvent } from 'react';
import { Building2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { ApiError } from '@akeela/portal/api';
import type { Company } from '@akeela/portal/models';
import {
  ActivityBadge,
  Failure,
  Field,
  Notice,
  PageTitle,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
import './profile.css';

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningful =
    words.length > 1 && ['شركة', 'مؤسسة', 'مجموعة'].includes(words[0]!)
      ? words.slice(1)
      : words;
  if (meaningful.length >= 2) {
    return (
      meaningful[0]!.slice(0, 1) + meaningful[1]!.slice(0, 1)
    ).toUpperCase();
  }
  return (meaningful[0] ?? 'AK').slice(0, 2).toUpperCase();
}

export function CompanyProfile({
  onUpdated,
}: {
  onUpdated?: (company: Company) => void;
}) {
  const resource = useResource<Company>(api, '/delivery-company/profile');
  return (
    <div className="del-profile-page">
      <PageTitle
        title="بيانات الشركة"
        description="هوية شركة التوصيل وبيانات التواصل الظاهرة في البوابة، مستقلة عن حساب الدخول."
      />
      <ResourceState resource={resource}>
        {resource.result && (
          <CompanyForm
            company={resource.result.data}
            reload={resource.reload}
            onUpdated={onUpdated}
          />
        )}
      </ResourceState>
    </div>
  );
}

export function CompanyForm({
  company,
  reload,
  onUpdated,
}: {
  company: Company;
  reload: () => void;
  onUpdated?: (company: Company) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const isLatin =
    /[A-Za-z]/.test(company.company_name) &&
    !/[\u0600-\u06FF]/.test(company.company_name);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(null);
    try {
      const response = await api.request<Company>('/delivery-company/profile', {
        method: 'PATCH',
        body: { ...values, company_email: values.company_email || null },
      });
      setNotice('تم حفظ بيانات الشركة وتحديث هويتها في البوابة.');
      if (response.data) onUpdated?.(response.data);
      reload();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="del-id-card" aria-label="بطاقة هوية شركة التوصيل">
        <div className="del-id-crest" aria-hidden="true">
          {monogram(company.company_name)}
        </div>
        <div className="del-id-body">
          <div className="del-id-top">
            <h2 className={'del-id-name' + (isLatin ? ' is-latin' : '')}>
              <bdi>{company.company_name}</bdi>
            </h2>
            <ActivityBadge
              active={company.is_active}
              activeLabel="شريك نشط"
              inactiveLabel="غير نشط"
            />
          </div>
          <div className="del-id-meta">
            <span className="numeric">
              <Building2 size={14} aria-hidden="true" />
              معرّف الشركة #{company.company_id}
            </span>
            <span className="numeric">
              <Phone size={14} aria-hidden="true" />
              <bdi>{company.company_phone}</bdi>
            </span>
            {company.company_email && (
              <span>
                <Mail size={14} aria-hidden="true" />
                <bdi>{company.company_email}</bdi>
              </span>
            )}
            <span>
              <MapPin size={14} aria-hidden="true" />
              {company.company_address}
            </span>
          </div>
          <p className="del-id-hint">
            <ShieldCheck size={14} aria-hidden="true" />
            يظهر اسم الشركة تلقائياً في شريط التنقل العلوي، والقائمة الجانبية،
            ولوحات التشغيل.
          </p>
        </div>
      </section>

      <section className="panel panel-pad">
        <h2>تعديل بيانات الشركة</h2>
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
            <div className="actions">
              <button className="button primary">
                {busy ? 'جار الحفظ…' : 'حفظ البيانات'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </>
  );
}
