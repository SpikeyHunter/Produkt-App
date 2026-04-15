<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import maplibregl from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    export let tourDates: any[] = [];
    export const mapsInfo: string = "";

    let mapContainer: HTMLElement;
    let map: maplibregl.Map;
    let mapReady = false;

    const PIN_COLOR  = '#E1FF00';
    const PIN_BORDER = '#1a1a1a';
    const LINE_COLOR = '#E1FF00';
    const TINT_COLOR = '#E1FF00';

    function parseAddress(address: any) {
        if (!address) return null;
        if (typeof address === 'object') return address;
        try {
            const parsed = JSON.parse(address);
            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        } catch (e) {
            console.error('Map: Failed to parse address', address, e);
            return null;
        }
    }

    $: if (mapReady && tourDates) {
        updateMapContent();
    }

    function updateMapContent() {
        if (!map || !mapReady) return;

        // Sort chronologically so pin #1 = earliest date
        const sorted = [...tourDates]
            .map(d => ({ ...d, geo: parseAddress(d.address) }))
            .filter(d => d.geo?.lat != null && d.geo?.lng != null)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log(`Map: Plotting ${sorted.length} pins`);

        // ── 1. Country tint ──────────────────────────────────────────────
        const countries = [...new Set(
            sorted.map(d => d.geo.country_code?.toUpperCase()).filter(Boolean)
        )];

        if (map.getLayer('country-highlight')) {
            map.setFilter('country-highlight', ['in', 'iso_a2', ...countries]);
            map.setPaintProperty('country-highlight', 'fill-opacity', countries.length ? 0.13 : 0);
        }

        // ── 2. Line GeoJSON ──────────────────────────────────────────────
        const coords = sorted.map(d => [Number(d.geo.lng), Number(d.geo.lat)]);

        const lineGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: coords.length > 1 ? [{
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords },
                properties: {}
            }] : []
        };

        // ── 3. Pin GeoJSON ───────────────────────────────────────────────
        const pinsGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: sorted.map((d, i) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [Number(d.geo.lng), Number(d.geo.lat)]
                },
                properties: {
                    index: i + 1,
                    venue: d.venue,
                    city: d.geo.city || '',
                    date: d.date
                        ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })
                        : ''
                }
            }))
        };

        // ── 4. Update or create sources + layers ─────────────────────────
        if (map.getSource('tour-lines')) {
            (map.getSource('tour-lines') as maplibregl.GeoJSONSource).setData(lineGeoJSON);
        } else {
            map.addSource('tour-lines', { type: 'geojson', data: lineGeoJSON });
            map.addLayer({
                id: 'tour-lines-layer',
                type: 'line',
                source: 'tour-lines',
                paint: {
                    'line-color': LINE_COLOR,
                    'line-width': 1.5,
                    'line-opacity': 0.5,
                    'line-dasharray': [4, 3]
                }
            });
        }

        if (map.getSource('tour-pins')) {
            (map.getSource('tour-pins') as maplibregl.GeoJSONSource).setData(pinsGeoJSON);
        } else {
            map.addSource('tour-pins', { type: 'geojson', data: pinsGeoJSON });

            // Filled circle
            map.addLayer({
                id: 'tour-pins-circle',
                type: 'circle',
                source: 'tour-pins',
                paint: {
                    'circle-radius': 14,
                    'circle-color': PIN_COLOR,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': PIN_BORDER
                }
            });

            // Number label inside circle
            map.addLayer({
                id: 'tour-pins-label',
                type: 'symbol',
                source: 'tour-pins',
                layout: {
                    'text-field': ['to-string', ['get', 'index']],
                    'text-font': ['Noto Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 11,
                    'text-allow-overlap': true,
                    'text-ignore-placement': true
                },
                paint: {
                    'text-color': PIN_BORDER
                }
            });
        }

        // ── 5. Click popup ───────────────────────────────────────────────
        map.off('click', 'tour-pins-circle', handlePinClick);
        map.on('click', 'tour-pins-circle', handlePinClick);
        map.on('mouseenter', 'tour-pins-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'tour-pins-circle', () => { map.getCanvas().style.cursor = ''; });

        // ── 6. Fit bounds ────────────────────────────────────────────────
        if (sorted.length === 0) return;

        if (sorted.length === 1) {
            map.flyTo({ center: coords[0] as [number, number], zoom: 10, duration: 1200 });
        } else {
            const bounds = coords.reduce(
                (b, c) => b.extend(c as [number, number]),
                new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
            );
            map.fitBounds(bounds, { padding: 80, maxZoom: 7, duration: 1200 });
        }
    }

    function handlePinClick(e: any) {
        const props = e.features?.[0]?.properties;
        if (!props) return;
        new maplibregl.Popup({ closeButton: false, offset: 20 })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div style="padding:8px 12px;font-family:sans-serif;min-width:130px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="background:#E1FF00;color:#1a1a1a;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0;">${props.index}</span>
                        <span style="font-weight:700;font-size:13px;color:#111;">${props.venue}</span>
                    </div>
                    <div style="font-size:11px;color:#555;padding-left:26px;">${props.date}</div>
                    <div style="font-size:11px;color:#888;padding-left:26px;">${props.city}</div>
                </div>
            `)
            .addTo(map);
    }

    onMount(async () => {
        await tick();

        map = new maplibregl.Map({
            container: mapContainer,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
            center: [0, 20],
            zoom: 1.5,
            attributionControl: false,
        });

        map.on('load', () => {
            // Country tint layer — added first so pins render on top
            map.addSource('world', {
                type: 'geojson',
                data: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
            });
            map.addLayer({
                id: 'country-highlight',
                type: 'fill',
                source: 'world',
                paint: { 'fill-color': TINT_COLOR, 'fill-opacity': 0 },
                filter: ['in', 'iso_a2', ''],
            });

            mapReady = true;
            updateMapContent();
        });

        const resizer = new ResizeObserver(() => map?.resize());
        resizer.observe(mapContainer);
    });

    onDestroy(() => {
        map?.remove();
    });
</script>

<div class="w-full h-full relative rounded-2xl overflow-hidden" style="min-height: 300px;">
    <div bind:this={mapContainer} style="position:absolute;inset:0;width:100%;height:100%;"></div>
</div>