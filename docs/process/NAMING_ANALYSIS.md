# Etapa 1 — Análise do projeto

Documento de análise produzido antes de qualquer alteração estrutural, conforme processo definido. Este documento é a base para as decisões de naming, refatoração de marca e documentação.

---

## 1. Resumo da arquitetura atual

O projeto é um monorepo (pnpm + turbo) que implementa **demos de software como código**: você escreve uma demo em TypeScript, o Playwright captura a aplicação-alvo, e o Remotion renderiza o vídeo final. Uma única API declarativa serve tanto desenvolvedores quanto agentes de IA.

**Fluxo de dados:**

```
demo.ts ─compileDemo─> DemoIR ─runDemo (Playwright)─> manifest + screenshots + recording
                      │                                     │
                      │   resolveTimeline (pure fn)         │
                      └──── materialize ────────────────> studio-data/
                                                            │
                                                  Next.js studio (preview + render)
                                                  Remotion renderDemoVideo → MP4
```

**Princípio arquitetural central:** captura (Playwright, precisa do app) é separada de preview (puro disco, sem app). O studio funciona totalmente a partir de artefatos em cache.

---

## 2. Mapa de pacotes (12 workspace packages + root)

| Pacote | Função | Depende de (workspace) |
|---|---|---|
| `@democraft/schema` | Tipos compartilhados + zod schemas (IR, steps, manifest, timeline, geometry) | — (base) |
| `@democraft/core` | API de autoração TypeScript (`defineDemo`, `defineTargets`, `byRole/byLabel/byTestId/byText`) | schema |
| `@democraft/compiler` | Compila `DemoDefinition` → `DemoIR` normalizado + diagnósticos estáticos | core, schema |
| `@democraft/playwright` | Runtime de captura: executa IR via Playwright, produz manifest + screenshots + recording | schema |
| `@democraft/timeline` | Resolver puro: `DemoIR` + manifest → `RenderTimeline` (camera/cursor/overlays) | schema |
| `@democraft/preview` | Gera preview HTML standalone (legado) | schema |
| `@democraft/remotion` | Renderer Remotion: `renderDemoVideo` (server) + `ProductDemoVideo` (composition) | schema |
| `@democraft/testing` | Fábrica de demo de referência para testes | compiler, core |
| `@democraft/cli` | CLI `democraft` com comandos: inspect, validate, targets, capture, timeline, preview, render, studio | todos (7 deps) |
| `@democraft/studio` | App Next.js 15: preview, edição (captions, layers), render queue, re-capture, staleness | 6 deps (compiler, core, playwright, remotion, schema, timeline) |
| `@democraft/example-basic-demo` | Exemplo: path mínimo de autoração | compiler, core |
| `@democraft/example-demo-app` | Exemplo: pipeline completo com app-alvo (servidor HTTP na :4173) | compiler, core, playwright, timeline |

**Grafo de dependências (simplificado):**

```
schema (base — dependido por todos)
  ↑
  ├── core
  │     ↑
  │     ├── compiler ──→ core, schema
  │     └── testing ───→ compiler, core
  │
  ├── playwright ──→ schema
  ├── timeline ────→ schema
  ├── preview ─────→ schema
  ├── remotion ────→ schema
  │
  ├── cli ────→ compiler, core, playwright, preview, remotion, schema, timeline
  └── studio ──→ compiler, core, playwright, remotion, schema, timeline
```

**Ferramentas de build:** todos os 9 pacotes de biblioteca usam **tsup** (ESM + DTS) → `dist/`. O studio usa Next.js (`.next/`). Exemplos rodam via `tsx` (sem build).

---

## 3. Mapa da API pública

### 3.1 API de autoração (`@democraft/core`)

O que um usuário escreve em `demo.ts` e `targets.ts`:

```typescript
import { defineDemo } from "@democraft/core";
import { defineTargets, defineTarget, byRole, byTestId, byLabel } from "@democraft/core";

export default defineDemo({
  id: "create-project-live",
  title: "Create a project live",
  source: { baseUrl: "http://localhost:4173", initialPath: "/dashboard" },
  targets,
  async run({ demo }) {
    await demo.scene("introduction", async (scene) => {
      await scene.goto("/dashboard");
      await scene.establish("dashboard");
      await scene.caption("Create a workspace in seconds.", { renderer: "remocn.kinetic-title" });
      await scene.hold("5000ms");
    });
  },
});
```

