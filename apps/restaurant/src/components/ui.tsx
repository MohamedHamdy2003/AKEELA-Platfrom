import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  ImageOff,
  Inbox,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { ApiError, errorMessage } from '../lib/api';
import type { Meta, OrderStatus } from '../lib/models';
import { statuses } from '../lib/models';
import { Presence, useExiting } from './presence';

export function Notice({
  error,
  children,
}: {
  error?: unknown;
  children?: ReactNode;
}) {
  return (
    <Presence duration="--motion-feedback">
      {error || children ? (
        <NoticeContent error={error}>{children}</NoticeContent>
      ) : null}
    </Presence>
  );
}
function NoticeContent({
  error,
  children,
}: {
  error?: unknown;
  children?: ReactNode;
}) {
  const exiting = useExiting();
  return (
    <div
      className={error ? 'notice error' : 'notice success'}
      data-exiting={exiting ? true : undefined}
      role={error ? 'alert' : 'status'}
    >
      {children || errorMessage(error)}
    </div>
  );
}
export function Field({
  label,
  error,
  hint,
  inputAction,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  inputAction?: ReactNode;
}) {
  const id = useId();
  const input = (
    <input
      id={id}
      {...props}
      aria-labelledby={id + '-label'}
      aria-invalid={!!error}
      aria-describedby={error || hint ? id + '-hint' : undefined}
    />
  );
  return (
    <div className="field">
      <label id={id + '-label'} htmlFor={id}>
        {label}
      </label>
      {inputAction ? (
        <div className="field-control">
          {input}
          {inputAction}
        </div>
      ) : (
        input
      )}
      {(error || hint) && (
        <small id={id + '-hint'} className={error ? 'field-error' : ''}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span id={id + '-label'}>{label}</span>
      <select id={id} {...props} aria-labelledby={id + '-label'}>
        {children}
      </select>
    </label>
  );
}
export function Check({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function TextArea({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field full">
      <span>{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={10000}
        rows={4}
        disabled={disabled}
      />
    </label>
  );
}
export function FieldErrors({ error }: { error: unknown }) {
  if (!(error instanceof ApiError) || !Object.keys(error.fields).length)
    return null;
  return (
    <ul className="field-errors">
      {Object.entries(error.fields).map(([field, values]) => (
        <li key={field}>
          <bdi>{field}</bdi>: {values.join(' ')}
        </li>
      ))}
    </ul>
  );
}
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={30} />
      <p>جارٍ التحميل…</p>
    </div>
  );
}
export function ButtonContent({
  busy,
  children,
  pending = 'جارٍ التنفيذ…',
}: {
  busy: boolean;
  children: ReactNode;
  pending?: string;
}) {
  return (
    <span className="button-content" aria-live="polite" aria-atomic="true">
      <span className="button-rest" aria-hidden={busy ? true : undefined}>
        {children}
      </span>
      {busy && (
        <span className="button-progress">
          <LoaderCircle size={19} className="spin" aria-hidden="true" />
          <span className="sr-only">{pending}</span>
        </span>
      )}
    </span>
  );
}
export function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="table-scroll table-skeleton"
      role="status"
      aria-label="جارٍ تحميل البيانات"
      aria-busy="true"
    >
      <table aria-hidden="true">
        <thead>
          <tr>
            {Array.from({ length: columns }, (_, column) => (
              <th key={column}>
                <span className="skeleton-line" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <td key={column}>
                  <span className="skeleton-line" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Empty({
  children = 'لا توجد نتائج بعد.',
}: {
  children?: ReactNode;
}) {
  return (
    <div className="state">
      <Inbox size={38} strokeWidth={1.4} />
      <h3>{children}</h3>
      <p>ستظهر البيانات هنا عندما تصبح متاحة.</p>
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="state">
      <Notice error={error} />
      <button className="button secondary" onClick={retry}>
        <RefreshCw size={18} />
        إعادة المحاولة
      </button>
    </div>
  );
}
export function Badge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-label" key={status}>
        {statuses[status] ?? status}
      </span>
    </span>
  );
}
export function Activity({ active }: { active: boolean }) {
  return (
    <span className={'activity ' + (active ? 'active' : '')}>
      <span />
      {active ? 'مفعّل' : 'متوقف'}
    </span>
  );
}
export function Picture({
  src,
  alt,
  className = '',
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt={alt}
      className={'picture ' + className}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      role="img"
      aria-label="لا توجد صورة"
      className={'picture fallback ' + className}
    >
      <ImageOff size={24} strokeWidth={1.4} />
    </span>
  );
}
export function Pager({
  meta,
  onPage,
}: {
  meta?: Meta;
  onPage: (page: number) => void;
}) {
  if (!meta) return null;
  return (
    <div className="pager">
      <span>
        الصفحة {meta.page} من {meta.last_page} · {meta.total} نتيجة
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="الصفحة السابقة"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ArrowRight size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="الصفحة التالية"
          disabled={meta.page >= meta.last_page}
          onClick={() => onPage(meta.page + 1)}
        >
          <ArrowLeft size={18} />
        </button>
      </div>
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const exiting = useExiting();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    if (exiting) dialog.close();
    else if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, [exiting]);
  return (
    <>
      {exiting && <div className="dialog-exit-backdrop" aria-hidden="true" />}
      <dialog
        ref={ref}
        className={drawer ? 'dialog drawer' : 'dialog'}
        data-exiting={exiting ? true : undefined}
        aria-labelledby={id}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              onClose();
          }
        }}
      >
        <header className="dialog-heading">
          <h2 id={id}>{title}</h2>
          <button className="icon-button" aria-label="إغلاق" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </dialog>
    </>
  );
}
export function Saved() {
  return (
    <span className="saved">
      <CircleCheck size={18} />
      تم حفظ التغييرات
    </span>
  );
}
