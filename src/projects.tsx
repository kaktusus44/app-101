import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createId } from './id'

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
}

type ProjectInput = Omit<Project, 'id' | 'balance' | 'income' | 'expense'>
type ProjectsContextValue = {
  projects: Project[]
  addProject: (project: ProjectInput) => string
  updateProject: (id: string, project: ProjectInput) => void
  deleteProject: (id: string) => void
}

const STORAGE_KEY = 'app101.projects'
const initialProjects: Project[] = [{
  id: 'test-project', name: 'Тест', shortName: 'Петя', customer: 'Васильев Василий', customerId: '',
  completionDate: '2026-09-04', area: 200, address: 'Москва, ул. Ленина, 2',
  photoAlbumUrl: '', balance: 0, income: 0, expense: 0,
}]
const ProjectsContext = createContext<ProjectsContextValue | null>(null)

function readProjects() {
  try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? JSON.parse(stored) as Project[] : initialProjects }
  catch { return initialProjects }
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(readProjects)
  function update(transform: (current: Project[]) => Project[]) { setProjects((current) => { const next = transform(current); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next }) }
  const value = useMemo<ProjectsContextValue>(() => ({
    projects,
    addProject(project) { const id = createId(); update((current) => [...current, { ...project, id, balance: 0, income: 0, expense: 0 }]); return id },
    updateProject(id, project) { update((current) => current.map((item) => item.id === id ? { ...item, ...project } : item)) },
    deleteProject(id) { update((current) => current.filter((item) => item.id !== id)) },
  }), [projects])
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects() { const value = useContext(ProjectsContext); if (!value) throw new Error('useProjects must be used inside ProjectsProvider'); return value }
