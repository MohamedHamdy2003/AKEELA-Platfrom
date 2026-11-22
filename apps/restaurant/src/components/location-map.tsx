import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Coordinates = { latitude: string; longitude: string };
const tileUrl =
  import.meta.env.VITE_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function LocationMap({
  coordinates,
  onChoose,
  editable = true,
}: {
  coordinates: Coordinates;
  onChoose: (point: Coordinates) => void;
  editable?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const editableRef = useRef(editable);
  const onChooseRef = useRef(onChoose);
  editableRef.current = editable;
  onChooseRef.current = onChoose;
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      scrollWheelZoom: false,
      worldCopyJump: true,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([20, 0], 2);
    mapRef.current = map;
    const tiles = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);
    tilesRef.current = tiles;
    tiles.on('tileerror', () => setTileError(true));
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!editableRef.current) return;
      const point = event.latlng.wrap();
      onChooseRef.current({
        latitude: Math.max(-90, Math.min(90, point.lat)).toFixed(7),
        longitude: point.lng.toFixed(7),
      });
    });
    const observer = new ResizeObserver(() =>
      map.invalidateSize({ pan: false }),
    );
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (editable) marker.dragging?.enable();
    else marker.dragging?.disable();
    const element = marker.getElement();
    if (element) {
      element.title = editable
        ? 'موقع المطعم — اسحب الدبوس أو حرّكه بمفاتيح الأسهم'
        : 'موقع المطعم المحفوظ';
      element.tabIndex = editable ? 0 : -1;
    }
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (
      !coordinates.latitude.trim() ||
      !coordinates.longitude.trim() ||
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180
    ) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const point = L.latLng(latitude, longitude);
    const hadMarker = Boolean(markerRef.current);
    if (!markerRef.current) {
      const marker = L.marker(point, {
        draggable: editableRef.current,
        keyboard: editableRef.current,
        title: editableRef.current
          ? 'موقع المطعم — اسحب الدبوس أو حرّكه بمفاتيح الأسهم'
          : 'موقع المطعم المحفوظ',
        icon: L.divIcon({
          className: 'location-marker',
          html: '<svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 39C12 33 1 22 1 16a15 15 0 1 1 30 0c0 6-11 17-15 23Z"/><circle cx="16" cy="16" r="5"/></svg>',
          iconSize: [32, 40],
          iconAnchor: [16, 40],
        }),
      }).addTo(map);
      markerRef.current = marker;
      const choose = (position: L.LatLng) => {
        if (!editableRef.current) return;
        const next = position.wrap();
        onChooseRef.current({
          latitude: Math.max(-90, Math.min(90, next.lat)).toFixed(7),
          longitude: next.lng.toFixed(7),
        });
      };
      marker.on('dragend', () => choose(marker.getLatLng()));
      marker.getElement()?.addEventListener('keydown', (event) => {
        const offsets: Record<string, [number, number]> = {
          ArrowLeft: [-10, 0],
          ArrowRight: [10, 0],
          ArrowUp: [0, -10],
          ArrowDown: [0, 10],
        };
        const offset = offsets[event.key];
        if (!offset) return;
        L.DomEvent.stop(event);
        choose(
          map.containerPointToLatLng(
            map.latLngToContainerPoint(marker.getLatLng()).add(offset),
          ),
        );
      });
    } else markerRef.current.setLatLng(point);
    const targetZoom = hadMarker ? map.getZoom() : 16;
    map.setView(point, targetZoom, { animate: false });
  }, [coordinates.latitude, coordinates.longitude]);

  return (
    <div className="location-picker full">
      <p id="location-map-help">
        {editable
          ? 'راجع موقع المطعم على الخريطة. اضغط لاختيار نقطة أو اسحب الدبوس؛ الإحداثيات تتحدّث تلقائيًا. يمكنك تحريك الدبوس بمفاتيح الأسهم أيضًا.'
          : 'موقع المطعم المحفوظ على الخريطة. التعديل غير متاح حاليًا.'}
      </p>
      <div
        ref={container}
        className="location-map"
        role="region"
        aria-label="خريطة اختيار موقع المطعم"
        aria-describedby="location-map-help"
        dir="ltr"
      />
      {tileError && (
        <div className="location-map-error" aria-live="polite">
          <p>
            تعذّر تحميل بعض أجزاء الخريطة. تحقّق من الاتصال أو أدخل الإحداثيات
            يدويًا.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setTileError(false);
              tilesRef.current?.redraw();
            }}
          >
            إعادة تحميل الخريطة
          </button>
        </div>
      )}
    </div>
  );
}
