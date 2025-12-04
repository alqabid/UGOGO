
import { User, Event } from './types';

export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Sarah Jenks',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=b6e3f4',
    bio: 'Love techno and rooftop vibes 🎵',
    snapchatHandle: 'sarah_j_vibes',
    isVerified: true,
  },
  {
    id: 'u2',
    name: 'Mike Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike&backgroundColor=c0aede',
    bio: 'Photographer looking for shoots 📸',
    snapchatHandle: 'mike.snaps',
    isVerified: true,
  },
  {
    id: 'u3',
    name: 'Jessica Alva',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica&backgroundColor=ffdfbf',
    bio: 'Just here for the tacos 🌮',
    snapchatHandle: 'jess_tacos',
    isVerified: false,
  },
  {
    id: 'u4',
    name: 'Davide B',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Davide&backgroundColor=d1d4f9',
    bio: 'Skating and coding.',
    snapchatHandle: 'dave_sk8',
    isVerified: true,
  }
];

export const CURRENT_USER: User = {
  id: 'me',
  name: 'Alex Rider',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=ffdfbf',
  bio: 'Ready to meet new people! ✨',
  snapchatHandle: 'alex_rider_x',
  isCurrentUser: true,
  isVerified: true,
};

export const INITIAL_EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Neon Rooftop Party',
    date: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
    location: 'Skybar, Downtown',
    imageUrl: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&q=80&w=800',
    description: 'The brightest night of the year. Wear neon, bring good vibes.',
    attendees: [MOCK_USERS[0], MOCK_USERS[1]],
    category: 'Party',
    hostId: 'u1',
    price: 25
  },
  {
    id: 'e2',
    title: 'Sunday Sunset Jazz',
    date: new Date(Date.now() + 86400000 * 5).toISOString(),
    location: 'The Blue Note',
    imageUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d03?auto=format&fit=crop&q=80&w=800',
    description: 'Smooth tunes and smooth drinks. A chill end to the week.',
    attendees: [MOCK_USERS[2], MOCK_USERS[3]],
    category: 'Chill',
    hostId: 'u2',
    price: 0
  },
  {
    id: 'e3',
    title: 'Indie Art Pop-up',
    date: new Date(Date.now() + 86400000 * 10).toISOString(),
    location: 'Warehouse District',
    imageUrl: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&q=80&w=800',
    description: 'Support local artists and find unique pieces.',
    attendees: [MOCK_USERS[1]],
    category: 'Art',
    hostId: 'u1',
    price: 5
  }
];
