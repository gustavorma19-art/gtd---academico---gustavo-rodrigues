# Arquitetura atual

## Frontend
Next.js App Router com React.

## Estado atual
A primeira versão funcional mantém dados no navegador via `localStorage`. Isso permite validar rapidamente o fluxo de uso sem acoplar o produto a um backend prematuramente.

## Próxima evolução
Migrar persistência para banco em nuvem com autenticação e manter a interface desacoplada da camada de dados.

## Estratégia Git
- `main`: produção estável
- `develop`: desenvolvimento e preview
- mudanças relevantes entram em `main` via pull request
