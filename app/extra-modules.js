'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Empty({text}){ return <div className="empty">{text}</div> }

export function Performance({coreData}){
  const [sessions,setSessions]=useState([])
  useEffect(()=>{ supabase.from('study_sessions').select('*').order('studied_at',{ascending:false}).then(({data})=>setSessions(data||[])) },[])
  const metrics=useMemo(()=>{
    const minutes=sessions.reduce((s,x)=>s+(x.minutes||0),0)
    const questions=sessions.reduce((s,x)=>s+(x.questions||0),0)
    const correct=sessions.reduce((s,x)=>s+(x.correct||0),0)
    const accuracy=questions?Math.round(correct/questions*100):0
    const mastered=coreData.contents.filter(c=>['Bom','Dominado'].includes(c.mastery)).length
    const coverage=coreData.contents.length?Math.round(mastered/coreData.contents.length*100):0
    const done=coreData.tasks.filter(t=>t.done).length
    const taskRate=coreData.tasks.length?Math.round(done/coreData.tasks.length*100):0
    return {minutes,questions,accuracy,coverage,taskRate}
  },[sessions,coreData])
  const bySubject=useMemo(()=>Object.values(sessions.reduce((acc,s)=>{
    const key=s.subject||'Geral'; if(!acc[key]) acc[key]={subject:key,minutes:0,questions:0,correct:0}
    acc[key].minutes+=s.minutes||0;acc[key].questions+=s.questions||0;acc[key].correct+=s.correct||0;return acc
  },{})).sort((a,b)=>b.minutes-a.minutes),[sessions])
  return <section className="pagePanel"><div className="pageIntro"><h2>Desempenho do aluno</h2><p>Visão consolidada de estudo, questões, cobertura dos conteúdos e execução das tarefas.</p></div>
    <div className="stats"><article><span>TEMPO ESTUDADO</span><b>{Math.floor(metrics.minutes/60)}h {metrics.minutes%60}m</b><small>registrado</small></article><article><span>ACURÁCIA</span><b>{metrics.accuracy}%</b><small>{metrics.questions} questões</small></article><article><span>COBERTURA</span><b>{metrics.coverage}%</b><small>conteúdos bons/dominados</small></article><article><span>EXECUÇÃO GTD</span><b>{metrics.taskRate}%</b><small>tarefas concluídas</small></article></div>
    <h3 className="sectionTitle">Desempenho por disciplina</h3>{bySubject.length?bySubject.map(s=><div className="listItem" key={s.subject}><div><b>{s.subject}</b><small>{Math.floor(s.minutes/60)}h {s.minutes%60}m · {s.questions} questões · {s.questions?Math.round(s.correct/s.questions*100):0}% de acertos</small></div></div>):<Empty text="Registre sessões de estudo para gerar seu desempenho."/>}
  </section>
}

export function StudySessions(){
  const [items,setItems]=useState([]); const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({subject:'',topic:'',minutes:'',questions:'',correct:'',studied_at:new Date().toISOString().slice(0,10)})
  const load=()=>supabase.from('study_sessions').select('*').order('studied_at',{ascending:false}).then(({data})=>setItems(data||[]))
  useEffect(()=>{load()},[])
  async function add(e){e.preventDefault();setBusy(true);const {data:{user}}=await supabase.auth.getUser(); if(user){await supabase.from('study_sessions').insert({user_id:user.id,subject:form.subject||null,topic:form.topic,minutes:Number(form.minutes)||0,questions:Number(form.questions)||0,correct:Number(form.correct)||0,studied_at:form.studied_at})} setBusy(false);setForm(f=>({...f,topic:'',minutes:'',questions:'',correct:''}));load()}
  async function remove(id){await supabase.from('study_sessions').delete().eq('id',id);load()}
  return <section className="pagePanel"><div className="pageIntro"><h2>Sessões de estudo</h2><p>Registre tempo, questões e acertos para alimentar o desempenho acadêmico.</p></div>
    <form className="modal" style={{boxShadow:'none',width:'100%',marginBottom:20}} onSubmit={add}><label>Disciplina<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Ex.: Obstetrícia"/></label><label>Tema<input required value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})} placeholder="Ex.: Pré-eclâmpsia"/></label><label>Data<input type="date" value={form.studied_at} onChange={e=>setForm({...form,studied_at:e.target.value})}/></label><label>Minutos<input type="number" min="0" value={form.minutes} onChange={e=>setForm({...form,minutes:e.target.value})}/></label><label>Questões realizadas<input type="number" min="0" value={form.questions} onChange={e=>setForm({...form,questions:e.target.value})}/></label><label>Acertos<input type="number" min="0" max={form.questions||undefined} value={form.correct} onChange={e=>setForm({...form,correct:e.target.value})}/></label><div className="modalActions"><button disabled={busy}>{busy?'Salvando…':'Registrar sessão'}</button></div></form>
    {items.length?items.map(i=><div className="listItem" key={i.id}><div><b>{i.topic}</b><small>{i.subject||'Geral'} · {i.studied_at} · {i.minutes} min · {i.questions} questões · {i.questions?Math.round(i.correct/i.questions*100):0}%</small></div><button className="danger" onClick={()=>remove(i.id)}>Excluir</button></div>):<Empty text="Nenhuma sessão registrada."/>}
  </section>
}

