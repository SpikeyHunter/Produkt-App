<script lang="ts">
	import { spring } from 'svelte/motion';
	import { onMount } from 'svelte';
	import DashboardTemplate from './DashboardTemplate.svelte';

	// Face scale
	let faceScale = 1;

	// State for different face modes
	type FaceMode = 'happy' | 'wink' | 'surprised' | 'sleepy' | 'dizzy' | 'love' | 'angry' | 'tongue';
	let currentMode: FaceMode = 'happy';
	let title = 'Say hi!';

	// Eye tracking state
	let eyesActive = true;
	let isWinking = false;
	let isSleeping = false;
	let isDizzy = false;
	let showHearts = false;
	let showStars = false;
	let showConfetti = false;
	let isAngry = false;
	let showTongue = false;

	// Spring stores for eye movement
	const springConfig = { stiffness: 0.05, damping: 0.2 };
	let leftEyeRotation = spring(0, springConfig);
	let rightEyeRotation = spring(0, springConfig);

	// Spring for mouth animation
	let mouthAnimation = spring(0, { stiffness: 0.1, damping: 0.3 });
	let mouthPath = 'M 45 80 Q 60 90, 75 82'; // Default smile

	// Dizzy rotation
	let dizzyRotation = spring(0, { stiffness: 0.05, damping: 0.15 });

	// Eye positions
	let leftEyeCenterX = 0;
	let leftEyeCenterY = 0;
	let rightEyeCenterX = 0;
	let rightEyeCenterY = 0;

	let faceElement: SVGSVGElement;
	let clickCount = 0;
	let lastClickTime = 0;
	let lastClickZone = '';

	// Floating elements
	let floatingElements: Array<{ id: number; type: string; x: number; y: number }> = [];
	let elementIdCounter = 0;

	const updateEyeCenters = () => {
		if (!faceElement) return;
		const rect = faceElement.getBoundingClientRect();
		const scaleFactor = (rect.width / 120) * faceScale;

		const svgCenterX = rect.left + rect.width / 2;
		const svgCenterY = rect.top + rect.height / 2;

		leftEyeCenterX = svgCenterX + -15 * scaleFactor;
		leftEyeCenterY = svgCenterY + -5 * scaleFactor;

		rightEyeCenterX = svgCenterX + 15 * scaleFactor;
		rightEyeCenterY = svgCenterY + -5 * scaleFactor;
	};

	onMount(() => {
		updateEyeCenters();
		window.addEventListener('resize', updateEyeCenters);

		// Random blinks
		const blinkInterval = setInterval(() => {
			if (currentMode === 'happy' && Math.random() > 0.7) {
				blink();
			}
		}, 3000);

		return () => {
			clearInterval(blinkInterval);
			window.removeEventListener('resize', updateEyeCenters);
			window.removeEventListener('mousemove', handleGlobalMouseMove);
		};
	});

	function handleGlobalMouseMove(event: MouseEvent) {
		if (!eyesActive || isSleeping || isDizzy) return;

		const { clientX, clientY } = event;

		const lDeltaX = clientX - leftEyeCenterX;
		const lDeltaY = clientY - leftEyeCenterY;
		const lAngle = Math.atan2(lDeltaY, lDeltaX) * (180 / Math.PI);
		leftEyeRotation.set(lAngle);

		const rDeltaX = clientX - rightEyeCenterX;
		const rDeltaY = clientY - rightEyeCenterY;
		const rAngle = Math.atan2(rDeltaY, rDeltaX) * (180 / Math.PI);
		rightEyeRotation.set(rAngle);
	}

	$: {
		if (eyesActive && !isSleeping && !isDizzy) {
			window.addEventListener('mousemove', handleGlobalMouseMove);
		} else {
			window.removeEventListener('mousemove', handleGlobalMouseMove);
		}
	}

	function blink() {
		isSleeping = true;
		setTimeout(() => {
			isSleeping = false;
		}, 150);
	}

	function spawnFloatingElements(type: string, count: number = 5) {
		for (let i = 0; i < count; i++) {
			setTimeout(() => {
				const element = {
					id: elementIdCounter++,
					type,
					x: Math.random() * 100,
					y: 100 + Math.random() * 20
				};
				floatingElements = [...floatingElements, element];

				// Remove after animation
				setTimeout(() => {
					floatingElements = floatingElements.filter((el) => el.id !== element.id);
				}, 3000);
			}, i * 200);
		}
	}

	function setExpression(mode: FaceMode) {
		currentMode = mode;
		showHearts = false;
		showStars = false;
		showConfetti = false;
		isDizzy = false;
		isSleeping = false;
		isWinking = false;
		isAngry = false;
		showTongue = false;
		eyesActive = true;

		switch (mode) {
			case 'happy':
				title = 'Vibing!';
				mouthPath = 'M 45 80 Q 60 90, 75 82';
				mouthAnimation.set(0);
				break;
			case 'wink':
				title = 'Smooth ;)';
				mouthPath = 'M 45 82 Q 60 88, 75 82';
				isWinking = true;
				spawnFloatingElements('star', 3);
				setTimeout(() => setExpression('happy'), 1500);
				break;
			case 'surprised':
				title = 'YOOO!!';
				mouthPath = 'M 50 85 Q 60 92, 70 85';
				mouthAnimation.set(1);
				spawnFloatingElements('confetti', 8);
				setTimeout(() => {
					setExpression('happy');
				}, 2000);
				break;
			case 'sleepy':
				title = '5 more mins...';
				mouthPath = 'M 52 83 Q 60 86, 68 83';
				isSleeping = true;
				eyesActive = false;
				spawnFloatingElements('z', 4);
				setTimeout(() => setExpression('happy'), 3000);
				break;
			case 'dizzy':
				title = 'Woops';
				mouthPath = 'M 48 82 Q 60 88, 72 82';
				isDizzy = true;
				eyesActive = false;
				spawnFloatingElements('spiral', 6);
				// Animate dizzy spin
				let rotation = 0;
				const dizzyInterval = setInterval(() => {
					rotation += 30;
					dizzyRotation.set(rotation);
					if (rotation >= 720) {
						clearInterval(dizzyInterval);
						dizzyRotation.set(0);
						setExpression('happy');
					}
				}, 50);
				break;
			case 'love':
				title = 'ur cute <3';
				mouthPath = 'M 45 78 Q 60 92, 75 78';
				showHearts = true;
				spawnFloatingElements('heart', 10);
				setTimeout(() => setExpression('happy'), 2500);
				break;
			case 'angry':
				title = 'BONK!!';
				mouthPath = 'M 50 85 Q 60 80, 70 85';
				isAngry = true;
				spawnFloatingElements('smoke', 4);
				setTimeout(() => setExpression('happy'), 2000);
				break;
			case 'tongue':
				title = 'I need lip balm!';
				mouthPath = 'M 48 82 Q 60 85, 72 82';
				showTongue = true;
				spawnFloatingElements('bubble', 5);
				setTimeout(() => setExpression('happy'), 2000);
				break;
		}
	}

	function detectClickZone(event: MouseEvent) {
		if (!faceElement) return 'center';

		const rect = faceElement.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 120;
		const y = ((event.clientY - rect.top) / rect.height) * 120;

		// Check if clicking on eyes
		const leftEyeDist = Math.sqrt(Math.pow(x - 45, 2) + Math.pow(y - 55, 2));
		const rightEyeDist = Math.sqrt(Math.pow(x - 75, 2) + Math.pow(y - 55, 2));

		if (leftEyeDist < 12 || rightEyeDist < 12) {
			return 'eyes';
		}

		// Check if clicking on mouth area
		if (y > 70 && y < 95 && x > 40 && x < 80) {
			return 'mouth';
		}

		// Check corners
		if ((x < 30 || x > 90) && (y < 30 || y > 90)) {
			return 'corner';
		}

		return 'center';
	}

	function handleClick(event: MouseEvent) {
		const zone = detectClickZone(event);

		if (zone === 'eyes') {
			title = 'Hey! My eyes!';
			setExpression('dizzy');
			return;
		} else if (zone === 'mouth') {
			title = 'Tickles!!';
			setExpression('tongue');
			return;
		} else if (zone === 'corner') {
			setExpression('angry');
			return;
		}

		// For regular center clicks, just call the new function
		triggerComboClick();
	}

	function handleMouseEnter() {
		if (currentMode === 'happy') {
			title = 'Hey there!';
			mouthAnimation.set(0.5);
		}
	}

	function handleMouseLeave() {
		if (currentMode === 'happy') {
			title = 'Click me!';
			mouthAnimation.set(0);
		}
	}

	function triggerComboClick() {
		const currentTime = Date.now();
		if (currentTime - lastClickTime > 500) {
			clickCount = 1;
		} else {
			clickCount++;
		}

		lastClickTime = currentTime;

		if (clickCount === 1) {
			setExpression('wink');
		} else if (clickCount === 2) {
			setExpression('surprised');
		} else if (clickCount === 3) {
			setExpression('love');
		} else if (clickCount === 4) {
			setExpression('sleepy');
		} else if (clickCount >= 5) {
			setExpression('dizzy');
			clickCount = 0;
		}
	}
