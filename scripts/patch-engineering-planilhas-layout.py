from pathlib import Path

path = Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s = path.read_text()
start = s.index('        <div className="engineering-sheet__group-grid">', s.index("} else if(section==='planilhas')"))
end = s.index("        {!sheetGroup&&emptyRow('Selecione uma torre/estrutura ou um aditivo para abrir a planilha correspondente.')}", start)
replacement = '''        <div className="engineering-contract-approved engineering-contract-approved--sheets">
          <section className="engineering-contract-approved__section">
            <div className="engineering-contract-approved__section-head">
              <div><strong>Planilhas por torre / estrutura</strong><span>Selecione uma estrutura para abrir a planilha completa em modal.</span></div>
            </div>
            <div className="engineering-contract-approved__structure-list">
              {structures.length?structures.map(item=>{const count=allocations.filter(allocation=>allocation.structureId===item.id).length;return <button key={item.id} type="button" className="engineering-contract-approved__structure" onClick={()=>selectSheetGroup({type:'structure',id:item.id})}><span className="engineering-contract-approved__building">▦</span><span className="engineering-contract-approved__structure-name"><strong>{item.name}</strong><small>{count} serviço(s) distribuído(s)</small></span><span className="engineering-contract-approved__structure-meta"><small>Tipo</small><b>Planilha de estrutura</b></span><span className="engineering-contract-approved__structure-meta"><small>Situação</small><b className="engineering-status engineering-status--active">Ativa</b></span><span className="engineering-contract-approved__open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>}):emptyRow('Nenhuma torre ou estrutura cadastrada.')}
            </div>
          </section>
          <section className="engineering-contract-approved__section engineering-contract-approved__section--addenda">
            <div className="engineering-contract-approved__section-head"><div><strong>Aditivos</strong><span>Cada aditivo permanece separado da planilha-base do contrato.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>＋ Novo aditivo</Button></div>
            <div className="engineering-contract-approved__addenda-grid">
              {addenda.length?addenda.map(item=><button key={item.id} type="button" className="engineering-contract-approved__addendum" onClick={()=>selectSheetGroup({type:'addendum',id:item.id})}><span className="engineering-contract-approved__addendum-icon">▤</span><span className="engineering-contract-approved__addendum-copy"><strong>Aditivo {item.number}</strong><small>{labelStatus(item.status)}</small></span><span className="engineering-contract-approved__addendum-open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>):<em className="ui-muted">Nenhum aditivo cadastrado.</em>}
            </div>
          </section>
        </div>
'''
s = s[:start] + replacement + s[end:]
path.write_text(s)
