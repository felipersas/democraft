# Revisão de arquitetura

## Fluxo real

```text
DemoDefinition
  -> compileDemo -> DemoIR + diagnostics
  -> runDemo -> manifest + screenshots + recording + trace
  -> resolveTimeline(IR, manifest) -> RenderTimeline
  -> preview HTML | Remotion props
  -> renderMedia -> MP4
```

O fluxo é acíclico no nível de domínio: `core -> schema <- compiler/playwright/timeline/remotion`, com CLI e Studio orquestrando. Esta direção deve ser preservada.

## Limites que estão corretos

1. **Core de autoria:** deve continuar sem I/O e sem Playwright.
2. **Compiler:** executa a DSL contra um proxy de captura; não deve abrir browser.
3. **Runtime de captura:** resolve targets e observa geometria; não decide estética.
4. **Timeline:** converte intenção e observação em tempo determinístico.
5. **Renderer:** consome dados resolvidos; não deve reler módulos de usuário.

## Vazamentos atuais

### Identidade mistura nome e versão

`DemoIR.id` recebe `definition.id` (`packages/compiler/src/compile.ts:54-63`). Um ID humano responde “qual demo?”, mas não “qual definição?”. Solução recomendada:

```ts
type ArtifactIdentity = {
  demoId: string;
  definitionHash?: string; // ausente em legado
  captureHash?: string; // ausente em legado
  runId: string;
};
```

### Contrato canônico de `definitionHash`

O hash autoral completo usa o prefixo versionado `definition-v1:sha256:` sobre
JSON compacto em UTF-8. As chaves de
objetos são ordenadas recursivamente, propriedades `undefined` são omitidas e a
ordem de arrays é preservada. O digest é hexadecimal minúsculo com 64
caracteres depois do prefixo.

Entram no payload, depois da normalização do compilador:

- `title`;
- `source` completo (`baseUrl` e `initialPath`, quando presente);
- `targets` completos, incluindo locators, descrição e framing;
- `scenes` na ordem declarada, incluindo `id`, metadata normalizada e todos os
  campos de cada step normalizado.

Não entram `schemaVersion`, `id`, o próprio `definitionHash`, diagnostics,
observações de captura, ambiente Playwright ou configuração de render. Portanto
renomear apenas o ID humano não altera o hash; reordenar chaves de um mapa
também não; reordenar cenas, locators ou steps altera. A inclusão de `title` é
conservadora: evita que uma mudança de conteúdo autoral seja silenciosamente
reutilizada caso o título passe a ser consumido por um renderer.

`definitionHash` é identidade autoral, não uma decisão de cache. Para decidir
reuso de screenshots existe um segundo hash, `capture-v1:sha256:<digest>`. Sua
projeção inclui `source.baseUrl`; de cada target, somente `id` e `locators`;
ordem/identidade dos steps; e todos os payloads que podem alterar ações
Playwright, snapshots, espera ou diagnostics. `source.initialPath`, descrição e
framing de target são excluídos porque o runtime de captura atual não os lê.
Também são excluídos `title`, metadata de cena, `camera.focus.padding`, tipo
visual de transition, renderer de overlays e nome de cue. Texto de caption e
copy de callout continuam incluídos porque podem mudar a espera de captura
quando settling está desabilitado.

Overrides efêmeros de caption no Studio são aplicados depois da verificação de
compatibilidade, sobre a timeline derivada enviada ao render. Eles são
render-only e não reivindicam uma nova identidade de captura. Já editar o texto
na DSL muda `captureHash` pelo efeito potencial na espera descrito acima.

`captureHash` é somente um fingerprint versionado da definição consumida pela
captura; não é fingerprint do ambiente. Viewport, DPR, locale, timezone,
storage state, opções de settle e versões do browser/aplicação não entram no
digest. Algumas dimensões ficam registradas no manifest, mas reuso seguro entre
ambientes ainda exige um futuro `environmentHash` ou contrato equivalente.

Ambos os hashes são opcionais nos tipos públicos para leitura de artefatos
legados. Ausência de `captureHash` significa compatibilidade desconhecida: o
artefato pode ser aberto, mas o Studio exige uma recaptura antes de re-resolver
ou declarar screenshots reutilizáveis. Divergência conhecida de `demoId` ou
`captureHash` bloqueia timeline/render antes de qualquer escrita. Divergência
somente de `definitionHash`, com `captureHash` igual, permite re-resolve.

### Orquestração duplicada

CLI e Studio carregam manifest/timeline, materializam screenshots e invocam o renderer separadamente. A duplicação já produziu dois protocolos de nome de output: estável na CLI e timestamp no Studio.

Recomendação: um `RenderService` Node pequeno que recebe artefatos validados, configura o render e gerencia lifecycle. CLI e Studio ficam adapters. Não mover React/composição para esse serviço.

### Tipos TypeScript fingem ser validação

O boundary JSON usa casts (`packages/cli/src/run.ts:92-97`, `143-148`). O pacote schema deve possuir tanto tipos quanto parsers versionados. Consumidores nunca devem importar Zod diretamente se um `parseManifest` com diagnostics puder estabilizar a UX.

### Artefato pertence ao pipeline, não ao codec

A primeira implementação pode viver junto ao server renderer para reduzir mudança, mas o limite conceitual é:

```text
artifact store -> escolhe diretório, IDs, metadata, atomicidade
render adapter -> produz bytes de vídeo
orchestrator   -> transita estados e conecta ambos
```

Extraia um pacote `@democraft/artifacts` apenas quando captura e render compartilharem listagem/retenção. Criá-lo antes disso aumentaria superfície sem consumidor suficiente.

## Arquitetura alvo incremental

```text
authoring/core
      |
compiler -- canonicalize/hash
      |
 contracts/schema -- parsers + migrations
      |
orchestrator ------------------------------+
  |                                       |
capture adapter                      render adapter
  |                                       |
artifact store <--- metadata/state ------+
      |
CLI / Studio / CI reporter
```

## Invariantes propostas

- `demoId` é estável e humano; `definitionHash` identifica toda a autoria; `captureHash` decide compatibilidade de captura; `runId` é único por tentativa.
- Nenhum arquivo final aparece antes do estado `completed`.
- Todo diretório de execução tem metadata, inclusive falha/cancelamento.
- Dados JSON são validados ao entrar em um processo.
- Um renderer não altera manifest/timeline recebidos.
- Cancelamento percorre orquestrador, captura/render e cleanup via `AbortSignal` ou adapter equivalente.
- Output explícito continua explícito; defaults gerenciados usam histórico.

## Decisões a adiar

- Banco de dados para histórico local: filesystem indexável é suficiente.
- Plugin system genérico: um registry visual já existe; não generalizar capture/render antes de um segundo adapter real.
- Distribuição remota: primeiro estabilizar contratos e metadata locais.
- Event sourcing da fila: metadata por job atende recuperação básica.

## Métricas arquiteturais úteis

- percentual de artefatos parseáveis pela versão corrente;
- falhas por estágio e diagnostic code;
- taxa de reuso de captura com hash compatível;
- tempo de bundle, render e encode separados;
- diretórios `running` órfãos após reinício;
- cobertura de contratos públicos por type tests e runtime schemas.
