export interface Series {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  storyCount?: number;
  /** Casts of its bible: a framed series has at least one */
  castCount?: number;
}
