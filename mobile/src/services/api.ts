import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// No Android emulator usa-se 10.0.2.2; no iOS / Web usa-se localhost.
// Em celular físico na mesma rede Wi-Fi, pode-se informar o IP do computador.
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

// Resposta formatada da imagem para visualização
export const formatImageUrl = (path: string | undefined): string => {
  if (!path) return 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${api.defaults.baseURL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'leader' | 'admin';
  current_streak: number;
  highest_streak: number;
  total_points: number;
  avatar_url?: string;
  completed_today?: boolean;
}

export interface Group {
  id: string;
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
  image_url: string;
  passage_or_chapter?: string;
  notes?: string;
  points_awarded: number;
  devotional_date: string;
  created_at: string;
  amen_count: number;
  glory_count: number;
  heart_count: number;
  reacted_amen: boolean;
  reacted_glory: boolean;
  reacted_heart: boolean;
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
