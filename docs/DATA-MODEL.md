# Modelo de dados planejado

A versão atual usa `localStorage` apenas para validar o fluxo do produto. A persistência em nuvem deve adotar entidades normalizadas.

## Entidades principais

### User
Conta e preferências do estudante.

### Subject
Disciplina ou área acadêmica.

### Task
Próxima ação GTD, com status, prazo, contexto e vínculo opcional com disciplina/projeto/avaliação.

### Assessment
Prova, OSCE, apresentação ou entrega avaliativa.

### Content
Tópico granular de estudo, com domínio, revisão e vínculo com avaliação.

### StudySession
Registro real de estudo: duração, tipo, questões feitas e corretas.

### Review
Evento de revisão espaçada ligado a um conteúdo.

### ErrorEntry
Caderno de erros com tipo do erro, conceito correto e revisão.

### Resource
Fonte de estudo ligada a disciplina ou conteúdo.

## Dados calculados

Cobertura, acurácia, risco acadêmico, prioridade e desempenho devem ser calculados a partir das entidades acima, evitando duplicação de estado.
