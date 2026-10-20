import React,{ createContext,useCallback,useContext,useEffect,useRef,useState } from 'react';
import { api,initApiConfig,User } from '../services/api';
import { sessionStorage as storage } from '../services/storage';
export interface SavedAccount { id: string; name: string; email: string; username_handle?: string | null; avatar_url?: string; church_name?: string | null; token: string }
interface AuthContextData {
  user: User | null; token: string | null; loading: boolean; savedAccounts: SavedAccount[]; isSeniorMode: boolean;
  toggleSeniorMode: () => Promise<void>; login: (email: string,password: string) => Promise<void>;
  loginDemo: (type: 'maria'|'joao'|'lider'|'admin'|'raquel'|'pastor_memorial') => Promise<void>;
  register: (payload: any) => Promise<any>; registerChurch: (payload: any) => Promise<any>;
  switchAccount: (id: string) => Promise<void>; removeSavedAccount: (id: string) => Promise<void>;
  joinChurch: (code: string) => Promise<void>; joinGroupByCode: (code: string) => Promise<void>;
  logout: () => Promise<void>; refreshProfile: () => Promise<void>;
}
const AuthContext=createContext<AuthContextData>({} as AuthContextData);
export function AuthProvider({children}: {children: React.ReactNode}) {
  const [user,setUser]=useState<User|null>(null), [token,setToken]=useState<string|null>(null), [loading,setLoading]=useState(true), [savedAccounts,setSavedAccounts]=useState<SavedAccount[]>([]), [isSeniorMode,setSeniorMode]=useState(false);
  const active=useRef<{token:string|null;user:User|null}>({token:null,user:null});
  const remember=useCallback(async (profile:User,session:string)=>{
    const raw=await storage.getItem('church_saved_accounts');const accounts:SavedAccount[]=raw?JSON.parse(raw):[];
    const entry:SavedAccount={id:profile.id,name:profile.name,email:profile.email,username_handle:profile.username_handle,avatar_url:profile.avatar_url,church_name:profile.church_name,token:session};
    const next=[entry,...accounts.filter(a=>a.id!==profile.id)].slice(0,4);
    await storage.setItem('church_saved_accounts',JSON.stringify(next));setSavedAccounts(next);
  },[]);
  const logout=useCallback(async()=>{
    const id=active.current.user?.id;active.current={user:null,token:null};setUser(null);setToken(null);
    await storage.removeItem('church_auth_token');await storage.removeItem('church_auth_user');
    const raw=await storage.getItem('church_saved_accounts');const accounts:SavedAccount[]=raw?JSON.parse(raw):[];
    const next=accounts.filter(a=>a.id!==id);await storage.setItem('church_saved_accounts',JSON.stringify(next));setSavedAccounts(next);
  },[]);
  const apply=useCallback(async(profile:User,session:string)=>{
    await storage.setItem('church_auth_token',session);await storage.setItem('church_auth_user',JSON.stringify(profile));
    active.current={token:session,user:profile};setToken(session);setUser(profile);await remember(profile,session);
  },[remember]);
  const refreshProfile=useCallback(async()=>{
    const session=active.current.token;if(!session)return;
    try {const response=await api.get('/api/auth/me',{headers:{Authorization:`Bearer ${session}`}});if(active.current.token!==session)return;active.current.user=response.data;setUser(response.data);await storage.setItem('church_auth_user',JSON.stringify(response.data));}
    catch(error:any){if(error.response?.status===401 && active.current.token===session)await logout();throw error;}
  },[logout]);
  useEffect(()=>{
    let mounted=true;
    const restore=async()=>{
      try {
        await initApiConfig();
        const [session,accounts,senior]=await Promise.all([storage.getItem('church_auth_token'),storage.getItem('church_saved_accounts'),storage.getItem('church_senior_mode')]);
        if(!mounted)return;setSavedAccounts(accounts?JSON.parse(accounts):[]);setSeniorMode(senior==='true');
        if(session){const response=await api.get('/api/auth/me',{headers:{Authorization:`Bearer ${session}`}});if(mounted)await apply(response.data,session);}
      }catch{if(mounted)await logout();}finally{if(mounted)setLoading(false);}
    };void restore();return()=>{mounted=false;};
  },[apply,logout]);
  const login=useCallback(async(email:string,password:string)=>{const response=await api.post('/api/auth/login',{email,password});await apply(response.data.user,response.data.token);await refreshProfile();},[apply,refreshProfile]);
  const loginDemo=useCallback(async(type:'maria'|'joao'|'lider'|'admin'|'raquel'|'pastor_memorial')=>{const emails={maria:'maria@igreja.com',joao:'joao@igreja.com',lider:'lider@igreja.com',admin:'admin@igreja.com',raquel:'raquel@memorial.com',pastor_memorial:'pastor.silas@memorial.com'};await login(emails[type],'123456');},[login]);
  const register=useCallback(async(payload:any)=>{const response=await api.post('/api/auth/register',payload);await apply(response.data.user,response.data.token);return response.data;},[apply]);
  const registerChurch=useCallback(async(payload:any)=>{const response=await api.post('/api/auth/register-church',payload);await apply(response.data.user,response.data.token);return response.data;},[apply]);
  const switchAccount=useCallback(async(id:string)=>{const account=savedAccounts.find(a=>a.id===id);if(!account)return;setLoading(true);try{const response=await api.get('/api/auth/me',{headers:{Authorization:`Bearer ${account.token}`}});await apply(response.data,account.token);}finally{setLoading(false);}},[savedAccounts,apply]);
  const removeSavedAccount=useCallback(async(id:string)=>{if(active.current.user?.id===id){await logout();return;}const next=savedAccounts.filter(a=>a.id!==id);await storage.setItem('church_saved_accounts',JSON.stringify(next));setSavedAccounts(next);},[logout,savedAccounts]);
  const joinChurch=useCallback(async(code:string)=>{await api.post('/api/auth/join-church',{code});await refreshProfile();},[refreshProfile]);
  const joinGroupByCode=useCallback(async(inviteCode:string)=>{await api.post('/api/groups/join',{inviteCode});await refreshProfile();},[refreshProfile]);
  const toggleSeniorMode=useCallback(async()=>{const next=!isSeniorMode;setSeniorMode(next);await storage.setItem('church_senior_mode',String(next));},[isSeniorMode]);
  return <AuthContext.Provider value={{user,token,loading,savedAccounts,isSeniorMode,toggleSeniorMode,login,loginDemo,register,registerChurch,switchAccount,removeSavedAccount,joinChurch,joinGroupByCode,logout,refreshProfile}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