</script>

<DashboardTemplate {title} width={250} height={250}>
	<div
		role="button"
		tabindex="0"
		class="flex items-center justify-center w-full h-full select-none cursor-pointer focus:outline-none rounded-lg relative overflow-visible"
		on:click={handleClick}
		on:mouseenter={handleMouseEnter}
		on:mouseleave={handleMouseLeave}
		on:keydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') triggerComboClick();
		}}
		aria-label="Interactive face graphic"
	>
		<!-- Floating elements that go everywhere -->
		<div class="fixed inset-0 pointer-events-none z-50">
			{#each floatingElements as element (element.id)}
				<div
					class="absolute text-3xl animate-float-everywhere"
					style="left: {element.x}%; top: {element.y}%; animation-delay: 0s;"
				>
					{#if element.type === 'heart'}
						<svg width="30" height="30" viewBox="0 0 24 24" fill="#E1FF00">
							<path
								d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
							/>
						</svg>
					{:else if element.type === 'star'}
						<svg width="30" height="30" viewBox="0 0 24 24" fill="#E1FF00">
							<path
								d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
							/>
						</svg>
					{:else if element.type === 'confetti'}
						<span style="color: #E1FF00; transform: rotate({Math.random() * 360}deg)">▪</span>
					{:else if element.type === 'z'}
						<span style="color: #E1FF00; font-weight: bold;">Z</span>
					{:else if element.type === 'spiral'}
						<span style="color: #E1FF00;">@</span>
					{:else if element.type === 'smoke'}
						<span style="color: #E1FF00;">💢</span>
					{:else if element.type === 'bubble'}
						<svg
							width="25"
							height="25"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#E1FF00"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" />
						</svg>
					{/if}
				</div>
			{/each}
		</div>

		<svg
			bind:this={faceElement}
			viewBox="0 0 120 120"
			class="w-full h-full max-w-[200px] transition-transform duration-300"
			style:transform="rotate({$dizzyRotation}deg)"
			aria-hidden="true"
		>
			<!-- Face circle -->
			<circle
				cx="60"
				cy="60"
				r="58"
				stroke="#E1FF00"
				stroke-width="4"
				fill="hsl(0, 0%, 20%)"
				class="transition-all duration-300"
				style:fill={isAngry ? 'hsl(0, 50%, 25%)' : 'hsl(0, 0%, 20%)'}
			/>

			<!-- Mouth with animation -->
			<path
				d={mouthPath}
				stroke="#E1FF00"
				stroke-width="4"
				stroke-linecap="round"
				fill="transparent"
				class="transition-all duration-300"
				style:transform="translateY({$mouthAnimation * 3}px)"
			/>

			<!-- Tongue when sticking out -->
			{#if showTongue}
				<ellipse cx="60" cy="88" rx="8" ry="12" fill="#ff6b6b" class="animate-wiggle" />
			{/if}

			<!-- Eyes group -->
			<g transform="translate(60 55)">
				<!-- Normal active eyes -->
				{#if !isDizzy && !isSleeping && eyesActive && !isAngry}
					<g class="transition-all duration-300 ease-in-out">
						<!-- Left eye (winks when winking) -->
						{#if isWinking}
							<line
								x1="-20"
								y1="0"
								x2="-10"
								y2="0"
								stroke="#E1FF00"
								stroke-width="3"
								stroke-linecap="round"
							/>
						{:else}
							<g transform="translate(-15 0) rotate({$leftEyeRotation})">
								<circle cx="8" cy="0" r="8" fill="#E1FF00" />
							</g>
						{/if}

						<!-- Right eye -->
						<g transform="translate(15 0) rotate({$rightEyeRotation})">
							<circle cx="8" cy="0" r="8" fill="#E1FF00" />
						</g>
					</g>
				{/if}

				<!-- Angry eyes -->
				{#if isAngry}
					<g class="transition-all duration-300 ease-in-out">
						<g transform="translate(-15 0)">
							<circle cx="0" cy="0" r="8" fill="#ff0000" />
						</g>
						<g transform="translate(15 0)">
							<circle cx="0" cy="0" r="8" fill="#ff0000" />
						</g>
						<!-- Angry eyebrows -->
						<path d="M -22 -10 L -8 -5" stroke="#E1FF00" stroke-width="3" stroke-linecap="round" />
						<path d="M 8 -5 L 22 -10" stroke="#E1FF00" stroke-width="3" stroke-linecap="round" />
					</g>
				{/if}

				<!-- Sleepy eyes -->
				{#if isSleeping}
					<g class="transition-all duration-300 ease-in-out">
						<line
							x1="-20"
							y1="0"
							x2="-10"
							y2="0"
							stroke="#E1FF00"
							stroke-width="3"
							stroke-linecap="round"
						/>
						<line
							x1="10"
							y1="0"
							x2="20"
							y2="0"
							stroke="#E1FF00"
							stroke-width="3"
							stroke-linecap="round"
						/>
					</g>
				{/if}

				<!-- Dizzy eyes -->
				{#if isDizzy}
					<g class="font-mono font-bold text-3xl" fill="#E1FF00" text-anchor="middle">
						<text x="-15" y="5" class="animate-spin">@</text>
						<text x="15" y="5" class="animate-spin" style="animation-direction: reverse;">@</text>
					</g>
				{/if}

				<!-- Surprised eyebrows -->
				{#if currentMode === 'surprised'}
					<g stroke="#E1FF00" stroke-width="2" stroke-linecap="round" fill="transparent">
						<path d="M -22 -15 L -8 -18" />
						<path d="M 8 -18 L 22 -15" />
					</g>
				{/if}
			</g>
		</svg>
	</div>
</DashboardTemplate>

<style>
	@keyframes float-everywhere {
		0% {
			opacity: 0;
			transform: translate(0, 0) scale(0.5);
		}
		20% {
			opacity: 1;
			transform: translate(-50px, -100px) scale(1) rotate(180deg);
		}
		40% {
			transform: translate(80px, -200px) scale(1.2) rotate(360deg);
		}
		60% {
			transform: translate(-100px, -350px) scale(0.8) rotate(540deg);
		}
		80% {
			transform: translate(120px, -500px) scale(1.1) rotate(720deg);
		}
		100% {
			opacity: 0;
			transform: translate(-80px, -700px) scale(0.3) rotate(900deg);
		}
	}

	.animate-float-everywhere {
		animation: float-everywhere 3s ease-out forwards;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes wiggle {
		0%,
		100% {
			transform: translateX(0) rotate(0);
		}
		25% {
			transform: translateX(-2px) rotate(-5deg);
		}
		75% {
			transform: translateX(2px) rotate(5deg);
		}
	}

	.animate-wiggle {
		animation: wiggle 0.5s ease-in-out infinite;
	}
</style>
