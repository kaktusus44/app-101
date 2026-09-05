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
import { CounterpartyDetails } from './pages/CounterpartyDetails'
import { PhotoAlbumHelp } from './pages/PhotoAlbumHelp'
import { EventHistory } from './pages/EventHistory'
import { NewEstimate } from './pages/NewEstimate'
import { ExpenseArticlesProvider } from './expenseArticles'
import { ProjectExpenseArticles } from './pages/ProjectExpenseArticles'
import { ExpenseArticleEditor } from './pages/ExpenseArticleEditor'
import { ProjectDocuments } from './pages/ProjectDocuments'
import { ReconciliationAct } from './pages/ReconciliationAct'
import { CompanyFund } from './pages/CompanyFund'
import { Analytics } from './pages/Analytics'
import { ProjectAgentFeeRecipients } from './pages/ProjectAgentFeeRecipients'
import { ProjectParticipants } from './pages/ProjectParticipants'
import { Archive } from './pages/Archive'
import { AppShell } from './components/AppShell'

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
      <CounterpartiesProvider><ProjectsProvider><PricingProvider><ExpenseArticlesProvider><Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<AcceptInvitation />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/projects/:projectId/expense-articles" element={<ProjectExpenseArticles />} />
          <Route path="/projects/:projectId/documents" element={<ProjectDocuments />} />
          <Route path="/projects/:projectId/agent-fee-recipients" element={<ProjectAgentFeeRecipients />} />
          <Route path="/projects/:projectId/participants" element={<ProjectParticipants />} />
          <Route path="/projects/photo-album-help" element={<PhotoAlbumHelp />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/counterparties" element={<Counterparties />} />
          <Route path="/counterparties/:counterpartyId/events/new/estimate" element={<NewEstimate />} />
          <Route path="/counterparties/:counterpartyId/events/new/:eventType" element={<CounterpartyDetails />} />
          <Route path="/counterparties/:counterpartyId/events/:eventId" element={<CounterpartyDetails />} />
          <Route path="/counterparties/:counterpartyId" element={<CounterpartyDetails />} />
          <Route path="/counterparties/:counterpartyId/reconciliation" element={<ReconciliationAct />} />
          <Route path="/events" element={<EventHistory />} />
          <Route path="/company-fund" element={<CompanyFund />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/price-lists" element={<PriceLists />} />
          <Route path="/price-lists/:priceListId" element={<PriceListDetails />} />
          <Route element={<EditorRoute />}>
            <Route path="/projects/new" element={<NewProject />} />
            <Route path="/projects/:projectId/edit" element={<NewProject />} />
            <Route path="/projects/:projectId/expense-articles/new" element={<ExpenseArticleEditor />} />
            <Route path="/projects/:projectId/expense-articles/:articleId/edit" element={<ExpenseArticleEditor />} />
            <Route path="/price-lists/new" element={<NewPriceList />} />
            <Route path="/price-lists/:priceListId/items/new" element={<NewPriceItem />} />
            <Route path="/price-lists/:priceListId/items/:itemId/edit" element={<NewPriceItem />} />
            <Route path="/counterparties/invite" element={<InviteCounterparty />} />
            <Route path="/archive" element={<Archive />} />
          </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></ExpenseArticlesProvider></PricingProvider></ProjectsProvider></CounterpartiesProvider>
    </AuthProvider>
  )
}
