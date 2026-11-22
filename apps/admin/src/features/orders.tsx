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
  return (
    <section className="detail-section">
      <h3>إجراءات الإدارة</h3>
      <p className="muted">المطعم يقبل الطلب والشركة تُسند السائق.</p>
      {['Accepted', 'Picked_Up'].includes(order.status) && (
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
      )}
    </section>
  );
}
