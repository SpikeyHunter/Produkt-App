<script lang="ts">
	import { authStore } from '$lib/stores/authStore';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	let loading = true;
	let currentTime = new Date();
	let greeting = '';
	// Default placeholder data
	let weather = { temp: 0, condition: 'Loading...', sunset: '00:00', sunrise: '00:00', icon: 'sun', iconColor: '#FCD34D' };
	let forecast = Array(5).fill({ date: '...', temp: '...', icon: 'sun', iconColor: '#E4E4E4' });
	let daysUntilNewYear = 0;
	let userLocation = 'Montreal';
	let otherTimezone = '';

	// --- Greeting and Time Functions ---
	function updateGreeting() {
		const hour = currentTime.getHours();
		if (hour < 5) { greeting = 'Late night grind'; } 
		else if (hour < 12) { greeting = 'Good morning'; } 
		else if (hour < 17) { greeting = 'Good afternoon'; } 
		else if (hour < 21) { greeting = 'Good evening'; } 
		else { greeting = 'Working late'; }
	}

	function calculateDaysUntilNewYear() {
		const now = new Date();
		const nextYear = new Date(now.getFullYear() + 1, 0, 1);
		const diff = nextYear.getTime() - now.getTime();
		daysUntilNewYear = Math.ceil(diff / (1000 * 60 * 60 * 24));
	}

	function updateTime() {
		currentTime = new Date();
		updateGreeting();
		calculateDaysUntilNewYear();
	}

	function getOtherTimezoneTime() {
		const targetTz = userLocation === 'Montreal' ? 'America/Los_Angeles' : 'America/Montreal';
		const targetCity = userLocation === 'Montreal' ? 'Los Angeles' : 'Montreal';
		const time = new Date().toLocaleTimeString('en-US', {
			timeZone: targetTz, hour: '2-digit', minute: '2-digit', hour12: true
		});
		return `${targetCity}: ${time}`;
	}

	// --- Weather Functions (using Open-Meteo API) ---

	function mapWeatherCode(code: number): { description: string; icon: string } {
		if (code === 0) return { description: 'Clear Sky', icon: 'sun' };
		if (code === 1) return { description: 'Mainly Clear', icon: 'sun' };
		if (code === 2) return { description: 'Partly Cloudy', icon: 'partly-cloudy' };
		if (code === 3) return { description: 'Overcast', icon: 'cloud' };
		if ([45, 48].includes(code)) return { description: 'Fog', icon: 'fog' };
		if ([51, 53, 55, 56, 57].includes(code)) return { description: 'Drizzle', icon: 'rain' };
		if ([61, 63, 65, 66, 67].includes(code)) return { description: 'Rain', icon: 'rain' };
		if ([80, 81, 82].includes(code)) return { description: 'Rain Showers', icon: 'rain' };
		if ([71, 73, 75, 77, 85, 86].includes(code)) return { description: 'Snow', icon: 'snow' };
		if ([95, 96, 99].includes(code)) return { description: 'Thunderstorm', icon: 'storm' };
		return { description: 'Clear', icon: 'sun' };
	}
	
	function getWeatherColor(icon: string): string {
		switch(icon) {
			case 'sun': return '#FCD34D';
			case 'cloud': return '#E4E4E4';
			case 'partly-cloudy': return '#FCD34D';
			case 'rain': return '#93c5fd';
			case 'storm': return '#93c5fd';
			case 'snow': return '#F7F7F7';
			case 'fog': return '#E4E4E4';
			default: return '#FCD34D';
		}
	}
	
	const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

	async function fetchWeather() {
		loading = true;
		try {
			const geoResponse = await fetch('https://wttr.in/?format=j1');
			const geoData = await geoResponse.json();
			const nearestArea = geoData.nearest_area?.[0];
			if (nearestArea) {
				const city = nearestArea.areaName?.[0]?.value || '';
				userLocation = city.includes('Los Angeles') || city.includes('LA') ? 'Los Angeles' : 'Montreal';
			}

			const coords = {
				'Montreal': { lat: 45.50, lon: -73.57 },
				'Los Angeles': { lat: 34.05, lon: -118.24 }
			};
			const { lat, lon } = coords[userLocation];
			
			const weatherURL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&current_weather=true&timezone=auto&forecast_days=5`;
			
			const response = await fetch(weatherURL);
			const data = await response.json();

			const currentWeatherCode = data.current_weather.weathercode;
			const { description, icon } = mapWeatherCode(currentWeatherCode);
			
			weather = {
				temp: Math.round(data.current_weather.temperature),
				condition: description,
				sunrise: formatTime(data.daily.sunrise[0]),
				sunset: formatTime(data.daily.sunset[0]),
				icon: icon,
				iconColor: getWeatherColor(icon)
			};

			forecast = data.daily.time.map((date, i) => {
				const forecastWeatherCode = data.daily.weathercode[i];
				const { icon: forecastIcon } = mapWeatherCode(forecastWeatherCode);
				
				// FIX: By appending 'T00:00:00', we force JS to interpret the date in the
				// user's local timezone, preventing it from shifting to the previous day.
				const correctDate = new Date(date + 'T00:00:00');

				return {
					date: i === 0 ? 'Today' : correctDate.toLocaleDateString('en-US', { weekday: 'short' }),
					temp: Math.round((data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2),
					icon: forecastIcon,
					iconColor: getWeatherColor(forecastIcon)
				};
			});

		} catch (error) {
			console.error('Weather fetch failed:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		updateGreeting();
		calculateDaysUntilNewYear();
		fetchWeather();
		const interval = setInterval(updateTime, 60000);

		return () => clearInterval(interval);
	});

	$: formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
	$: formattedDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	$: currentHour = currentTime.getHours();
	$: currentMinute = currentTime.getMinutes();
	$: hourProgress = currentMinute / 60;
	$: isNightTime = currentHour >= 19 || currentHour < 6;
	$: sunTimeLabel = isNightTime ? 'Sunrise' : 'Sunset';
	$: sunTime = isNightTime ? weather.sunrise : weather.sunset;
	$: otherTimezone = getOtherTimezoneTime();
</script>

<style>
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	@keyframes float {
		0%, 100% { transform: translateY(0px); }
		50% { transform: translateY(-3px); }
	}
	.animate-float {
		animation: float 3s ease-in-out infinite;
	}
</style>

<DashboardTemplate title="Welcome" width={350} height={500}>
	<div slot="icon">
		<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
	</div>

	<div slot="header-actions" class="text-right">
		<div class="text-lime font-bold text-xl tabular-nums">{formattedTime}</div>
	</div>

	<div class="h-full flex flex-col justify-between py-2">
		<div class="space-y-4">
			<div>
				<p class="text-gray3 text-xs">{formattedDate}</p>
				<p class="text-white text-2xl font-bold mt-1">
					{greeting}{#if $authStore.profile?.first_name},
						<span class="text-lime">{$authStore.profile.first_name}</span>
					{/if}!
				</p>
			</div>

			<div class="pt-3 border-t border-gray1">
				<div class="flex items-center justify-between">
					{#if loading}
						<div class="flex items-center gap-3 w-full">
							<div class="w-10 h-10 bg-gray1 rounded-full animate-pulse"></div>
							<div class="flex-grow">
								<div class="h-8 w-20 bg-gray1 rounded-md animate-pulse"></div>
								<div class="h-4 w-24 bg-gray1 rounded-md mt-1 animate-pulse"></div>
							</div>
							<div class="flex items-center gap-2">
								<div class="w-10 h-10 bg-gray1 rounded-full animate-pulse"></div>
								<div>
									<div class="h-5 w-16 bg-gray1 rounded-md animate-pulse"></div>
									<div class="h-4 w-12 bg-gray1 rounded-md mt-1 animate-pulse"></div>
								</div>
							</div>
						</div>
					{:else}
						<div class="flex items-center justify-between w-full" in:fade={{ duration: 300 }}>
							<div class="flex items-center gap-3">
								<div class="animate-float" style="color: {weather.iconColor}">
									{#if weather.icon === 'sun'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
									{:else if weather.icon === 'cloud' || weather.icon === 'fog'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
									{:else if weather.icon === 'partly-cloudy'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
									{:else if weather.icon === 'rain'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="19" x2="8" y2="21"></line><line x1="8" y1="13" x2="8" y2="15"></line><line x1="16" y1="19" x2="16" y2="21"></line><line x1="16" y1="13" x2="16" y2="15"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="12" y1="15" x2="12" y2="17"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
									{:else if weather.icon === 'storm'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="13 11 9 17 15 17 11 23"></polyline></svg>
									{:else if weather.icon === 'snow'} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="8" y1="20" x2="8" y2="20"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="12" y1="22" x2="12" y2="22"></line><line x1="16" y1="16" x2="16" y2="16"></line><line x1="16" y1="20" x2="16" y2="20"></line></svg>
									{/if}
								</div>
								<div>
									<p class="text-white text-2xl font-bold">{weather.temp}°C</p>
									<p class="text-gray3 text-xs">{weather.condition}</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if isNightTime} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" stroke-width="2"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="8 6 12 2 16 6" stroke="#93c5fd"></polyline></svg>
								{:else} <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" stroke-width="2"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="9" x2="12" y2="2"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="16 5 12 9 8 5" stroke="#93c5fd"></polyline></svg>
								{/if}
								<div class="text-left">
									<p class="text-white text-sm font-semibold">{sunTime}</p>
									<p class="text-gray3 text-xs">{sunTimeLabel}</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="pt-3 border-t border-gray1">
				<p class="text-gray3 text-xs mb-2">5 Day Forecast</p>
				<div class="flex justify-between">
					{#each forecast as day, i (i)}
						<div class="flex flex-col items-center gap-1 w-[45px]">
						{#if loading}
							<div class="h-3 w-8 bg-gray1 rounded animate-pulse"></div>
							<div class="w-6 h-6 bg-gray1 rounded-full my-0.5 animate-pulse"></div>
							<div class="h-4 w-6 bg-gray1 rounded animate-pulse"></div>
						{:else}
							<div class="flex flex-col items-center gap-1" in:fade={{ duration: 300, delay: i * 50}}>
								<p class="text-gray3 text-[10px] font-semibold">{day.date}</p>
								<div style="color: {day.iconColor}">
									{#if day.icon === 'sun'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
									{:else if day.icon === 'cloud' || day.icon === 'fog'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
									{:else if day.icon === 'partly-cloudy'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
									{:else if day.icon === 'rain'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="13" x2="8" y2="16"></line><line x1="16" y1="13" x2="16" y2="16"></line><line x1="12" y1="15" x2="12" y2="18"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>
									{:else if day.icon === 'storm'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"></path><polyline points="13 11 9 17 15 17 11 23"></polyline></svg>
									{:else if day.icon === 'snow'} <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="8" y1="20" x2="8" y2="20"></line><line x1="12" y1="18" x2="12" y2="18"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
									{/if}
								</div>
								<p class="text-white text-xs font-semibold">{day.temp}°</p>
							</div>
						{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="pt-3 border-t border-gray1 grid grid-cols-2 gap-4">
				<div>
					<p class="text-gray3 text-xs">Time in</p>
					<p class="text-white text-sm font-semibold">{otherTimezone}</p>
				</div>
				<div class="text-right">
					<p class="text-gray3 text-xs">Days to 2026</p>
					<p class="text-white text-sm font-bold">
						<span class="text-lime">{daysUntilNewYear}</span> days
					</p>
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-1.5 pb-1">
			<div class="flex items-end justify-between">
				{#each Array(24) as _, i}
					{@const isPast = i < currentHour}
					{@const isCurrent = i === currentHour}
					{@const baseHeight = isPast ? 22 : 16}
					{@const height = isCurrent ? baseHeight + (hourProgress * 10) : baseHeight}
					<div
						class="w-[4px] rounded-full transition-all duration-500"
						style="height: {height}px; background-color: {isCurrent ? 'rgb(190, 242, 100)' : isPast ? 'rgb(140, 200, 80)' : 'rgb(70, 70, 70)'}"
						title="{i}:00"
					></div>
				{/each}
			</div>
			
			<div class="flex justify-between text-[9px] text-gray3 px-1">
				<span>12AM</span>
				<span>6AM</span>
				<span>12PM</span>
				<span>6PM</span>
				<span>12AM</span>
			</div>
		</div>
	</div>
</DashboardTemplate>