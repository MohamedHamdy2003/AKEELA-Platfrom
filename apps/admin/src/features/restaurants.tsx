import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { query } from '@akeela/portal/api';
import type { RestaurantReview } from '@akeela/portal/models';
import {
  ActivityBadge,
  Failure,
  Field,
  Pager,
  PageTitle,
  ResourceState,
  TableSkeleton,
  useResource,
} from '@akeela/portal/ui';
import { api } from '../lib/api';
import { DetailWorkspace } from '../components/detail-workspace';
import { EmailVerification } from '../components/email-verification';
import { RestaurantWorkspace } from './restaurant-workspace';
import './restaurants.css';

export function Restaurants({
  revision = 0,
  analyticsRevision = revision,
  initialStatus,
  onInitialStatusConsumed,
}: {
  revision?: number;
  analyticsRevision?: number;
  initialStatus?: string;
  onInitialStatusConsumed?: () => void;
} = {}) {
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState(initialStatus ?? ''),
    [searchInput, setSearchInput] = useState(''),
    [debouncedSearch, setDebouncedSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [workspaceRest, setWorkspaceRest] = useState<RestaurantReview | null>(null),
    [confirmAction, setConfirmAction] = useState<'Active' | 'Suspended' | null>(
      null,
    ),
    [actionBusy, setActionBusy] = useState(false),
    [actionError, setActionError] = useState<unknown>(null);

  const confirmDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
      setPage(1);
      setSelected(null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    if (initialStatus !== undefined && initialStatus !== '') {
      setFilter(initialStatus);
      setPage(1);
      setSelected(null);
      setWorkspaceRest(null);
      onInitialStatusConsumed?.();
    }
  }, [initialStatus, onInitialStatusConsumed]);

  const resource = useResource<RestaurantReview[]>(
    api,
    '/admin/restaurants' +
      query({
        page,
        per_page: 10,
        activation_status: filter,
        search: debouncedSearch,
      }),
  );

  useEffect(() => {
    const last = resource.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [resource.result?.meta?.last_page, page]);

  const item = resource.result?.data.find(
    (row) => row.profile.rest_id === selected,
  );
  const activeWorkspaceRest = workspaceRest
    ? (resource.result?.data.find(
        (row) => row.profile.rest_id === workspaceRest.profile.rest_id,
      ) ?? workspaceRest)
    : null;
  const confirmTarget = activeWorkspaceRest ?? item ?? null;

  useEffect(() => {
    if (selected && resource.result && !item) {
      setSelected(null);
    }
  }, [selected, resource.result, item]);

  const labels = {
    Pending: 'بانتظار التفعيل',
    Active: 'مفعّل',
    Suspended: 'معلّق',
  };

  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (confirmAction) {
      setActionError(null);
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close();
      }
    }
  }, [confirmAction]);

  const executeStatusChange = async () => {
    if (!confirmAction || !confirmTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await api.request(
        '/admin/restaurants/' + confirmTarget.profile.rest_id + '/activation',
        {
          method: 'PATCH',
          body: { activation_status: confirmAction },
        },
      );
      if (
        workspaceRest &&
        workspaceRest.profile.rest_id === confirmTarget.profile.rest_id
      ) {
        setWorkspaceRest({
          ...confirmTarget,
          profile: {
            ...confirmTarget.profile,
            activation_status: confirmAction,
          },
        });
      }
      setConfirmAction(null);
      resource.reload();
    } catch (cause) {
      setActionError(cause);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      {activeWorkspaceRest ? (
        <RestaurantWorkspace
          restaurant={activeWorkspaceRest}
          revision={revision}
          analyticsRevision={analyticsRevision}
          onBack={() => setWorkspaceRest(null)}
          onRequestActivation={(action) => setConfirmAction(action)}
        />
      ) : (
        <DetailWorkspace
          selectedKey={item ? selected : null}
          title="مراجعة المطعم"
          onClose={() => setSelected(null)}
          details={
            item && (
              <>
                <div className="restaurant-detail-title-wrap">
                  <h2>{item.profile.rest_title}</h2>
                  <span
                    className={`status-pill activation-${item.profile.activation_status.toLowerCase()}`}
                  >
                    <i className="status-dot" aria-hidden="true" />
                    {labels[item.profile.activation_status]}
                  </span>
                </div>
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
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div>
                    <h3>بيانات المالك</h3>
                    <p>{item.owner?.full_name}</p>
                    <p className="email-cell">
                      <bdi>{item.owner?.email}</bdi>
                      {item.owner && (
                        <EmailVerification
                          verified={!!item.owner.email_verified_at}
                        />
                      )}
                    </p>
                    <p>
                      <bdi>{item.owner?.phone}</bdi>
                    </p>
                    <div className="account-meta">
                      <span>
                        الحساب{' '}
                        <ActivityBadge active={!!item.owner?.is_active} />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="actions restaurant-detail-actions">
                  <button
                    type="button"
                    className="button primary restaurant-goto-btn"
                    onClick={() => {
                      setWorkspaceRest(item);
                      setSelected(null);
                    }}
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                    الانتقال إلى المطعم
                  </button>
                  {item.profile.activation_status !== 'Active' && (
                    <button
                      type="button"
                      className="button"
                      onClick={() => setConfirmAction('Active')}
                    >
                      تفعيل المطعم
                    </button>
                  )}
                  {item.profile.activation_status !== 'Suspended' && (
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => setConfirmAction('Suspended')}
                    >
                      تعليق المطعم
                    </button>
                  )}
                </div>
              </>
            )
          }
        >
          <PageTitle
            title="المطاعم"
            description="راجع بيانات المطعم ثم فعّل حسابه أو علّقه، أو انتقل إلى ملفه لمتابعة طلباته ومكاسبه."
          />
          <div className="filters restaurants-filters">
            <Field label="بحث باسم المطعم أو المالك">
              <div className="restaurant-search-wrap">
                <Search
                  size={16}
                  className="restaurant-search-ico"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  className="restaurant-search-input"
                  value={searchInput}
                  placeholder="ابحث باسم المطعم أو اسم المالك..."
                  aria-label="بحث باسم المطعم أو اسم المالك"
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="restaurant-search-clear"
                    aria-label="مسح البحث"
                    onClick={() => {
                      setSearchInput('');
                      setDebouncedSearch('');
                      setPage(1);
                      setSelected(null);
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </Field>
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
            {(filter || searchInput) && (
              <button
                type="button"
                className="button filters-reset"
                onClick={() => {
                  setFilter('');
                  setSearchInput('');
                  setDebouncedSearch('');
                  setPage(1);
                  setSelected(null);
                }}
              >
                إعادة ضبط
              </button>
            )}
          </div>
          <ResourceState
            resource={resource}
            empty={!!resource.result && !resource.result.data.length}
            skeleton={<TableSkeleton columns={6} />}
          >
            <section className="panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>رقم المطعم</th>
                      <th>المطعم</th>
                      <th>المالك</th>
                      <th>حالة التفعيل</th>
                      <th>استقبال الطلبات</th>
                      <th>المراجعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.result?.data.map((row) => (
                      <tr
                        key={row.profile.rest_id}
                        data-selected={selected === row.profile.rest_id}
                      >
                        <td>
                          <bdi>#{row.profile.rest_id}</bdi>
                        </td>
                        <td>
                          <strong>{row.profile.rest_title}</strong>
                        </td>
                        <td>{row.owner?.full_name ?? 'غير متاح'}</td>
                        <td>
                          <span
                            className={`status-pill activation-${row.profile.activation_status.toLowerCase()}`}
                          >
                            <i className="status-dot" aria-hidden="true" />
                            {labels[row.profile.activation_status]}
                          </span>
                        </td>
                        <td>
                          <ActivityBadge
                            active={row.profile.is_active}
                            activeLabel="مفتوح"
                            inactiveLabel="متوقف"
                          />
                        </td>
                        <td>
                          <button
                            className="button compact"
                            aria-expanded={selected === row.profile.rest_id}
                            data-detail-record={row.profile.rest_id}
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
              <Pager
                meta={resource.result?.meta}
                change={(nextPage) => {
                  setSelected(null);
                  setPage(nextPage);
                }}
              />
            </section>
          </ResourceState>
        </DetailWorkspace>
      )}

      {/* Confirmation Dialog for Restaurant Activation / Suspension */}
      <dialog
        ref={confirmDialogRef}
        className="restaurant-confirm-dialog"
        onCancel={(event) => {
          if (actionBusy) event.preventDefault();
        }}
        onClose={() => {
          if (!actionBusy) setConfirmAction(null);
        }}
        aria-labelledby="confirm-dialog-title"
      >
        {confirmAction && confirmTarget && (
          <div className="confirm-dialog-content">
            <div className="dialog-head">
              <div className="dialog-title-group">
                <span
                  className={`dialog-badge ${confirmAction === 'Active' ? 'badge-activate' : 'badge-suspend'}`}
                >
                  {confirmAction === 'Active' ? (
                    <CheckCircle2 size={20} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={20} aria-hidden="true" />
                  )}
                </span>
                <h2 id="confirm-dialog-title">
                  {confirmAction === 'Active'
                    ? 'تأكيد تفعيل المطعم'
                    : 'تأكيد تعليق المطعم'}
                </h2>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                aria-label="إغلاق"
                disabled={actionBusy}
                onClick={() => setConfirmAction(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="confirm-body">
              <div className="confirm-target-summary">
                <div className="confirm-target-row">
                  <span className="label">اسم المطعم:</span>
                  <span className="value">
                    {confirmTarget.profile.rest_title}
                  </span>
                </div>
                <div className="confirm-target-row">
                  <span className="label">رقم المطعم:</span>
                  <span className="value">
                    <bdi>#{confirmTarget.profile.rest_id}</bdi>
                  </span>
                </div>
                <div className="confirm-target-row">
                  <span className="label">المالك:</span>
                  <span className="value">
                    {confirmTarget.owner?.full_name ?? 'غير متاح'}
                  </span>
                </div>
              </div>

              <div
                className={`confirm-explanation ${confirmAction === 'Active' ? 'explain-activate' : 'explain-suspend'}`}
              >
                <strong>
                  {confirmAction === 'Active'
                    ? 'ماذا يعني تفعيل المطعم؟'
                    : 'ماذا يعني تعليق المطعم؟'}
                </strong>
                <p>
                  {confirmAction === 'Active'
                    ? 'سيسمح التفعيل للمطعم بالظهور للعملاء في التطبيق واستقبال طلبات الزبائن، وإدارة الأصناف وقائمة الطعام، بشرط نشاط حسابه وتوثيق البريد.'
                    : 'سيتم تعليق المطعم وإيقاف استقباله للطلبات فوراً ومنع أي تعديلات على حسابه. ستظل قراءة البيانات وسجل الطلبات السابقة متاحة للمراجعة.'}
                </p>
              </div>

              {!!actionError && <Failure error={actionError} />}

              <div className="confirm-dialog-actions">
                <button
                  type="button"
                  className={
                    'button ' +
                    (confirmAction === 'Active' ? 'primary' : 'danger')
                  }
                  disabled={actionBusy}
                  onClick={() => void executeStatusChange()}
                >
                  {actionBusy ? 'جارٍ التنفيذ…' : 'تأكيد'}
                </button>
                <button
                  type="button"
                  className="button"
                  disabled={actionBusy}
                  onClick={() => setConfirmAction(null)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
