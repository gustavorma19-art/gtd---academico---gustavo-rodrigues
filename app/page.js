'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const nav = [
  ['dashboard','⌂','Dashboard'],
  ['tasks','✓','Tarefas'],
  ['contents','🧠','Conteúdos'],
  ['assessments','🚨','Avaliações'],
  ['calendar','📅','Calendário']
]

const emptyData = { tasks: [], contents: [], assessments: [] }

function normalizeData(raw){
  return {
    tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
    contents: Array.isArray(raw?.contents) ? raw.contents : [],
    assessments: Array.isArray(raw?.assessments) ? raw.assessments : []
  }
}

function daysUntil(date){
  if(!date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(`${date}T00:00:00`)
  if(Number.isNaN(target.getTime())) return null
  return Math.ceil((target-today)/86400000)
}

function dateLabel(date){
  const days = daysUntil(date)
  if(days === null) return 'Sem data'
  if(days === 0) return 'Hoje'
  if(days === 1) return 'Amanhã'
  if(days > 1) return `em ${days} dias`
  if(days === -1) return 'Ontem'
  return `${Math.abs(days)} dias atrás`
}

function riskFor(a, contents){
  const days = daysUntil(a.date)
  const linked = contents.filter(c => c.assessmentId === a.id || c.assessment === a.name)
  const coverage = linked.length ? linked.filter(c => ['Bom','Dominado'].includes(c.mastery)).length / linked.length : 0
  if(days !== null && days >= 0 && days <= 7 && coverage < .5) return 'Alto'
  if(days !== null && days >= 0 && days <= 14 && coverage < .75) return 'Médio'
  return 'Baixo'
}

function localToCloudTask(t,userId){ return { user_id:userId, name:t.name, subject:t.subject||null, due_date:t.date||null, done:!!t.done } }
function localToCloudAssessment(a,userId){ return { user_id:userId, name:a.name, subject:a.subject||null, assessment_date:a.date } }
function dbTask(t){ return { id:t.id, name:t.name, subject:t.subject||'', date:t.due_date||'', done:t.done } }
function dbAssessment(a){ return { id:a.id, name:a.name, subject:a.subject||'', date:a.assessment_date } }
function dbContent(c, assessments){
  const assessment = assessments.find(a=>a.id===c.assessment_id)
  return { id:c.id, name:c.name, subject:c.subject||'', mastery:c.mastery, review:c.next_review||'', assessmentId:c.assessment_id||'', assessment:assessment?.name||'' }
}

export default function Home(){
  const [active,setActive] = useState('dashboard')
  const [data,setData] = useState(emptyData)
  const [session,setSession] = useState(null)
  const [authReady,setAuthReady] = useState(false)
  const [loading,setLoading] = useState(false)
  const [modal,setModal] = useState(null)
  const [notice,setNotice] = useState('')

  useEffect(()=>{
    let alive = true
    supabase.auth.getSession().then(({data:{session}})=>{
      if(!alive) return
      setSession(session)
      setAuthReady(true)
    })
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next)=>{
      setSession(next)
      setAuthReady(true)
    })
    return ()=>{ alive=false; subscription.unsubscribe() }
  },[])

  useEffect(()=>{
    if(!authReady) return
    if(session?.user) loadCloud(session.user.id)
    else setData(emptyData)
  },[authReady,session?.user?.id])

  async function loadCloud(userId){
    setLoading(true)
    setNotice('')
    const [{data:tasks,error:taskError},{data:assessments,error:assessmentError}] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at',{ascending:true}),
      supabase.from('assessments').select('*').order('assessment_date',{ascending:true})
    ])
    if(taskError || assessmentError){
      setNotice('Não foi possível carregar seus dados da nuvem.')
      setLoading(false)
      return
    }
    const {data:contents,error:contentError} = await supabase.from('contents').select('*').order('created_at',{ascending:true})
    if(contentError){
      setNotice('Não foi possível carregar seus conteúdos da nuvem.')
      setLoading(false)
      return
    }

    let next = {
      tasks:(tasks||[]).map(dbTask),
      assessments:(assessments||[]).map(dbAssessment),
      contents:(contents||[]).map(c=>dbContent(c,assessments||[]))
    }

    const cloudEmpty = !next.tasks.length && !next.assessments.length && !next.contents.length
    if(cloudEmpty){
      try{
        const saved = normalizeData(JSON.parse(localStorage.getItem('gtd-academico-data')||'{}'))
        const hasLocal = saved.tasks.length || saved.assessments.length || saved.contents.length
        if(hasLocal){
          const {data:insertedAssessments} = saved.assessments.length
            ? await supabase.from('assessments').insert(saved.assessments.filter(a=>a.name&&a.date).map(a=>localToCloudAssessment(a,userId))).select('*')
            : {data:[]}
          if(saved.tasks.length) await supabase.from('tasks').insert(saved.tasks.filter(t=>t.name).map(t=>localToCloudTask(t,userId)))
          if(saved.contents.length){
            const newAssessments = insertedAssessments||[]
            const contentRows = saved.contents.filter(c=>c.name).map(c=>({
              user_id:userId,
              name:c.name,
              subject:c.subject||null,
              mastery:c.mastery||'Não iniciado',
              next_review:c.review||null,
              assessment_id:newAssessments.find(a=>a.name===c.assessment)?.id||null
            }))
            if(contentRows.length) await supabase.from('contents').insert(contentRows)
          }
          localStorage.removeItem('gtd-academico-data')
          setNotice('Seus dados antigos deste navegador foram migrados para a nuvem.')
          setLoading(false)
          return loadCloud(userId)
        }
      } catch {}
    }

    next = normalizeData(next)
    setData(next)
    setLoading(false)
  }

  const stats = useMemo(()=>{
    const openTasks = data.tasks.filter(t=>!t.done).length
    const critical = data.contents.filter(c=>['Não iniciado','Fraco'].includes(c.mastery)).length
    const reviews = data.contents.filter(c=>c.review && daysUntil(c.review) <= 0).length
    const risky = data.assessments.filter(a=>riskFor(a,data.contents)==='Alto').length
    return {openTasks,critical,reviews,risky}
  },[data])

  const studyNow = useMemo(()=> data.contents
    .map(c=>({ ...c, score: (c.mastery==='Não iniciado'?4:c.mastery==='Fraco'?3:c.mastery==='Em progresso'?2:1) + (c.review && daysUntil(c.review)<=0?3:0) + ((c.assessmentId||c.assessment) ? Math.max(0,3-Math.floor((daysUntil(data.assessments.find(a=>a.id===c.assessmentId || a.name===c.assessment)?.date) ?? 30)/7)):0) }))
    .sort((a,b)=>b.score-a.score).slice(0,4), [data])

  async function addItem(type, form){
    if(!session?.user) return
    setLoading(true)
    let error = null
    if(type==='tasks'){
      const res = await supabase.from('tasks').insert(localToCloudTask(form,session.user.id)).select('*').single()
      error=res.error
      if(res.data) setData(d=>({...d,tasks:[...d.tasks,dbTask(res.data)]}))
    } else if(type==='assessments'){
      if(!form.date){ setNotice('Escolha a data da avaliação.'); setLoading(false); return }
      const res = await supabase.from('assessments').insert(localToCloudAssessment(form,session.user.id)).select('*').single()
      error=res.error
      if(res.data) setData(d=>({...d,assessments:[...d.assessments,dbAssessment(res.data)]}))
    } else if(type==='contents'){
      const row={ user_id:session.user.id, name:form.name, subject:form.subject||null, mastery:form.mastery||'Não iniciado', next_review:form.review||null, assessment_id:form.assessmentId||null }
      const res=await supabase.from('contents').insert(row).select('*').single()
      error=res.error
      if(res.data) setData(d=>({...d,contents:[...d.contents,dbContent(res.data,d.assessments.map(a=>({id:a.id,name:a.name})))]}))
    }
    setLoading(false)
    if(error){ setNotice('Não foi possível salvar. Tente novamente.'); return }
    setNotice('Salvo na nuvem.')
    setModal(null)
  }

  async function remove(type,id){
    const table = type==='tasks'?'tasks':type==='contents'?'contents':'assessments'
    const {error}=await supabase.from(table).delete().eq('id',id)
    if(error){ setNotice('Não foi possível excluir.'); return }
    setData(d=>({...d,[type]:d[type].filter(x=>x.id!==id), ...(type==='assessments'?{contents:d.contents.map(c=>c.assessmentId===id?{...c,assessmentId:'',assessment:''}:c)}:{})}))
  }

  async function toggleTask(id){
    const task=data.tasks.find(t=>t.id===id)
    if(!task) return
    const next=!task.done
    const {error}=await supabase.from('tasks').update({done:next}).eq('id',id)
    if(error){ setNotice('Não foi possível atualizar a tarefa.'); return }
    setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,done:next}:t)}))
  }

  async function signOut(){ await supabase.auth.signOut(); setData(emptyData); setActive('dashboard') }

  if(!authReady) return <div className="authScreen"><div className="authCard"><b>🎓 GTD Acadêmico</b><p>Preparando seu ambiente...</p></div></div>
  if(!session) return <AuthScreen />

  return <main className="shell">
    <aside>
      <div className="brand"><b>🎓 GTD Acadêmico</b><small>Sistema de Organização</small></div>
      <nav>{nav.map(([id,i,n])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}>{i}<span>{n}</span></button>)}</nav>
      <footer>{session.user.email}<br/><button className="logout" onClick={signOut}>Sair</button><br/><small>© Gustavo Rodrigues · Método GTD de David Allen</small></footer>
    </aside>

    <section className="content">
      <header><div><span>GTD ACADÊMICO</span><h1>{nav.find(n=>n[0]===active)?.[2]}</h1></div><div className="headerActions"><button className="ghost" onClick={()=>setActive('dashboard')}>Visão geral</button><button disabled={loading} onClick={()=>setModal(active==='dashboard'?'tasks':active==='calendar'?'assessments':active)}>＋ Adicionar</button></div></header>
      {notice && <div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      {loading && <div className="syncing">Sincronizando com a nuvem…</div>}
      {active==='dashboard' && <Dashboard stats={stats} studyNow={studyNow} data={data} setActive={setActive}/>} 
      {active==='tasks' && <Tasks items={data.tasks} toggle={toggleTask} remove={id=>remove('tasks',id)}/>} 
      {active==='contents' && <Contents items={data.contents} remove={id=>remove('contents',id)}/>} 
      {active==='assessments' && <Assessments items={data.assessments} contents={data.contents} remove={id=>remove('assessments',id)}/>} 
      {active==='calendar' && <Calendar assessments={data.assessments}/>} 
    </section>

    {modal && <Modal type={modal} assessments={data.assessments} onClose={()=>setModal(null)} onSave={form=>addItem(modal,form)}/>} 
  </main>
}

