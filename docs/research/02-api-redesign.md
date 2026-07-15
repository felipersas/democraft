# Redesenho de API e contrato para agentes

## Objetivo

Melhorar inferência, validação e evolução sem quebrar `defineDemo`, métodos atuais de scene nem os comandos existentes.

## Avaliação da API atual

Pontos bons: verbos legíveis (`goto`, `click`, `focus`, `caption`), targets centralizados e separação scene/demo. Problemas: IDs de target chegam aos métodos como `string`, configuração existe como identity helper mas não percorre o pipeline, e erros são arrays genéricos de diagnostics sem resultado discriminado.

## Três alternativas

### A. Evolução compatível da DSL atual — recomendada

```ts
const targets = defineTargets({ save: byRole("button", {name: "Save"}) });

export default defineDemo({
  id: "save-profile",
  targets,
  async run({demo}) {
    await demo.scene("save", async (scene) => {
      await scene.click("save");
    });
  },
});
```

Evoluções: preservar chaves literais de `defineTargets`, aceitar `DemoDefinition<TTargets>`, adicionar config no definition e retornar resultados discriminados nos serviços. Menor migração e melhor compatibilidade.

### B. IR declarativa como API primária

```ts
defineDemo({ scenes: [{id: "save", steps: [{kind: "browser.click", target: "save"}]}] });
```

Excelente para geração por LLM e validação, mas menos natural para condicionais/abstrações TypeScript. Pode existir como formato de intercâmbio, não como substituto imediato.

### C. Builder fluente

```ts
demo("save-profile").scene("save").click(targets.save).caption("Saved");
```

Autocomplete agradável, porém adiciona estado implícito, dificulta `await`, branching e mensagens de erro. Não recomendado.

## Recomendação

Manter A para humanos e expor B como **Authoring IR** JSON versionada para agentes. Ambos compilam para a mesma `DemoIR`. Não fazer um builder C.

## Contrato LLM-friendly

```ts
type AuthoringDocumentV1 = {
  schemaVersion: "1";
  demo: {
    id: string;
    title: string;
    source: {baseUrl: string; initialPath?: string};
  };
  targets: Record<string, {
    locators: Array<Locator>;
    description?: string;
  }>;
  scenes: Array<{
    id: string;
    title?: string;
    steps: AuthoringStepV1[];
  }>;
};
```

Regras para agentes:

- unions discriminadas por `kind`;
- sem campos polimórficos `string | object`;
- IDs com regex documentada e unicidade validada;
- defaults aplicados por `normalize`, nunca presumidos pelo modelo;
- `additionalProperties: false` no JSON Schema publicado;
- diagnostics com `code`, `path`, `message`, `suggestion` e `docsUrl`;
- exemplos válidos e inválidos no próprio pacote.

## Resultado de operações

```ts
type OperationResult<T> =
  | {ok: true; value: T; diagnostics: Diagnostic[]}
  | {ok: false; diagnostics: Diagnostic[]};
```

O CLI converte isso em exit code. O Studio apresenta diagnostics. Bibliotecas não chamam `process.exit`.

## Comandos propostos

```text
democraft validate demo.ts --static
democraft validate-artifact manifest.json
democraft inspect demo.ts --json
democraft plan demo.ts --manifest ... --dry-run
democraft render --manifest ... --timeline ...
democraft runs list [demo-id] --json
democraft runs open <run-id>
democraft doctor
```

`--dry-run` deve produzir plano, caminhos pretendidos, versões e hashes sem abrir browser nem iniciar Remotion.

## Erros e versionamento

- Catálogo único `DCxxxx`, sem reutilizar código.
- Schema version é major do artefato, separado da versão npm.
- Leitor suporta versão atual e anterior por migrations puras.
- Escritor sempre emite versão atual.
- Campo desconhecido: warning em modo compatível, erro em modo strict.
- Remoção de API passa por deprecation JSDoc + warning opt-in + major release.

## Migração sem quebra

1. Adicionar parsers e tipos genéricos sem mudar output.
2. Emitir `definitionHash` opcional nos novos artefatos.
3. Fazer leitores aceitarem ausência do hash.
4. Adicionar Authoring IR como entrada alternativa.
5. Só em major futuro tornar validação strict default para campos desconhecidos.
