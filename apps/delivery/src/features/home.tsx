import type { Driver, OrderStatusCounts } from '@akeela/portal/models';
import {
  Failure,
  Metrics,
  Notice,
  PageTitle,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
export function Home({
  revision,
  navigate,
}: {
  revision: number;
  navigate: (key: string) => void;
}) {
  const orderCounts = useResource<OrderStatusCounts>(
      api,
      '/delivery-company/orders/counts',
      revision,
    ),
    drivers = useResource<Driver[]>(
      api,
      '/delivery-company/drivers?per_page=1&is_active=true',
    );
  return (
    <>
      <PageTitle
        title="نظرة عامة"
        description="تشغيل واضح، من استلام الطلب إلى تسليمه."
      />
      <Metrics
        items={[
          {
            label: 'طلبات مقبولة',
            value: orderCounts.result?.data.Accepted ?? null,
            status: 'Accepted',
            onClick: () => navigate('orders'),
          },
          {
            label: 'قيد التوصيل',
            value: orderCounts.result?.data.Picked_Up ?? null,
            status: 'Picked_Up',
            onClick: () => navigate('orders'),
          },
          {
            label: 'السائقون النشطون',
            value: drivers.result?.meta?.total ?? null,
            onClick: () => navigate('drivers'),
          },
        ]}
      />
      {[orderCounts, drivers]
        .filter((item) => item.error)
        .map((item, index) => (
          <Failure key={index} error={item.error} retry={item.reload} />
        ))}
      <section className="panel panel-pad">
        <h2>ابدأ من الطلبات</h2>
        <p>اختر سائقًا نشطًا لبدء التوصيل تلقائيًا، ثم أكّد التسليم للعميل.</p>
        <div className="quick-links">
          <button className="button primary" onClick={() => navigate('orders')}>
            فتح طلبات الشركة ←
          </button>
          <button className="button" onClick={() => navigate('drivers')}>
            إدارة السائقين
          </button>
        </div>
      </section>
      <Notice>
        السائق النشط يمكن إسناد الطلب إليه. هذا العدد لا يعني أنه متاح أو غير
        مشغول. التطبيق مخصص لمسؤول الشركة.
      </Notice>
    </>
  );
}
