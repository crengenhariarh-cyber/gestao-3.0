from pathlib import Path

path = Path('src/modules/engineering/ui/EngineeringContractWorkspace.tsx')
s = path.read_text()
start = s.index("    } else if(section==='planilhas'){")
end = s.index("    } else if(section==='provisorios'){", start)
new = r'''    } else if(section==='planilhas'){
      const selectedStructure=sheetGroup?.type==='structure'?structures.find(item=>item.id===sheetGroup.id):undefined;
      const selectedAddendum=sheetGroup?.type==='addendum'?addenda.find(item=>item.id===sheetGroup.id):undefined;
      const structureAllocations=selectedStructure?allocations.filter(item=>item.structureId===selectedStructure.id):[];
      const structureRows=selectedStructure?structureAllocations.flatMap((allocation,index)=>{const service=contractServices.find(item=>item.id===allocation.contractServiceId);return service?[{service,index,allocation}]:[]}).filter(row=>match(row.service.description,row.service.unit,selectedStructure.name)&&matchService(row.service.description,row.service.unit,String(row.index+1),String(row.allocation.allocatedQuantity))):[];
      const sheetStructures=structures.filter(item=>match(item.name));
      const sheetAddenda=addenda.filter(item=>match(item.number,labelStatus(item.status)));
      body=<div className="engineering-contract-approved engineering-sheets-approved">
        <div className="engineering-contract-approved__tools">
          <div className="engineering-sheet__search"><span aria-hidden="true">⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar torre, estrutura ou aditivo…" aria-label="Buscar planilha"/></div>
          <select value={filter} onChange={event=>setFilter(event.target.value)} aria-label="Filtrar planilhas"><option value="all">Todos</option><option value="active">Ativos</option><option value="draft">Rascunhos</option><option value="approved">Aprovados</option><option value="closed">Fechados</option></select>
          <Button variant="secondary" size="sm" onClick={()=>open('allocation')}>Distribuir serviço</Button>
          <Button size="sm" onClick={()=>open('contractService')}>＋ Adicionar serviço</Button>
        </div>
        <div className="engineering-contract-approved__stats">
          <div><span className="engineering-contract-approved__stat-icon">▤</span><span><small>Serviços</small><strong>{contractServices.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">▦</span><span><small>Estruturas</small><strong>{structures.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon">◇</span><span><small>Aditivos</small><strong>{addenda.length}</strong></span></div>
          <div><span className="engineering-contract-approved__stat-icon engineering-contract-approved__stat-icon--success">▥</span><span><small>Distribuições</small><strong>{allocations.length}</strong></span></div>
        </div>
        <section className="engineering-contract-approved__section">
          <div className="engineering-contract-approved__section-head"><div><strong>Planilhas por torre / estrutura</strong><span>Selecione uma torre ou estrutura para abrir sua planilha completa em modal.</span></div></div>
          <div className="engineering-contract-approved__structure-list">
            {sheetStructures.length?sheetStructures.map(item=>{const count=allocations.filter(allocation=>allocation.structureId===item.id).length;return <button key={item.id} type="button" className="engineering-contract-approved__structure" onClick={()=>selectSheetGroup({type:'structure',id:item.id})}><span className="engineering-contract-approved__building">▦</span><span className="engineering-contract-approved__structure-name"><strong>{item.name}</strong><small>Planilha-base da estrutura</small></span><span className="engineering-contract-approved__structure-meta"><small>Serviços distribuídos</small><b>{count}</b></span><span className="engineering-contract-approved__structure-meta"><small>Situação</small><b className="engineering-status engineering-status--active">Ativa</b></span><span className="engineering-contract-approved__open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>}):emptyRow('Nenhuma torre ou estrutura corresponde ao filtro.')}
          </div>
        </section>
        <section className="engineering-contract-approved__section engineering-contract-approved__section--addenda">
          <div className="engineering-contract-approved__section-head"><div><strong>Aditivos</strong><span>Cada aditivo permanece separado da planilha-base do contrato.</span></div><Button size="sm" variant="secondary" onClick={()=>open('addendum')}>＋ Novo aditivo</Button></div>
          <div className="engineering-contract-approved__addenda-grid">
            {sheetAddenda.length?sheetAddenda.map(item=><button key={item.id} type="button" className="engineering-contract-approved__addendum" onClick={()=>selectSheetGroup({type:'addendum',id:item.id})}><span className="engineering-contract-approved__addendum-icon">▤</span><span className="engineering-contract-approved__addendum-copy"><strong>Aditivo {item.number}</strong><small>{labelStatus(item.status)}</small></span><span className="engineering-contract-approved__addendum-open">Abrir planilha</span><span className="engineering-contract-approved__chevron">›</span></button>):<em className="ui-muted">Nenhum aditivo corresponde ao filtro.</em>}
          </div>
        </section>
        {selectedStructure&&<Dialog open title={selectedStructure.name} description={`${structureAllocations.length} serviço(s) com quantitativo definido`} onClose={()=>setSheetGroup(null)} onBack={()=>setSheetGroup(null)} footer={<Button onClick={()=>open('allocation')}>＋ Distribuir serviço</Button>}><div className="engineering-sheet"><div className="engineering-sheet__live-filter"><span aria-hidden="true">⌕</span><input autoFocus value={serviceSearch} onChange={event=>setServiceSearch(event.target.value)} placeholder="Filtrar serviços enquanto digita: código, descrição, unidade ou quantitativo…" aria-label={`Filtrar serviços da ${selectedStructure.name}`}/>{serviceSearch&&<button type="button" onClick={()=>setServiceSearch('')} aria-label="Limpar filtro">×</button>}<small>{structureRows.length} de {structureAllocations.length}</small></div><div className="engineering-sheet__table-wrap engineering-sheet__table-wrap--detail"><table className="engineering-sheet__table engineering-sheet__table--services"><thead><tr><th>#</th><th>Serviço</th><th>Unidade</th><th>Valor unit.</th><th>Quantitativo</th><th>Ações</th></tr></thead><tbody>{structureRows.map(row=><tr key={row.service.id}><td>{String(row.index+1).padStart(3,'0')}</td><td><strong>{row.service.description}</strong></td><td>{row.service.unit}</td><td>{currency.format(row.service.unitPrice)}</td><td><strong>{quantity.format(row.allocation.allocatedQuantity)}</strong></td><td><Button size="sm" variant="tertiary" onClick={()=>{const cfg=towerConfig(selectedStructure.metadata);const availableFloors=cfg?Array.from({length:cfg.floorCount},(_,offset)=>String(cfg.firstFloor+offset)):[];const savedFloors=Array.isArray(row.allocation.scopeConfig?.floors)?row.allocation.scopeConfig.floors.map(String):[];setAllocationError(null);setAllocationEdit({contractServiceId:row.service.id,structureId:selectedStructure.id,serviceLabel:row.service.description,structureLabel:selectedStructure.name,unit:row.service.unit,quantity:String(row.allocation.allocatedQuantity),maxQuantity:row.service.quantity,notes:row.allocation.notes??'',availableFloors,selectedFloors:savedFloors,unitsPerFloor:cfg?.unitsPerFloor??0});}}>Editar quantitativo</Button></td></tr>)}</tbody></table>{structureRows.length===0&&emptyRow(serviceSearch?'Nenhum serviço corresponde ao filtro digitado.':'Nenhum serviço distribuído para esta estrutura.')}</div></div></Dialog>}
        {selectedAddendum&&<EngineeringAddendumSheetDialog open scope={scope} addendumId={selectedAddendum.id} addendumNumber={selectedAddendum.number} statusLabel={labelStatus(selectedAddendum.status)} onClose={()=>setSheetGroup(null)} onEditLine={()=>open('addendumLine')}/>}
      </div>;
'''
s = s[:start] + new + s[end:]
path.write_text(s)
