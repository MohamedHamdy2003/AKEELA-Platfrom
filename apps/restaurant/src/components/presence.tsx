import {
  createContext,
  Fragment,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

const ExitContext = createContext(false);
export const useExiting = () => useContext(ExitContext);

// Retain only the outgoing presentation. Owners clear their state immediately;
// closed dialogs release focus and pointer access before this visual tail ends.
export function Presence({
  children,
  duration = '--motion-dialog',
}: {
  children: ReactNode;
  duration?: '--motion-dialog' | '--motion-feedback';
}) {
  const present = Boolean(children);
  const [retained, setRetained] = useState(children);
  const [appearance, setAppearance] = useState({ present, generation: 0 });
  if (present !== appearance.present) {
    setAppearance({
      present,
      generation: appearance.generation + (present ? 1 : 0),
    });
  }
  useLayoutEffect(() => {
    if (present) {
      setRetained(children);
      return;
    }
    const value = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(duration),
    );
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : Number.isFinite(value)
        ? value
        : 240;
    const timer = window.setTimeout(() => setRetained(null), delay);
    return () => window.clearTimeout(timer);
  }, [children, present, duration]);
  return (
    <ExitContext.Provider value={!present}>
      <div
        className="motion-presence"
        inert={!present}
        aria-hidden={!present ? true : undefined}
        data-exiting={!present ? true : undefined}
      >
        <Fragment key={appearance.generation}>
          {present ? children : retained}
        </Fragment>
      </div>
    </ExitContext.Provider>
  );
}
