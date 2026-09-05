import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'

export type UserRole = 'organization' | 'client'
export type User = { id: string; organizationId: string; email: string; name: string; organizationName: string; role: UserRole; category?: 'customer'|'partner'|'contractor'|'supplier'|'employee'|'' }
type Profile = Pick<User, 'name' | 'email' | 'organizationName'>
type AuthContextValue = { user: User | null; loading: boolean; signIn: (email: string, password: string, role?: UserRole) => Promise<void>; signOut: () => Promise<void>; updateProfile: (profile: Profile) => Promise<void>; acceptInvitation: (token: string, email: string, password: string) => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api<User>('/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    async signIn(email, password) { setUser(await api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) })) },
    async signOut() { await api('/auth/logout', { method: 'POST' }).catch(() => undefined); setUser(null) },
    async updateProfile(profile) { setUser(await api<User>('/me', { method: 'PATCH', body: JSON.stringify(profile) })) },
    async acceptInvitation(token, email, password) { setUser(await api<User>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: JSON.stringify({ email, password }) })) },
  }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
