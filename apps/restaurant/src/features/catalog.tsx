import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Info,
  Link2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Unlink,
  Upload,
} from 'lucide-react';
import { api, ApiError, query } from '../lib/api';
import type {
  Addon,
  CatalogKind,
  CatalogRecord,
  Category,
  Envelope,
  Offer,
  Product,
  ProductAddon,
} from '../lib/models';
import { cairoISO, cairoLocal, dateTime, money } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Presence } from '../components/presence';
import {
  Activity,
  ButtonContent,
  Check,
  Dialog,
  Empty,
  Failure,
  Field,
  FieldErrors,
  Loading,
  Notice,
  PageHeading,
  Pager,
  Picture,
  Select,
  TextArea,
  TableSkeleton,
} from '../components/ui';
import './catalog.css';

const config = {
  categories: {
    title: 'التصنيفات',
    singular: 'تصنيف',
    name: 'cat_title',
    id: 'cat_id',
    subtitle: 'رتّب قائمتك، وانقر على أي تصنيف لإدارة منتجاته.',
  },
  products: {
    title: 'المنتجات',
    singular: 'منتج',
    name: 'prod_name',
    id: 'prod_id',
    subtitle: 'كل تفاصيل قائمتك، بعناية.',
  },
  addons: {
    title: 'الإضافات',
    singular: 'إضافة',
    name: 'addon_name',
    id: 'addon_id',
    subtitle: 'تفاصيل صغيرة، وخيارات أكثر.',
  },
  offers: {
    title: 'العروض',
    singular: 'عرض',
    name: 'offer_title',
    id: 'offer_id',
    subtitle: 'عروض واضحة، في الوقت المناسب.',
  },
} as const;

type PoolFilter = 'all' | 'linked' | 'unlinked';

type ConfirmState =
  | { kind: 'delete-category'; category: Category }
  | { kind: 'unlink-product'; product: Product; categoryTitle?: string }
  | { kind: 'delete-product'; product: Product }
  | { kind: 'delete-addon'; addon: Addon };

function value(record: CatalogRecord, key: string): string {
  return String((record as unknown as Record<string, unknown>)[key] ?? '');
}

function countArabic(
  n: number,
  singular: string,
  dual: string,
  plural: string,
) {
  if (n === 0) return 'فارغ (0)';
  if (n === 1) return `1 ${singular}`;
  if (n === 2) return dual;
  if (n <= 10) return `${n} ${plural}`;
  return `${n} ${singular}`;
}

function AlertBanner({
  tone,
  children,
  action,
}: {
  tone: 'warning' | 'success' | 'info' | 'danger';
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      className={`cat-alert is-${tone}`}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <div className="cat-alert-main">
        <Icon size={18} aria-hidden="true" />
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}

export async function allPages<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let response: Envelope<T[]>;
  do {
    response = await api.request<T[]>(path + query({ page, per_page: 100 }), {
      signal,
    });
    items.push(...response.data);
    page++;
  } while (response.meta && page <= response.meta.last_page);
  return items;
}

