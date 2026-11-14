import { useCallback, useEffect, useRef, useState } from 'react';

export function useDeviceLocation(enabled: boolean) {
  const [coordinates, setCoordinates] = useState({
    longitude: '',
    latitude: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setMessage(
        'تحديد الموقع غير متاح في هذا المتصفح. أدخل الإحداثيات يدويًا.',
      );
      return;
    }
    let active = true;
    const subscription: { id?: number } = {};
    let bestAccuracy = Infinity;
    const stop = () => {
      active = false;
      if (subscription.id !== undefined)
        navigator.geolocation.clearWatch(subscription.id);
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(() => {
      stop();
      setLocating(false);
      if (!Number.isFinite(bestAccuracy)) {
        setMessage('تعذّر تحديد الموقع. أعد المحاولة أو أدخل الإحداثيات يدويًا.');
      }
    }, 25000);
    cancel.current = stop;
    setLocating(true);
    setMessage('جارٍ تحديد موقع الجهاز وتحسين دقته…');
    subscription.id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (
          !active ||
          !Number.isFinite(coords.accuracy) ||
          coords.accuracy < 0 ||
          !Number.isFinite(coords.longitude) ||
          Math.abs(coords.longitude) > 180 ||
          !Number.isFinite(coords.latitude) ||
          Math.abs(coords.latitude) > 90 ||
          coords.accuracy >= bestAccuracy
        )
          return;
        bestAccuracy = coords.accuracy;
        setCoordinates({
          longitude: coords.longitude.toFixed(7),
          latitude: coords.latitude.toFixed(7),
        });
        setMessage(
          `دقة الموقع التقديرية: نحو ${Math.max(1, Math.ceil(coords.accuracy))} متر. قد يكون تقدير اللابتوب بعيدًا؛ راجع النقطة على الخريطة وعدّلها لتطابق المطعم.`,
        );
        // Acquisition heuristic only; this does not restrict registration.
        if (coords.accuracy <= 50) {
          stop();
          setLocating(false);
        }
      },
      (failure) => {
        if (!active) return;
        stop();
        setLocating(false);
        if (Number.isFinite(bestAccuracy)) return;
        setMessage(
          failure.code === 1
            ? 'إذن الموقع غير متاح. اسمح به من المتصفح أو أدخل الإحداثيات يدويًا.'
            : 'تعذّر تحديد الموقع. أعد المحاولة أو أدخل الإحداثيات يدويًا.',
        );
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
    if (!active) navigator.geolocation.clearWatch(subscription.id);
    return stop;
  }, [enabled, attempt]);

  function editCoordinate(name: 'longitude' | 'latitude', value: string) {
    cancel.current();
    setLocating(false);
    setCoordinates((old) => ({ ...old, [name]: value }));
    setMessage(
      'تم تعديل الإحداثيات يدويًا. راجع النقطة على الخريطة لتطابق موقع المطعم.',
    );
  }
  const chooseCoordinates = useCallback(
    (point: { latitude: string; longitude: string }) => {
      cancel.current();
      setLocating(false);
      setCoordinates(point);
      setMessage(
        'تم استخدام نقطة المطعم التي اخترتها من الخريطة. التحديد التلقائي متوقف حتى تضغط تحديث الموقع.',
      );
    },
    [],
  );
  const longitude = Number(coordinates.longitude);
  const latitude = Number(coordinates.latitude);
  const mapUrl =
    coordinates.longitude.trim() &&
    coordinates.latitude.trim() &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180 &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90
      ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
      : undefined;
  return {
    coordinates,
    locating,
    message,
    mapUrl,
    editCoordinate,
    chooseCoordinates,
    retry: () => setAttempt((n) => n + 1),
  };
}