function AuthScreen(){
  const [mode,setMode]=useState('login')
  const [form,setForm]=useState({email:'',password:'',name:''})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}))
  const submit=async e=>{
    e.preventDefault(); setBusy(true); setMessage('')
    if(mode==='login'){
      const {error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password})
      if(error) setMessage(error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':error.message)
    }else{
      const {data,error}=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.name}}})
      if(error) setMessage(error.message)
      else if(!data.session) setMessage('Conta criada. Confira seu e-mail para confirmar o cadastro e depois faça login.')
      else setMessage('Conta criada com sucesso.')
    }
    setBusy(false)
  }
  return <div className="authScreen"><form className="authCard" onSubmit={submit}><div className="authBrand"><b>🎓 GTD Acadêmico</b><span>Organização acadêmica inteligente, agora sincronizada na nuvem.</span></div><h1>{mode==='login'?'Entrar':'Criar conta'}</h1>{mode==='signup'&&<label>Nome<input name="name" value={form.name} onChange={change} placeholder="Seu nome"/></label>}<label>E-mail<input required type="email" name="email" value={form.email} onChange={change} placeholder="voce@email.com"/></label><label>Senha<input required minLength="6" type="password" name="password" value={form.password} onChange={change} placeholder="Mínimo 6 caracteres"/></label>{message&&<div className="authMessage">{message}</div>}<button disabled={busy}>{busy?'Aguarde…':mode==='login'?'Entrar':'Criar conta'}</button><button type="button" className="authSwitch" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'Ainda não tenho conta':'Já tenho uma conta'}</button></form></div>
}

