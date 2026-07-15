# Roadmap priorizado

## Princípios

- Corrigir confiança antes de adicionar automação.
- Manter compatibilidade de DSL, CLI flags e renderer público.
- Cada fase termina em um artefato verificável e pode ser revertida isoladamente.
- Não implementar cache, remoto ou plugins antes de identidade e schemas.

## P0 — confiança no output

### Fase 0A: histórico de render

- IDs criptograficamente aleatórios e paths únicos.
- Diretório por render, metadata básica e promoção atômica.
- CLI default e Studio no mesmo protocolo.
- Compatibilidade de `--output-file`.
- Testes de sucesso, falha, cancelamento e colisão.

**Status:** escopo da implementação inicial deste estudo.

### Fase 0B: identidade estrutural

- canonicalização documentada;
- `definitionHash` separado de `demoId`;
- `captureHash` versionado separado da identidade autoral;
- persistência em manifest/timeline/render metadata;
- staleness do Studio baseado em hash;
- migration para artefato sem hash.

**Gate:** fixtures provam estabilidade e mudança do hash para cada campo estrutural.

**Status:** implementado de forma compatível; novos IRs propagam os hashes para
captura, timeline e metadata de render. Artefatos sem `captureHash` continuam
legíveis, mas o Studio classifica sua compatibilidade como desconhecida e pede
uma recaptura antes de re-resolver.

## P1 — boundaries confiáveis

### Fase 1A: schemas completos

- Zod + JSON Schema para IR, manifest, timeline e metadata;
- parsers com diagnostics por path;
- limites de tamanho/contagem;
- contract fixtures de versão anterior.

**Status:** runtime entregue parcialmente em 2026-07-15. `@democraft/schema`
agora publica schemas Zod e parsers v1 para `DemoIR`, manifest, timeline,
metadata de render e `StudioMeta`. CLI e Studio validam seus boundaries JSON;
versões desconhecidas e hashes prefixados inválidos falham com erro estável e
path-aware, enquanto campos opcionais legados continuam aceitos. Fixtures de
contrato, round trip e bloqueio do renderer/preview cobrem a migração. Restam a
publicação dos JSON Schemas e limites de tamanho/contagem definidos a partir de
fixtures reais, evitando introduzir thresholds arbitrários nesta etapa.

**Correções de contrato:** schemas base preservam extensões aninhadas; o
compilador diagnostica IDs vazios e targets sem locator; fps e flags numéricas
são rejeitados antes de produzir output; requests de render do Studio têm
schema e resposta 400 estruturada; metadata de render valida estados terminais
e ranges, inclusive no writer. `/api/data` expõe violações persistidas como 422
estruturado.

**Fora desta rodada:** limite de bytes aplicado ao body antes de `request.json`,
containment/`realpath` de paths, reload de imports ESM transitivos e validação
dos eventos SSE no cliente. Esses itens permanecem respectivamente nas fases
de segurança/robustez do Studio, sem política ad hoc nesta mudança.

### Fase 1B: lifecycle de captura

- run ID e diretório por captura;
- metadata/state machine;
- atomic manifest/trace finalization;
- AbortSignal e cleanup;
- Studio resolve `latest completed` explicitamente.

**Status:** implementado em 2026-07-15. O default cria uma execução única por
captura com metadata v1 e promoção atômica do manifest. Falhas de launch e
cancelamentos ficam terminais sem atualizar `latest.json`; CLI e Studio usam o
último `completed`, com fallback legado conservador. `outputDir` explícito e o
retorno público de `runDemo()` foram preservados.

**Hardening corretivo:** namespaces incluem digest estável do ID original;
pointer é reparável por scan validado; output explícito tem lock/lease; paths de
screenshot são canônicos e contidos; recapture é single-flight e promove uma
generation completa. Hardening por `realpath` contra symlinks continua na fase
1C, separado do containment lexical já aplicado.

### Fase 1C: hardening do Studio

- containment de paths e `realpath`;
- Origin/session token;
- loopback documentado/testado;
- histórico reconstruído do filesystem.

### Resíduos de identidade/reload

- Definir um fingerprint de ambiente de captura (viewport/DPR, locale,
  timezone, storage/settle e runtime) antes de tratar `captureHash` como chave
  de cache portátil.
- Isolar o carregamento da definição para que imports ESM transitivos sejam
  recarregados. Hoje o cache-buster versiona somente o módulo de entrada; Node
  mantém dependências transitivas no cache do processo longo do Studio. O
  repositório não possui um loader/isolamento seguro já disponível. A correção
  deve usar worker/child process ou empacotamento explícito do grafo, não um
  loader ad hoc.

## P2 — operação e DX

- parser CLI estrito e config efetiva;
- `doctor`, `validate-artifact`, `--dry-run`;
- logs JSONL e timings por estágio;
- `runs list/open/remove/prune`;
- integração real Chromium + vídeo curto no CI;
- frames visuais sentinela;
- reload confiável do grafo ESM transitivo no Studio;
- alinhar documentação com comportamento.

## P3 — expansão controlada

- Authoring IR JSON para agentes;
- cache por hashes de estágio;
- compare de render/timeline;
- presets portáveis;
- múltiplos aspect ratios suportados;
- adapter remoto somente após um caso real.

## Sequência e dependências

```text
render history
  -> complete schemas
  -> definition hash
  -> capture history
  -> Studio history/security
  -> doctor/retention/compare
  -> cache/remote
```

Schemas podem começar em paralelo com o design do hash, mas o hash só deve ser persistido depois que o envelope de artefato estiver versionado.

## Riscos de rollout

| Mudança | Risco | Mitigação |
| --- | --- | --- |
| novo default de output | scripts procuram path antigo | stdout claro; `--output-file` legado |
| definition hash | falsos stale | fixtures canônicas e campo opcional |
| schemas strict | rejeitar artefato legado | compat mode + migrations |
| capture history | scripts procuram pasta fixa | resolver `latest completed`; fallback legado; output explícito intacto |
| path hardening | UI usa path explícito | migrar para job ID antes de bloquear |

## Critério de “pronto para 1.0”

- nenhum fluxo normal sobrescreve artefato sem opção explícita;
- staleness usa identidade estrutural;
- todos os artefatos públicos têm parser e migration;
- capture/render têm estado terminal e cancelamento testado;
- um E2E empacotado roda em ambiente limpo;
- segurança local e classificação de dados estão documentadas.
