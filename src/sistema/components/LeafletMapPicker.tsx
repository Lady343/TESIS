import { useEffect, useRef } from 'react';

declare const L: any;

interface LeafletMapPickerProps {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
}

export default function LeafletMapPicker({ lat, lng, onChange }: LeafletMapPickerProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!wrapperRef.current || typeof L === 'undefined') return;
        if (mapRef.current) return;

        // Creamos el div del mapa manualmente para que React NO interfiera con él
        const mapDiv = document.createElement('div');
        mapDiv.style.width = '100%';
        mapDiv.style.height = '100%';
        mapDiv.style.borderRadius = '16px';
        wrapperRef.current.appendChild(mapDiv);

        try {
            const map = L.map(mapDiv, {
                center: [lat, lng],
                zoom: 15,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);

            const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                onChangeRef.current(pos.lat, pos.lng);
            });

            map.on('click', (e: any) => {
                marker.setLatLng(e.latlng);
                onChangeRef.current(e.latlng.lat, e.latlng.lng);
            });

            mapRef.current = map;
            markerRef.current = marker;
        } catch (err) {
            console.error('Leaflet init error:', err);
        }

        return () => {
            try {
                if (mapRef.current) {
                    mapRef.current.off();
                    mapRef.current.remove();
                    mapRef.current = null;
                }
                if (wrapperRef.current && mapDiv.parentNode === wrapperRef.current) {
                    wrapperRef.current.removeChild(mapDiv);
                }
            } catch (e) {
                console.error("Error al desmontar Leaflet:", e);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sincronizar marcador si cambian lat/lng desde fuera
    useEffect(() => {
        try {
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            }
        } catch (_) {}
    }, [lat, lng]);

    return (
        <div
            ref={wrapperRef}
            style={{
                width: '100%',
                height: '240px',
                zIndex: 0,
            }}
        />
    );
}
