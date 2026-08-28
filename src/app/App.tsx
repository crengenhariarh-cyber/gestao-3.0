export function App() {
  return (
    <main className="foundation-page">
      <section className="foundation-card" aria-labelledby="foundation-title">
        <span className="foundation-badge">Fase 3 · Fundação Técnica</span>
        <h1 id="foundation-title">Gestão 3.0</h1>
        <p>
          Base limpa inicializada. Nenhum módulo de negócio foi copiado do Gestão 2.0.
        </p>
        <dl className="foundation-status">
          <div>
            <dt>Arquitetura</dt>
            <dd>Monólito modular</dd>
          </div>
          <div>
            <dt>TypeScript</dt>
            <dd>Strict</dd>
          </div>
          <div>
            <dt>Produção</dt>
            <dd>Sem deploy</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
