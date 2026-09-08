const modules = [
  ['🎯','O que estudar agora?','Prioridades por risco, domínio e revisão'],
  ['📅','Calendário','Aulas, provas e compromissos'],
  ['✓','Tarefas','Fluxo GTD e próximas ações'],
  ['🧠','Conteúdos & Revisões','Domínio e revisão espaçada'],
  ['❌','Caderno de Erros','Transforme erros em aprendizado'],
  ['🚨','Radar Pré-Prova','Cobertura, acerto e risco'],
  ['📊','Desempenho','Horas, questões e evolução'],
  ['🩺','GTD Médico','OSCE, habilidades e flashcards'],
  ['📚','Biblioteca','Suas fontes de estudo']
]

export default function Home(){
 return <main className="shell">
  <aside><div className="brand"><b>🎓 GTD Acadêmico</b><small>Sistema de Organização</small></div><nav><a className="active">⌂ Dashboard</a>{modules.map(([i,n])=><a key={n}>{i} {n}</a>)}</nav><footer>© Gustavo Rodrigues<br/><small>Baseado no método GTD de David Allen</small></footer></aside>
  <section className="content">
   <header><div><span>VISÃO GERAL</span><h1>Dashboard</h1></div><button>＋ Adicionar</button></header>
   <div className="hero"><span>SEU SISTEMA ACADÊMICO</span><h2>Organize o semestre.<br/>Estude com prioridade.<br/>Acompanhe sua evolução.</h2><p>Um sistema acadêmico que transforma calendário, tarefas, conteúdos, revisões e desempenho em próximas ações claras.</p></div>
   <div className="stats"><article><span>PRÓXIMAS AÇÕES</span><b>0</b><small>tarefas abertas</small></article><article><span>CONTEÚDOS CRÍTICOS</span><b>0</b><small>prioridade máxima</small></article><article><span>REVISÕES</span><b>0</b><small>pendentes</small></article><article><span>PROVAS EM RISCO</span><b>0</b><small>risco alto</small></article></div>
   <div className="grid"><article className="panel"><span>🎯 FOCO</span><h3>O que estudar agora?</h3><div className="empty">Cadastre seus conteúdos para receber prioridades.</div></article><article className="panel"><span>🚨 RADAR</span><h3>Próximas avaliações</h3><div className="empty">Cadastre suas avaliações para ativar o radar.</div></article></div>
   <h3 className="sectionTitle">Módulos do sistema</h3><div className="modules">{modules.map(([i,n,d])=><article key={n}><i>{i}</i><div><b>{n}</b><small>{d}</small></div></article>)}</div>
  </section>
 </main>
}
