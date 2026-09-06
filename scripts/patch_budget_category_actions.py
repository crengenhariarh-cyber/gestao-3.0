from pathlib import Path

page_path = Path('src/modules/budget/ui/BudgetWorkspacePageImpl.tsx')
css_path = Path('src/modules/budget/ui/budget-workspace.css')
page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

old_status = "async function setCategoryStatus(category:CategoryRow,status:'active'|'inactive'){if(!scopeTenantId||!scopeCompanyId)return;if(status==='inactive'&&!window.confirm(`Excluir ${category.name} das opções deste orçamento? O histórico será preservado.`))return;const preservedScroll=window.scrollY;const result=await supabase.from('financial_categories').update({status}).eq('id',category.id).eq('tenant_id',scopeTenantId).eq('company_id',scopeCompanyId);if(result.error)setFeedback({tone:'danger',message:result.error.message});else{await load(true);requestAnimationFrame(()=>window.scrollTo({top:preservedScroll,behavior:'auto'}));setFeedback({tone:'success',message:status==='inactive'?'Categoria desativada. O histórico foi preservado.':'Categoria reativada.'});}}"
new_status = "async function setCategoryStatus(category:CategoryRow,status:'active'|'inactive'){if(!scopeTenantId||!scopeCompanyId)return false;if(status==='inactive'&&!window.confirm(`Excluir ${category.name} das opções deste orçamento? O histórico será preservado.`))return false;const preservedScroll=window.scrollY;const result=await supabase.from('financial_categories').update({status}).eq('id',category.id).eq('tenant_id',scopeTenantId).eq('company_id',scopeCompanyId);if(result.error){setFeedback({tone:'danger',message:result.error.message});return false;}await load(true);requestAnimationFrame(()=>window.scrollTo({top:preservedScroll,behavior:'auto'}));setFeedback({tone:'success',message:status==='inactive'?'Categoria desativada. O histórico foi preservado.':'Categoria reativada.'});return true;}"
if old_status not in page:
    raise SystemExit('setCategoryStatus anchor not found')
page = page.replace(old_status, new_status, 1)

old_draft = "const draftAnnual=itemDraft?numberValue(itemDraft.amount):0;"
new_draft = "const selectedDraftCategory=itemDraft?.categoryId?categoryMap.get(itemDraft.categoryId):undefined;\n const draftAnnual=itemDraft?numberValue(itemDraft.amount):0;"
if old_draft not in page:
    raise SystemExit('draft anchor not found')
page = page.replace(old_draft, new_draft, 1)

old_category = "<><Select label=\"Categoria\" value={itemDraft.categoryId} onChange={event=>{const categoryId=event.target.value;setItemFeedback(null);setItemDraft({...itemDraft,categoryId,treatment:treatmentFor(categoryId||null,itemDraft.costCenterId||null)});}} options={[{value:'',label:'Selecione…'},...compatibleCategories(itemDraft.flowType).map(category=>({value:category.id,label:category.name}))]}/><Select label=\"Tratamento no orçamento\""
new_category = "<><div className=\"budget-entry-category-row\"><Select label=\"Categoria\" value={itemDraft.categoryId} onChange={event=>{const categoryId=event.target.value;setItemFeedback(null);setItemDraft({...itemDraft,categoryId,treatment:treatmentFor(categoryId||null,itemDraft.costCenterId||null)});}} options={[{value:'',label:'Selecione…'},...compatibleCategories(itemDraft.flowType).map(category=>({value:category.id,label:category.name}))]}/>{selectedDraftCategory&&<div className=\"budget-entry-category-actions\"><Button size=\"sm\" variant=\"secondary\" onClick={()=>setCategoryDraft({id:selectedDraftCategory.id,name:selectedDraftCategory.name,kind:selectedDraftCategory.kind})}>Editar</Button><Button size=\"sm\" variant=\"danger\" onClick={()=>{void setCategoryStatus(selectedDraftCategory,'inactive').then(changed=>{if(changed)setItemDraft(current=>current?{...current,categoryId:'',amount:'',notes:''}:current);});}}>Excluir</Button></div>}</div><Select label=\"Tratamento no orçamento\""
if old_category not in page:
    raise SystemExit('category select anchor not found')
page = page.replace(old_category, new_category, 1)

css_patch = '''\n/* Category maintenance inside annual budget entry. */\n.budget-entry-category-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}\n.budget-entry-category-actions{display:flex;gap:8px;align-items:center;padding-bottom:1px}\n.budget-entry-category-actions .ui-button{min-height:50px;white-space:nowrap}\n@media(max-width:680px){.budget-entry-category-row{grid-template-columns:1fr}.budget-entry-category-actions{display:grid;grid-template-columns:1fr 1fr}.budget-entry-category-actions .ui-button{width:100%}}\n'''
if 'Category maintenance inside annual budget entry.' not in css:
    css += css_patch

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
