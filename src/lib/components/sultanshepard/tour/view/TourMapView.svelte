<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	// @ts-ignore
	import polyline from '@mapbox/polyline';
	import { supabase } from '$lib/supabase';
	import { slide } from 'svelte/transition';

	export let tourDates: any[] = [];
	export let selectedDateId: string | null = null;

	let mapContainer: HTMLElement;
	let map: maplibregl.Map;
	let mapReady = false;
	let eventsBound = false;
	let skipNextZoom = false;

	// HTML Markers arrays
	let distanceMarkers: maplibregl.Marker[] = [];
	let variantDistanceMarkers: maplibregl.Marker[] = [];
	let pinMarkers: maplibregl.Marker[] = [];

	// Edit Route States
	let editingDateId: string | null = null;
	let alternativeRoutesForEdit: any[] = [];
	let currentPopup: maplibregl.Popup | null = null;

	// Styling State
	let LINE_COLOR = '#E1FF00'; // Default line color
	const TINT_COLOR = '#E1FF00';
	
	let typeColors: Record<string, string> = {
		'Tour Date': '#E1FF00',
		'Stop': '#E4E4E4',
		'Pickup': '#86EFAC',
		'Return': '#FCA5A5'
	};

	// The requested colors for the alternative routes
	const VARIANT_COLORS = ['#86EFAC', '#FDBA74', '#FCA5A5'];

	// Colors Setting Options
	const LINE_COLORS_OPTIONS = [
		{ name: 'White', hex: '#F7F7F7' },
		{ name: 'Gray', hex: '#E4E4E4' },
		{ name: 'Lime', hex: '#E1FF00' },
		{ name: 'Yellow', hex: '#FCD34D' },
		{ name: 'Orange', hex: '#FDBA74' },
		{ name: 'Red', hex: '#FCA5A5' },
		{ name: 'Green', hex: '#86EFAC' },
		{ name: 'Blue', hex: '#93c5fd' },
		{ name: 'Purple', hex: '#c4b5fd' }
	];

	// Line Menu State
	let isColorMenuOpen = false;
	let isColorMenuHovered = false;

	// Type Menu State
	let isTypeMenuOpen = false;
	let isTypeMenuHovered = false;
	let activeTypeForColor: string | null = null;

	const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

	function getTypeColor(type?: string) {
		const t = type || 'Tour Date';
		return typeColors[t] || typeColors['Tour Date'] || '#E1FF00';
	}

	function parseAddress(address: any) {
		if (!address) return null;
		if (typeof address === 'object') return address;
		try {
			const parsed = JSON.parse(address);
			return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
		} catch (e) {
			return null;
		}
	}

	function calculateDistanceNum(coords: [number, number][]) {
		let total = 0;
		const R = 6371; // km
		for (let i = 0; i < coords.length - 1; i++) {
			const [lon1, lat1] = coords[i];
			const [lon2, lat2] = coords[i + 1];
			const dLat = (lat2 - lat1) * Math.PI / 180;
			const dLon = (lon2 - lon1) * Math.PI / 180;
			const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
				Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
				Math.sin(dLon / 2) * Math.sin(dLon / 2);
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			total += R * c;
		}
		return Math.round(total);
	}

	function calculateDistance(coords: [number, number][]) {
		return calculateDistanceNum(coords) + ' km';
	}

	$: if (mapReady && tourDates) {
		updateMapContent();
	}

	// Triggers Zoom & Popup when selecting from the Sidebar List
	$: if (mapReady && selectedDateId) {
		if (skipNextZoom) {
			skipNextZoom = false; // Reset to allow future zooms
		} else {
			const selected = tourDates.find((d) => d.id === selectedDateId);
			if (selected) {
				const geo = parseAddress(selected.address);
				if (geo?.lng && geo?.lat) {
					const coords = [Number(geo.lng), Number(geo.lat)] as [number, number];
					map.flyTo({
						center: coords,
						zoom: 12,
						speed: 3,
						curve: 1,
						essential: true
					});
					showPopupForDate(selected, coords);
				}
			}
		}
	}

	async function loadUserSettings() {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('user_settings')
				.eq('id', user.id)
				.single();

			if (profile?.user_settings?.tour_line_color) {
				LINE_COLOR = profile.user_settings.tour_line_color;
			}
			if (profile?.user_settings?.tour_type_colors) {
				// Merge saved colors with defaults
				typeColors = { ...typeColors, ...profile.user_settings.tour_type_colors };
			}
		}
	}

	async function saveLineColor(colorHex: string) {
		LINE_COLOR = colorHex;
		isColorMenuOpen = false;
		isColorMenuHovered = false;
		updateMapContent();

		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('user_settings')
				.eq('id', user.id)
				.single();

			const currentSettings = profile?.user_settings || {};
			currentSettings.tour_line_color = colorHex;

			await supabase
				.from('user_profiles')
				.update({ user_settings: currentSettings })
				.eq('id', user.id);
		}
	}

	async function saveTypeColor(type: string, colorHex: string) {
		typeColors[type] = colorHex;
		activeTypeForColor = null; // Return to type list
		updateMapContent();

		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('user_settings')
				.eq('id', user.id)
				.single();

			const currentSettings = profile?.user_settings || {};
			currentSettings.tour_type_colors = typeColors;

			await supabase
				.from('user_profiles')
				.update({ user_settings: currentSettings })
				.eq('id', user.id);
		}
	}

	async function fetchRoute(start: [number, number], end: [number, number], cachedRoute?: string, forceFetchAlternatives = false) {
		if (cachedRoute && !forceFetchAlternatives) {
			const coords = polyline.decode(cachedRoute).map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);
			return [{ coords, encoded: cachedRoute, distanceKm: calculateDistance(coords), rawDist: calculateDistanceNum(coords) }];
		}
		
		if (!GOOGLE_API_KEY) {
			const rawDist = calculateDistanceNum([start, end] as [number, number][]);
			return [{ coords: [start, end] as [number, number][], encoded: '', distanceKm: rawDist + ' km', rawDist }];
		}

		try {
			const response = await fetch(`https://routes.googleapis.com/directions/v2:computeRoutes`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Goog-Api-Key': GOOGLE_API_KEY,
					'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline'
				},
				body: JSON.stringify({
					origin: { location: { latLng: { latitude: start[1], longitude: start[0] } } },
					destination: { location: { latLng: { latitude: end[1], longitude: end[0] } } },
					travelMode: 'DRIVE',
					routingPreference: 'TRAFFIC_UNAWARE',
					computeAlternativeRoutes: true
				})
			});
			const data = await response.json();
			if (!data.routes || data.routes.length === 0) {
				const rawDist = calculateDistanceNum([start, end] as [number, number][]);
				return [{ coords: [start, end] as [number, number][], encoded: '', distanceKm: rawDist + ' km', rawDist }];
			}

			return data.routes.map((r: any) => {
				const encoded = r.polyline.encodedPolyline;
				const coords = polyline.decode(encoded).map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);
				const rawDist = r.distanceMeters ? Math.round(r.distanceMeters / 1000) : calculateDistanceNum(coords);
				return { coords, encoded, distanceKm: rawDist + ' km', rawDist };
			});
		} catch (e) {
			const rawDist = calculateDistanceNum([start, end] as [number, number][]);
			return [{ coords: [start, end] as [number, number][], encoded: '', distanceKm: rawDist + ' km', rawDist }];
		}
	}

	async function triggerEditRoute(startData: any, endData: any, lngLat: any) {
		const start = [Number(startData.geo.lng), Number(startData.geo.lat)] as [number, number];
		const end = [Number(endData.geo.lng), Number(endData.geo.lat)] as [number, number];

		editingDateId = startData.id;
		const routes = await fetchRoute(start, end, undefined, true);
		// Sort by distance to correctly match fastest, middle, slowest to Route 1, 2, 3
		alternativeRoutesForEdit = routes.sort((a: any, b: any) => a.rawDist - b.rawDist);

		updateMapContent();
		showPopupForDate(startData, lngLat); 
	}

	async function saveVariantRoute(idx: number) {
		if (!editingDateId) return;

		const selectedRoute = alternativeRoutesForEdit[idx];
		const variantsStr = JSON.stringify(alternativeRoutesForEdit.map(r => r.encoded));
		const dObj = tourDates.find(d => d.id === editingDateId);
		if (dObj) {
			dObj.cached_route_to_next = selectedRoute.encoded;
			dObj.route_variants = variantsStr;
			skipNextZoom = true; // Prevent map from zooming in after updating tourDates array
			tourDates = [...tourDates];
		}

		await supabase.from('ss_tour_dates').update({
			cached_route_to_next: selectedRoute.encoded,
			route_variants: variantsStr
		}).eq('id', editingDateId);

		editingDateId = null;
		alternativeRoutesForEdit = [];
		updateMapContent();
		if (currentPopup) currentPopup.remove();
	}

	function updateMarkerVisibility() {
		if (!map) return;
		const z = map.getZoom();
		const markers = document.querySelectorAll('.km-marker-inner');
		markers.forEach(inner => {
			const el = inner as HTMLElement;
			if (z < 3.5) {
				el.style.opacity = '0';
				el.style.transform = 'scale(0.5) translateY(-50%)';
				el.style.pointerEvents = 'none';
			} else if (z < 5.5) {
				el.style.opacity = '0.6';
				el.style.transform = 'scale(0.75) translateY(-50%)';
				el.style.pointerEvents = 'auto';
			} else {
				el.style.opacity = '1';
				el.style.transform = 'scale(1) translateY(-50%)';
				el.style.pointerEvents = 'auto';
			}
		});
	}

	async function updateMapContent() {
		if (!map || !mapReady) return;

		distanceMarkers.forEach(m => m.remove());
		distanceMarkers = [];
		variantDistanceMarkers.forEach(m => m.remove());
		variantDistanceMarkers = [];
		pinMarkers.forEach(m => m.remove());
		pinMarkers = [];

		const sorted = [...tourDates]
			.map((d) => ({ ...d, geo: parseAddress(d.address) }))
			.filter((d) => d.geo?.lat != null && d.geo?.lng != null)
			.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

		// Restore original map styles: transparent for empty countries, subtle lime for tour countries
		if (map.getLayer('country-highlight')) {
			const activeCountryCodes = [...new Set(sorted.map(d => d.geo.country_code?.toUpperCase()).filter(Boolean))];
			const matchArray = activeCountryCodes.length > 0 ? activeCountryCodes : ['NONE_PLACEHOLDER'];

			map.setPaintProperty('country-highlight', 'fill-color', [
				'case',
				['in', ['get', 'ISO_A2'], ['literal', matchArray]], TINT_COLOR,
				'transparent'
			]);
			map.setPaintProperty('country-highlight', 'fill-opacity', [
				'case',
				['in', ['get', 'ISO_A2'], ['literal', matchArray]], 0.15,
				0
			]);
		}

		if (sorted.length === 0) return;

		let allRouteFeatures: any[] = [];
		const stops = sorted.map((d) => [Number(d.geo.lng), Number(d.geo.lat)] as [number, number]);

		// Main Lines
		if (stops.length > 1) {
			for (let i = 0; i < sorted.length - 1; i++) {
				const startData = sorted[i];
				const endData = sorted[i + 1];
				const routesArray = await fetchRoute(stops[i], stops[i + 1], startData.cached_route_to_next);

				if (routesArray.length > 0) {
					const mainRoute = routesArray[0];
					allRouteFeatures.push({
						type: 'Feature',
						geometry: { type: 'LineString', coordinates: mainRoute.coords }
					});

					if (startData.id !== editingDateId) {
						const midIndex = Math.floor(mainRoute.coords.length / 2);
						const midPoint = mainRoute.coords[midIndex];

						// Wrapping inner marker to safely apply CSS transforms without clashing with MapLibre's translations
						const el = document.createElement('div');
						el.className = 'km-marker-container z-[50]';
						
						const inner = document.createElement('div');
						inner.title = ""; 
						inner.className = 'km-marker-inner text-[#1a1a1a] font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-[#1a1a1a] whitespace-nowrap cursor-pointer transition-all duration-300 transform origin-center';
						inner.style.backgroundColor = LINE_COLOR;
						inner.innerText = mainRoute.distanceKm;

						// Clicking KM triggers Edit Route
						inner.addEventListener('click', (e) => {
							e.stopPropagation();
							const pointCoords = [Number(startData.geo.lng), Number(startData.geo.lat)];
							triggerEditRoute(startData, endData, pointCoords);
						});

						el.appendChild(inner);

						const distMarker = new maplibregl.Marker({ element: el })
							.setLngLat(midPoint as [number, number])
							.addTo(map);
						distanceMarkers.push(distMarker);
					}
				}
			}
		}

		// Variant Lines
		const variantsGeoJSON = {
			type: 'FeatureCollection',
			features: editingDateId ? alternativeRoutesForEdit.map((r, i) => ({
				type: 'Feature',
				geometry: { type: 'LineString', coordinates: r.coords },
				properties: { variantIndex: i, color: VARIANT_COLORS[i % VARIANT_COLORS.length] }
			})) : []
		};

		// Variant HTML Markers
		if (editingDateId) {
			alternativeRoutesForEdit.forEach((r, i) => {
				const midIndex = Math.floor(r.coords.length / 2);
				const midPoint = r.coords[midIndex];

				const el = document.createElement('div');
				el.className = 'km-marker-container z-[100]';

				const inner = document.createElement('div');
				inner.title = "";
				const bgColor = VARIANT_COLORS[i % VARIANT_COLORS.length];
				inner.className = 'km-marker-inner text-[#1a1a1a] font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border-2 border-[#1a1a1a] whitespace-nowrap cursor-pointer transition-all duration-300 transform origin-center';
				inner.style.backgroundColor = bgColor;
				inner.innerText = r.distanceKm;

				inner.addEventListener('click', (e) => {
					e.stopPropagation();
					saveVariantRoute(i);
				});

				el.appendChild(inner);

				const distMarker = new maplibregl.Marker({ element: el })
					.setLngLat(midPoint as [number, number])
					.addTo(map);
				variantDistanceMarkers.push(distMarker);
			});
		}

		const lineGeoJSON = {
			type: 'FeatureCollection',
			features: allRouteFeatures
		};

		if (map.getSource('tour-lines')) {
			(map.getSource('tour-lines') as maplibregl.GeoJSONSource).setData(lineGeoJSON as any);
			map.setPaintProperty('tour-lines-layer', 'line-color', LINE_COLOR);
		} else {
			map.addSource('tour-lines', { type: 'geojson', data: lineGeoJSON as any });
			map.addLayer({
				id: 'tour-lines-layer',
				type: 'line',
				source: 'tour-lines',
				paint: { 'line-color': LINE_COLOR, 'line-width': 2, 'line-opacity': 0.8 }
			});
		}

		if (map.getSource('tour-variants')) {
			(map.getSource('tour-variants') as maplibregl.GeoJSONSource).setData(variantsGeoJSON as any);
		} else {
			map.addSource('tour-variants', { type: 'geojson', data: variantsGeoJSON as any });
			map.addLayer({
				id: 'tour-variants-layer',
				type: 'line',
				source: 'tour-variants',
				paint: { 
					'line-color': ['get', 'color'], 
					'line-width': 5, 
					'line-opacity': 1
				}
			});
		}

		// Create HTML Markers for Pins
		sorted.forEach((d, i) => {
			const el = document.createElement('div');
			el.className = 'z-50';

			const inner = document.createElement('div');
			inner.className = 'border-2 border-[#1a1a1a] text-[#1a1a1a] rounded-full flex items-center justify-center font-black cursor-pointer shadow-lg transition-transform hover:scale-110 origin-center';
			inner.style.backgroundColor = getTypeColor(d.type); // Applies dynamic color based on type
			inner.style.width = '28px';
			inner.style.height = '28px';
			inner.style.fontSize = '12px';
			inner.innerText = (i + 1).toString();

			inner.addEventListener('click', (e) => {
				e.stopPropagation();
				skipNextZoom = true;
				selectedDateId = d.id;
				const coords = [Number(d.geo.lng), Number(d.geo.lat)];
				showPopupForDate(d, coords);
			});

			el.appendChild(inner);

			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([Number(d.geo.lng), Number(d.geo.lat)])
				.addTo(map);
			
			pinMarkers.push(marker);
		});

		if (!eventsBound) {
			map.on('click', 'tour-variants-layer', (e) => {
				if (e.features && e.features.length > 0) {
					const idx = e.features[0].properties.variantIndex;
					saveVariantRoute(idx);
				}
			});

			map.on('mouseenter', 'tour-variants-layer', () => (map.getCanvas().style.cursor = 'pointer'));
			map.on('mouseleave', 'tour-variants-layer', () => (map.getCanvas().style.cursor = ''));

			map.on('click', (e) => {
				const features = map.queryRenderedFeatures(e.point, {
					layers: ['tour-variants-layer'] 
				});
				if (features.length === 0 && editingDateId) {
					editingDateId = null;
					alternativeRoutesForEdit = [];
					updateMapContent();
					if (currentPopup) currentPopup.remove();
				}
			});

			map.on('zoom', updateMarkerVisibility);
			map.on('mousedown', () => map.stop());
			eventsBound = true;
		}

		// Apply visibility settings right away for initial render
		setTimeout(updateMarkerVisibility, 50);
	}

	function showPopupForDate(data: any, lngLat: any) {
		if (currentPopup) currentPopup.remove();

		const sorted = [...tourDates]
			.map((d) => ({ ...d, geo: parseAddress(d.address) }))
			.filter((d) => d.geo?.lat != null && d.geo?.lng != null)
			.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

		const stopIdx = sorted.findIndex(d => d.id === data.id);
		const displayIndex = stopIdx !== -1 ? stopIdx + 1 : (data.index || '');
		const displayCity = stopIdx !== -1 ? (sorted[stopIdx].geo?.city || '') : (data.city || '');
		const dateStr = new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		const typeColor = getTypeColor(data.type);

		const isEditing = editingDateId === data.id;
		const hasNextStop = stopIdx !== -1 && stopIdx < sorted.length - 1;

		let actionAreaHTML = '';
		if (hasNextStop) {
			if (isEditing && alternativeRoutesForEdit.length > 0) {
				actionAreaHTML += `<div style="margin-top:24px; border-top: 1px solid #444; padding-top:12px;">`;
				actionAreaHTML += `<div style="font-size:11px; font-weight:bold; color: white; margin-bottom: 8px; text-align: center;">Select Route:</div>`;
				actionAreaHTML += `<div style="display: flex; flex-direction: column; gap: 8px;">`;

				alternativeRoutesForEdit.forEach((r, idx) => {
					const color = VARIANT_COLORS[idx % VARIANT_COLORS.length];
					actionAreaHTML += `<button class="route-variant-btn" data-idx="${idx}" style="width: 100%; background: #1a1a1a; border: 1px solid ${color}; color: ${color}; padding: 6px 16px; border-radius: 24px; font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.2s; text-align: left; display: flex; justify-content: space-between; align-items: center;"><span>Route ${idx + 1}</span> <span>${r.distanceKm}</span></button>`;
				});

				actionAreaHTML += `</div></div>`;
			} else {
				actionAreaHTML = `<div style="display: flex; justify-content: center; width: 100%; margin-top: 24px;"><button id="edit-route-btn" style="background: rgba(228, 228, 228, 0.1); border: 1px solid rgba(228, 228, 228, 0.3); color: #E4E4E4; padding: 6px 20px; border-radius: 24px; font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.2s;">Edit Route to Next Stop</button></div>`;
			}
		}

		const container = document.createElement('div');
		container.className = 'custom-popup-container';
		container.innerHTML = `
            <div style="background: #2F2F2F; color: white; padding: 16px; border-radius: 16px; min-width: 240px; font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="background: ${typeColor}; color: #1a1a1a; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 900; font-size: 12px;">${displayIndex}</span>
                    <b style="font-size: 15px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.venue}</b>
                    <button id="zoom-to-point" style="background: transparent; border: none; cursor: pointer; padding: 4px; color: #aaa; transition: color 0.2s;" title="Zoom Location">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </button>
                </div>
               
                <div style="font-size: 12px; color: #ddd; margin-left: 34px;">${dateStr}</div>
                <div style="font-size: 12px; color: #aaa; margin-left: 34px;">${displayCity}</div>
                ${actionAreaHTML}
            </div>
        `;

		container.querySelector('#zoom-to-point')?.addEventListener('click', () => {
			map.flyTo({
				center: lngLat,
				zoom: 12,
				speed: 3,
				curve: 1,
				essential: true
			});
		});

		if (hasNextStop) {
			if (isEditing && alternativeRoutesForEdit.length > 0) {
				const btns = container.querySelectorAll('.route-variant-btn');

				btns.forEach(btn => {
					btn.addEventListener('click', async (e) => {
						const target = e.currentTarget as HTMLElement;
						target.innerText = "Saving...";
						target.style.opacity = '0.5';

						const idx = parseInt(target.getAttribute('data-idx') || '0');
						saveVariantRoute(idx);
					});
				});

			} else {
				container.querySelector('#edit-route-btn')?.addEventListener('click', async (e) => {
					const target = e.currentTarget as HTMLElement;
					target.innerText = "Fetching routes...";
					target.style.opacity = '0.5';
					target.style.pointerEvents = 'none';
					
					// Extract startData correctly from the parsed sorted list so .geo exists
					const startData = sorted[stopIdx];
					const endData = sorted[stopIdx + 1];
					triggerEditRoute(startData, endData, lngLat);
				});
			}
		}

		currentPopup = new maplibregl.Popup({ closeButton: false, offset: [0, -14], anchor: 'bottom' })
			.setLngLat(lngLat)
			.setDOMContent(container)
			.addTo(map);
	}

	onMount(async () => {
		await loadUserSettings();
		await tick();
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
			center: [0, 20],
			zoom: 1.5,
			attributionControl: false,
			pitchWithRotate: false,
			dragRotate: false,
			renderWorldCopies: false,
			fadeDuration: 0
		});

		map.on('load', () => {
			map.addSource('world', {
				type: 'geojson',
				data: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'
			});
			map.addLayer({
				id: 'country-highlight',
				type: 'fill',
				source: 'world',
				paint: { 'fill-color': 'transparent', 'fill-opacity': 0 } 
			}, 'watername_ocean'); 
			
			mapReady = true;
			updateMapContent();
		});
	});

	onDestroy(() => {
		map?.remove();
		distanceMarkers.forEach(m => m.remove());
		variantDistanceMarkers.forEach(m => m.remove());
		pinMarkers.forEach(m => m.remove());
	});