**Builders de scene** (`DemoScene`): `goto`, `click`, `fill`, `select`, `expectVisible`, `expectText`, `expectUrl`, `establish`, `focus`, `hold`, `transition`, `caption`, `callout`, `cue` — 14 métodos que produzem os 14 kinds de step.

**Locators:** `byRole(role, {name})`, `byLabel(text)`, `byTestId(id)`, `byText(text)`.

**Targets:** `defineTargets({ id: Locator | TargetInput })` — normaliza para `TargetDefinition` com locators ordenados (fallback chain).

### 3.2 Modelo de dados

- **`DemoDefinition`** (autoração) → **`DemoIR`** (compilado, normalizado) → **`RecordedDemoManifest`** (capturado pelo Playwright) → **`RenderTimeline`** (resolvida para render)
- **14 step kinds** (união discriminada): `browser.goto/click/fill/select`, `assert.visible/text/url`, `camera.establish/focus`, `timeline.hold/transition`, `overlay.caption/callout`, `cue`
- **Diagnostic codes:** MD001-MD105 (invalidConfig, duplicateId, unknownTarget, invalidDuration, invalidScene, invalidStep, unknownRenderer)
- **`schemaVersion: "1"`** em IR, manifest e timeline

### 3.3 CLI

Comando único: `democraft <command> <demo.ts> [flags]`

| Comando | Faz |
|---|---|
| `inspect` | Compila + imprime o IR |
| `validate --static` | Validação estática (diagnósticos) |
| `targets --json` | Lista targets resolvidos |
| `capture` | Captura via Playwright (via exemplo) |
| `timeline --manifest` | Resolve timeline |
| `preview --manifest --timeline` | Gera HTML preview |
| `render --manifest --timeline` | Renderiza MP4 via Remotion |
| `studio` | Lança studio Next.js (preview + render + edição) |

### 3.4 Studio

App Next.js 15 (App Router) com: Remotion Player (preview), inspector de captions, render queue com progresso/ETA/cancel, layer visibility/solo, frame ruler com zoom, in/out markers + render range, command palette (Cmd+K), re-capture dentro do studio, staleness badge, re-resolve automático ao editar demo.ts, render presets (localStorage).

---

## 4. Conceitos existentes

Conceitos reais (não inventados), mapeados a partir do código:

| Conceito | Onde vive | Estado |
|---|---|---|
| Projeto (`DemoDefinition`) | core | ✅ estável |
| Cena (`DemoScene`) | core | ✅ estável |
| Step (14 kinds) | core/schema | ✅ estável |
| Target + Locator (4 strategies) | core/schema | ✅ estável |
| IR (`DemoIR`) | schema/compiler | ✅ estável |
| Captura (`RecordedDemoManifest`) | schema/playwright | ✅ estável |
| Timeline (`RenderTimeline`) | schema/timeline | ✅ estável |
| Camera track (establish/focus) | timeline/remotion | ✅ estável |
| Cursor track (click ripple) | timeline/remotion | ✅ estável |
| Overlay track (caption/callout) | timeline/remotion | ✅ estável |
| Composição (`ProductDemoVideo`) | remotion | ✅ estável |
| Renderer (`renderDemoVideo`) | remotion | ✅ estável |
| Diagnósticos (MD001-MD105) | schema/compiler | ✅ estável |
| Cue (sync point) | core/schema | ✅ existe na API, não usado em render ainda |
| Renderer registry (`remocn.*`) | remotion | ⚠️ experimental |
| Studio (Next.js preview/render) | studio | ✅ funcional |
| Render queue + onProgress | studio/render-queue | ✅ funcional |
| Staleness / re-capture / re-resolve | studio | ✅ funcional (recém-implementado) |

**Conceitos NÃO implementados** (mencionados em docs/roadmap mas ausentes do código): áudio, narração (TTS), digitação animada, rolagem, transições crossfade reais (existe no tipo mas o renderer só faz cut), plugins/adapters/presets como sistema extensível, geração de referência de API automatizada, serialização para JSON como formato de input (a IR é JSON-compatible mas a entrada é só TypeScript).

---

## 5. Inconsistências e dívida técnica

