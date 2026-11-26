import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import './detail-workspace.css';

/** Shared list + left detail pane. Retain the selected record until exit finishes. */
export function DetailWorkspace({
  selectedKey,
  title,
  titleBadge,
  onClose,
  children,
  details,
  eyebrow,
}: {
  selectedKey: string | null;
  title: string;
  titleBadge?: string;
  onClose: () => void;
  children: ReactNode;
  details: ReactNode;
  eyebrow?: string;
}) {
  const titleId = useId();
  const pane = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);

  useLayoutEffect(() => {
    setClosing(false);
    if (selectedKey) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !pane.current?.contains(active))
        trigger.current = active;
      closeButton.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1080px)').matches) {
        pane.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [selectedKey]);

  const close = () => {
    if (timer.current || !selectedKey) return;
    setClosing(true);
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    timer.current = setTimeout(
      () => {
        timer.current = null;
        onClose();
        // Wait for the pane to leave the layout before revealing its original row.
        requestAnimationFrame(() => {
          const target = trigger.current?.isConnected
            ? trigger.current
            : workspace.current?.querySelector<HTMLButtonElement>(
                `button[data-detail-record="${CSS.escape(selectedKey)}"]`,
              );
          target?.focus();
        });
      },
      reduced ? 0 : 280,
    );
  };

  const closeRef = useRef<() => void>(() => undefined);
  closeRef.current = close;

  useEffect(() => {
    if (!selectedKey) return;
    const escape = (event: KeyboardEvent) => {
      // Verification and action confirmations own Escape while a native modal is open.
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.querySelector('dialog[open]')
      )
        return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [selectedKey]);

  return (
    <div
      ref={workspace}
      className="admin-detail-workspace"
      data-open={!!selectedKey && !closing}
    >
      <section className="admin-detail-list">{children}</section>
      <div className="admin-detail-slot">
        {selectedKey && (
          <aside
            ref={pane}
            className="detail-panel admin-detail-sheet"
            data-closing={closing}
            inert={closing}
            aria-labelledby={titleId}
          >
            <header className="detail-head">
              <div className="detail-head-main">
                {eyebrow && (
                  <span className="admin-detail-eyebrow">{eyebrow}</span>
                )}
                <div className="detail-head-title-row">
                  <h2 id={titleId}>{title}</h2>
                  {titleBadge && (
                    <span className="detail-head-id">
                      <bdi>{titleBadge}</bdi>
                    </span>
                  )}
                </div>
              </div>
              <button
                ref={closeButton}
                type="button"
                className="admin-detail-close"
                aria-label={`إغلاق ${title}`}
                onClick={close}
                disabled={closing}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="admin-detail-content">{details}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
