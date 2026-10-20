import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, initApiConfig } from '../services/api';

export interface SavedAccount {
  id: string;
  name: string;
  email: string;
  username_handle?: string | null;
  avatar_url?: string;
  church_name?: string | null;
  token: string;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  savedAccounts: SavedAccount[];
  isSeniorMode: boolean;
  toggleSeniorMode: () => void;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (userType: 'maria' | 'joao' | 'lider' | 'admin' | 'raquel' | 'pastor_memorial') => Promise<void>;
  register: (payload: any) => Promise<any>;
  registerChurch: (payload: any) => Promise<any>;
  switchAccount: (accountId: string) => Promise<void>;
  removeSavedAccount: (accountId: string) => Promise<void>;
  joinChurch: (code: string) => Promise<void>;
  joinGroupByCode: (inviteCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isSeniorMode, setIsSeniorMode] = useState<boolean>(false);

  useEffect(() => {
    loadSavedSession();
  }, []);

  const loadSavedSession = async () => {
    try {
      await initApiConfig();
      const savedToken = await AsyncStorage.getItem('church_auth_token');
      const savedUser = await AsyncStorage.getItem('church_auth_user');
      const accountsJson = await AsyncStorage.getItem('church_saved_accounts');
      const seniorModeVal = await AsyncStorage.getItem('church_senior_mode');

      if (seniorModeVal === 'true') {
        setIsSeniorMode(true);
      }

      if (accountsJson) {
        setSavedAccounts(JSON.parse(accountsJson));
      }

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        fetchFreshProfile(savedToken);
      }
    } catch (e) {
      console.error('Erro ao restaurar sessão:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeniorMode = async () => {
    const nextVal = !isSeniorMode;
    setIsSeniorMode(nextVal);
    await AsyncStorage.setItem('church_senior_mode', String(nextVal));
  };

  const persistAccountInList = async (u: User, t: string) => {
    try {
      let accounts: SavedAccount[] = [];
      const raw = await AsyncStorage.getItem('church_saved_accounts');
      if (raw) {
        accounts = JSON.parse(raw);
      }

      const existingIdx = accounts.findIndex((a) => a.id === u.id);
      const accData: SavedAccount = {
        id: u.id,
        name: u.name,
        email: u.email,
        username_handle: u.username_handle,
        avatar_url: u.avatar_url,
        church_name: u.church_name,
        token: t,
      };

      if (existingIdx >= 0) {
        accounts[existingIdx] = accData;
      } else {
        accounts.push(accData);
      }

      setSavedAccounts(accounts);
      await AsyncStorage.setItem('church_saved_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.error('Erro ao salvar conta na lista:', e);
    }
  };

  const fetchFreshProfile = async (currentToken: string) => {
    try {
      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setUser(res.data);
      await AsyncStorage.setItem('church_auth_user', JSON.stringify(res.data));
      persistAccountInList(res.data, currentToken);
    } catch (err) {
      console.error('Falha ao atualizar perfil:', err);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token: receivedToken, user: receivedUser } = res.data;

    setToken(receivedToken);
    setUser(receivedUser);

    await AsyncStorage.setItem('church_auth_token', receivedToken);
    await AsyncStorage.setItem('church_auth_user', JSON.stringify(receivedUser));
    await persistAccountInList(receivedUser, receivedToken);
  };

  const switchAccount = async (accountId: string) => {
    const acc = savedAccounts.find((a) => a.id === accountId);
    if (!acc) return;

    setLoading(true);
    setToken(acc.token);
    await AsyncStorage.setItem('church_auth_token', acc.token);
    await fetchFreshProfile(acc.token);
    setLoading(false);
  };

  const removeSavedAccount = async (accountId: string) => {
    const nextAccounts = savedAccounts.filter((a) => a.id !== accountId);
    setSavedAccounts(nextAccounts);
    await AsyncStorage.setItem('church_saved_accounts', JSON.stringify(nextAccounts));
    if (user?.id === accountId) {
      await logout();
    }
  };

  const loginDemo = async (userType: 'maria' | 'joao' | 'lider' | 'admin' | 'raquel' | 'pastor_memorial') => {
    const demoEmails = {
      maria: 'maria@igreja.com',
      joao: 'joao@igreja.com',
      lider: 'lider@igreja.com',
      admin: 'admin@igreja.com',
      raquel: 'raquel@memorial.com',
      pastor_memorial: 'pastor.silas@memorial.com',
    };
    await login(demoEmails[userType], '123456');
  };

  const register = async (payload: any) => {
    const res = await api.post('/api/auth/register', payload);
    const { token: receivedToken, user: receivedUser } = res.data;

    setToken(receivedToken);
    setUser(receivedUser);

    await AsyncStorage.setItem('church_auth_token', receivedToken);
    await AsyncStorage.setItem('church_auth_user', JSON.stringify(receivedUser));
    await persistAccountInList(receivedUser, receivedToken);
    return res.data;
  };

  const registerChurch = async (payload: any) => {
    const res = await api.post('/api/auth/register-church', payload);
    const { token: receivedToken, user: receivedUser } = res.data;

    setToken(receivedToken);
    setUser(receivedUser);

    await AsyncStorage.setItem('church_auth_token', receivedToken);
    await AsyncStorage.setItem('church_auth_user', JSON.stringify(receivedUser));
    await persistAccountInList(receivedUser, receivedToken);
    return res.data;
  };

  const joinChurch = async (code: string) => {
    await api.post('/api/auth/join-church', { code });
    await refreshProfile();
  };

  const joinGroupByCode = async (inviteCode: string) => {
    await api.post('/api/groups/join', { inviteCode });
    await refreshProfile();
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('church_auth_token');
    await AsyncStorage.removeItem('church_auth_user');
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchFreshProfile(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        savedAccounts,
        isSeniorMode,
        toggleSeniorMode,
        login,
        loginDemo,
        register,
        registerChurch,
        switchAccount,
        removeSavedAccount,
        joinChurch,
        joinGroupByCode,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
