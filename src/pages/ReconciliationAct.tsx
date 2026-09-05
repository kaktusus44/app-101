import { Download, ExternalLink, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { api } from '../api'
import { useAuth } from '../auth'
import { useCounterparties } from '../counterparties'
import { PageHeader } from '../components/PageHeader'

type FinanceEvent = { id:string; type:'receipt'|'report'|'transfer'|'estimate'; amount:number; status:string; projectName:string; description:string; eventDate:string; receiptDestination:string; relatedPartyName:string; transferKind:string }
type LegalDetails = { fullName?:string; inn?:string; ogrn?:string; registrationAddress?:string; bankName?:string; bankAccount?:string; bik?:string; correspondentAccount?:string }

export function ReconciliationAct() {
  const { counterpartyId = '' } = useParams()
  const { user } = useAuth()
  const { counterparties } = useCounterparties()
  const isSelf = counterpartyId === 'me' || counterpartyId === user?.id
  const ownerId = isSelf ? user?.id ?? '' : counterpartyId
  const person = isSelf ? { name:user?.name ?? '', email:user?.email ?? '', phone:'' } : counterparties.find(item=>item.id===counterpartyId)
  const [events,setEvents]=useState<FinanceEvent[]>([])
  const [loading,setLoading]=useState(true)
  const [pdfUrl,setPdfUrl]=useState('')
  const [pdfBlob,setPdfBlob]=useState<Blob|null>(null)
  const [pdfError,setPdfError]=useState('')
  const [from,setFrom]=useState(()=>new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10))
  const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10))
  const [details,setDetails]=useState<LegalDetails>({})

  useEffect(()=>{if(!ownerId)return;setLoading(true);Promise.all([api<{events:FinanceEvent[]}>(`/counterparties/${ownerId}/finance-events`),api<LegalDetails>('/document-settings')]).then(([data,savedDetails])=>{setEvents(data.events);setDetails(savedDetails)}).catch(()=>setPdfError('Не удалось загрузить данные для акта сверки.')).finally(()=>setLoading(false))},[ownerId])
  useEffect(()=>{
    if(!person||loading)return
    const definition=buildAct({organization:user?.organizationName||user?.name||'Организация',counterparty:person.name,email:person.email||'',phone:person.phone||'',details,events,from,to})
    setPdfError('')
    generatePdf(definition).then((blob:Blob)=>{setPdfBlob(blob);setPdfUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return URL.createObjectURL(blob)})}).catch(()=>{setPdfBlob(null);setPdfError('Не удалось сформировать PDF. Попробуйте обновить страницу.')})
    return()=>setPdfUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return ''})
  },[person?.name,person?.email,person?.phone,loading,events,from,to,user?.organizationName,user?.name,details])
  if(!person)return <Navigate to="/counterparties" replace/>
  const fileName=`Акт_сверки_${safeName(person.name)}_${to.split('-').reverse().join('_')}.pdf`
  async function share(){if(!pdfBlob)return;const file=new File([pdfBlob],fileName,{type:'application/pdf'});if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:'Акт сверки',files:[file]})}else download(pdfBlob,fileName)}
  return <main className="light-page"><div className="mobile-page reconciliation-page"><PageHeader title="Акт сверки"/>
    <label className="reconciliation-period"><span>Период</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/><i>—</i><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <section className="pdf-preview">{pdfError?<p className="form-error">{pdfError}</p>:loading||!pdfUrl?<p>Формируем PDF…</p>:<><object aria-label="Предпросмотр акта сверки" data={pdfUrl} type="application/pdf"><p>Встроенный просмотр PDF не поддерживается этим браузером.</p></object><a className="pdf-preview-open" href={pdfUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/>Открыть PDF</a></>}</section>
    <div className="pdf-actions pdf-actions--three"><a href={pdfUrl||undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!pdfUrl}><ExternalLink/>Открыть</a><button onClick={()=>pdfBlob&&download(pdfBlob,fileName)} disabled={!pdfBlob}><Download/>Скачать</button><button className="primary-button" onClick={share} disabled={!pdfBlob}><Share2/>Поделиться</button></div>
  </div></main>
}

