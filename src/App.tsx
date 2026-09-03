import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { NewProject } from './pages/NewProject'
import { Projects } from './pages/Projects'
import { Profile } from './pages/Profile'
import { PriceListDetails } from './pages/PriceListDetails'
import { PriceLists } from './pages/PriceLists'
import { NewPriceItem } from './pages/NewPriceItem'
import { NewPriceList } from './pages/NewPriceList'
import { PricingProvider } from './pricing'
import { ProjectsProvider } from './projects'
import { ProjectDetails } from './pages/ProjectDetails'
import { CounterpartiesProvider } from './counterparties'
import { Counterparties } from './pages/Counterparties'
import { InviteCounterparty } from './pages/InviteCounterparty'
import { AcceptInvitation } from './pages/AcceptInvitation'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="login-page"><section className="login-card"><p>Загрузка…</p></section></main>
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

function EditorRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user?.role === 'organization' ? <Outlet /> : <Navigate to="/" replace />
}

export function App() {
  return (
    <AuthProvider>
      <CounterpartiesProvider><ProjectsProvider><PricingProvider><Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<AcceptInvitation />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/counterparties" element={<Counterparties />} />
          <Route path="/price-lists" element={<PriceLists />} />
          <Route path="/price-lists/:priceListId" element={<PriceListDetails />} />
          <Route element={<EditorRoute />}>
            <Route path="/projects/new" element={<NewProject />} />
            <Route path="/price-lists/new" element={<NewPriceList />} />
            <Route path="/price-lists/:priceListId/items/new" element={<NewPriceItem />} />
            <Route path="/price-lists/:priceListId/items/:itemId/edit" element={<NewPriceItem />} />
            <Route path="/counterparties/invite" element={<InviteCounterparty />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></PricingProvider></ProjectsProvider></CounterpartiesProvider>
    </AuthProvider>
  )
}
