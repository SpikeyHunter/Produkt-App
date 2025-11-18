// This file defines the 'shape' of our Preset data.
// No changes, but it's needed for the other files to work.

export type Preset = {
	id: string;
	name: string;
	category: string;
	type: string | null;
	price: number | null;
	quantity: number | null;
	unit: string | null;
};