function buildAct(input:{organization:string;counterparty:string;email:string;phone:string;details:LegalDetails;events:FinanceEvent[];from:string;to:string}):TDocumentDefinitions{
  const confirmed=input.events.filter(event=>event.status==='confirmed'&&event.type!=='estimate').sort((a,b)=>a.eventDate.localeCompare(b.eventDate))
  const signed=(event:FinanceEvent)=>event.type==='receipt'?event.amount:-event.amount
  const opening=confirmed.filter(event=>event.eventDate<input.from).reduce((sum,event)=>sum+signed(event),0)
  const period=confirmed.filter(event=>event.eventDate>=input.from&&event.eventDate<=input.to)
  let running=opening
  const rows=period.map((event,index)=>{const amount=signed(event);running+=amount;return [String(index+1),formatDate(event.eventDate),eventTitle(event),event.projectName||'—',amount>0?money(amount):'—',amount<0?money(-amount):'—',money(running)]})
  const debit=period.filter(event=>signed(event)>0).reduce((sum,event)=>sum+signed(event),0)
  const credit=-period.filter(event=>signed(event)<0).reduce((sum,event)=>sum+signed(event),0)
  const details=[input.details.fullName,input.details.inn&&`ИНН ${input.details.inn}`,input.details.ogrn&&`ОГРН ${input.details.ogrn}`,input.details.registrationAddress].filter(Boolean).join(', ')
  const body:Content[]=[
    {text:'Акт сверки взаимных расчётов',style:'title'},
    {text:`за период с ${formatDate(input.from)} по ${formatDate(input.to)}`,alignment:'center',margin:[0,0,0,18]},
    {columns:[{stack:[{text:'Организация',style:'caption'},{text:input.organization,bold:true},{text:details||'Реквизиты организации не заполнены',fontSize:8,color:'#555'}]},{stack:[{text:'Контрагент',style:'caption'},{text:input.counterparty,bold:true},{text:[input.phone,input.email].filter(Boolean).join(' · ')||'Контактные данные не указаны',fontSize:8,color:'#555'}]}],columnGap:20,margin:[0,0,0,16]},
    {table:{widths:['*','auto'],body:[['Сальдо на начало периода',money(opening)],['Оборот: поступления',money(debit)],['Оборот: списания',money(credit)],['Сальдо на конец периода',money(running)]]},layout:'lightHorizontalLines',margin:[0,0,0,18]},
    {table:{headerRows:1,widths:[18,48,'*',70,49,49,49],body:[['№','Дата','Операция','Проект','Приход','Расход','Сальдо'],...rows]},layout:{fillColor:(row:number)=>row===0?'#ececf2':null,hLineColor:'#aaa',vLineColor:'#aaa'},fontSize:7},
    {columns:[{text:`По данным ${input.organization}\n________________ / ____________`,margin:[0,34,10,0]},{text:`По данным ${input.counterparty}\n________________ / ____________`,margin:[10,34,0,0]}],fontSize:9},
    {text:`Сформировано ${new Date().toLocaleDateString('ru-RU')}`,alignment:'center',fontSize:7,color:'#777',margin:[0,28,0,0]}
  ]
  if(!rows.length)body.splice(4,1,{text:'За выбранный период подтверждённых операций нет.',alignment:'center',margin:[0,22,0,22],color:'#666'})
  return {pageSize:'A4',pageMargins:[32,34,32,34],content:body,defaultStyle:{font:'Roboto',fontSize:9},styles:{title:{fontSize:16,bold:true,alignment:'center',margin:[0,0,0,4]},caption:{fontSize:8,color:'#777',margin:[0,0,0,3]}},footer:(page,pages)=>({text:`стр. ${page} из ${pages}`,alignment:'center',fontSize:7,color:'#777'})}
}
function eventTitle(event:FinanceEvent){if(event.type==='receipt')return event.receiptDestination==='company_fund'?'Поступление в Фонд компании':event.receiptDestination==='agent_fee'?'Агентское вознаграждение':'Поступление по проекту';if(event.type==='report')return event.description||'Отчёт о расходах';return event.description||'Перевод'}
function formatDate(value:string){const [y,m,d]=value.split('-');return d&&m&&y?`${d}.${m}.${y}`:value}
function money(value:number){return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}
function safeName(value:string){return value.trim().replace(/[^\p{L}\p{N}]+/gu,'_')||'контрагент'}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function generatePdf(definition:TDocumentDefinitions){const [{default:pdfMake},{default:pdfFonts}]=await Promise.all([import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);pdfMake.vfs=pdfFonts as unknown as Record<string,string>;return new Promise<Blob>(resolve=>pdfMake.createPdf(definition).getBlob(resolve))}