1. **`@democraft/preview`** está marcado como deprecated/legado mas ainda é dependência da CLI. O studio substitui sua função.
2. **Transições** — `TimelineTransitionStep` suporta `cut | crossfade` no tipo, mas o renderer Remotion atual não implementa crossfade de fato.
3. **`cue`** — existe como step kind mas não tem efeito no renderer (é um sync point sem consumidor).
4. **`byText`** — exportado da API pública mas não usado no exemplo demo-app.
5. **Tipos duplicados** — `RenderJob`/`RenderJobOptions`/`CaptionOverrides` antes duplicados entre `types.ts` e `render-queue.ts` (dedupe feito na refatoração recente, fonte única agora em `types/render.ts`).
6. **`defineConfig`** — existe na API mas `DemoConfig` não é consumido pelo compiler ainda.
7. **Render presets localStorage key** (`democraft:render-presets`) — rename vai órfar presets salvos.

---

## 6. Inventário de marca (surface area do rename)

| Categoria | Contagem aproximada |
|---|---|
| Campos `name` em package.json | 13 |
| `@democraft/` em package.json (deps + scripts) | ~46 |
| Imports `@democraft/` em source | 77 |
| `@democraft/` em next.config / spawn filter / remotion-entry | ~8 |
| CLI binary `democraft` + invocações em docs/source | ~50+ |
| Data dir `.democraft/` | 58 |
| Env var `DEMOCRAFT_STUDIO_DATA` | 7 |
| Referências em markdown | 216 |
| **Total (rough)** | **~475+ touchpoints** |

**Hotspots de risco:**
- `packages/cli/src/studio.ts:197` — string hardcoded `"@democraft/studio"` no spawn do pnpm filter (load-bearing)
- `packages/studio/lib/remotion-entry.ts` — path-walking que procura `@democraft` em paths
- `packages/studio/next.config.ts` — `serverExternalPackages` e `transpilePackages` com nomes scoped
- `DEMOCRAFT_STUDIO_DATA` — contrato de dois lados (CLI escreve, studio lê)
- `.democraft/` data dir — rename órfa captures existentes

**Sem referências de marca em:** tsconfig*, eslint, prettier, turbo.json, pnpm-workspace.yaml, codegraph.

---

## 7. Documentação existente

- **41 arquivos `.md`**, ~4.550 linhas no total
- `docs/` tem 25 arquivos (design bible): vision, principles, API design, pipeline, architecture, CLI, validation, remotion integration, studio, roadmap, ADRs, end-to-end examples
- `llms.txt` — referência rápida para LLMs (muito densa em marca)
- 10 READMEs de pacote (a maioria é 3-5 linhas)
- `DEVELOPMENT.md` — guia de desenvolvimento (recentemente criado, 202 linhas)

**Lacunas:** não há quickstart estruturado, não há referência de API gerada automaticamente, não há site de documentação, não há i18n, não há busca.

---

## 8. Proposta de arquitetura de documentação

**Ferramenta:** Fumadocs (Next.js), como um novo app `apps/docs/` no monorepo (não dentro de `packages/`).

**Estrutura de rotas (i18n desde o início):**
```
apps/docs/
  app/
    [lang]/          ← pt-BR | en
      [[...slug]]/
        page.tsx
    layout.tsx
  content/
    [lang]/
      introduction/
      quickstart/
      concepts/
      sdk/
      remotion/
      pipeline/
      cli/
      examples/
      reference/
      architecture/
```

**Conteúdo prioritário (nesta ordem):**
1. Visão geral / visão geral / filosofia
2. Instalação / quickstart
3. Conceitos (demo, scene, step, target, timeline, capture, render)
4. Referência da SDK (gerada a partir dos tipos reais)
5. Integração com Remotion
6. Pipeline interno (com diagramas)
7. API única para devs + agentes de IA
8. Referência da CLI
9. Arquitetura / contribuição

**Validação:** script que verifica paridade entre locales (páginas órfãs, estrutura divergente, metadados ausentes).

---

## 9. Proposta de i18n

- **Locales:** `pt-BR` (default) e `en`
- **Estrutura:** `content/pt-BR/` e `content/en/` espelhando a mesma hierarquia
- **Snippets de código:** compartilhados entre locales (não duplicados)
- **Glossário:** termos técnicos que permanecem em inglês (Pipeline, Preset, Frame, Track, Clip) vs. traduzidos (Cena, Faixa, Gravação, Captura, Renderização)
- **APIs públicas NÃO traduzidas:** `defineDemo`, `byRole`, `RenderTimeline`, etc. permanecem em inglês nos snippets e referência
- **Seletor de idioma:** persiste escolha, preserva página ao trocar
- **SEO:** hreflang, canonical por locale, sitemap localizado