export function ErrorNotebook(){
  const [items,setItems]=useState([]); const [form,setForm]=useState({subject:'',topic:'',error_text:'',correction:''})
  const load=()=>supabase.from('error_notes').select('*').order('created_at',{ascending:false}).then(({data})=>setItems(data||[]))
  useEffect(()=>{load()},[])
  async function add(e){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from('error_notes').insert({user_id:user.id,...form,subject:form.subject||null,correction:form.correction||null});setForm({subject:'',topic:'',error_text:'',correction:''});load()}
  async function remove(id){await supabase.from('error_notes').delete().eq('id',id);load()}
  return <section className="pagePanel"><div className="pageIntro"><h2>Caderno de erros</h2><p>Transforme erros de questões e provas em pontos objetivos de revisão.</p></div>
    <form className="modal" style={{boxShadow:'none',width:'100%',marginBottom:20}} onSubmit={add}><label>Disciplina<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Tema<input required value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}/></label><label>Erro / dúvida<textarea required value={form.error_text} onChange={e=>setForm({...form,error_text:e.target.value})} style={{display:'block',width:'100%',marginTop:6,minHeight:90,border:'1px solid #dfe3ea',borderRadius:10,padding:12}}/></label><label>Correção / aprendizagem<textarea value={form.correction} onChange={e=>setForm({...form,correction:e.target.value})} style={{display:'block',width:'100%',marginTop:6,minHeight:90,border:'1px solid #dfe3ea',borderRadius:10,padding:12}}/></label><div className="modalActions"><button>Salvar erro</button></div></form>
    {items.length?items.map(i=><div className="assessmentCard" key={i.id}><div><h3>{i.topic}</h3><p>{i.subject||'Geral'} · {i.error_text}</p>{i.correction&&<p><b>Correção:</b> {i.correction}</p>}</div><button className="danger" onClick={()=>remove(i.id)}>Excluir</button></div>):<Empty text="Seu caderno de erros está vazio."/>}
  </section>
}

export function Library(){
  const [items,setItems]=useState([]); const [form,setForm]=useState({title:'',subject:'',resource_type:'PDF',url:'',notes:''})
  const load=()=>supabase.from('library_resources').select('*').order('created_at',{ascending:false}).then(({data})=>setItems(data||[]))
  useEffect(()=>{load()},[])
  async function add(e){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();if(!user)return;await supabase.from('library_resources').insert({user_id:user.id,...form,subject:form.subject||null,url:form.url||null,notes:form.notes||null});setForm({title:'',subject:'',resource_type:'PDF',url:'',notes:''});load()}
  async function remove(id){await supabase.from('library_resources').delete().eq('id',id);load()}
  return <section className="pagePanel"><div className="pageIntro"><h2>Biblioteca acadêmica</h2><p>Centralize PDFs, links, livros, aulas e outros recursos vinculados às disciplinas.</p></div>
    <form className="modal" style={{boxShadow:'none',width:'100%',marginBottom:20}} onSubmit={add}><label>Título<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Disciplina<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label><label>Tipo<select value={form.resource_type} onChange={e=>setForm({...form,resource_type:e.target.value})}><option>PDF</option><option>Livro</option><option>Vídeo</option><option>Site</option><option>Prova antiga</option><option>Resumo</option><option>Outro</option></select></label><label>Link<input type="url" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..."/></label><label>Observações<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label><div className="modalActions"><button>Adicionar à biblioteca</button></div></form>
    {items.length?items.map(i=><div className="listItem" key={i.id}><div><b>{i.title}</b><small>{i.resource_type} · {i.subject||'Geral'}{i.notes?` · ${i.notes}`:''}</small>{i.url&&<small><a href={i.url} target="_blank" rel="noreferrer">Abrir recurso ↗</a></small>}</div><button className="danger" onClick={()=>remove(i.id)}>Excluir</button></div>):<Empty text="Sua biblioteca ainda está vazia."/>}
  </section>
}
