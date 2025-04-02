export interface ReviewSuggestion {
  id: number;
  agent: string;
  message: string;
  patch?: string;
  file_path: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface ReviewSession {
  session_id: number;
  suggestions: ReviewSuggestion[];
}

export interface ReviewSummary {
  session_id: number;
  summary: string;
}