---

## 10. Proposta de naming (10-15 nomes)

Análise baseada em: posicionamento (demos de software programáticas), diferenciais (code-first, single API para humans + IA, Playwright + Remotion), e expansão futura (além de demos).

### Critérios de avaliação
- Identidade própria (não parecer wrapper do Remotion)
- Memorabilidade e pronúncia
- Potencial de marca (logo, visual)
- Adequação para CLI (curto, digitable)
- Adequação para SDK (namespace claro)
- Disponibilidade semântica (conflitos de busca)

### Os 15 nomes

| # | Nome | Significado / Conceito | CLI | NPM |
|---|---|---|---|---|
| 1 | **Revlit** | "Rev" (revelar/revisar) + "lit" (iluminado/leve). Revela o produto através de composição luminosa | `revlit` | `@revlit/core` |
| 2 | **Cineframe** | Cine (cinema) + frame. Composição cinematográfica frame a frame | `cineframe` | `@cineframe/core` |
| 3 | **Democraft** | Demo + craft (ofício). O ofício de criar demonstrações | `democraft` | `@democraft/core` |
| 4 | **Playframe** | Play (tocar/executar) + frame. Captura que vira frames componíveis | `playframe` | `@playframe/core` |
| 5 | **Showreel** | Reel (carretel de filme) + show. Demo como um rolo de filme editável | `showreel` | `@showreel/core` |
| 6 | **Scenecut** | Scene + cut (corte de edição). Cenas que se cortam e compõem | `scenecut` | `@scenecut/core` |
| 7 | **Stagewise** | Stage (palco/etapa) + wise. Demo construída por etapas em palco | `stagewise` | `@stagewise/core` |
| 8 | **Takeframe** | Take (tomada de filmagem) + frame. Cada captura é uma take | `takeframe` | `@takeframe/core` |
| 9 | **Caststudio** | Cast (elenco/transmitir) + studio. Estúdio de demos que "transmitem" o produto | `caststudio` | `@caststudio/core` |
| 10 | **Cueform** | Cue (deixa/sinal) + form (forma). Demos conformadas por sinais declarativos | `cueform` | `@cueform/core` |
| 11 | **Actframe** | Act (ato de uma peça/fazer) + frame. Demos como atos cinematográficos | `actframe` | `@actframe/core` |
| 12 | **Moviola** | Referência à moviola (máquina de edição de cinema). Edição programática | `moviola` | `@moviola/core` |
| 13 | **Framecast** | Frame + cast (gravar/transmitir). Frames que são gravados e transmitidos | `framecast` | `@framecast/core` |
| 14 | **Screencut** | Screen (tela) + cut (corte). Captura de tela que é cortada e composta | `screencut` | `@screencut/core` |
| 15 | **Directrix** | Diretriz + matrix. A direção programática da demo (diretor de cinema) | `directrix` | `@directrix/core` |

---

## 11. Os três finalistas

### 🥇 Finalista 1 — **Democraft**

- **Significado:** O ofício (craft) de criar demonstrações de software. Posiciona a biblioteca como uma ferramenta de artesanato digital, não um gravador automático.
- **Conceito:** Demos são artefatos cuidadosamente construídos, versionados e refinados — como código de produção.
- **Identidade própria:** Forte. Não remete a Remotion. Tem personalidade.
- **CLI:** `democraft studio demo.ts` — natural, digitable, memorável.
- **SDK:** `@democraft/core`, `@democraft/cli`, `@democraft/studio` — namespace limpo.
- **Potencial visual:** Marcante (martelo/ferramenta + pixel/frame, tipografia artesanal).
- **Riscos:** Pode soar "caseiro" demais para alguns; "craft" é trend word em dev tools (pode haver sobreposição semântica com outras libs).

### 🥈 Finalista 2 — **Showreel**

- **Significado:** Um "showreel" é um portfólio de demonstrações (reel = carretel de filme). A biblioteca cria showreels de software.
- **Conceito:** Demos são montagens cinematográficas que mostram o melhor do produto.
- **Identidade própria:** Média-forte. "Reel" conecta com vídeo/filme sem ser genérico.
- **CLI:** `showreel studio demo.ts` — flui bem.
- **SDK:** `@showreel/core`, `@showreel/cli` — claro.
- **Potencial visual:** Alto (carretel de filme, timeline, frames).
- **Riscos:** "Showreel" é uma palavra comum no audiovisual — pode haver conflito de marca/busca com produtos de vídeo portfolio. Mais difícil de trademarkear.

