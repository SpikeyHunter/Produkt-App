export interface TalentPayment {
  id: number;
  advance_id: number;
  event_id: number;
  amount: number;
  notes: string | null;
  delivery_method: 'Pick Up' | 'Mail' | null;
  status: 'Draft' | 'Confirmed' | 'Invoiced' | 'Approved' | 'Submitted' | 'Paid';
  invoice_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  public_token: string;
}

export interface LocalArtistAdvance {
  id: number; // advance_id
  event_id: number;
  artist_name: string;
  payment?: TalentPayment; // Joined data
}