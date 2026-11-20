import type { User } from '@akeela/portal/models';
import { ActivityBadge, dateTime } from '@akeela/portal/ui';

const restaurantFields = [
  ['rest_id', 'معرّف المطعم'],
  ['rest_title', 'اسم المطعم'],
  ['rest_description', 'الوصف'],
  ['rest_address', 'عنوان المطعم'],
  ['latitude', 'خط العرض'],
  ['longitude', 'خط الطول'],
  ['opens_at', 'يفتح بتوقيت مصر'],
  ['closes_at', 'يغلق بتوقيت مصر'],
  ['activation_status', 'حالة التفعيل'],
  ['is_active', 'استقبال الطلبات'],
] as const;
const activation: Record<string, string> = {
  Pending: 'بانتظار التفعيل',
  Active: 'مفعّل',
  Suspended: 'معلّق',
};
export function ProfileDetails({ user }: { user: User }) {
  const profile = user.profile;
  if (!profile) return null;
  const image =
    user.role === 'Customer'
      ? profile.cus_avatar_url
      : user.role === 'Restaurant'
        ? profile.rest_image_url_mobile
        : null;
  return (
    <section aria-label="بيانات الملف">
      <div className="account-meta">
        <span>
          معرّف الحساب: <bdi>#{user.user_id}</bdi>
        </span>
      </div>
      {typeof image === 'string' && image && (
        <img
          className="profile-image"
          src={image}
          alt={user.role === 'Restaurant' ? 'صورة المطعم' : 'صورة العميل'}
        />
      )}
      {user.role === 'Restaurant' && (
        <div className="form-grid">
          {restaurantFields.map(([key, label]) => (
            <div className="profile-fact" key={key}>
              <strong>{label}</strong>
              <p>
                {key === 'is_active' ? (
                  <ActivityBadge
                    active={!!profile[key]}
                    activeLabel="يستقبل الطلبات"
                    inactiveLabel="متوقف"
                  />
                ) : key === 'activation_status' ? (
                  (activation[String(profile[key])] ?? '—')
                ) : (
                  String(profile[key] ?? '—')
                )}
              </p>
            </div>
          ))}
        </div>
      )}
      {(['created_at', 'updated_at'] as const).map((key, index) =>
        typeof profile[key] === 'string' ? (
          <p className="muted" key={key}>
            {index === 0 ? 'إنشاء الملف' : 'تحديث الملف'}:{' '}
            {dateTime(profile[key] as string)}
          </p>
        ) : null,
      )}
    </section>
  );
}
