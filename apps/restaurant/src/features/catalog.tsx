import { useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, SlidersHorizontal, Upload } from 'lucide-react';
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

const config = {
  categories: {
    title: 'التصنيفات',
    singular: 'تصنيف',
    name: 'cat_title',
    id: 'cat_id',
    subtitle: 'رتّب قائمتك، واجعل الاختيار أبسط.',
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
function value(record: CatalogRecord, key: string): string {
  return String((record as unknown as Record<string, unknown>)[key] ?? '');
}
export async function allPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let response: Envelope<T[]>;
  do {
    response = await api.request<T[]>(path + query({ page, per_page: 100 }));
    items.push(...response.data);
    page++;
  } while (response.meta && page <= response.meta.last_page);
  return items;
}
export function Catalog({ kind }: { kind: CatalogKind }) {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [pickerError, setPickerError] = useState<unknown>(null);
  const [editing, setEditing] = useState<CatalogRecord | 'new' | null>(null);
  const [linking, setLinking] = useState<Product | null>(null);
  const resource = useResource<CatalogRecord[]>(
    '/restaurant/' +
      kind +
      query({
        page,
        per_page: 20,
        cat_id: kind === 'products' ? category : undefined,
      }),
  );
  const cfg = config[kind];
  useEffect(() => {
    if (kind !== 'products') return;
    let current = true;
    allPages<Category>('/restaurant/categories')
      .then((rows) => {
        if (current) setCategories(rows);
      })
      .catch((cause) => {
        if (current) setPickerError(cause);
      });
    return () => {
      current = false;
    };
  }, [kind]);
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
      <div className="list-toolbar">
        {kind === 'products' && (
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
        <button className="button secondary" onClick={resource.reload}>
          <RefreshCw
            size={17}
            className={resource.loading ? 'spin' : undefined}
          />
          تحديث
        </button>
      </div>
      <Notice error={pickerError} />
      <div className="panel table-panel">
        {resource.loading ? (
          <TableSkeleton columns={kind === 'offers' ? 6 : 5} />
        ) : resource.error ? (
          <Failure error={resource.error} retry={resource.reload} />
        ) : !resource.result?.data.length ? (
          <Empty>لم تُضف أي {cfg.title} بعد.</Empty>
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
                  <th>{kind === 'categories' ? 'ترتيب العرض' : 'السعر'}</th>
                  {kind === 'offers' && <th>فترة العرض</th>}
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {resource.result.data.map((record, index) => (
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
                      ) : (
                        String((page - 1) * 20 + index + 1).padStart(2, '0')
                      )}
                    </td>
                    <td>
                      <strong>{value(record, cfg.name)}</strong>
                      {kind === 'products' && (
                        <small className="cell-subtitle">
                          {
                            categories.find(
                              (c) => c.cat_id === value(record, 'cat_id'),
                            )?.cat_title
                          }
                        </small>
                      )}
                    </td>
                    <td>
                      {kind === 'categories' ? (
                        value(record, 'display_order')
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
                        <button
                          className="button compact secondary"
                          onClick={() => setEditing(record)}
                        >
                          تعديل
                        </button>
                        {kind === 'products' && (
                          <button
                            className="icon-button"
                            aria-label={'إضافات ' + value(record, cfg.name)}
                            onClick={() => setLinking(record as Product)}
                          >
                            <SlidersHorizontal size={19} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              resource.reload();
            }}
          />
        )}
      </Presence>
      <Presence>
        {linking && (
          <AddonLinks product={linking} onClose={() => setLinking(null)} />
        )}
      </Presence>
    </>
  );
}
const moneyPattern = '[0-9]{1,10}(\\.[0-9]{1,2})?';
export function CatalogEditor({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: CatalogKind;
  record: CatalogRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const cfg = config[kind];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (record)
      Object.entries(record).forEach(([key, val]) => {
        seed[key] = val === null ? '' : String(val);
      });
    if (kind === 'offers' && record) {
      seed.starts_at = cairoLocal((record as Offer).starts_at);
      seed.expires_at = cairoLocal((record as Offer).expires_at);
    }
    return seed;
  });
  const [active, setActive] = useState(record?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [savedId, setSavedId] = useState(record ? value(record, cfg.id) : '');
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(kind === 'products');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [retryLoad, setRetryLoad] = useState(0);
  useEffect(() => {
    if (kind !== 'products') return;
    let current = true;
    setLoading(true);
    Promise.all([
      allPages<Category>('/restaurant/categories'),
      record && !savedId
        ? Promise.resolve(null)
        : savedId
          ? api.request<Product>('/restaurant/products/' + savedId)
          : Promise.resolve(null),
    ])
      .then(([rows, product]) => {
        if (current) {
          setCategories(rows);
          if (product) {
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
        if (current) setError(cause);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [kind, retryLoad]);
  const set = (name: string, val: string) =>
    setValues((old) => ({ ...old, [name]: val }));
  const err = (name: string) =>
    error instanceof ApiError ? error.fields[name]?.join(' ') : undefined;
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
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const body: Record<string, unknown> = {
        [cfg.name]: values[cfg.name]?.trim(),
        is_active: active,
      };
      if (kind === 'categories')
        body.display_order = Number(values.display_order || 0);
      if (kind === 'products')
        Object.assign(body, {
          cat_id: values.cat_id,
          prod_description: values.prod_description || null,
          price: values.price,
        });
      if (kind === 'addons') body.addon_price = values.addon_price;
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
        });
      }
      const response = await api.request<CatalogRecord>(
        '/restaurant/' + kind + (savedId ? '/' + savedId : ''),
        { method: savedId ? 'PATCH' : 'POST', body },
      );
      const id = value(response.data, cfg.id);
      setSavedId(id);
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
      onClose={() => {
        if (!busy) onClose();
      }}
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
              {kind === 'categories' &&
                input('display_order', 'ترتيب العرض', {
                  type: 'number',
                  min: 0,
                  max: 2147483647,
                  step: 1,
                  required: false,
                })}
              {kind === 'products' && (
                <>
                  <Select
                    label="التصنيف"
                    name="cat_id"
                    value={values.cat_id ?? ''}
                    onChange={(e) => set('cat_id', e.target.value)}
                    required
                  >
                    <option value="">اختر تصنيفًا</option>
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
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
              </div>
              {(kind === 'products' || kind === 'offers') && (
                <ImagePicker
                  uploading={uploading}
                  src={
                    record
                      ? value(
                          record,
                          kind === 'products'
                            ? 'prod_image_url'
                            : 'offer_image_url',
                        )
                      : null
                  }
                  file={file}
                  onFile={setFile}
                />
              )}
            </div>
            <FieldErrors error={error} />
            {kind === 'products' && !categories.length && (
              <>
                <Notice
                  error={new Error('أضف تصنيفًا أولًا، أو أعد تحميل التصنيفات.')}
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRetryLoad((n) => n + 1)}
                >
                  إعادة تحميل التصنيفات
                </button>
              </>
            )}
            <div className="actions">
              <button
                className="button primary"
                disabled={busy || (kind === 'products' && !categories.length)}
              >
                <ButtonContent busy={busy} pending="جارٍ الحفظ…">
                  {'حفظ ال' + cfg.singular}
                </ButtonContent>
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
                disabled={busy}
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
}: {
  product: Product;
  onClose: () => void;
}) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [links, setLinks] = useState<ProductAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      allPages<Addon>('/restaurant/addons'),
      api.request<ProductAddon[]>(
        '/restaurant/products/' + product.prod_id + '/addons',
      ),
    ])
      .then(([rows, response]) => {
        if (current) {
          setAddons(rows);
          setLinks(response.data);
        }
      })
      .catch((cause) => {
        if (current) setError(cause);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [product.prod_id, revision]);
  async function toggle(addon: Addon, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.request(
        '/restaurant/products/' + product.prod_id + '/addons/' + addon.addon_id,
        { method: 'PUT', body: { is_active: active } },
      );
      setRevision((n) => n + 1);
    } catch (cause) {
      setError(cause);
      setRevision((n) => n + 1);
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
      {loading ? (
        <Loading />
      ) : !addons.length ? (
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
