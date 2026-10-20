import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const DEFAULT_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

export const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
});

export const setApiBaseUrl = async (newUrl: string) => {
  api.defaults.baseURL = newUrl;
  await AsyncStorage.setItem('church_custom_api_url', newUrl);
};

export const initApiConfig = async () => {
  const savedUrl = await AsyncStorage.getItem('church_custom_api_url');
  if (savedUrl) {
    api.defaults.baseURL = savedUrl;
  }
};

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('church_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const formatImageUrl = (path: string | undefined): string => {
  if (!path) return 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${api.defaults.baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export interface User {
  id: string;
  church_id: string | null;
  church_name?: string | null;
  church_code?: string | null;
  church_logo?: string | null;
  name: string;
  last_name?: string | null;
  username_handle?: string | null;
  email: string;
  role: 'member' | 'leader' | 'church_admin' | 'super_admin';
  current_streak: number;
  highest_streak: number;
  total_points: number;
  avatar_url?: string;
  age?: number | null;
  parent_phone?: string | null;
  parent_consent_verified?: number | boolean;
  address_street?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zipcode?: string | null;
  profile_completion_percent?: number;
  profile_bonus_awarded?: boolean;
  missing_profile_fields?: string[];
  completed_today?: boolean;
  feedbacks_count?: number;
}

export interface Group {
  id: string;
  church_id: string;
  leader_id?: string;
  leader_name?: string;
  title: string;
  description: string;
  category: 'biblia' | 'livro';
  book_or_theme: string;
  cover_image: string;
  invite_code: string;
  member_count?: number;
  devotional_count?: number;
  is_member?: boolean;
  posted_today?: boolean;
}

export interface Devotional {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  user_role: string;
  user_streak: number;
  group_title: string;
  image_url?: string | null;
  passage_or_chapter?: string;
  notes?: string | null;
  is_private_protected?: boolean;
  points_awarded: number;
  devotional_date: string;
  created_at: string;
  amen_count: number;
  glory_count: number;
  heart_count: number;
  reacted_amen: boolean;
  reacted_glory: boolean;
  reacted_heart: boolean;
  leader_feedback?: string | null;
}

export interface LeaderFeedback {
  id: string;
  pastoral_guidance: string;
  feedback_date: string;
  passage_or_chapter: string;
  devotional_date: string;
  group_title: string;
  leader_name: string;
  leader_avatar?: string;
}

export interface GroupRanking {
  position: number;
  id: string;
  title: string;
  category: string;
  leader_name?: string;
  total_members: number;
  total_devotionals: number;
  total_group_points: number;
  avg_streak: number;
  avg_points_per_member: number;
  badge?: string | null;
}

export interface ChallengeLeaderboardItem {
  position: number;
  church_id: string;
  church_name: string;
  church_logo: string;
  city: string;
  state: string;
  total_points_earned: number;
  active_members_count: number;
  badge: string;
}

export interface ActiveChallenge {
  active_challenge: {
    id: string;
    title: string;
    description: string;
    invite_code: string;
    start_date: string;
    end_date: string;
  } | null;
  leaderboard: ChallengeLeaderboardItem[];
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'prata' | 'ouro' | 'especial';
  points_required: number;
  partner_name: string;
  user_points: number;
  progress_percent: number;
  unlocked: boolean;
  points_remaining: number;
  already_claimed: boolean;
  coupon_code?: string;
}

export interface Coupon {
  id: string;
  coupon_code: string;
  qr_code_data: string;
  status: 'active' | 'used' | 'expired';
  redeemed_at?: string;
  created_at: string;
  reward_title: string;
  reward_description?: string;
  tier: string;
  points_required: number;
  partner_name: string;
  quarter_title: string;
}
