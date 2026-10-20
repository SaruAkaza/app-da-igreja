import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, initApiConfig } from '../services/api';

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (userType: 'maria' | 'joao' | 'lider' | 'admin' | 'raquel' | 'pastor_memorial') => Promise<void>;
  register: (name: string, email: string, password: string, churchCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSavedSession();
  }, []);

  const loadSavedSession = async () => {
    try {
      await initApiConfig();
      const savedToken = await AsyncStorage.getItem('church_auth_token');
      const savedUser = await AsyncStorage.getItem('church_auth_user');

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

  const fetchFreshProfile = async (currentToken: string) => {
    try {
      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setUser(res.data);
      await AsyncStorage.setItem('church_auth_user', JSON.stringify(res.data));
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

  const register = async (name: string, email: string, password: string, churchCode?: string) => {
    const res = await api.post('/api/auth/register', { name, email, password, churchCode });
    const { token: receivedToken, user: receivedUser } = res.data;

    setToken(receivedToken);
    setUser(receivedUser);

    await AsyncStorage.setItem('church_auth_token', receivedToken);
    await AsyncStorage.setItem('church_auth_user', JSON.stringify(receivedUser));
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
        login,
        loginDemo,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
