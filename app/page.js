'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Performance, StudySessions, ErrorNotebook, Library } from './extra-modules'

const nav = [
  ['dashboard','⌂','Dashboard'],
  ['tasks','✓','Tarefas'],
  ['contents','◫','Conteúdos'],
  ['assessments','⚑','Avaliações'],
  ['calendar','□','Calendário'],
  ['performance','↗','Desempenho'],
  ['study','◷','Sessões de estudo'],
  ['errors','✎','Caderno de erros'],
  ['library','▤','Biblioteca']
]

const emptyData = { tasks: [], contents: [], assessments: [] }

function daysUntil(date){
  if(!date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(`${date}T00:00:00`)
  if(Number.isNaN(target.getTime())) return null
  return Math.ceil((target-today)/86400000)
}
function dateLabel(date){
  const d=daysUntil(date)
  if(d===null) return 'Sem data'
  if(d===0) return 'Hoje'
  if(d===1) return 'Amanhã'
  if(d>1) return `em ${d} dias`
  return `${Math.abs(d)} dias atrás`
}
function riskFor(a,contents){
  const days=daysUntil(a.date)
  const linked=contents.filter(c=>c.assessmentId===a.id)
  const coverage=linked.length?linked.filter(c=>['Bom','Dominado'].includes(c.mastery)).length/linked.length:0
  if(days!==null&&days>=0&&days<=7&&coverage<.5) return 'Alto'
  if(days!==null&&days>=0&&days<=14&&coverage<.75) return 'Médio'
  return 'Baixo'
}
function dbTask(t){return{id:t.id,name:t.name,subject:t.subject||'',date:t.due_date||'',done:!!t.done}}
function dbAssessment(a){return{id:a.id,name:a.name,subject:a.subject||'',date:a.assessment_date}}
function dbContent(c,assessments){const a=assessments.find(x=>x.id===c.assessment_id);return{id:c.id,name:c.name,subject:c.subject||'',mastery:c.mastery,review:c.next_review||'',assessmentId:c.assessment_id||'',assessment:a?.name||''}}

export default function Home(){
  const [active,setActive]=useState('dashboard')
  const [data,setData]=useState(emptyData)
  const [session,setSession]=useState(null)
  const [authReady,setAuthReady]=useState(false)
  const [loading,setLoading]=useState(false)
  const [modal,setModal]=useState(null)
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);setAuthReady(true)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);setAuthReady(true)})
    return()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{if(authReady&&session?.user) loadCloud(); if(authReady&&!session) setData(emptyData)},[authReady,session?.user?.id])

  async function loadCloud(){
    setLoading(true)
    const [{data:tasks,error:e1},{data:assessments,error:e2},{data:contents,error:e3}]=await Promise.all([
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('assessments').select('*').order('assessment_date'),
      supabase.from('contents').select('*').order('created_at')
    ])
    if(e1||e2||e3){setNotice('Não foi possível carregar todos os dados da nuvem.');setLoading(false);return}
    const as=assessments||[]
    setData({tasks:(tasks||[]).map(dbTask),assessments:as.map(dbAssessment),contents:(contents||[]).map(c=>dbContent(c,as))})
    setLoading(false)
  }

  const stats=useMemo(()=>({
    openTasks:data.tasks.filter(t=>!t.done).length,
    critical:data.contents.filter(c=>['Não iniciado','Fraco'].includes(c.mastery)).length,
    reviews:data.contents.filter(c=>c.review&&daysUntil(c.review)<=0).length,
    risky:data.assessments.filter(a=>riskFor(a,data.contents)==='Alto').length
  }),[data])
  const studyNow=useMemo(()=>data.contents.map(c=>({...c,score:(c.mastery==='Não iniciado'?4:c.mastery==='Fraco'?3:c.mastery==='Em progresso'?2:1)+(c.review&&daysUntil(c.review)<=0?3:0)+(c.assessmentId?Math.max(0,3-Math.floor((daysUntil(data.assessments.find(a=>a.id===c.assessmentId)?.date)??30)/7)):0)})).sort((a,b)=>b.score-a.score).slice(0,5),[data])

  async function addItem(type,form){
    if(!session?.user)return
    setLoading(true);let res
    if(type==='tasks') res=await supabase.from('tasks').insert({user_id:session.user.id,name:form.name,subject:form.subject||null,due_date:form.date||null,done:false}).select().single()
    if(type==='assessments') res=await supabase.from('assessments').insert({user_id:session.user.id,name:form.name,subject:form.subject||null,assessment_date:form.date}).select().single()
    if(type==='contents') res=await supabase.from('contents').insert({user_id:session.user.id,name:form.name,subject:form.subject||null,mastery:form.mastery,next_review:form.review||null,assessment_id:form.assessmentId||null}).select().single()
    setLoading(false)
    if(res?.error){setNotice('Não foi possível salvar.');return}
    setModal(null);setNotice('Salvo na nuvem.');loadCloud()
  }
  async function remove(type,id){const table=type==='tasks'?'tasks':type==='contents'?'contents':'assessments';const {error}=await supabase.from(table).delete().eq('id',id);if(error)setNotice('Não foi possível excluir.');else loadCloud()}
  async function toggleTask(id){const t=data.tasks.find(x=>x.id===id);if(!t)return;const {error}=await supabase.from('tasks').update({done:!t.done}).eq('id',id);if(error)setNotice('Não foi possível atualizar.');else loadCloud()}
  async function signOut(){await supabase.auth.signOut();setData(emptyData);setActive('dashboard')}

  if(!authReady)return <div className="authScreen"><div className="authCard"><div className="brandMark">G</div><b>GTD Acadêmico</b><p>Preparando seu ambiente...</p></div></div>
  if(!session)return <AuthScreen/>
  const canAdd=['dashboard','tasks','contents','assessments','calendar'].includes(active)
  const currentTitle=nav.find(n=>n[0]===active)?.[2]||'Dashboard'

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">G</div><div><b>GTD Acadêmico</b><small>Study OS</small></div></div>
      <div className="navLabel">ORGANIZAÇÃO</div>
      <nav>{nav.slice(0,5).map(([id,i,n])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}><span className="navIcon">{i}</span><span>{n}</span></button>)}</nav>
      <div className="navLabel">APRENDIZADO</div>
      <nav>{nav.slice(5).map(([id,i,n])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}><span className="navIcon">{i}</span><span>{n}</span></button>)}</nav>
      <div className="navLabel">INTELIGÊNCIA</div>
      <nav className="smartNav">
        <a href="/semana"><span className="navIcon">▦</span><span>Semana Acadêmica</span></a>
        <a href="/assistente" className="aiNav"><span className="navIcon">✦</span><span>Assistente IA</span><em>AI</em></a>
      </nav>
      <footer><div className="userMini"><div className="avatar">{(session.user.email||'A').slice(0,1).toUpperCase()}</div><div><b>{session.user.email}</b><button className="logout" onClick={signOut}>Sair da conta</button></div></div><small className="copyright">© Gustavo Rodrigues</small></footer>
    </aside>

    <section className="content">
      <header><div><span>GTD ACADÊMICO</span><h1>{currentTitle}</h1></div><div className="headerActions"><a className="aiHeader" href="/assistente">✦ Perguntar à IA</a>{canAdd&&<button disabled={loading} onClick={()=>setModal(active==='dashboard'?'tasks':active==='calendar'?'assessments':active)}>＋ Adicionar</button>}</div></header>
      {notice&&<div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}{loading&&<div className="syncing">Sincronizando com a nuvem…</div>}
      {active==='dashboard'&&<Dashboard stats={stats} studyNow={studyNow} data={data} setActive={setActive}/>} 
      {active==='tasks'&&<Tasks items={data.tasks} toggle={toggleTask} remove={id=>remove('tasks',id)}/>} 
      {active==='contents'&&<Contents items={data.contents} remove={id=>remove('contents',id)}/>} 
      {active==='assessments'&&<Assessments items={data.assessments} contents={data.contents} remove={id=>remove('assessments',id)}/>} 
      {active==='calendar'&&<Calendar assessments={data.assessments}/>} 
      {active==='performance'&&<Performance coreData={data}/>} 
      {active==='study'&&<StudySessions/>} 
      {active==='errors'&&<ErrorNotebook/>} 
      {active==='library'&&<Library/>}
    </section>
    {modal&&<Modal type={modal} assessments={data.assessments} onClose={()=>setModal(null)} onSave={f=>addItem(modal,f)}/>} 
  </main>
}