export function Catalog({ kind }: { kind: CatalogKind }) {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [pool, setPool] = useState<PoolFilter>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesRev, setCategoriesRev] = useState(0);
  const [pickerError, setPickerError] = useState<unknown>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState<CatalogRecord | 'new' | null>(null);
  const [linking, setLinking] = useState<Product | null>(null);
  const [linkingAddon, setLinkingAddon] = useState<Addon | null>(null);
  const [movingProduct, setMovingProduct] = useState<{
    product: Product;
    mode: 'move' | 'link';
  } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<unknown>(null);
  const [feedback, setFeedback] = useState('');
  const [detailsRev, setDetailsRev] = useState(0);

  useEffect(() => {
    setPage(1);
    setCategory('');
    setPool('all');
    setSelectedCategoryId(null);
    setEditing(null);
    setLinking(null);
    setLinkingAddon(null);
    setMovingProduct(null);
    setConfirmState(null);
    setConfirmError(null);
    setFeedback('');
  }, [kind]);

  const unlinkedQuery =
    (kind === 'products' || kind === 'addons') && pool !== 'all'
      ? pool === 'unlinked'
        ? 'true'
        : 'false'
      : undefined;

  const resource = useResource<CatalogRecord[]>(
    '/restaurant/' +
      kind +
      query({
        page,
        per_page: 20,
        cat_id:
          kind === 'products' && pool !== 'unlinked' ? category : undefined,
        unlinked: unlinkedQuery,
      }),
  );

  const cfg = config[kind];

  useEffect(() => {
    const last = resource.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [resource.result?.meta?.last_page, page]);

  const singlePageCategories =
    kind === 'categories' &&
    page === 1 &&
    resource.result?.meta?.last_page === 1
      ? (resource.result.data as Category[])
      : null;

  useEffect(() => {
    if (singlePageCategories) {
      setCategories(singlePageCategories);
      setPickerError(null);
      return;
    }
    if (kind !== 'products' && kind !== 'categories') return;
    if (kind === 'categories' && !resource.result && resource.loading) return;
    const controller = new AbortController();
    setPickerError(null);
    allPages<Category>('/restaurant/categories', controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setCategories(rows);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setPickerError(cause);
      });
    return () => controller.abort();
  }, [
    kind,
    categoriesRev,
    singlePageCategories,
    resource.loading,
    resource.result,
  ]);

  const refreshAll = (message?: string) => {
    if (message) setFeedback(message);
    resource.reload();
    setCategoriesRev((n) => n + 1);
    setDetailsRev((n) => n + 1);
  };

  async function executeConfirm() {
    if (!confirmState) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      if (confirmState.kind === 'delete-category') {
        await api.request(
          '/restaurant/categories/' + confirmState.category.cat_id,
          { method: 'DELETE' },
        );
        setConfirmState(null);
        setEditing(null);
        setSelectedCategoryId(null);
        refreshAll(
          `تم مسح التصنيف «${confirmState.category.cat_title}» وإعادة ضبط الترتيب تلقائياً.`,
        );
      } else if (confirmState.kind === 'unlink-product') {
        await api.request(
          '/restaurant/products/' + confirmState.product.prod_id,
          { method: 'PATCH', body: { cat_id: null } },
        );
        setConfirmState(null);
        setEditing(null);
        refreshAll(
          `تم فك ربط «${confirmState.product.prod_name}» ونقله إلى قائمة المنتجات غير المربوطة (غير المفعّلة).`,
        );
      } else if (confirmState.kind === 'delete-product') {
        await api.request(
          '/restaurant/products/' + confirmState.product.prod_id,
          { method: 'DELETE' },
        );
        setConfirmState(null);
        setEditing(null);
        refreshAll(
          `تم مسح المنتج «${confirmState.product.prod_name}» نهائياً مع الحفاظ على سجل الطلبات السابقة.`,
        );
      } else if (confirmState.kind === 'delete-addon') {
        await api.request('/restaurant/addons/' + confirmState.addon.addon_id, {
          method: 'DELETE',
        });
        setConfirmState(null);
        setEditing(null);
        refreshAll(
          `تم مسح الإضافة «${confirmState.addon.addon_name}» نهائياً مع الحفاظ على سجل الطلبات السابقة.`,
        );
      }
    } catch (cause) {
      setConfirmError(cause);
    } finally {
      setConfirmBusy(false);
    }
  }

  const selectedCategory =
    kind === 'categories' && selectedCategoryId
      ? (categories.find((c) => c.cat_id === selectedCategoryId) ??
        (resource.result?.data as Category[] | undefined)?.find(
          (c) => c.cat_id === selectedCategoryId,
        ) ??
        null)
      : null;

  const confirmDialogProps = (() => {
    if (!confirmState) return null;
    if (confirmState.kind === 'delete-category') {
      return {
        title: 'تأكيد مسح التصنيف',
        body: (
          <>
            هل أنت متأكد من مسح تصنيف{' '}
            <strong>«{confirmState.category.cat_title}»</strong> نهائياً؟ سيتم
            إعادة ضبط ترتيب باقي التصنيفات تلقائياً بشكل متسلسل.
          </>
        ),
        confirmLabel: 'مسح التصنيف نهائياً',
        confirmTone: 'danger' as const,
      };
    }
    if (confirmState.kind === 'unlink-product') {
      return {
        title: 'فك ربط المنتج من التصنيف',
        body: (
          <>
            سيتم إخراج <strong>«{confirmState.product.prod_name}»</strong>
            {confirmState.categoryTitle ? (
              <>
                {' '}
                من تصنيف <strong>«{confirmState.categoryTitle}»</strong>
              </>
            ) : null}{' '}
            ونقله إلى قائمة <strong>المنتجات غير المربوطة (غير المفعّلة)</strong>
            . لن يظهر المنتج للعملاء حتى يتم ربطه بتصنيف مرة أخرى، ويمكنك مسحه
            نهائياً من هناك.
          </>
        ),
        confirmLabel: 'تأكيد فك الربط',
        confirmTone: 'primary' as const,
      };
    }
    if (confirmState.kind === 'delete-product') {
      return {
        title: 'تأكيد مسح المنتج نهائياً',
        body: (
          <>
            هل أنت متأكد من مسح المنتج{' '}
            <strong>«{confirmState.product.prod_name}»</strong> نهائياً؟ لا يمكن
            التراجع عن هذا الإجراء. ستظل تفاصيل الطلبات السابقة محفوظة في
            التاريخ، وستُوقف أي إضافة كانت مربوطة بهذا المنتج وحده تلقائياً.
          </>
        ),
        confirmLabel: 'مسح المنتج نهائياً',
        confirmTone: 'danger' as const,
      };
    }
    return {
      title: 'تأكيد مسح الإضافة نهائياً',
      body: (
        <>
          هل أنت متأكد من مسح الإضافة{' '}
          <strong>«{confirmState.addon.addon_name}»</strong> نهائياً؟ لا يمكن
          التراجع عن هذا الإجراء، مع بقاء سجل الطلبات السابقة محفوظاً بالكامل.
        </>
      ),
      confirmLabel: 'مسح الإضافة نهائياً',
      confirmTone: 'danger' as const,
    };
  })();

  if (kind === 'categories' && selectedCategory) {
    return (
      <>
        <CategoryDetailsView
          category={selectedCategory}
          revision={detailsRev}
          onBack={() => {
            setSelectedCategoryId(null);
            setFeedback('');
          }}
          onEdit={() => setEditing(selectedCategory)}
          onRequestDelete={() => {
            setConfirmError(null);
            setConfirmState({
              kind: 'delete-category',
              category: selectedCategory,
            });
          }}
          onRequestMove={(product) =>
            setMovingProduct({ product, mode: 'move' })
          }
          onRequestUnlink={(product) => {
            setConfirmError(null);
            setConfirmState({
              kind: 'unlink-product',
              product,
              categoryTitle: selectedCategory.cat_title,
            });
          }}
          feedback={feedback}
        />

        <Presence>
          {editing && (
            <CatalogEditor
              kind="categories"
              record={editing === 'new' ? null : editing}
              allCategories={categories}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                refreshAll('تم حفظ تعديلات التصنيف بنجاح.');
              }}
              onRequestDeleteCategory={(cat) => {
                setEditing(null);
                setConfirmError(null);
                setConfirmState({ kind: 'delete-category', category: cat });
              }}
              onOpenCategoryDetails={(cat) => {
                setEditing(null);
                setSelectedCategoryId(cat.cat_id);
              }}
            />
          )}
        </Presence>

        <Presence>
          {movingProduct && (
            <MoveProductDialog
              product={movingProduct.product}
              mode={movingProduct.mode}
              categories={categories}
              onClose={() => setMovingProduct(null)}
              onSaved={(targetTitle) => {
                const name = movingProduct.product.prod_name;
                setMovingProduct(null);
                refreshAll(`تم نقل «${name}» إلى تصنيف «${targetTitle}».`);
              }}
            />
          )}
        </Presence>

        <Presence>
          {confirmState && confirmDialogProps && (
            <ConfirmActionDialog
              title={confirmDialogProps.title}
              body={confirmDialogProps.body}
              confirmLabel={confirmDialogProps.confirmLabel}
              confirmTone={confirmDialogProps.confirmTone}
              busy={confirmBusy}
              error={confirmError}
              onConfirm={executeConfirm}
              onClose={() => {
                if (!confirmBusy) {
                  setConfirmState(null);
                  setConfirmError(null);
                }
              }}
            />
          )}
        </Presence>
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={cfg.title}
        subtitle={cfg.subtitle}
        action={
          <button className="button primary" onClick={() => setEditing('new')}>
            <Plus size={19} />
            إضافة {cfg.singular}
          </button>
        }
      />

      <div className="cat-toolbar">
        {(kind === 'products' || kind === 'addons') && (
          <div
            className="cat-seg"
            role="group"
            aria-label={
              kind === 'products'
                ? 'تصفية المنتجات حسب الربط'
                : 'تصفية الإضافات حسب الربط'
            }
          >
            <button
              type="button"
              aria-pressed={pool === 'all'}
              onClick={() => {
                setPool('all');
                setPage(1);
              }}
            >
              {kind === 'products' ? 'كل المنتجات' : 'كل الإضافات'}
            </button>
            <button
              type="button"
              aria-pressed={pool === 'linked'}
              onClick={() => {
                setPool('linked');
                setPage(1);
              }}
            >
              {kind === 'products' ? 'مربوطة بتصنيف' : 'مربوطة بمنتجات'}
            </button>
            <button
              type="button"
              aria-pressed={pool === 'unlinked'}
              onClick={() => {
                setPool('unlinked');
                setCategory('');
                setPage(1);
              }}
            >
              غير مربوطة (غير مفعّلة)
            </button>
          </div>
        )}

        {kind === 'products' && pool !== 'unlinked' && (
          <Select
            label="التصنيف"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.cat_id} value={c.cat_id}>
                {c.cat_title}
              </option>
            ))}
          </Select>
        )}

        <button
          className="button secondary cat-toolbar-refresh"
          onClick={() => refreshAll()}
        >
          <RefreshCw
            size={17}
            className={resource.loading ? 'spin' : undefined}
          />
          تحديث
        </button>
      </div>

      <Notice error={pickerError} />
      <Notice>{feedback}</Notice>

      {kind === 'products' && pool === 'unlinked' && (
        <AlertBanner tone="warning">
          المنتجات غير المربوطة بأي تصنيف تكون غير مفعّلة تلقائياً ولا تظهر
          للعملاء. لتفعيل أي منتج اضغط على «ربط بتصنيف»، أو يمكنك مسحه نهائياً من
          هنا.
        </AlertBanner>
      )}

      {kind === 'addons' && pool === 'unlinked' && (
        <AlertBanner tone="warning">
          الإضافات غير المربوطة بأي منتج تكون غير مفعّلة تلقائياً. اربط الإضافة
          بمنتج واحد على الأقل لتفعيلها تلقائياً، أو يمكنك مسحها نهائياً من هنا.
        </AlertBanner>
      )}

      <div className="panel table-panel">
        {!resource.result && resource.loading ? (
          <TableSkeleton columns={kind === 'offers' ? 6 : 5} />
        ) : !resource.result && resource.error ? (
          <Failure error={resource.error} retry={resource.reload} />
        ) : !resource.result?.data.length ? (
          <Empty>
            {pool === 'unlinked'
              ? kind === 'products'
                ? 'لا توجد منتجات غير مربوطة حالياً.'
                : 'لا توجد إضافات غير مربوطة حالياً.'
              : pool === 'linked'
                ? kind === 'products'
                  ? 'لا توجد منتجات مربوطة بتصنيف حالياً.'
                  : 'لا توجد إضافات مربوطة بمنتجات حالياً.'
                : kind === 'products' && category
                  ? 'لا توجد منتجات في هذا التصنيف حالياً.'
                  : `لم تُضف أي ${cfg.title} بعد.`}
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {kind === 'products' || kind === 'offers'
                      ? 'الصورة'
                      : 'الترتيب'}
                  </th>
                  <th>الاسم</th>
                  <th>
                    {kind === 'categories' ? 'المنتجات المرتبطة' : 'السعر'}
                  </th>
                  {kind === 'offers' && <th>فترة العرض</th>}
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {resource.result.data.map((record, index) => {
                  const catRecord =
                    kind === 'categories' ? (record as Category) : null;
                  const prodRecord =
                    kind === 'products' ? (record as Product) : null;
                  const addonRecord =
                    kind === 'addons' ? (record as Addon) : null;
                  const addonLinkedCount =
                    addonRecord?.linked_product_ids?.length ?? 0;

                  return (
                    <tr key={value(record, cfg.id)}>
                      <td>
                        {kind === 'products' || kind === 'offers' ? (
                          <Picture
                            src={value(
                              record,
                              kind === 'products'
                                ? 'prod_image_url'
                                : 'offer_image_url',
                            )}
                            alt={value(record, cfg.name)}
                          />
                        ) : catRecord ? (
                          <span className="cat-order-pill">
                            #{catRecord.display_order}
                          </span>
                        ) : (
                          String((page - 1) * 20 + index + 1).padStart(2, '0')
                        )}
                      </td>
                      <td>
                        {catRecord ? (
                          <button
                            type="button"
                            className="cat-title-btn"
                            onClick={() => {
                              setFeedback('');
                              setSelectedCategoryId(catRecord.cat_id);
                            }}
                          >
                            {catRecord.cat_title}
                          </button>
                        ) : (
                          <strong>{value(record, cfg.name)}</strong>
                        )}
                        {prodRecord &&
                          (prodRecord.cat_id ? (
                            <small className="cell-subtitle">
                              {
                                categories.find(
                                  (c) => c.cat_id === prodRecord.cat_id,
                                )?.cat_title
                              }
                            </small>
                          ) : (
                            <div>
                              <span className="cat-unlinked-tag">
                                <Unlink size={12} aria-hidden="true" />
                                غير مربوط بتصنيف
                              </span>
                            </div>
                          ))}
                        {addonRecord &&
                          (addonLinkedCount > 0 ? (
                            <small className="cell-subtitle">
                              مربوطة بـ{' '}
                              {countArabic(
                                addonLinkedCount,
                                'منتج',
                                'منتجين',
                                'منتجات',
                              )}
                            </small>
                          ) : (
                            <div>
                              <span className="cat-unlinked-tag">
                                <Unlink size={12} aria-hidden="true" />
                                غير مربوطة بأي منتج
                              </span>
                            </div>
                          ))}
                      </td>
                      <td>
                        {catRecord ? (
                          <span
                            className={`cat-count-pill ${(catRecord.product_count ?? 0) === 0 ? 'is-empty' : 'is-linked'}`}
                          >
                            {countArabic(
                              catRecord.product_count ?? 0,
                              'منتج',
                              'منتجين',
                              'منتجات',
                            )}
                          </span>
                        ) : (
                          <bdi>
                            {money(
                              value(
                                record,
                                kind === 'products'
                                  ? 'price'
                                  : kind === 'addons'
                                    ? 'addon_price'
                                    : 'real_price',
                              ),
                            )}
                          </bdi>
                        )}
                      </td>
                      {kind === 'offers' && (
                        <td className="date-cell">
                          {dateTime(value(record, 'starts_at'))}
                          <br />
                          {dateTime(value(record, 'expires_at'))}
                        </td>
                      )}
                      <td>
                        <Activity active={record.is_active} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {catRecord && (
                            <button
                              className="button compact-sm secondary"
                              onClick={() => {
                                setFeedback('');
                                setSelectedCategoryId(catRecord.cat_id);
                              }}
                            >
                              <FolderOpen size={15} />
                              عرض المنتجات
                            </button>
                          )}
                          {prodRecord && !prodRecord.cat_id && (
                            <button
                              className="button compact-sm primary"
                              onClick={() =>
                                setMovingProduct({
                                  product: prodRecord,
                                  mode: 'link',
                                })
                              }
                            >
                              <Link2 size={15} />
                              ربط بتصنيف
                            </button>
                          )}
                          {addonRecord && (
                            <button
                              className="button compact-sm secondary"
                              onClick={() => setLinkingAddon(addonRecord)}
                            >
                              <Link2 size={15} />
                              ربط بمنتجات
                            </button>
                          )}
                          <button
                            className="button compact-sm secondary"
                            onClick={() => setEditing(record)}
                          >
                            تعديل
                          </button>
                          {prodRecord && (
                            <button
                              className="icon-button"
                              aria-label={'إضافات ' + prodRecord.prod_name}
                              title="إضافات المنتج"
                              onClick={() => setLinking(prodRecord)}
                            >
                              <SlidersHorizontal size={18} />
                            </button>
                          )}
                          {prodRecord && !prodRecord.cat_id && (
                            <button
                              className="button compact-sm danger-outline"
                              aria-label={'مسح ' + prodRecord.prod_name}
                              onClick={() => {
                                setConfirmError(null);
                                setConfirmState({
                                  kind: 'delete-product',
                                  product: prodRecord,
                                });
                              }}
                            >
                              <Trash2 size={15} />
                              مسح
                            </button>
                          )}
                          {addonRecord && addonLinkedCount === 0 && (
                            <button
                              className="button compact-sm danger-outline"
                              aria-label={'مسح ' + addonRecord.addon_name}
                              onClick={() => {
                                setConfirmError(null);
                                setConfirmState({
                                  kind: 'delete-addon',
                                  addon: addonRecord,
                                });
                              }}
                            >
                              <Trash2 size={15} />
                              مسح
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pager meta={resource.result?.meta} onPage={setPage} />

      <Presence>
        {editing && (
          <CatalogEditor
            kind={kind}
            record={editing === 'new' ? null : editing}
            allCategories={categories}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refreshAll();
            }}
            onRequestDeleteCategory={(cat) => {
              setEditing(null);
              setConfirmError(null);
              setConfirmState({ kind: 'delete-category', category: cat });
            }}
            onOpenCategoryDetails={(cat) => {
              setEditing(null);
              setSelectedCategoryId(cat.cat_id);
            }}
            onRequestUnlinkProduct={(product) => {
              setEditing(null);
              setConfirmError(null);
              setConfirmState({
                kind: 'unlink-product',
                product,
                categoryTitle: categories.find(
                  (c) => c.cat_id === product.cat_id,
                )?.cat_title,
              });
            }}
            onRequestDeleteProduct={(product) => {
              setEditing(null);
              setConfirmError(null);
              setConfirmState({ kind: 'delete-product', product });
            }}
            onRequestDeleteAddon={(addon) => {
              setEditing(null);
              setConfirmError(null);
              setConfirmState({ kind: 'delete-addon', addon });
            }}
            onOpenAddonLinks={(addon) => {
              setEditing(null);
              setLinkingAddon(addon);
            }}
          />
        )}
      </Presence>

      <Presence>
        {linking && (
          <AddonLinks
            product={linking}
            onClose={() => setLinking(null)}
            onChanged={() => refreshAll()}
          />
        )}
      </Presence>

      <Presence>
        {linkingAddon && (
          <AddonProductsDialog
            addon={linkingAddon}
            onClose={() => setLinkingAddon(null)}
            onChanged={() => refreshAll()}
          />
        )}
      </Presence>

      <Presence>
        {movingProduct && (
          <MoveProductDialog
            product={movingProduct.product}
            mode={movingProduct.mode}
            categories={categories}
            onClose={() => setMovingProduct(null)}
            onSaved={(targetTitle) => {
              const name = movingProduct.product.prod_name;
              const wasLink = movingProduct.mode === 'link';
              setMovingProduct(null);
              refreshAll(
                wasLink
                  ? `تم ربط «${name}» بتصنيف «${targetTitle}» وتفعيله تلقائياً.`
                  : `تم نقل «${name}» إلى تصنيف «${targetTitle}».`,
              );
            }}
          />
        )}
      </Presence>

      <Presence>
        {confirmState && confirmDialogProps && (
          <ConfirmActionDialog
            title={confirmDialogProps.title}
            body={confirmDialogProps.body}
            confirmLabel={confirmDialogProps.confirmLabel}
            confirmTone={confirmDialogProps.confirmTone}
            busy={confirmBusy}
            error={confirmError}
            onConfirm={executeConfirm}
            onClose={() => {
              if (!confirmBusy) {
                setConfirmState(null);
                setConfirmError(null);
              }
            }}
          />
        )}
      </Presence>
    </>
  );
}

function CategoryDetailsView({
  category,
  revision,
  feedback,
  onBack,
  onEdit,
  onRequestDelete,
  onRequestMove,
  onRequestUnlink,
}: {
  category: Category;
  revision: number;
  feedback: string;
  onBack: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onRequestMove: (product: Product) => void;
  onRequestUnlink: (product: Product) => void;
}) {
  const [page, setPage] = useState(1);
  const productsRes = useResource<Product[]>(
    '/restaurant/products' +
      query({ cat_id: category.cat_id, page, per_page: 20 }),
  );
  const { reload } = productsRes;
  const prevRevisionRef = useRef(revision);

  useEffect(() => {
    setPage(1);
  }, [category.cat_id]);

  useEffect(() => {
    if (revision !== prevRevisionRef.current) {
      prevRevisionRef.current = revision;
      reload();
    }
  }, [revision, reload]);

  useEffect(() => {
    const last = productsRes.result?.meta?.last_page;
    if (last && page > last) setPage(Math.max(1, last));
  }, [productsRes.result?.meta?.last_page, page]);

  const products = productsRes.result?.data ?? [];
  const totalCount =
    productsRes.result?.meta?.total ??
    products.length ??
    category.product_count ??
    0;
  const canDelete =
    !productsRes.loading && !productsRes.error && totalCount === 0;

  return (
    <>
      <div className="cat-details-bar">
        <div className="cat-details-head">
          <button type="button" className="cat-back-btn" onClick={onBack}>
            <ArrowRight size={16} />
            العودة إلى التصنيفات
          </button>
          <div className="cat-details-title">
            <h1>{category.cat_title}</h1>
            <span className="cat-order-pill">#{category.display_order}</span>
            <Activity active={category.is_active} />
            <span
              className={`cat-count-pill ${totalCount === 0 ? 'is-empty' : 'is-linked'}`}
            >
              {countArabic(totalCount, 'منتج', 'منتجين', 'منتجات')}
            </span>
          </div>
        </div>

        <div className="cat-details-actions">
          <button type="button" className="button secondary" onClick={onEdit}>
            تعديل التصنيف
          </button>
          <button
            type="button"
            className="button danger"
            disabled={!canDelete}
            title={
              totalCount > 0
                ? 'لا يمكن مسح التصنيف قبل نقل أو فك ربط جميع المنتجات بداخله'
                : 'مسح التصنيف نهائياً'
            }
            onClick={onRequestDelete}
          >
            <Trash2 size={17} />
            مسح التصنيف
          </button>
        </div>
      </div>

      <Notice>{feedback}</Notice>

      {!productsRes.loading && !productsRes.error && (
        <AlertBanner tone={totalCount > 0 ? 'warning' : 'success'}>
          {totalCount > 0
            ? `لا يمكن مسح هذا التصنيف طالما يحتوي على ${countArabic(totalCount, 'منتج', 'منتجين', 'منتجات')}. انقل كل منتج إلى تصنيف آخر أو فك ربطه (لينتقل لقائمة المنتجات غير المربوطة / غير المفعّلة) وعندها سيتفعل زر المسح مباشرةً.`
            : 'هذا التصنيف فارغ تماماً الآن ولا يحتوي على أي منتجات. يمكنك مسحه نهائياً بأمان، وسيُعاد ضبط ترتيب باقي التصنيفات تلقائياً.'}
        </AlertBanner>
      )}

      <div className="panel table-panel">
        {!productsRes.result && productsRes.loading ? (
          <TableSkeleton columns={5} rows={4} />
        ) : !productsRes.result && productsRes.error ? (
          <Failure error={productsRes.error} retry={productsRes.reload} />
        ) : !products.length ? (
          <Empty>لا توجد منتجات في هذا التصنيف حالياً.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الصورة</th>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.prod_id}>
                    <td>
                      <Picture
                        src={product.prod_image_url}
                        alt={product.prod_name}
                      />
                    </td>
                    <td>
                      <strong>{product.prod_name}</strong>
                      {product.prod_description && (
                        <small className="cell-subtitle">
                          {product.prod_description}
                        </small>
                      )}
                    </td>
                    <td>
                      <bdi>{money(product.price)}</bdi>
                    </td>
                    <td>
                      <Activity active={product.is_active} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button compact-sm secondary"
                          onClick={() => onRequestMove(product)}
                        >
                          <ArrowLeftRight size={15} />
                          نقل لتصنيف آخر
                        </button>
                        <button
                          type="button"
                          className="button compact-sm danger-outline"
                          onClick={() => onRequestUnlink(product)}
                        >
                          <Unlink size={15} />
                          فك الربط
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pager meta={productsRes.result?.meta} onPage={setPage} />
    </>
  );
}

function ConfirmActionDialog({
  title,
  body,
  confirmLabel,
  confirmTone,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  confirmTone: 'danger' | 'primary';
  busy: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title={title} onClose={onClose}>
      <Notice error={error} />
      <p className="cat-modal-copy">{body}</p>
      <div className="actions">
        <button
          type="button"
          className={`button ${confirmTone}`}
          disabled={busy}
          onClick={onConfirm}
        >
          <ButtonContent busy={busy} pending="جارٍ التنفيذ…">
            {confirmLabel}
          </ButtonContent>
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          إلغاء
        </button>
      </div>
    </Dialog>
  );
}

function MoveProductDialog({
  product,
  mode,
  categories,
  onClose,
  onSaved,
}: {
  product: Product;
  mode: 'move' | 'link';
  categories: Category[];
  onClose: () => void;
  onSaved: (targetCategoryTitle: string) => void;
}) {
  const choices =
    mode === 'move'
      ? categories.filter((c) => c.cat_id !== product.cat_id)
      : categories;
  const [targetId, setTargetId] = useState(choices[0]?.cat_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!targetId && choices[0]) setTargetId(choices[0].cat_id);
  }, [choices, targetId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetId) return;
    setBusy(true);
    setError(null);
    try {
      await api.request('/restaurant/products/' + product.prod_id, {
        method: 'PATCH',
        body: { cat_id: targetId },
      });
      const targetTitle =
        choices.find((c) => c.cat_id === targetId)?.cat_title ?? '';
      onSaved(targetTitle);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={mode === 'link' ? 'ربط المنتج بتصنيف' : 'نقل المنتج إلى تصنيف آخر'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Notice error={error} />
      <p className="cat-modal-copy">
        {mode === 'link' ? (
          <>
            اختر التصنيف الذي تريد ربط <strong>«{product.prod_name}»</strong>{' '}
            به. سيُفعَّل المنتج تلقائياً فور الربط ليظهر للعملاء.
          </>
        ) : (
          <>
            اختر التصنيف الجديد لنقل <strong>«{product.prod_name}»</strong> إليه
            مع الحفاظ على حالته وإضافاته.
          </>
        )}
      </p>
      {!choices.length ? (
        <AlertBanner tone="warning">
          {mode === 'move'
            ? 'لا توجد تصنيفات أخرى لنقل المنتج إليها. يمكنك إنشاء تصنيف جديد أولاً أو فك ربط المنتج.'
            : 'لا توجد تصنيفات متاحة حالياً. أضف تصنيفاً أولاً ثم اربط المنتج به.'}
        </AlertBanner>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <Select
              label="التصنيف المستهدف"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              {choices.map((c) => (
                <option key={c.cat_id} value={c.cat_id}>
                  #{c.display_order} — {c.cat_title}
                  {!c.is_active ? ' (متوقف)' : ''}
                </option>
              ))}
            </Select>
            <div className="actions">
              <button type="submit" className="button primary" disabled={busy}>
                <ButtonContent busy={busy} pending="جارٍ الحفظ…">
                  {mode === 'link' ? 'ربط وتفعيل المنتج' : 'نقل المنتج'}
                </ButtonContent>
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={onClose}
              >
                إلغاء
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </Dialog>
  );
}

const moneyPattern = '[0-9]{1,10}(\\.[0-9]{1,2})?';

export function CatalogEditor({
  kind,
  record,
  allCategories = [],
  onClose,
  onSaved,
  onRequestDeleteCategory,
  onOpenCategoryDetails,
  onRequestUnlinkProduct,
  onRequestDeleteProduct,
  onRequestDeleteAddon,
  onOpenAddonLinks,
}: {
  kind: CatalogKind;
  record: CatalogRecord | null;
  allCategories?: Category[];
  onClose: () => void;
  onSaved: () => void;
  onRequestDeleteCategory?: (category: Category) => void;
  onOpenCategoryDetails?: (category: Category) => void;
  onRequestUnlinkProduct?: (product: Product) => void;
  onRequestDeleteProduct?: (product: Product) => void;
  onRequestDeleteAddon?: (addon: Addon) => void;
  onOpenAddonLinks?: (addon: Addon) => void;
}) {
  const cfg = config[kind];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (record)
      Object.entries(record).forEach(([key, val]) => {
        if (Array.isArray(val)) return;
        seed[key] = val === null ? '' : String(val);
      });
    if (kind === 'offers' && record) {
      seed.starts_at = cairoLocal((record as Offer).starts_at);
      seed.expires_at = cairoLocal((record as Offer).expires_at);
    }
    return seed;
  });
  const [active, setActive] = useState(() => {
    if (record) return record.is_active;
    if (kind === 'addons' || kind === 'products') return false;
    return true;
  });
  const [file, setFile] = useState<File | null>(null);
  const initialId = record ? value(record, cfg.id) : '';
  const [savedId, setSavedId] = useState(initialId);
  const [loadedProduct, setLoadedProduct] = useState<Product | null>(null);
  const didMutate = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>(allCategories);
  const [loading, setLoading] = useState(kind === 'products');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');

  const handleClose = () => {
    if (busy) return;
    if (didMutate.current) onSaved();
    else onClose();
  };

  useEffect(() => {
    if (kind === 'categories') {
      setCategories(allCategories);
    }
  }, [kind, allCategories]);

  useEffect(() => {
    if (kind !== 'products') return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      allPages<Category>('/restaurant/categories', controller.signal),
      initialId
        ? api.request<Product>('/restaurant/products/' + initialId, {
            signal: controller.signal,
          })
        : Promise.resolve(null),
    ])
      .then(([rows, product]) => {
        if (!controller.signal.aborted) {
          setCategories(rows);
          if (product) {
            setLoadedProduct(product.data);
            setActive(product.data.is_active);
            setValues(
              Object.fromEntries(
                Object.entries(product.data).map(([k, v]) => [
                  k,
                  v === null ? '' : String(v),
                ]),
              ),
            );
          }
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [kind, initialId]);

  const set = (name: string, val: string) =>
    setValues((old) => ({ ...old, [name]: val }));
  const err = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;

  const isProductUnlinked = kind === 'products' && !values.cat_id;
  const editingCategory =
    kind === 'categories' && record ? (record as Category) : null;
  const editingProduct =
    kind === 'products'
      ? (loadedProduct ?? (record ? (record as Product) : null))
      : null;
  const editingAddon = kind === 'addons' && record ? (record as Addon) : null;
  const addonLinkedCount = editingAddon?.linked_product_ids?.length ?? 0;
  const isAddonUnlinked =
    kind === 'addons' && (!editingAddon || addonLinkedCount === 0);

  const sortedCategories = [
    ...(editingCategory &&
    !categories.some((c) => c.cat_id === editingCategory.cat_id)
      ? [editingCategory]
      : []),
    ...categories,
  ].sort((a, b) => a.display_order - b.display_order);
  const nextAutoOrder =
    sortedCategories.reduce(
      (max, c) => Math.max(max, Number(c.display_order) || 0),
      0,
    ) + 1;

  const input = (
    name: string,
    label: string,
    props: {
      type?: string;
      required?: boolean;
      pattern?: string;
      maxLength?: number;
      min?: number;
      max?: number;
      step?: number;
      hint?: string;
    } = {},
  ) => (
    <Field
      label={label}
      name={name}
      value={values[name] ?? ''}
      onChange={(e) => set(name, e.target.value)}
      error={err(name)}
      required
      maxLength={150}
      {...props}
    />
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const body: Record<string, unknown> = {
        [cfg.name]: values[cfg.name]?.trim(),
      };
      if (kind === 'categories') {
        body.is_active = active;
        if (savedId && values.display_order) {
          body.display_order = Number(values.display_order);
        }
      }
      if (kind === 'products') {
        const nextCatId = values.cat_id ? values.cat_id : null;
        Object.assign(body, {
          cat_id: nextCatId,
          prod_description: values.prod_description || null,
          price: values.price,
          is_active: nextCatId ? active : false,
        });
      }
      if (kind === 'addons') {
        body.addon_price = values.addon_price;
        if (savedId && !isAddonUnlinked) {
          body.is_active = active;
        }
      }
      if (kind === 'offers') {
        const start = cairoISO(values.starts_at);
        const end = cairoISO(values.expires_at);
        if (start >= end)
          throw new Error('نهاية العرض يجب أن تكون بعد بدايته.');
        const toCents = (v: string) => {
          const [a, b = ''] = v.split('.');
          return BigInt(a) * 100n + BigInt(b.padEnd(2, '0'));
        };
        if (toCents(values.real_price) > toCents(values.initial_price))
          throw new Error('سعر العرض لا يتجاوز السعر الأصلي.');
        Object.assign(body, {
          offer_description: values.offer_description || null,
          initial_price: values.initial_price,
          real_price: values.real_price,
          starts_at: start,
          expires_at: end,
          is_active: active,
        });
      }

      const response = await api.request<CatalogRecord>(
        '/restaurant/' + kind + (savedId ? '/' + savedId : ''),
        { method: savedId ? 'PATCH' : 'POST', body },
      );
      const id = value(response.data, cfg.id);
      setSavedId(id);
      didMutate.current = true;
      if (file) {
        setUploading(true);
        const data = new FormData();
        data.append('file', file);
        try {
          await api.request('/restaurant/' + kind + '/' + id + '/image', {
            method: 'PUT',
            body: data,
          });
        } catch (cause) {
          setNotice(
            'تم حفظ البيانات. لم تُرفع الصورة؛ يمكنك إعادة المحاولة دون إنشاء سجل جديد.',
          );
          throw cause;
        }
      }
      onSaved();
    } catch (cause) {
      setError(cause);
    } finally {
      setUploading(false);
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={(record ? 'تعديل ' : 'إضافة ') + cfg.singular}
      onClose={handleClose}
    >
      <Notice error={error} />
      <Notice>{notice}</Notice>
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              {input(cfg.name, 'اسم ال' + cfg.singular)}

              {kind === 'categories' && !editingCategory && (
                <div className="cat-order-info">
                  <span>الترتيب التلقائي في القائمة</span>
                  <strong>#{nextAutoOrder}</strong>
                </div>
              )}

              {kind === 'categories' && editingCategory && (
                <div className="cat-swap-field">
                  <Select
                    label="ترتيب العرض (تبديل مع تصنيف موجود)"
                    name="display_order"
                    value={
                      values.display_order ||
                      String(editingCategory.display_order)
                    }
                    onChange={(e) => set('display_order', e.target.value)}
                  >
                    {sortedCategories.map((c) => (
                      <option key={c.cat_id} value={String(c.display_order)}>
                        {c.display_order} — {c.cat_title}
                        {c.cat_id === editingCategory.cat_id ? ' (الحالي)' : ''}
                      </option>
                    ))}
                  </Select>
                  <small className="muted">
                    اختيار موضع تصنيف آخر يقوم بتبديل ترتيبهما مباشرةً دون تكرار.
                  </small>
                </div>
              )}

              {kind === 'products' && (
                <>
                  <Select
                    label="التصنيف"
                    name="cat_id"
                    value={values.cat_id ?? ''}
                    onChange={(e) => {
                      const prev = values.cat_id ?? '';
                      const next = e.target.value;
                      set('cat_id', next);
                      if (!next) {
                        setActive(false);
                      } else if (!prev && next) {
                        setActive(true);
                      }
                    }}
                  >
                    <option value="">بدون تصنيف (غير مربوط / غير مفعّل)</option>
                    {categories.map((c) => (
                      <option key={c.cat_id} value={c.cat_id}>
                        {c.cat_title}
                        {!c.is_active ? ' (متوقف)' : ''}
                      </option>
                    ))}
                  </Select>
                  <TextArea
                    label="الوصف"
                    name="prod_description"
                    value={values.prod_description ?? ''}
                    onChange={(v) => set('prod_description', v)}
                  />
                  {input('price', 'السعر بالجنيه المصري', {
                    pattern: moneyPattern,
                    maxLength: 13,
                  })}
                </>
              )}

              {kind === 'addons' &&
                input('addon_price', 'السعر بالجنيه المصري', {
                  pattern: moneyPattern,
                  maxLength: 13,
                })}

              {kind === 'offers' && (
                <>
                  <TextArea
                    label="الوصف"
                    name="offer_description"
                    value={values.offer_description ?? ''}
                    onChange={(v) => set('offer_description', v)}
                  />
                  {input('initial_price', 'السعر الأصلي (ج.م)', {
                    pattern: moneyPattern,
                    maxLength: 13,
                  })}
                  {input('real_price', 'سعر العرض (ج.م)', {
                    pattern: moneyPattern,
                    maxLength: 13,
                  })}
                  {input('starts_at', 'بداية العرض (القاهرة)', {
                    type: 'datetime-local',
                  })}
                  {input('expires_at', 'نهاية العرض (القاهرة)', {
                    type: 'datetime-local',
                  })}
                </>
              )}

              <div className="full">
                <Check
                  label={kind === 'products' ? 'متاح للطلب' : 'مفعّل'}
                  checked={
                    isProductUnlinked || isAddonUnlinked ? false : active
                  }
                  disabled={isProductUnlinked || isAddonUnlinked}
                  onChange={(e) => setActive(e.target.checked)}
                />
              </div>

              {isProductUnlinked && (
                <div className="full">
                  <AlertBanner tone="warning">
                    المنتج غير مربوط بتصنيف، لذلك يظل غير مفعّل تلقائياً ولا يظهر
                    للعملاء حتى يتم ربطه بتصنيف (وعند الربط يتفعّل تلقائياً).
                  </AlertBanner>
                </div>
              )}

              {isAddonUnlinked && (
                <div className="full">
                  <AlertBanner tone="info">
                    {editingAddon
                      ? 'هذه الإضافة غير مربوطة بأي منتج، لذلك تظل غير مفعّلة تلقائياً. اربطها بمنتج واحد على الأقل لتفعيلها تلقائياً.'
                      : 'تبدأ الإضافة الجديدة غير مفعّلة تلقائياً حتى يتم ربطها بمنتج واحد على الأقل، وعندها تُفعَّل تلقائياً.'}
                  </AlertBanner>
                </div>
              )}

              {(kind === 'products' || kind === 'offers') && (
                <ImagePicker
                  uploading={uploading}
                  src={
                    kind === 'products'
                      ? (editingProduct?.prod_image_url ?? null)
                      : record
                        ? value(record, 'offer_image_url')
                        : null
                  }
                  file={file}
                  onFile={setFile}
                />
              )}
            </div>

            <FieldErrors error={error} />

            <div className="actions">
              <button className="button primary" disabled={busy}>
                <ButtonContent busy={busy} pending="جارٍ الحفظ…">
                  {'حفظ ال' + cfg.singular}
                </ButtonContent>
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleClose}
                disabled={busy}
              >
                إلغاء
              </button>
            </div>

            {editingCategory && onRequestDeleteCategory && (
              <div className="cat-danger-zone">
                <div className="cat-danger-head">
                  <h3>مسح التصنيف</h3>
                  <div className="cat-danger-actions">
                    {(editingCategory.product_count ?? 0) > 0 &&
                      onOpenCategoryDetails && (
                        <button
                          type="button"
                          className="button compact-sm secondary"
                          onClick={() => onOpenCategoryDetails(editingCategory)}
                        >
                          <FolderOpen size={15} />
                          عرض منتجات التصنيف
                        </button>
                      )}
                    <button
                      type="button"
                      className="button compact-sm danger"
                      disabled={(editingCategory.product_count ?? 0) > 0}
                      onClick={() => onRequestDeleteCategory(editingCategory)}
                    >
                      <Trash2 size={15} />
                      مسح التصنيف
                    </button>
                  </div>
                </div>
                {(editingCategory.product_count ?? 0) > 0 ? (
                  <AlertBanner tone="warning">
                    لا يمكن مسح التصنيف لأنه يحتوي على{' '}
                    {countArabic(
                      editingCategory.product_count ?? 0,
                      'منتج',
                      'منتجين',
                      'منتجات',
                    )}
                    . افتح صفحة تفاصيل التصنيف لنقل المنتجات أو فك ربطها أولاً.
                  </AlertBanner>
                ) : (
                  <AlertBanner tone="success">
                    التصنيف فارغ ويمكن مسحه نهائياً الآن.
                  </AlertBanner>
                )}
              </div>
            )}

            {editingProduct && onRequestDeleteProduct && (
              <div className="cat-danger-zone">
                <div className="cat-danger-head">
                  <h3>فك الربط والمسح النهائي</h3>
                  <div className="cat-danger-actions">
                    {editingProduct.cat_id && onRequestUnlinkProduct && (
                      <button
                        type="button"
                        className="button compact-sm secondary"
                        onClick={() => onRequestUnlinkProduct(editingProduct)}
                      >
                        <Unlink size={15} />
                        فك الربط من التصنيف
                      </button>
                    )}
                    <button
                      type="button"
                      className="button compact-sm danger"
                      disabled={Boolean(editingProduct.cat_id)}
                      onClick={() => onRequestDeleteProduct(editingProduct)}
                    >
                      <Trash2 size={15} />
                      مسح المنتج نهائياً
                    </button>
                  </div>
                </div>
                {editingProduct.cat_id ? (
                  <AlertBanner tone="warning">
                    لا يمكن مسح منتج مربوط بتصنيف. فك ربطه أولاً (ليتحول لقائمة
                    غير المربوطة / غير المفعّلة) ثم امسحه نهائياً.
                  </AlertBanner>
                ) : (
                  <AlertBanner tone="success">
                    المنتج غير مربوط حالياً ويمكن مسحه نهائياً مع الحفاظ على سجل
                    الطلبات السابقة.
                  </AlertBanner>
                )}
              </div>
            )}

            {editingAddon && onRequestDeleteAddon && (
              <div className="cat-danger-zone">
                <div className="cat-danger-head">
                  <h3>مسح الإضافة</h3>
                  <div className="cat-danger-actions">
                    {addonLinkedCount > 0 && onOpenAddonLinks && (
                      <button
                        type="button"
                        className="button compact-sm secondary"
                        onClick={() => onOpenAddonLinks(editingAddon)}
                      >
                        <Link2 size={15} />
                        إدارة ربط المنتجات
                      </button>
                    )}
                    <button
                      type="button"
                      className="button compact-sm danger"
                      disabled={addonLinkedCount > 0}
                      onClick={() => onRequestDeleteAddon(editingAddon)}
                    >
                      <Trash2 size={15} />
                      مسح الإضافة نهائياً
                    </button>
                  </div>
                </div>
                {addonLinkedCount > 0 ? (
                  <AlertBanner tone="warning">
                    لا يمكن مسح الإضافة لأنها مربوطة حالياً بـ{' '}
                    {countArabic(addonLinkedCount, 'منتج', 'منتجين', 'منتجات')}.
                    فك ربطها من جميع المنتجات أولاً ثم امسحها نهائياً.
                  </AlertBanner>
                ) : (
                  <AlertBanner tone="success">
                    الإضافة غير مربوطة بأي منتج حالياً ويمكن مسحها نهائياً مع
                    الحفاظ على سجل الطلبات السابقة.
                  </AlertBanner>
                )}
              </div>
            )}
          </fieldset>
        </form>
      )}
    </Dialog>
  );
}

export function ImagePicker({
  src,
  file,
  onFile,
  uploading = false,
}: {
  src: string | null;
  file: File | null;
  onFile: (file: File | null) => void;
  uploading?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="image-picker full">
      <Picture src={preview || src} alt="معاينة الصورة" />
      <div>
        <h3>الصورة</h3>
        {uploading && (
          <div role="status">
            <progress aria-label="جارٍ رفع الصورة" /> جارٍ رفع الصورة…
          </div>
        )}
        <p>JPEG، PNG أو WebP — حتى 5MB</p>
        <label className="button secondary upload-label">
          <Upload size={17} />
          اختيار صورة
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(
                  selected.type,
                ) ||
                selected.size > 5 * 1024 * 1024
              ) {
                setError('اختر صورة JPEG أو PNG أو WebP لا تتجاوز 5MB.');
                event.target.value = '';
                return;
              }
              setError('');
              onFile(selected);
            }}
          />
        </label>
        {file && <small>{file.name} · تُرفع بعد حفظ البيانات.</small>}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function AddonLinks({
  product,
  onClose,
  onChanged,
}: {
  product: Product;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [links, setLinks] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading((prev) => (addons.length === 0 ? true : prev));
    setError(null);
    Promise.all([
      allPages<Addon>('/restaurant/addons', controller.signal),
      api.request<ProductAddon[]>(
        '/restaurant/products/' + product.prod_id + '/addons',
        { signal: controller.signal },
      ),
    ])
      .then(([rows, response]) => {
        if (!controller.signal.aborted) {
          setAddons(rows);
          setLinks(response.data);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [product.prod_id, revision]);

  async function toggle(addon: Addon, active: boolean) {
    if (busy) return;
    const prevLinks = links;
    setLinks((current) => {
      const exists = current.some((l) => l.addon_id === addon.addon_id);
      if (exists) {
        return current.map((l) =>
          l.addon_id === addon.addon_id ? { ...l, is_active: active } : l,
        );
      }
      return [
        ...current,
        {
          prod_id: product.prod_id,
          addon_id: addon.addon_id,
          is_active: active,
          addon,
        },
      ];
    });
    setBusy(true);
    setError(null);
    try {
      const response = await api.request<ProductAddon>(
        '/restaurant/products/' + product.prod_id + '/addons/' + addon.addon_id,
        { method: 'PUT', body: { is_active: active } },
      );
      setAddons((current) =>
        current.map((a) =>
          a.addon_id === addon.addon_id
            ? { ...a, is_active: response.data.addon.is_active }
            : a,
        ),
      );
      onChanged?.();
    } catch (cause) {
      setLinks(prevLinks);
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={'إضافات ' + product.prod_name}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Notice error={error} />
      <AlertBanner tone="info">
        ربط إضافة غير مفعّلة بأول منتج يُفعّلها تلقائياً، وفك ربطها من آخر منتج
        يُوقفها تلقائياً وينقلها لقائمة الإضافات غير المربوطة.
      </AlertBanner>
      {loading ? (
        <Loading />
      ) : error && !addons.length ? null : !addons.length ? (
        <Empty>أضف إضافات إلى القائمة أولًا.</Empty>
      ) : (
        <div className="link-list">
          {addons.map((addon) => (
            <div key={addon.addon_id}>
              <Check
                label={addon.addon_name + (!addon.is_active ? ' (متوقفة)' : '')}
                checked={links.some(
                  (link) => link.addon_id === addon.addon_id && link.is_active,
                )}
                disabled={busy}
                onChange={(e) => toggle(addon, e.target.checked)}
              />
              <bdi>{money(addon.addon_price)}</bdi>
            </div>
          ))}
        </div>
      )}
      <button
        className="text-button"
        disabled={busy || loading}
        onClick={() => setRevision((n) => n + 1)}
      >
        تحديث الإضافات
      </button>
    </Dialog>
  );
}

function AddonProductsDialog({
  addon,
  onClose,
  onChanged,
}: {
  addon: Addon;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>(
    addon.linked_product_ids ?? [],
  );
  const [isActive, setIsActive] = useState<boolean>(addon.is_active);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      allPages<Product>('/restaurant/products', controller.signal),
      allPages<Category>('/restaurant/categories', controller.signal),
      allPages<Addon>('/restaurant/addons', controller.signal),
    ])
      .then(([prodRows, catRows, addonRows]) => {
        if (controller.signal.aborted) return;
        setProducts(prodRows);
        setCategories(catRows);
        const latest = addonRows.find((a) => a.addon_id === addon.addon_id);
        if (latest) {
          setLinkedIds(latest.linked_product_ids ?? []);
          setIsActive(latest.is_active);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [addon.addon_id]);

  async function toggleProduct(product: Product, checked: boolean) {
    if (busy) return;
    const previousLinked = linkedIds;
    const previousActive = isActive;
    const optimisticLinked = checked
      ? [...new Set([...linkedIds, product.prod_id])]
      : linkedIds.filter((id) => id !== product.prod_id);
    setLinkedIds(optimisticLinked);
    if (previousLinked.length === 0 && optimisticLinked.length > 0) {
      setIsActive(true);
    } else if (optimisticLinked.length === 0) {
      setIsActive(false);
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.request<ProductAddon>(
        '/restaurant/products/' + product.prod_id + '/addons/' + addon.addon_id,
        { method: 'PUT', body: { is_active: checked } },
      );
      const nextLinked =
        response.data.addon.linked_product_ids ?? optimisticLinked;
      setLinkedIds(nextLinked);
      setIsActive(response.data.addon.is_active);
      onChanged();
    } catch (cause) {
      setLinkedIds(previousLinked);
      setIsActive(previousActive);
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={'ربط الإضافة: ' + addon.addon_name}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Notice error={error} />
      {!loading &&
        !error &&
        (linkedIds.length === 0 ? (
          <AlertBanner tone="warning">
            هذه الإضافة غير مربوطة بأي منتج حالياً (غير مفعّلة). اختر منتجاً واحداً
            على الأقل لتفعيلها تلقائياً.
          </AlertBanner>
        ) : linkedIds.length === 1 ? (
          <AlertBanner tone="info">
            مربوطة بمنتج واحد فقط ({isActive ? 'مفعّلة' : 'متوقفة'}). فك ربط هذا
            المنتج سيُوقف الإضافة تلقائياً وينقلها لقائمة غير المربوطة.
          </AlertBanner>
        ) : (
          <AlertBanner tone="success">
            مربوطة حالياً بـ{' '}
            {countArabic(linkedIds.length, 'منتج', 'منتجين', 'منتجات')} (
            {isActive ? 'مفعّلة' : 'متوقفة'}).
          </AlertBanner>
        ))}
      {loading ? (
        <Loading />
      ) : error && !products.length ? null : !products.length ? (
        <Empty>أضف منتجات إلى القائمة أولاً للتمكن من ربط الإضافات بها.</Empty>
      ) : (
        <div>
          {products.map((product) => {
            const catTitle = product.cat_id
              ? categories.find((c) => c.cat_id === product.cat_id)?.cat_title
              : null;
            const checked = linkedIds.includes(product.prod_id);
            return (
              <div key={product.prod_id} className="cat-link-row">
                <div>
                  <Check
                    label={product.prod_name}
                    checked={checked}
                    disabled={busy}
                    onChange={(e) => toggleProduct(product, e.target.checked)}
                  />
                  <span className="cat-link-meta">
                    {catTitle ?? 'منتج غير مربوط بتصنيف'}
                  </span>
                </div>
                <bdi>{money(product.price)}</bdi>
              </div>
            );
          })}
        </div>
      )}
      <div className="actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onClose}
        >
          تم
        </button>
      </div>
    </Dialog>
  );
}