function Dashboard({stats,studyNow,data,setActive}){
 return <>
   <div className="hero"><span>SEU SISTEMA ACADÊMICO</span><h2>Organize o semestre.<br/>Estude com prioridade.<br/>Acompanhe sua evolução.</h2><p>Suas tarefas, conteúdos e avaliações agora ficam vinculados à sua conta e sincronizados na nuvem.</p></div>
   <div className="stats"><article><span>PRÓXIMAS AÇÕES</span><b>{stats.openTasks}</b><small>tarefas abertas</small></article><article><span>CONTEÚDOS CRÍTICOS</span><b>{stats.critical}</b><small>fracos ou não iniciados</small></article><article><span>REVISÕES</span><b>{stats.reviews}</b><small>vencidas ou para hoje</small></article><article><span>PROVAS EM RISCO</span><b>{stats.risky}</b><small>risco alto</small></article></div>
   <div className="grid">
    <article className="panel"><div className="panelHead"><div><span>🎯 FOCO</span><h3>O que estudar agora?</h3></div><button className="linkBtn" onClick={()=>setActive('contents')}>Ver conteúdos →</button></div>{studyNow.length?studyNow.map(c=><div className="row" key={c.id}><div><b>{c.name}</b><small>{c.subject || 'Sem disciplina'} · {c.mastery}</small></div><span className="priority">P{Math.max(1,5-c.score)}</span></div>):<div className="empty">Cadastre conteúdos para receber prioridades.</div>}</article>
    <article className="panel"><div className="panelHead"><div><span>🚨 RADAR</span><h3>Próximas avaliações</h3></div><button className="linkBtn" onClick={()=>setActive('assessments')}>Abrir radar →</button></div>{data.assessments.length?data.assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(a=><div className="row" key={a.id}><div><b>{a.name}</b><small>{a.subject || 'Sem disciplina'} · {dateLabel(a.date)}</small></div><span className={`risk ${riskFor(a,data.contents).toLowerCase()}`}>{riskFor(a,data.contents)}</span></div>):<div className="empty">Cadastre avaliações para ativar o radar.</div>}</article>
   </div>
   <h3 className="sectionTitle">Base do sistema</h3><div className="modules"><article><i>☁️</i><div><b>Sincronização em nuvem</b><small>Dados vinculados à sua conta</small></div></article><article><i>🧠</i><div><b>Conteúdos & domínio</b><small>Base para priorização automática</small></div></article><article><i>🚨</i><div><b>Radar pré-prova</b><small>Risco por prazo e cobertura</small></div></article></div>
 </>
}

