import { useState } from 'react';
import { query } from '@akeela/portal/api';
import type { RestaurantReview } from '@akeela/portal/models';
import {
  Confirm,
  Field,
  Pager,
  PageTitle,
  ResourceState,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
export function Restaurants() {
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState(''),
    [selected, setSelected] = useState<string | null>(null);
  const resource = useResource<RestaurantReview[]>(
    api,
    '/admin/restaurants' +
      query({ page, per_page: 10, activation_status: filter }),
  );
  const item = resource.result?.data.find(
    (row) => row.profile.rest_id === selected,
  );
  const labels = {
    Pending: 'بانتظار التفعيل',
    Active: 'مفعّل',
    Suspended: 'معلّق',
  };
  return (
    <>
      <PageTitle
        title="المطاعم"
        description="راجع بيانات المطعم ثم فعّل حسابه أو علّقه."
      />
      <div className="filters">
        <Field label="حالة التفعيل">
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
              setSelected(null);
            }}
          >
            <option value="">جميع المطاعم</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
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
                  <th>المطعم</th>
                  <th>المالك</th>
                  <th>حالة التفعيل</th>
                  <th>استقبال الطلبات</th>
                  <th>المراجعة</th>
                </tr>
              </thead>
              <tbody>
                {resource.result?.data.map((row) => (
                  <tr key={row.profile.rest_id}>
                    <td>
                      <strong>{row.profile.rest_title}</strong>
                      <small>#{row.profile.rest_id}</small>
                    </td>
                    <td>{row.owner?.full_name ?? 'غير متاح'}</td>
                    <td>{labels[row.profile.activation_status]}</td>
                    <td>{row.profile.is_active ? 'مفتوح' : 'متوقف'}</td>
                    <td>
                      <button
                        className="button compact"
                        onClick={() => setSelected(row.profile.rest_id)}
                      >
                        مراجعة المطعم
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
      {item && (
        <section className="panel panel-pad">
          <h2>{item.profile.rest_title}</h2>
          <div className="form-grid">
            <div>
              <h3>بيانات المطعم</h3>
              <p>{item.profile.rest_description}</p>
              <p>{item.profile.rest_address}</p>
              <p>
                <bdi>
                  {item.profile.latitude}, {item.profile.longitude}
                </bdi>
              </p>
              <p>
                <bdi>
                  {item.profile.opens_at} – {item.profile.closes_at}
                </bdi>{' '}
                · بتوقيت مصر
              </p>
              {item.profile.rest_image_url_mobile && (
                <img
                  className="restaurant-thumbnail"
                  src={item.profile.rest_image_url_mobile}
                  alt={item.profile.rest_title}
                />
              )}
            </div>
            <div>
              <h3>بيانات المالك</h3>
              <p>{item.owner?.full_name}</p>
              <p>
                <bdi>{item.owner?.email}</bdi>
              </p>
              <p>
                <bdi>{item.owner?.phone}</bdi>
              </p>
              <p>
                البريد {item.owner?.email_verified_at ? 'موثّق' : 'غير موثّق'} ·
                الحساب {item.owner?.is_active ? 'نشط' : 'غير نشط'}
              </p>
            </div>
          </div>
          <div className="actions">
            {item.profile.activation_status !== 'Active' && (
              <Confirm
                label="تفعيل المطعم"
                description="سيسمح التفعيل للمطعم بإدارة قائمته وطلباته، بشرط نشاط حسابه وتوثيق البريد."
                run={() =>
                  api.request(
                    '/admin/restaurants/' +
                      item.profile.rest_id +
                      '/activation',
                    { method: 'PATCH', body: { activation_status: 'Active' } },
                  )
                }
                done={resource.reload}
              />
            )}
            {item.profile.activation_status !== 'Suspended' && (
              <Confirm
                label="تعليق المطعم"
                danger
                description="سيتم منع عمليات المطعم والتعديلات. ستظل قراءة البيانات وحالة التفعيل متاحة."
                run={() =>
                  api.request(
                    '/admin/restaurants/' +
                      item.profile.rest_id +
                      '/activation',
                    {
                      method: 'PATCH',
                      body: { activation_status: 'Suspended' },
                    },
                  )
                }
                done={resource.reload}
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
