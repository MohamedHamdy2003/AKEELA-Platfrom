import { Clock3, ShieldAlert } from 'lucide-react';
import type { Dashboard, Profile } from '../lib/models';
import { PageHeading } from '../components/ui';

export function ActivationNotice({
  dashboard,
  profile,
  navigate,
}: {
  dashboard: Dashboard;
  profile: Profile;
  navigate: (route: string) => void;
}) {
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
}
