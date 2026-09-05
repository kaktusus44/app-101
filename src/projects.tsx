import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'

export type Project = {
  id: string
  name: string
  shortName: string
  customer: string
  customerId?: string
  completionDate: string
  area: number
  address: string
  photoAlbumUrl: string
  balance: number
  income: number
  expense: number
  agentFeeShares?: { recipientId: string; name: string; category: string; percent: number; locked: boolean }[]
  participantIds?: string[]
}

export type ProjectInput = Omit<Project, 'id' | 'balance' | 'income' | 'expense'>
type ProjectsContextValue = {
  projects: Project[]
  loading: boolean
  error: string
  addProject: (project: ProjectInput) => Promise<string>
  updateProject: (id: string, project: ProjectInput) => Promise<void>
  deleteProject: (id: string) => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!user) { setProjects([]); setLoading(false); return }
    setLoading(true); setError('')
    api<Project[]>('/projects')
      .then((items) => { if (active) setProjects(items) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить проекты') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, user?.role])

  const value = useMemo<ProjectsContextValue>(() => ({
    projects, loading, error,
    async addProject(project) { const created = await api<{id:string}>('/projects',{method:'POST',body:JSON.stringify(project)});setProjects((current)=>[...current,{...project,id:created.id,balance:0,income:0,expense:0}]);return created.id },
    async updateProject(id, project) { const existing=projects.find((item)=>item.id===id);const merged=existing?{...existing,...project}:project;await api(`/projects/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(merged)});setProjects((current)=>current.map((item)=>item.id===id?{...item,...merged}:item)) },
    async deleteProject(id) { await api(`/projects/${encodeURIComponent(id)}`,{method:'DELETE'});setProjects((current)=>current.filter((item)=>item.id!==id)) },
  }), [projects,loading,error])
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects() { const value = useContext(ProjectsContext); if (!value) throw new Error('useProjects must be used inside ProjectsProvider'); return value }