function Tasks({items,toggle,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Próximas ações</h2><p>Capture o que precisa ser feito e mantenha tudo sincronizado.</p></div>{items.length?items.map(t=><div className="listItem" key={t.id}><label><input type="checkbox" checked={!!t.done} onChange={()=>toggle(t.id)}/><span className={t.done?'done':''}><b>{t.name}</b><small>{t.subject || 'Geral'}{t.date?` · ${t.date}`:''}</small></span></label><button className="danger" onClick={()=>remove(t.id)}>Excluir</button></div>):<Empty text="Nenhuma tarefa cadastrada."/>}</section> }
function Contents({items,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Conteúdos & revisões</h2><p>Registre domínio, revisão e vínculo com avaliações.</p></div>{items.length?items.map(c=><div className="listItem" key={c.id}><div><b>{c.name}</b><small>{c.subject || 'Sem disciplina'} · Domínio: {c.mastery}{c.review?` · Revisão ${c.review}`:''}{c.assessment?` · ${c.assessment}`:''}</small></div><button className="danger" onClick={()=>remove(c.id)}>Excluir</button></div>):<Empty text="Nenhum conteúdo cadastrado."/>}</section> }
function Assessments({items,contents,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Radar pré-prova</h2><p>O risco inicial considera proximidade da prova e domínio dos conteúdos vinculados.</p></div>{items.length?items.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=><div className="assessmentCard" key={a.id}><div><span className={`risk ${riskFor(a,contents).toLowerCase()}`}>{riskFor(a,contents)}</span><h3>{a.name}</h3><p>{a.subject || 'Sem disciplina'} · {a.date} · {dateLabel(a.date)}</p></div><button className="danger" onClick={()=>remove(a.id)}>Excluir</button></div>):<Empty text="Nenhuma avaliação cadastrada."/>}</section> }
function Calendar({assessments}){ return <section className="pagePanel"><div className="pageIntro"><h2>Calendário acadêmico</h2><p>Avaliações em ordem cronológica. Aulas e compromissos entram na próxima evolução.</p></div>{assessments.length?assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=>{const d=new Date(`${a.date}T00:00:00`);return <div className="calendarItem" key={a.id}><div className="dateBox"><b>{d.getDate()}</b><small>{d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</small></div><div><b>{a.name}</b><small>{a.subject || 'Avaliação'} · {dateLabel(a.date)}</small></div></div>}):<Empty text="Seu calendário ainda está vazio."/>}</section> }
function Empty({text}){ return <div className="empty">{text}<br/><small>Use “＋ Adicionar” no topo.</small></div> }

function Modal({type,assessments,onClose,onSave}){
 const [form,setForm] = useState(type==='tasks'?{name:'',subject:'',date:'',done:false}:type==='contents'?{name:'',subject:'',mastery:'Não iniciado',review:'',assessmentId:''}:{name:'',subject:'',date:''})
 const label = type==='tasks'?'Nova tarefa':type==='contents'?'Novo conteúdo':'Nova avaliação'
 const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}))
 const submit=e=>{e.preventDefault(); if(!form.name) return; onSave(form)}
 return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}><div className="modalHead"><div><span>CADASTRO</span><h2>{label}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Nome<input required name="name" value={form.name} onChange={change} autoFocus placeholder={type==='contents'?'Ex.: Pré-eclâmpsia':'Digite um nome'}/></label><label>Disciplina<input name="subject" value={form.subject} onChange={change} placeholder="Ex.: Obstetrícia"/></label>{type!=='contents'&&<label>Data<input required={type==='assessments'} type="date" name="date" value={form.date} onChange={change}/></label>}{type==='contents'&&<><label>Domínio<select name="mastery" value={form.mastery} onChange={change}><option>Não iniciado</option><option>Fraco</option><option>Em progresso</option><option>Bom</option><option>Dominado</option></select></label><label>Próxima revisão<input type="date" name="review" value={form.review} onChange={change}/></label><label>Avaliação vinculada<select name="assessmentId" value={form.assessmentId} onChange={change}><option value="">Nenhuma</option>{assessments.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></>}<div className="modalActions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button>Salvar</button></div></form></div>
}
