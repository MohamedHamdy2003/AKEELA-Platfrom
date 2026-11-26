import type { Order } from '@akeela/portal/models';
import { Confirm } from '@akeela/portal/ui';
import { api } from '../lib/api';
export function AdminActions({
  order,
  refresh,
}: {
  order: Order;
  refresh: () => void;
}) {
  if (!['Accepted', 'Picked_Up'].includes(order.status)) {
    return null;
  }

  return (
    <section className="order-card order-action-card">
      <div className="order-card-head">
        <h3>إجراءات الإدارة</h3>
      </div>
      <Confirm
        label="تسجيل تعثّر الطلب"
        danger
        description="سيتم إنهاء الطلب بحالة «متعثر». لا يمكن التراجع عن هذا الإجراء."
        run={() =>
          api.request('/admin/orders/' + order.order_id + '/fail', {
            method: 'POST',
          })
        }
        done={refresh}
      />
    </section>
  );
}