</script>

<div class="w-full h-full relative rounded-2xl overflow-hidden" style="min-height: 300px;">
	<div bind:this={mapContainer} style="position:absolute;inset:0;width:100%;height:100%; bg-[#1a1a1a]"></div>

	{#if !mapReady}
		<div class="absolute inset-0 z-[1000] bg-[#1a1a1a]/80 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-300">
			<div class="animate-spin w-8 h-8 text-lime mb-3">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 12a9 9 0 11-6.219-8.56" />
				</svg>
			</div>
			<span class="text-[10px] font-bold text-gray2 uppercase tracking-widest animate-pulse">Loading Map...</span>
		</div>
	{/if}

	<div class="absolute top-4 right-4 z-[999] flex flex-col items-end gap-2">
		<div role="group" aria-label="Line Color Settings" class="flex flex-col items-end gap-2"
			 on:mouseenter={() => isColorMenuHovered = true}
			 on:mouseleave={() => { isColorMenuHovered = false; isColorMenuOpen = false; }}>
			
			<button class="h-8 bg-[#1a1a1a] border border-[#2F2F2F] rounded-full flex items-center cursor-pointer hover:bg-[#2F2F2F] transition-all duration-300 overflow-hidden box-border"
					style="width: {isColorMenuHovered || isColorMenuOpen ? '108px' : '32px'}; padding: 0 7px;"
					on:click={() => isColorMenuOpen = !isColorMenuOpen}>
				<div class="flex items-center gap-2" style="color: {LINE_COLOR}; width: max-content;">
					<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="4" cy="12" r="2"></circle>
						<circle cx="20" cy="12" r="2"></circle>
						<line x1="6" y1="12" x2="18" y2="12"></line>
					</svg>
					<span class="text-xs font-bold whitespace-nowrap" style="opacity: {isColorMenuHovered || isColorMenuOpen ? '1' : '0'}; transition: opacity 0.2s;">Line Color</span>
				</div>
			</button>

			{#if isColorMenuOpen}
				<div transition:slide={{ duration: 200 }} class="bg-[#1a1a1a] border border-[#2F2F2F] rounded-2xl p-2 flex flex-col gap-1 shadow-xl origin-top-right w-[140px]">
					{#each LINE_COLORS_OPTIONS as color}
						<button class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2F2F2F] transition-colors w-full text-left cursor-pointer"
								on:click={() => saveLineColor(color.hex)}>
							<div class="w-3 h-3 rounded-full border border-gray2 shrink-0" style="background-color: {color.hex};"></div>
							<span class="text-xs font-bold text-white whitespace-nowrap">{color.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div role="group" aria-label="Date Type Settings" class="flex flex-col items-end gap-2"
			 on:mouseenter={() => isTypeMenuHovered = true}
			 on:mouseleave={() => { isTypeMenuHovered = false; isTypeMenuOpen = false; activeTypeForColor = null; }}>
			
			<button class="h-8 bg-[#1a1a1a] border border-[#2F2F2F] rounded-full flex items-center cursor-pointer hover:bg-[#2F2F2F] transition-all duration-300 overflow-hidden box-border"
					style="width: {isTypeMenuHovered || isTypeMenuOpen ? '112px' : '32px'}; padding: 0 7px;"
					on:click={() => { isTypeMenuOpen = !isTypeMenuOpen; activeTypeForColor = null; }}>
				<div class="flex items-center gap-2" style="color: #E4E4E4; width: max-content;">
					<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
						<circle cx="12" cy="10" r="3"></circle>
					</svg>
					<span class="text-xs font-bold whitespace-nowrap" style="opacity: {isTypeMenuHovered || isTypeMenuOpen ? '1' : '0'}; transition: opacity 0.2s;">Date Types</span>
				</div>
			</button>

			{#if isTypeMenuOpen}
				<div transition:slide={{ duration: 200 }} class="bg-[#1a1a1a] border border-[#2F2F2F] rounded-2xl p-2 flex flex-col gap-1 shadow-xl origin-top-right w-[140px]">
					{#if activeTypeForColor}
						<button class="flex items-center gap-2 px-2 py-1.5 text-gray2 hover:text-white transition-colors mb-1 cursor-pointer rounded-lg hover:bg-[#2F2F2F]"
								on:click={() => activeTypeForColor = null}>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
							<span class="text-[10px] font-bold uppercase tracking-wider">Back</span>
						</button>
						{#each LINE_COLORS_OPTIONS as color}
							<button class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2F2F2F] transition-colors w-full text-left cursor-pointer"
									on:click={() => saveTypeColor(activeTypeForColor || '', color.hex)}>
								<div class="w-3 h-3 rounded-full border border-gray2 shrink-0" style="background-color: {color.hex};"></div>
								<span class="text-xs font-bold text-white whitespace-nowrap">{color.name}</span>
							</button>
						{/each}
					{:else}
						{#each Object.keys(typeColors) as type}
							<button class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2F2F2F] transition-colors w-full text-left cursor-pointer justify-between"
									on:click={() => activeTypeForColor = type}>
								<div class="flex items-center gap-3">
									<div class="w-3 h-3 rounded-full border border-gray2 shrink-0" style="background-color: {typeColors[type]};"></div>
									<span class="text-xs font-bold text-white whitespace-nowrap truncate max-w-[70px]">{type}</span>
								</div>
								<svg class="w-3 h-3 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Make absolutely sure the popup container renders visually on top of everything, including maplibre markers */
	:global(.maplibregl-popup) {
		z-index: 9999 !important;
	}
	:global(.maplibregl-popup-content) {
		background: transparent !important;
		padding: 0 !important;
		box-shadow: none !important;
		border: none !important;
	}
	:global(.maplibregl-popup-tip) {
		border-top-color: #2F2F2F !important;
		border-bottom-color: #2F2F2F !important;
	}
	:global(#edit-route-btn:hover) {
		background-color: rgba(228, 228, 228, 0.2) !important;
	}
	:global(#zoom-to-point:hover) {
		color: #E4E4E4 !important;
	}
	:global(.route-variant-btn:hover) {
		filter: brightness(1.2);
	}
</style>