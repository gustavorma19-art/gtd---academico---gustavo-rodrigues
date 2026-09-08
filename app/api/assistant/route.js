export async function POST(request){
  try{
    const {message,context={}}=await request.json()
    if(!message?.trim()) return Response.json({error:'Escreva o que você precisa organizar.'},{status:400})
    if(!process.env.OPENAI_API_KEY) return Response.json({error:'IA ainda não ativada. Configure OPENAI_API_KEY na Vercel.'},{status:503})

    const system=`Você é o Assistente Acadêmico do GTD Acadêmico. Ajude o aluno a organizar estudos usando apenas o contexto fornecido. Priorize GTD, provas próximas, tarefas, domínio, revisões e desempenho. Nunca afirme ter alterado dados. Quando sugerir mudanças, apresente primeiro um plano claro para confirmação do aluno. Responda em português do Brasil, de forma prática e concisa.`
    const payload={model:process.env.OPENAI_MODEL||'gpt-5-mini',store:false,input:[{role:'system',content:system},{role:'user',content:`CONTEXTO DO APP:\n${JSON.stringify(context)}\n\nPEDIDO DO ALUNO:\n${message}`} ]}
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(payload)})
    const data=await r.json()
    if(!r.ok) return Response.json({error:data?.error?.message||'Falha ao consultar a IA.'},{status:r.status})
    const text=data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||data.output_text||'Sem resposta.'
    return Response.json({text})
  }catch(e){return Response.json({error:'Não foi possível processar a solicitação.'},{status:500})}
}
