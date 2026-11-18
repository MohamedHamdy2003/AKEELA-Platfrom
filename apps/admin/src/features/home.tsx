import { navigation } from '../lib/navigation';
import type { User, RestaurantReview, Order } from '@akeela/portal/models';
import { Failure, Metrics, PageTitle, useResource } from '@akeela/portal/ui';
import { api } from '../lib/api';
export function Home({
  revision,
  navigate,
}: {
  revision: number;
  navigate: (key: string) => void;
}) {
  const users = useResource<User[]>(api, '/admin/users?per_page=1'),
    restaurants = useResource<RestaurantReview[]>(
      api,
      '/admin/restaurants?activation_status=Pending&per_page=1',
    ),
    orders = useResource<Order[]>(
      api,
      '/admin/orders?status=Pending&per_page=1',
      revision,
    );
  return (
    <>
      <PageTitle
        title="نظرة عامة"
        description="كل ما تحتاجه لإدارة المنصة، في مساحة واضحة."
      />
      <Metrics
        items={[
          { label: 'حسابات المنصة', value: users.result?.meta?.total ?? null },
          {
            label: 'مطاعم تنتظر التفعيل',
            value: restaurants.result?.meta?.total ?? null,
          },
          {
            label: 'طلبات قيد الانتظار',
            value: orders.result?.meta?.total ?? null,
          },
        ]}
      />
      {[users, restaurants, orders]
        .filter((item) => item.error)
        .map((item, index) => (
          <Failure key={index} error={item.error} retry={item.reload} />
        ))}
      <section className="panel panel-pad">
        <h2>مساحة التشغيل</h2>
        <p className="muted">انتقل مباشرة إلى المهام اليومية.</p>
        <div className="quick-links">
          {navigation.slice(1, 5).map(([key, label]) => (
            <button className="button" key={key} onClick={() => navigate(key)}>
              {label} ←
            </button>
          ))}
        </div>
      </section>
      <section className="panel panel-pad">
        <h2>صلاحيات واضحة</h2>
        <p>
          تفعيل المطاعم ومراجعة الحسابات ومتابعة الطلبات. إسناد شركة التوصيل يتم
          تلقائيًا عند قبول المطعم للطلب.
        </p>
        <p className="muted">
          الأعداد المعروضة من قوائم المنصة الحالية. لا تشمل تقارير مالية.
        </p>
      </section>
    </>
  );
}