### 🥉 Finalista 3 — **Stagewise**

- **Significado:** Demo construída por etapas (stages) num palco (stage = palco/etapa). Cada cena é um stage.
- **Conceito:** A aplicação é um palco; a demo orquestra cenas nele. "Wise" adiciona sofisticação.
- **Identidade própria:** Forte. Original, sem conflitos óbvios.
- **CLI:** `stagewise studio demo.ts` — um pouco longo mas digitable.
- **SDK:** `@stagewise/core` — funciona.
- **Potencial visual:** Médio (palco, cortina, spotlight, etapas).
- **Riscos:** Pode soar vago para quem não conhece o conceito. "Stage" tem muitos significados (deploy stages, etc.) — possível ambiguidade semântica.

---

## 12. Recomendação principal

### **Democraft**

**Por quê:**

1. **Comunicação clara do propósito** — "demo" + "craft" diz exatamente o que a ferramenta faz (criar demos com ofício) sem explicar.
2. **Identidade própria forte** — não lembra Remotion, não é genérico como "Motion Lib", tem personalidade.
3. **CLI memorável** — `democraft` é uma palavra única, fácil de digitar e lembrar.
4. **Namespace limpo** — `@democraft/*` é curto, escaneável, sem ambiguidade.
5. **Expansível** — funciona para SDK, CLI, studio, docs, e futuramente para SaaS.
6. **Tom certo** — "craft" comunica qualidade intencional, alinhado com code-first e versionamento.

**Riscos e mitigações:**
- *"Craft é trend word"* → Verdadeiro, mas combinado com "demo" cria um composto distintivo. Não é "CraftJS" ou "Craft SDK" — é "Democraft".
- *"Pode soar caseiro"* → A documentação e o design da marca podem elevar o tom (precisão técnica, não artesanato rústico).

**Como a marca se desdobra:**
- **Pacotes:** `@democraft/core`, `@democraft/schema`, `@democraft/compiler`, `@democraft/playwright`, `@democraft/timeline`, `@democraft/remotion`, `@democraft/cli`, `@democraft/studio`, `@democraft/testing`, `@democraft/preview`
- **CLI:** `democraft <command>`
- **Data dir:** `.democraft/`
- **Env vars:** `DEMOCRAFT_STUDIO_DATA`
- **Docs:** `docs.democraft.dev` (exemplo)
- **Studio:** "Democraft Studio"

---

## 13. Plano de rename (preview)

*Será detalhado após a escolha do nome definitivo. Visão geral:*

1. **Inventário completo** (já feito — §6)
2. **Rename mecânico** com script: package.json names, imports, data dir, env vars, CLI binary, spawn filters, next.config, remotion-entry, localStorage key, docs
3. **Rebuild** de todos os pacotes (tsup)
4. **Validação:** typecheck, build, test, lint, smoke (studio abre, CLI funciona)
5. **Relatório de rename** com todos os touchpoints, breaking changes e pendências

**Breaking changes esperados:**
- Nome do pacote (usuários mudam imports)
- CLI binary name
- Data dir path (`.democraft/` → `.democraft/`)
- Env var
- localStorage key (render presets)

**Estratégia de compatibilidade:** dado que o projeto está em `0.0.0` (pre-release), não há usuários externos para preservar — o rename pode ser limpo sem aliases depreciados.

---

## 14. Plano de execução (overview)

| Etapa | Status | Bloqueante? |
|---|---|---|
| 1. Análise | ✅ Este documento | — |
| 2. Naming | ⏳ Aguardando escolha do nome | Escolha do usuário |
| 3. Refatoração de marca | Pendente | Nome definitivo |
| 4. Fundação da documentação (Fumadocs + i18n) | Pendente | Nome definitivo |
| 5. Conteúdo prioritário | Pendente | Fundação |
| 6. Validação | Pendente | Conteúdo |

---

## Próximo passo

**Aguardo sua escolha do nome definitivo** entre os três finalistas (Democraft, Showreel, Stagewise) — ou qualquer outro dos 15 propostos, ou um nome próprio que você queira sugerir. A partir daí, executo a Etapa 3 (rename) e Etapa 4 (documentação).
