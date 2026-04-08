export async function extractDominantColor(imgSrc: string): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'Anonymous'; 
		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (!ctx) return resolve('#39FF14'); // Neon Green Fallback

			canvas.width = img.width;
			canvas.height = img.height;
			ctx.drawImage(img, 0, 0);

			try {
				const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
				let maxSaturation = 0;
				let bestR = 255, bestG = 0, bestB = 255; // Default Fluorescent Pink

				for (let i = 0; i < data.length; i += 40) { 
					const r = data[i], g = data[i+1], b = data[i+2];
					
					const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
					if (isGray || (r < 40 && g < 40 && b < 40) || (r > 240 && g > 240 && b > 240)) continue;

					const max = Math.max(r, g, b), min = Math.min(r, g, b);
					const saturation = max === 0 ? 0 : (max - min) / max;
					
					if (saturation > maxSaturation) {
						maxSaturation = saturation;
						bestR = r; bestG = g; bestB = b;
					}
				}
				
				// Returning the raw, highly saturated color without adding white
				resolve(`#${((1 << 24) + (bestR << 16) + (bestG << 8) + bestB).toString(16).slice(1).toUpperCase()}`);
			} catch (e) {
				resolve('#00FFFF'); // Neon Cyan Fallback
			}
		};
		img.onerror = () => resolve('#FF00FF');
		img.src = imgSrc;
	});
}

export function hexToHSL(hex: string): {h: number, s: number, l: number} {
	let r = parseInt(hex.slice(1, 3), 16) / 255;
	let g = parseInt(hex.slice(3, 5), 16) / 255;
	let b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h = 0, s = 0, l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}
	return { h: h * 360, s: s * 100, l: l * 100 };
}

export function HSLToHex(h: number, s: number, l: number): string {
	s /= 100; l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
	return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

export function resolveColorCollisions(events: any[]): any[] {
	const hueThreshold = 25;
	const processed = [...events];
	
	for (let i = 0; i < processed.length; i++) {
		if (processed[i]._adjusted) continue;
		const baseHSL = hexToHSL(processed[i].color);
		const collisions = [processed[i]];

		for (let j = i + 1; j < processed.length; j++) {
			if (processed[j]._adjusted) continue;
			const checkHSL = hexToHSL(processed[j].color);
			let hueDiff = Math.abs(baseHSL.h - checkHSL.h);
			if (hueDiff > 180) hueDiff = 360 - hueDiff;
			if (hueDiff < hueThreshold) {
				collisions.push(processed[j]);
			}
		}

		if (collisions.length === 2) {
			collisions[0].color = HSLToHex(baseHSL.h, baseHSL.s, 40);
			collisions[1].color = HSLToHex(baseHSL.h, baseHSL.s, 75);
		} else if (collisions.length >= 3) {
			collisions[0].color = HSLToHex(baseHSL.h, baseHSL.s, 40);
			collisions[1].color = HSLToHex(baseHSL.h, baseHSL.s, 60);
			collisions[2].color = HSLToHex(baseHSL.h, baseHSL.s, 80);
			for(let c = 3; c < collisions.length; c++) {
				collisions[c].color = HSLToHex(baseHSL.h, baseHSL.s, 30 + ((c % 3) * 25));
			}
		}
		collisions.forEach(c => c._adjusted = true);
	}
	return processed.map(e => {
		delete e._adjusted;
		return e;
	});
}