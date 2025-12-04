
export interface User {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  snapchatHandle: string;
  isCurrentUser?: boolean;
  isVerified?: boolean;
}

export interface Event {
  id: string;
  title: string;
  date: string; // ISO string
  location: string;
  imageUrl: string;
  description: string;
  attendees: User[];
  category: 'Party' | 'Concert' | 'Chill' | 'Sports' | 'Art';
  hostId?: string;
  price: number; // 0 = free
}

export type ViewState = 'login' | 'discover' | 'create' | 'profile' | 'event_details';

export interface GeminiResponse {
  text: string;
}
