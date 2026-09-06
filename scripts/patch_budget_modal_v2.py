from pathlib import Path
import re

page_path=Path('src/modules/budget/ui/BudgetWorkspacePageImpl.tsx')
css_path=Path('src/modules/budget/ui/budget-workspace.css')
page=page_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')

# Remove subtitle/description from annual forecast modal.
page=re.sub(r' description=\{`Informe o valor total do exercício\.[^`]+`\}', '', page, count=1)

# Replace save flow so Save closes and Save + next advances automatically to the next category.
pattern=r" async function saveItem\(\)\{.*?\}\n async function removeForecast"
replacement=r''' async function saveItem(goNext=false){
  if(!itemDraft||!scopeTenantId||!scopeCompanyId)return;
  if(itemDraft.flowType==='expense'&&!itemDraft.categoryId){setItemFeedback('Selecione uma categoria para a saída prevista.');return;}
  const current=itemDraft;
  setSaving(true);setFeedback(null);setItemFeedback(null);
  try{
    const annualAmount=numberValue(current.amount);
    if(annualAmount<=0)throw new Error('Informe um valor anual previsto maior que zero.');
    const notes=current.notes||null;
    const monthlyAmount=monthsInPlan>0?Number((annualAmount/monthsInPlan).toFixed(2)):annualAmount;
    if(current.flowType==='expense'){
      const treatmentResult=await saveTreatment(current.categoryId,current.costCenterId,current.treatment);
      if(treatmentResult.error)throw treatmentResult.error;
    }
    const annualResult=await saveAnnualDefinition(current.flowType,current.categoryId,current.costCenterId,annualAmount,notes);
    if(annualResult.error)throw annualResult.error;
    for(let month=startMonth;month<=12;month+=1){
      if(current.flowType==='expense'){
        const limitResult=await upsertMonthlyLimit(current.categoryId,current.costCenterId,month,monthlyAmount,notes);
        if(limitResult.error)throw limitResult.error;
      }
      const planResult=await upsertMonthlyPlan(current.flowType,current.categoryId,current.costCenterId,month,monthlyAmount,notes);
      if(planResult.error)throw planResult.error;
    }
    await load(true);
    if(goNext&&!current.id){
      const available=compatibleCategories(current.flowType);
      const currentIndex=available.findIndex(category=>category.id===current.categoryId);
      const nextCategory=currentIndex>=0?available[currentIndex+1]:available[0];
      if(nextCategory){
        setItemDraft({id:null,source:current.flowType==='expense'?'limit':'plan',flowType:current.flowType,categoryId:nextCategory.id,costCenterId:current.costCenterId,amount:'',notes:'',treatment:current.flowType==='expense'?treatmentFor(nextCategory.id,current.costCenterId||null):'operational_cost'});
        setItemFeedback(null);
      }else{
        setItemDraft(null);
        setFeedback({tone:'success',message:'Última categoria concluída.'});
      }
    }else{
      setItemDraft(null);
      setFeedback({tone:'success',message:`Previsão anual salva e distribuída em ${monthsInPlan} ${monthsInPlan===1?'mês':'meses'} (${money(monthlyAmount)}/mês).`});
    }
  }catch(error){setItemFeedback(errorMessage(error));}
  finally{setSaving(false);}
 }
 async function removeForecast'''
page,n=re.subn(pattern,replacement,page,count=1,flags=re.S)
if n!=1: raise SystemExit('saveItem block not found')

# Make removeForecast return success so modal delete can close only when deletion actually happened.
page=page.replace("async function removeForecast(flowType:FlowType,categoryId:string|null,costCenterId:string|null){if(!scopeTenantId||!scopeCompanyId)return;if(!window.confirm", "async function removeForecast(flowType:FlowType,categoryId:string|null,costCenterId:string|null){if(!scopeTenantId||!scopeCompanyId)return false;if(!window.confirm",1)
page=page.replace("))return;setSaving(true);setFeedback(null);try{", "))return false;setSaving(true);setFeedback(null);try{",1)
page=page.replace("await load();setFeedback({tone:'success',message:'Previsão removida. Os valores realizados e a classificação do item foram preservados.'});}catch(error){setFeedback({tone:'danger',message:errorMessage(error)});}finally{setSaving(false);}}", "await load(true);setFeedback({tone:'success',message:'Previsão removida. Os valores realizados e a classificação do item foram preservados.'});return true;}catch(error){setFeedback({tone:'danger',message:errorMessage(error)});return false;}finally{setSaving(false);}}",1)

# Preserve page scroll when category is excluded/reactivated.
old="else{await load();setFeedback({tone:'success',message:status==='inactive'?'Categoria desativada. O histórico foi preservado.':'Categoria reativada.'});}}"
new="else{const preservedScroll=window.scrollY;await load(true);requestAnimationFrame(()=>window.scrollTo({top:preservedScroll,behavior:'auto'}));setFeedback({tone:'success',message:status==='inactive'?'Categoria desativada. O histórico foi preservado.':'Categoria reativada.'});}}"
if old not in page: raise SystemExit('category status completion not found')
page=page.replace(old,new,1)

# Add custom footer with edit/delete/save/save-next actions.
needle='loading={saving} onClose='
footer='''loading={saving} footer={itemDraft?<div className="budget-entry-actions">{itemDraft.id&&<Button variant="danger" onClick={()=>{void removeForecast(itemDraft.flowType,itemDraft.categoryId||null,itemDraft.costCenterId||null).then(removed=>{if(removed)setItemDraft(null);});}} disabled={saving}>Excluir</Button>}{itemDraft.id&&<Button variant="secondary" onClick={()=>{void saveItem(false);}} loading={saving}>Editar</Button>}<Button variant="secondary" onClick={()=>{void saveItem(false);}} loading={saving}>Salvar</Button>{!itemDraft.id&&<Button onClick={()=>{void saveItem(true);}} loading={saving}>Salvar e próximo →</Button>}</div>:undefined} onClose='''
if needle not in page: raise SystemExit('dialog loading/onClose anchor not found')
page=page.replace(needle,footer,1)
# Remove default confirm to avoid duplicate footer action.
page=page.replace(" onConfirm={()=>{void saveItem();}}",'',1)

css_patch='''\n/* Budget annual-entry v2: approved app-form language. */\n.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__header{background:linear-gradient(180deg,#0b284a,#0d3159);color:#fff;border-bottom:0}\n.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__heading h2{color:#fff}\n.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__close{color:#fff}\n.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__content{background:#f5f8fc}\n.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>.ui-field{padding:10px 12px;border:1px solid color-mix(in srgb,var(--color-border,#dfe3eb) 88%,transparent);border-radius:16px;background:var(--color-surface,#fff);box-shadow:0 4px 14px rgba(16,24,40,.04)}\n.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>p.ui-muted{padding:10px 12px;border-radius:14px;background:color-mix(in srgb,var(--color-primary,#2563eb) 6%,var(--color-surface,#fff));font-weight:650}\n.budget-entry-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}\n.budget-entry-actions .ui-button{width:100%;min-width:0}\n@media(max-width:680px){.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__content{padding:12px 14px 16px}.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form{gap:9px}.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>.ui-field{padding:9px 10px;border-radius:14px}.budget-entry-actions{grid-template-columns:1fr 1fr}.budget-entry-actions .ui-button{min-height:50px;font-size:.9rem}}\n'''
if 'Budget annual-entry v2' not in css: css += css_patch

page_path.write_text(page,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
