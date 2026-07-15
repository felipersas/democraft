# Revisão de segurança e privacidade

## Modelo de ameaça

Democraft é uma ferramenta local que abre aplicações autenticadas, lê `storageState`, captura pixels e executa código de demos. O adversário relevante pode ser: módulo de demo não confiável, página capturada, origin web que alcança o Studio local, artefato JSON malformado ou publicação acidental de outputs.

## Achados

### P1 — abertura de caminho arbitrário

**Observado.** `/api/open-folder` aceita `path` fornecido pela query e só verifica existência (`packages/studio/app/api/open-folder/route.ts:14-32`), depois chama comandos do SO (`:36-50`). O comentário afirma escopo mais restrito do que o código.

**Mitigação.** Remover `path` público ou garantir `path.relative(root, resolved)` sem `..`/absolute. Preferir job ID opaco.

### P1 — assets e path containment

Qualquer rota que concatena paths de manifest precisa usar containment por `relative`, não apenas prefix string. Symlinks exigem decisão explícita: rejeitar via `realpath` fora da raiz ou documentar confiança local.

### P1 — execução de código de usuário

`loadDemo` importa o módulo. Isso é execução arbitrária Node, não “parse”. CLI/docs devem dizer claramente que demos de terceiros têm o mesmo privilégio do usuário. Sandbox fica fora do escopo imediato; CI deve usar container e credenciais mínimas.

### P1 — dados sensíveis em captura

Screenshots, recording, trace e storage state podem conter PII, tokens e conteúdo interno. `.gitignore` cobre `.democraft` e `.env` (`.gitignore:16-18`, `30-33`), mas cópias via `--output-dir` podem sair dessa raiz.

**Mitigação.** Warning para output rastreado pelo Git, política de redaction, retenção opt-in, documentação de secrets e um comando de export que exclua trace/storage paths por default.

### P2 — endpoints mutáveis do Studio

O Studio deve bindar somente `127.0.0.1`, validar Origin e usar token aleatório da sessão para POST/cancel/recapture. CORS “não configurado” não substitui proteção CSRF.

### P2 — JSON sem limites/schema

Manifest/timeline não validados permitem payloads enormes, paths inesperados e crashes. Adicionar limite de tamanho, schema e quantidade máxima razoável de steps/assets antes do renderer.

**Progresso em 2026-07-15:** manifest, timeline, metadata, StudioMeta e request
de render possuem validação runtime antes dos consumidores. Limites de campos e
numéricos do request de render foram adicionados. Overrides de caption seguem
o contrato não limitado da DSL; limites de texto/contagem devem ser definidos
em conjunto com ela, não apenas no transporte. Ainda falta um limite de bytes
antes do parse de `request.json()` e limites de tamanho/contagem para artefatos
persistidos; isso exige um reader central com erro próprio, não fica
implicitamente resolvido pelo Zod.

### P2 — metadata pode vazar paths

Paths absolutos ajudam diagnóstico local, mas revelam username e estrutura. Metadata local pode mantê-los; `export --portable` deve converter para relativos/redigidos.

## Regras de filesystem

```ts
const relative = path.relative(rootRealPath, candidateRealPath);
const contained = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
```

Para revelar a própria raiz, permitir `relative === ""`. Criar arquivos com permissões do usuário e nunca seguir um symlink para remoção recursiva sem `realpath`/root check.

## Secrets

- nunca copiar `storageState` para diretório de render;
- nunca registrar headers/cookies;
- tratar URLs com query como sensíveis;
- permitir lista de seletores de mask antes de screenshots;
- CI usa secret store e credencial read-only de curta duração;
- traces têm a mesma classificação de sensibilidade que storage state.

## Supply chain

- Remotion/bundler executa bundle local; entry customizada é código confiável.
- Fixar versões críticas (já ocorre para Remotion) e automatizar audit/SBOM em release.
- Publicar checksums de tarballs e testar exports empacotados.

## Checklist de hardening

- [ ] rotas locais aceitam apenas paths sob roots permitidas;
- [ ] bind loopback + token/Origin;
- [ ] schemas e limites em todas as entradas JSON;
- [ ] logs e exports redigem segredos;
- [ ] cleanup não remove fora de `.democraft`;
- [ ] docs declaram execução de código e sensibilidade dos artefatos;
- [ ] fixture de teste não contém credenciais reais.
