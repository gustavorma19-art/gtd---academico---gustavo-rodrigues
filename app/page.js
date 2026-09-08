'use client'

import { useEffect, useMemo, useState } from 'react'

const nav = [
  ['dashboard','⌂','Dashboard'],
  ['tasks','✓','Tarefas'],
  ['contents','🧠','Conteúdos'],
  ['assessments','🚨','Avaliações'],
  ['calendar','📅','Calendário']
]

const emptyData = { tasks: [], contents: [], assessments: [] }

function daysUntil(date){
  if(!date) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target-today)/86400000)
}

function riskFor(a, contents){
  const days = daysUntil(a.date)
  const linked = contents.filter(c => c.assessment === a.name)
  const coverage = linked.length ? linked.filter(c => ['Bom','Dominado'].includes(c.mastery)).length / linked.length : 0
  if(days !== null && days <= 7 && coverage < .5) return 'Alto'
  if(days !== null && days <= 14 && coverage < .75) return 'Médio'
  return 'Baixo'
}

export default function Home(){
  const [active,setActive] = useState('dashboard')
  const [data,setData] = useState(emptyData)
  const [ready,setReady] = useState(false)
  const [modal,setModal] = useState(null)

  useEffect(()=>{
    try{
      const saved = localStorage.getItem('gtd-academico-data')
      if(saved) setData(JSON.parse(saved))
    } catch {}
    setReady(true)
  },[])

  useEffect(()=>{
    if(ready) localStorage.setItem('gtd-academico-data', JSON.stringify(data))
  },[data,ready])

  const stats = useMemo(()=>{
    const openTasks = data.tasks.filter(t=>!t.done).length
    const critical = data.contents.filter(c=>['Não iniciado','Fraco'].includes(c.mastery)).length
    const reviews = data.contents.filter(c=>c.review && daysUntil(c.review) <= 0).length
    const risky = data.assessments.filter(a=>riskFor(a,data.contents)==='Alto').length
    return {openTasks,critical,reviews,risky}
  },[data])

  const studyNow = useMemo(()=> data.contents
    .map(c=>({ ...c, score: (c.mastery==='Não iniciado'?4:c.mastery==='Fraco'?3:c.mastery==='Em progresso'?2:1) + (c.review && daysUntil(c.review)<=0?3:0) + (c.assessment ? Math.max(0,3-Math.floor((daysUntil(data.assessments.find(a=>a.name===c.assessment)?.date) ?? 30)/7)):0) }))
    .sort((a,b)=>b.score-a.score).slice(0,4), [data])

  function addItem(type, form){
    const id = crypto.randomUUID()
    setData(d=>({...d,[type]:[...d[type],{id,...form}]}))
    setModal(null)
  }

  function remove(type,id){ setData(d=>({...d,[type]:d[type].filter(x=>x.id!==id)})) }
  function toggleTask(id){ setData(d=>({...d,tasks:d.tasks.map(t=>t.id===id?{...t,done:!t.done}:t)})) }

  return <main className="shell">
    <aside>
      <div className="brand"><b>🎓 GTD Acadêmico</b><small>Sistema de Organização</small></div>
      <nav>{nav.map(([id,i,n])=><button key={id} className={active===id?'active':''} onClick={()=>setActive(id)}>{i}<span>{n}</span></button>)}</nav>
      <footer>© Gustavo Rodrigues<br/><small>Baseado no método GTD de David Allen</small></footer>
    </aside>

    <section className="content">
      <header><div><span>GTD ACADÊMICO</span><h1>{nav.find(n=>n[0]===active)?.[2]}</h1></div><div className="headerActions"><button className="ghost" onClick={()=>setActive('dashboard')}>Visão geral</button><button onClick={()=>setModal(active==='dashboard'?'tasks':active==='calendar'?'assessments':active)}>＋ Adicionar</button></div></header>

      {active==='dashboard' && <Dashboard stats={stats} studyNow={studyNow} data={data} setActive={setActive}/>} 
      {active==='tasks' && <Tasks items={data.tasks} toggle={toggleTask} remove={id=>remove('tasks',id)}/>} 
      {active==='contents' && <Contents items={data.contents} remove={id=>remove('contents',id)}/>} 
      {active==='assessments' && <Assessments items={data.assessments} contents={data.contents} remove={id=>remove('assessments',id)}/>} 
      {active==='calendar' && <Calendar assessments={data.assessments}/>} 
    </section>

    {modal && <Modal type={modal} assessments={data.assessments} onClose={()=>setModal(null)} onSave={form=>addItem(modal,form)}/>} 
  </main>
}

