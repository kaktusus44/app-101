import { ChevronRight, FileSpreadsheet, History, ListChecks, UserRound, UsersRound, WalletCards } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useCounterparties } from '../counterparties'
import { PageHeader } from '../components/PageHeader'
import { isFundEvent, money, summarizeFund, useFinanceEvents } from '../finance'

export function CompanyFund(){
 const navigate=useNavigate();const {user}=useAuth();const {counterparties}=useCounterparties();const {events}=useFinanceEvents()
 const fundEvents=useMemo(()=>events.filter(isFundEvent),[events]);const balance=summarizeFund(events).balance;const pendingReports=fundEvents.filter(event=>event.type==='report'&&event.status==='pending').length;const partners=counterparties.filter(item=>item.category==='partner').length
 const menu=[
  {label:'Прайс-листы',meta:'',icon:FileSpreadsheet,to:'/price-lists'},
  {label:'События',meta:String(fundEvents.length),icon:History,to:'/events?scope=company_fund'},
  {label:'Статьи расходов',meta:String(fundEvents.filter(event=>event.type==='estimate').length),icon:ListChecks,to:'/events?scope=company_fund&type=estimate'},
  {label:'Партнёры',meta:String(partners),icon:UsersRound,to:'/counterparties?category=partner'},
  {label:'Руководитель компании',meta:'',icon:UserRound,to:'/counterparties/me'},
 ]
 return <main className="light-page"><div className="mobile-page company-fund-page"><PageHeader title="Фонд компании" onBack={()=>navigate('/',{replace:true})}/><h2>{user?.organizationName||'Организация'}</h2><p className="company-fund-manager">Руководитель компании: <b>{user?.name}</b></p><section className="company-fund-summary"><div><span>Баланс</span><strong className={balance<0?'is-negative':''}>{money(balance)}</strong></div><div><span>Непринятые отчёты Фонда компании</span><strong>{pendingReports}</strong></div></section><section className="company-fund-menu">{menu.map(({label,meta,icon:Icon,to})=><button key={label} onClick={()=>navigate(to)}><Icon/><span>{label}</span>{meta&&<b>{meta}</b>}<ChevronRight/></button>)}</section><button className="company-fund-balance-link" onClick={()=>navigate('/counterparties/me')}><WalletCards/>Открыть операции Фонда компании<ChevronRight/></button></div></main>
}
