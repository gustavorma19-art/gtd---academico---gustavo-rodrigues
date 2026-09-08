import './globals.css'
import GlobalLaunchers from './global-launchers'

export const metadata = {
  title: 'GTD Acadêmico — Gustavo Rodrigues',
  description: 'Sistema acadêmico de organização, desempenho e preparação.'
}

export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body>{children}<GlobalLaunchers/></body></html>
}