function Dashboard({stats,studyNow,data,setActive}){
 return <>
   <div className="hero"><span>SEU SISTEMA ACADÊMICO</span><h2>Organize o semestre.<br/>Estude com prioridade.<br/>Acompanhe sua evolução.</h2><p>Agora o sistema já registra tarefas, conteúdos e avaliações no navegador e transforma esses dados em prioridades acadêmicas.</p></div>
   <div className="stats"><article><span>PRÓXIMAS AÇÕES</span><b>{stats.openTasks}</b><small>tarefas abertas</small></article><article><span>CONTEÚDOS CRÍTICOS</span><b>{stats.critical}</b><small>fracos ou não iniciados</small></article><article><span>REVISÕES</span><b>{stats.reviews}</b><small>vencidas ou para hoje</small></article><article><span>PROVAS EM RISCO</span><b>{stats.risky}</b><small>risco alto</small></article></div>
   <div className="grid">
    <article className="panel"><div className="panelHead"><div><span>🎯 FOCO</span><h3>O que estudar agora?</h3></div><button className="linkBtn" onClick={()=>setActive('contents')}>Ver conteúdos →</button></div>{studyNow.length?studyNow.map(c=><div className="row" key={c.id}><div><b>{c.name}</b><small>{c.subject || 'Sem disciplina'} · {c.mastery}</small></div><span className="priority">P{Math.max(1,5-c.score)}</span></div>):<div className="empty">Cadastre conteúdos para receber prioridades.</div>}</article>
    <article className="panel"><div className="panelHead"><div><span>🚨 RADAR</span><h3>Próximas avaliações</h3></div><button className="linkBtn" onClick={()=>setActive('assessments')}>Abrir radar →</button></div>{data.assessments.length?data.assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(a=><div className="row" key={a.id}><div><b>{a.name}</b><small>{a.subject || 'Sem disciplina'} · {daysUntil(a.date)} dias</small></div><span className={`risk ${riskFor(a,data.contents).toLowerCase()}`}>{riskFor(a,data.contents)}</span></div>):<div className="empty">Cadastre avaliações para ativar o radar.</div>}</article>
   </div>
   <h3 className="sectionTitle">Base do MVP</h3><div className="modules"><article><i>✓</i><div><b>Tarefas persistentes</b><small>Próximas ações com conclusão</small></div></article><article><i>🧠</i><div><b>Conteúdos & domínio</b><small>Base para priorização automática</small></div></article><article><i>🚨</i><div><b>Radar pré-prova</b><small>Risco calculado por prazo e cobertura</small></div></article></div>
 </>
}

function Tasks({items,toggle,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Próximas ações</h2><p>Capture o que precisa ser feito e conclua sem perder o histórico local.</p></div>{items.length?items.map(t=><div className="listItem" key={t.id}><label><input type="checkbox" checked={!!t.done} onChange={()=>toggle(t.id)}/><span className={t.done?'done':''}><b>{t.name}</b><small>{t.subject || 'Geral'}{t.date?` · ${t.date}`:''}</small></span></label><button className="danger" onClick={()=>remove(t.id)}>Excluir</button></div>):<Empty text="Nenhuma tarefa cadastrada."/>}</section> }

function Contents({items,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Conteúdos & revisões</h2><p>Registre domínio, revisão e vínculo com avaliações.</p></div>{items.length?items.map(c=><div className="listItem" key={c.id}><div><b>{c.name}</b><small>{c.subject || 'Sem disciplina'} · Domínio: {c.mastery}{c.review?` · Revisão ${c.review}`:''}</small></div><button className="danger" onClick={()=>remove(c.id)}>Excluir</button></div>):<Empty text="Nenhum conteúdo cadastrado."/>}</section> }

function Assessments({items,contents,remove}){ return <section className="pagePanel"><div className="pageIntro"><h2>Radar pré-prova</h2><p>O risco inicial considera proximidade da prova e domínio dos conteúdos vinculados.</p></div>{items.length?items.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=><div className="assessmentCard" key={a.id}><div><span className={`risk ${riskFor(a,contents).toLowerCase()}`}>{riskFor(a,contents)}</span><h3>{a.name}</h3><p>{a.subject || 'Sem disciplina'} · {a.date} · {daysUntil(a.date)} dias</p></div><button className="danger" onClick={()=>remove(a.id)}>Excluir</button></div>):<Empty text="Nenhuma avaliação cadastrada."/>}</section> }

function Calendar({assessments}){ return <section className="pagePanel"><div className="pageIntro"><h2>Calendário acadêmico</h2><p>Primeira versão: avaliações em ordem cronológica. Aulas e compromissos entram na próxima etapa.</p></div>{assessments.length?assessments.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(a=><div className="calendarItem" key={a.id}><div className="dateBox"><b>{new Date(`${a.date}T00:00:00`).getDate()}</b><small>{new Date(`${a.date}T00:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</small></div><div><b>{a.name}</b><small>{a.subject || 'Avaliação'}</small></div></div>):<Empty text="Seu calendário ainda está vazio."/>}</section> }

function Empty({text}){ return <div className="empty">{text}<br/><small>Use “＋ Adicionar” no topo.</small></div> }

function Modal({type,assessments,onClose,onSave}){
 const [form,setForm] = useState(type==='tasks'?{name:'',subject:'',date:'',done:false}:type==='contents'?{name:'',subject:'',mastery:'Não iniciado',review:'',assessment:''}:{name:'',subject:'',date:''})
 const label = type==='tasks'?'Nova tarefa':type==='contents'?'Novo conteúdo':'Nova avaliação'
 const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}))
 const submit=e=>{e.preventDefault(); if(!form.name) return; onSave(form)}
 return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="modal" onSubmit={submit}><div className="modalHead"><div><span>CADASTRO</span><h2>{label}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div><label>Nome<input name="name" value={form.name} onChange={change} autoFocus placeholder={type==='contents'?'Ex.: Pré-eclâmpsia':'Digite um nome'}/></label><label>Disciplina<input name="subject" value={form.subject} onChange={change} placeholder="Ex.: Obstetrícia"/></label>{type!=='contents'&&<label>Data<input type="date" name="date" value={form.date} onChange={change}/></label>}{type==='contents'&&<><label>Domínio<select name="mastery" value={form.mastery} onChange={change}><option>Não iniciado</option><option>Fraco</option><option>Em progresso</option><option>Bom</option><option>Dominado</option></select></label><label>Próxima revisão<input type="date" name="review" value={form.review} onChange={change}/></label><label>Avaliação vinculada<select name="assessment" value={form.assessment} onChange={change}><option value="">Nenhuma</option>{assessments.map(a=><option key={a.id}>{a.name}</option>)}</select></label></>}<div className="modalActions"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button>Salvar</button></div></form></div>
}
