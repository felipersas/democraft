# Oportunidades de produto

## Critério

Uma feature é relevante se aumenta confiança, reduz repetição operacional ou melhora diretamente o vídeo. A classificação considera dependências técnicas reais, não apenas esforço de UI.

## Quick wins

| Feature | Valor | Dependência |
| --- | --- | --- |
| histórico de renders + metadata | evita perda, habilita suporte | artifact lifecycle |
| stdout com render ID/path | automação simples | histórico |
| validação de flags numéricas | elimina erros silenciosos | parser CLI |
| ignore de outputs gerados no lint | gate reproduzível | configuração |
| `doctor` inicial | diagnóstico de instalação | checks existentes |
| botão “open” somente por job ID | reduz risco | boundary de paths |

## Médio prazo

### Histórico no Studio

Listar metadata do filesystem, filtrar por demo/status, abrir e remover. Não persistir a fila inteira em banco; reconstruir somente estados terminais e marcar `running` antigo como `interrupted`.

### Hash estrutural e staleness real

Canonicalizar IR removendo campos puramente apresentacionais definidos pela política, calcular SHA-256 e explicar exatamente quais alterações invalidam captura. Isso corrige confiança, mas exige migration coordenada.

### Validate/dry-run/inspect unificados

Um plano de execução mostra source, targets, assets, artifact path e config efetiva. Bom para humanos, CI e LLMs.

### Comparação de renders

Metadata diff + frames sentinela. Útil antes de comparação pixel-a-pixel de vídeos completos.

### Presets versionados

Resolução, CRF, frame range, visual registry e media mode em configuração serializável, com config efetiva no metadata.

## Estratégico

### Authoring IR JSON

Permite agentes gerarem demos com schema fechado, diagnostics por path e dry-run. A DSL TypeScript continua como frontend humano.

### Cache por estágio

Chaves separadas: definition hash, capture environment hash, timeline policy hash e render config hash. Só depois de identidade correta.

### Execução remota/CI distribuído

Artifact store abstrato e protocolo de worker. Prematuro antes de atomicidade, schemas e redaction.

### Ecossistema de adapters

Segundo capture engine ou renderer justificaria interfaces públicas. Hoje abstração genérica seria especulativa.

## Não fazer agora

- banco embutido para histórico;
- marketplace de templates/plugins;
- colaboração multiusuário no Studio;
- editor visual completo de steps;
- render farm;
- event sourcing;
- IA que corrige locators automaticamente em produção.

Essas ideias ampliam trust boundary e custo de suporte antes de o pipeline local conseguir provar identidade e reproduzir outputs.

## Features de qualidade visual que merecem pesquisa

- safe areas responsivas por aspect ratio;
- uso real de `TargetDefinition.framing` e padding de focus;
- curva de câmera configurável e motion reduction;
- inspeção de target bounding boxes no Studio;
- trilha explícita para cues;
- fontes/asset preflight e fallback determinístico;
- audio/narração somente após timeline e sincronização terem contrato versionado.
