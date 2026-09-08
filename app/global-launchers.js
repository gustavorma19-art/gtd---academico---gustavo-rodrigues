'use client'

export default function GlobalLaunchers(){
  return <div style={{position:'fixed',right:18,bottom:18,zIndex:60,display:'flex',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}>
    <a href="/semana" style={{textDecoration:'none',background:'#eef2f8',color:'#344054',border:'1px solid #dfe4eb',borderRadius:12,padding:'11px 14px',fontWeight:700,fontSize:12,boxShadow:'0 8px 24px rgba(16,24,40,.08)'}}>🗓 Semana Acadêmica</a>
    <a href="/assistente" style={{textDecoration:'none',background:'#315ee8',color:'#fff',borderRadius:12,padding:'11px 14px',fontWeight:800,fontSize:12,boxShadow:'0 10px 28px rgba(49,94,232,.28)'}}>✨ Assistente IA</a>
  </div>
}