function AuthScreen(){
  const [mode,setMode]=useState('login');const [form,setForm]=useState({email:'',password:'',name:''});const [busy,setBusy]=useState(false);const [message,setMessage]=useState('')
  async function submit(e){e.preventDefault();setBusy(true);setMessage('');if(mode==='login'){const{error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password});if(error)setMessage(error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':error.message)}else{const{data,error}=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name}}});if(error)setMessage(error.message);else if(!data.session)setMessage('Conta criada. Confira seu e-mail para confirmar o cadastro.')}setBusy(false)}
  return <div className="authScreen"><form className="authCard" onSubmit={submit}><div className="authBrand"><div className="brandMark large">G</div><div><b>GTD Acadêmico</b><span>Seu sistema inteligente de organização e estudo.</span></div></div><h1>{mode==='login'?'Bem-vindo de volta':'Criar sua conta'}</h1>{mode==='signup'&&<label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Seu nome"/></label>}<label>E-mail<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="voce@email.com"/></label><label>Senha<input required minLength="6" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mínimo 6 caracteres"/></label>{message&&<div className="authMessage">{message}</div>}<button disabled={busy}>{busy?'Aguarde…':mode==='login'?'Entrar':'Criar conta'}</button><button type="button" className="authSwitch" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Ainda não tenho conta':'Já tenho uma conta'}</button></form></div>
}

function Dashboard({stats,studyNow,data,setActive}){return <>
  <div className="hero"><div><span>SEU PAINEL DE ESTUDO</span><h2>Menos caos.<br/>Mais clareza para estudar.</h2><p>Seu semestre organizado em um único sistema: prioridades, desempenho, revisões, biblioteca e inteligência acadêmica.</p><div className="heroActions"><a href="/assistente">✦ Organizar com IA</a><a className="secondary" href="/semana">Ver minha semana →</a></div></div><div className="heroOrb"><b>GTD</b><small>ACADEMIC OS</small></div></div>
  <div className="stats"><article><span>PRÓXIMAS AÇÕES</span><b>{stats.openTasks}</b><small>tarefas abertas</small></article><article><span>CONTEÚDOS CRÍTICOS</span><b>{stats.critical}</b><small>precisam de atenção</small></article><article><span>REVISÕES</span><b>{stats.reviews}</b><small>para hoje ou atrasadas</small></article><article><span>RISCO PRÉ-PROVA</span><b>{stats.risky}</b><small>avaliações em risco alto</small></article></div>
  <div className="grid"><article className="panel"><div className="panelHead"><div><span>FOCO INTELIGENTE</span><h3>O que estudar agora?</h3></div><button className="linkBtn" onClick={()=>setActive('contents')}>Todos os conteúdos →</button></div>{studyNow.length?studyNow.map(c=><div className="row" key={c.id}><div><b>{c.name}</b><small>{c.subject||'Sem disciplina'} · {c.mastery}</small></div><span className="priority">P{Math.max(1,5-c.score)}</span></div>):<div className="empty">Cadastre conteúdos para o sistema calcular suas prioridades.</div>}</article><article className="panel"><div className="panelHead"><div><span>RADAR PRÉ-PROVA</span><h3>Próximas avaliações</h3></div><button className="linkBtn" onClick={()=>setActive('assessments')}>Abrir radar →</button></div>{data.assessments.length?data.assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(a=><div className="row" key={a.id}><div><b>{a.name}</b><small>{a.subject||'Sem disciplina'} · {dateLabel(a.date)}</small></div><span className={`risk ${riskFor(a,data.contents).toLowerCase()}`}>{riskFor(a,data.contents)}</span></div>):<div className="empty">Cadastre avaliações para ativar seu radar.</div>}</article></div>
  <div className="sectionHeading"><div><span>ECOSSISTEMA</span><h3>Seu centro acadêmico</h3></div></div><div className="modules"><article onClick={()=>setActive('performance')}><i>↗</i><div><b>Desempenho</b><small>Tempo, acurácia e cobertura</small></div></article><article onClick={()=>setActive('study')}><i>◷</i><div><b>Sessões de estudo</b><small>Tempo e questões realizadas</small></div></article><article onClick={()=>setActive('errors')}><i>✎</i><div><b>Caderno de erros</b><small>Erros, dúvidas e correções</small></div></article><article onClick={()=>setActive('library')}><i>▤</i><div><b>Biblioteca</b><small>Materiais e recursos</small></div></article><a href="/semana"><i>▦</i><div><b>Semana Acadêmica</b><small>Planejamento operacional</small></div></a><a href="/assistente" className="aiModule"><i>✦</i><div><b>Assistente IA</b><small>Organize seu app por conversa</small></div></a></div>
</>}

function Tasks({items,toggle,remove}){return <section className="pagePanel"><div className="pageIntro"><span>GTD</span><h2>Próximas ações</h2><p>Capture o que precisa ser feito e mantenha tudo sincronizado.</p></div>{items.length?items.map(t=><div className="listItem" key={t.id}><label><input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)}/><span className={t.done?'done':''}><b>{t.name}</b><small>{t.subject||'Geral'}{t.date?` · ${t.date}`:''}</small></span></label><button className="danger" onClick={()=>remove(t.id)}>Excluir</button></div>):<Empty text="Nenhuma tarefa cadastrada."/>}</section>}
function Contents({items,remove}){return <section className="pagePanel"><div className="pageIntro"><span>APRENDIZADO</span><h2>Conteúdos & revisões</h2><p>Registre domínio, revisão e vínculo com avaliações.</p></div>{items.length?items.map(c=><div className="listItem" key={c.id}><div><b>{c.name}</b><small>{c.subject||'Sem disciplina'} · Domínio: {c.mastery}{c.review?` · Revisão ${c.review}`:''}{c.assessment?` · ${c.assessment}`:''}</small></div><button className="danger" onClick={()=>remove(c.id)}>Excluir</button></div>):<Empty text="Nenhum conteúdo cadastrado."/>}</section>}
function Assessments({items,contents,remove}){return <section className="pagePanel"><div className="pageIntro"><span>PREPARAÇÃO</span><h2>Radar pré-prova</h2><p>Risco calculado por proximidade e domínio dos conteúdos vinculados.</p></div>{items.length?items.map(a=><div className="assessmentCard" key={a.id}><div><span className={`risk ${riskFor(a,contents).toLowerCase()}`}>{riskFor(a,contents)}</span><h3>{a.name}</h3><p>{a.subject||'Sem disciplina'} · {a.date} · {dateLabel(a.date)}</p></div><button className="danger" onClick={()=>remove(a.id)}>Excluir</button></div>):<Empty text="Nenhuma avaliação cadastrada."/>}</section>}
function Calendar({assessments}){return <section className="pagePanel"><div className="pageIntro"><span>AGENDA</span><h2>Calendário acadêmico</h2><p>Suas avaliações em ordem cronológica.</p></div>{assessments.length?assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=>{const d=new Date(`${a.date}T00:00:00`);return <div className="calendarItem" key={a.id}><div className="dateBox"><b>{d.getDate()}</b><small>{d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</small></div><div><b>{a.name}</b><small>{a.subject||'Avaliação'} · {dateLabel(a.date)}</small></div></div>}):<Empty text="Seu calendário ainda está vazio."/>}</section>}
function Empty({text}){return <div className="empty">{text}<br/><small>Use “＋ Adicionar” no topo.</small></div>}

function Modal({type,assessments,onClose,onSave}){
  const [form,setForm]=useState(type==='tasks'?{name:'',subject:'',date:''}:type==='contents'?{name:'',subject:'',mastery:'Não iniciado',review:'',assessmentId:''}:{name:'',subject:'',date:''})
  const label=type==='tasks'?'Nova tarefa':type==='contents'?'Novo conteúdo':'Nova avaliação'
  return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={e=>{e.preventDefault();if(form.name)onSave(form)}}><div className="modalHead"><div><span>CADASTRO</span><h2>{label}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Nome<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Disciplina<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label>{type!=='contents'&&<label>Data<input required={type==='assessments'} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>}{type==='contents'&&<><label>Domínio<select value={form.mastery} onChange={e=>setForm({...form,mastery:e.target.value})}><option>Não iniciado</option><option>Fraco</option><option>Em progresso</option><option>Bom</option><option>Dominado</option></select></label><label>Próxima revisão<input type="date" value={form.review} onChange={e=>setForm({...form,review:e.target.value})}/></label><label>Avaliação vinculada<select value={form.assessmentId} onChange={e=>setForm({...form,assessmentId:e.target.value})}><option value="">Nenhuma</option>{assessments.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></>}<div className="modalActions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button>Salvar</button></div></form></div>
}
