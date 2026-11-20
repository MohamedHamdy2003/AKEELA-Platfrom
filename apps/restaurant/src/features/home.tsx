import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { cairo } from '../lib/format';
import {
  ArrowLeft,
  CircleCheck,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useResource } from '../lib/use-resource';
import type { Dashboard, OrderSummary, Profile } from '../lib/models';
import {
  Activity,
  Empty,
  Failure,
  TableSkeleton,
  Notice,
  PageHeading,
} from '../components/ui';
import { OrdersTable } from './orders';

export function Home({
  dashboard,
  profile,
  navigate,
  openOrder,
  onProfileChanged,
}: {
  dashboard: Dashboard;
  profile: Profile;
  navigate: (route: string) => void;
  openOrder: (id: string) => void;
  onProfileChanged: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const resource = useResource<OrderSummary[]>(
    dashboard.can_manage ? '/restaurant/orders?page=1&per_page=5' : null,
  );
  useEffect(() => {
    if (resource.result)
      setUpdatedAt(
        new Intl.DateTimeFormat('ar-EG', {
          timeZone: cairo,
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date()),
      );
  }, [resource.result]);
  async function toggleService() {
    setUpdating(true);
    setError(null);
    try {
      await api.request('/restaurant/profile', {
        method: 'PATCH',
        body: { is_active: !profile.is_active },
      });
    } catch (cause) {
      setError(cause);
    } finally {
      onProfileChanged();
      setUpdating(false);
    }
  }
  if (!dashboard.can_manage)
    return (
      <>
        <PageHeading
          title={
            dashboard.activation_status === 'Suspended'
              ? 'مطعمك موقوف مؤقتًا'
              : 'خطوتك التالية: تفعيل المطعم'
          }
          subtitle={profile.rest_title}
        />
        <div className="activation-state">
          {dashboard.activation_status === 'Suspended' ? (
            <ShieldAlert size={48} strokeWidth={1.4} />
          ) : (
            <Clock3 size={48} strokeWidth={1.4} />
          )}
          <h2>
            {dashboard.activation_status === 'Suspended'
              ? 'الإدارة أوقفت إدارة المطعم مؤقتًا.'
              : 'حسابك جاهز، وطلب التفعيل قيد المراجعة.'}
          </h2>
          <p>يمكنك الاطلاع على بيانات حسابك ومطعمك، وإدارة كلمة المرور.</p>
          <p className="server-message" lang="en" dir="auto">
            {dashboard.message}
          </p>
          <button
            className="button secondary"
            onClick={() => navigate('profile')}
          >
            عرض ملف المطعم
          </button>
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        title={'صباح الخير، ' + profile.rest_title}
        subtitle="كل ما يحتاجه يومك، في مكان واحد."
        action={
          <button className="button primary" onClick={() => navigate('orders')}>
            عرض الطلبات
            <ArrowLeft size={20} />
          </button>
        }
      />
      <section className="service-band">
        <div>
          <CircleCheck size={28} strokeWidth={1.6} />
          <strong>
            {profile.is_active
              ? 'مطعمك جاهز لاستقبال الطلبات.'
              : 'استقبال المبيعات الجديدة متوقف.'}
          </strong>
        </div>
        <div>
          <button
            className={'service-switch ' + (profile.is_active ? 'on' : '')}
            role="switch"
            aria-checked={profile.is_active}
            aria-busy={updating}
            aria-label="استقبال مبيعات جديدة"
            disabled={updating}
            onClick={toggleService}
          >
            <span />
          </button>
          <span>
            الخدمة{' '}
            <Activity
              active={profile.is_active}
              activeLabel="مفعّلة"
              inactiveLabel="متوقفة"
            />
          </span>
          <button className="text-button" onClick={() => navigate('profile')}>
            إدارة المطعم
          </button>
        </div>
      </section>
      <Notice error={error} />
      <div className="section-heading">
        <h2>أحدث الطلبات</h2>
        <button
          className="text-button accent"
          onClick={() => navigate('orders')}
        >
          عرض الكل
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="panel table-panel">
        {resource.loading ? (
          <TableSkeleton />
        ) : resource.error ? (
          <Failure error={resource.error} retry={resource.reload} />
        ) : resource.result ? (
          <OrdersTable orders={resource.result.data} onSelect={openOrder} />
        ) : (
          <Empty />
        )}
      </div>
      <div className="refresh-line">
        <span>{updatedAt ? 'آخر تحديث ' + updatedAt : 'جارٍ التحديث…'}</span>
        <button className="button secondary compact" onClick={resource.reload}>
          <RefreshCw
            size={17}
            className={resource.loading ? 'spin' : undefined}
          />
          تحديث
        </button>
      </div>
      <footer className="main-footer">
        أكيلة <span>|</span> AKEELA
      </footer>
    </>
  );
}
