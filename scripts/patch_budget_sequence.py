from pathlib import Path

page_path = Path('src/modules/budget/ui/BudgetWorkspacePageImpl.tsx')
css_path = Path('src/modules/budget/ui/budget-workspace.css')
page = page_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

replacements = [
    ("const load=useCallback(async()=>{", "const load=useCallback(async(silent=false)=>{"),
    ("if(!scopeTenantId||!scopeCompanyId){setLoading(false);return;}\n  setLoading(true);const month=", "if(!scopeTenantId||!scopeCompanyId){if(!silent)setLoading(false);return;}\n  if(!silent)setLoading(true);const month="),
    ("setTreatments((treatment.data??[]) as TreatmentRow[]);}setLoading(false);\n },[scopeTenantId,scopeCompanyId,competence,budgetYear]);", "setTreatments((treatment.data??[]) as TreatmentRow[]);}if(!silent)setLoading(false);\n },[scopeTenantId,scopeCompanyId,competence,budgetYear]);"),
    ("<Dialog open={itemDraft!==null}", "<Dialog variant=\"budget-entry\" open={itemDraft!==null}"),
]
for old, new in replacements:
    if old not in page:
        raise SystemExit(f'Expected pattern not found: {old[:90]}')
    page = page.replace(old, new, 1)

old_save = "await load();setItemDraft(null);setFeedback({tone:'success',message:`Previsão anual salva e distribuída em ${monthsInPlan} ${monthsInPlan===1?'mês':'meses'} (${money(monthlyAmount)}/mês).`});"
new_save = "await load(true);if(itemDraft.id){setItemDraft(null);setFeedback({tone:'success',message:`Previsão anual salva e distribuída em ${monthsInPlan} ${monthsInPlan===1?'mês':'meses'} (${money(monthlyAmount)}/mês).`});}else{const savedFlowType=itemDraft.flowType;const savedCostCenterId=itemDraft.costCenterId;const savedTreatment=itemDraft.treatment;setItemDraft({id:null,source:savedFlowType==='expense'?'limit':'plan',flowType:savedFlowType,categoryId:'',costCenterId:savedCostCenterId,amount:'',notes:'',treatment:savedFlowType==='expense'?savedTreatment:'operational_cost'});setItemFeedback(null);setFeedback(null);}"
if old_save not in page:
    raise SystemExit('saveItem completion pattern not found')
page = page.replace(old_save, new_save, 1)

anchor = "useEffect(()=>{void load();},[load]);"
feedback_effect = "useEffect(()=>{void load();},[load]);\n useEffect(()=>{if(!feedback)return;const timeout=window.setTimeout(()=>setFeedback(null),feedback.tone==='success'?1800:4000);return()=>window.clearTimeout(timeout);},[feedback]);"
if anchor not in page:
    raise SystemExit('load effect anchor not found')
page = page.replace(anchor, feedback_effect, 1)

css_patch = r'''

/* Budget mobile correction: filters never compete for width. */
@media(max-width:680px){
  .budget-workspace__filters{grid-template-columns:1fr!important;gap:10px!important}
  .budget-workspace__filters>.ui-field,.budget-workspace__filters>.ui-field:last-child{grid-column:1/-1!important;width:100%!important;max-width:none!important;min-width:0!important;min-height:76px!important}
  .budget-workspace__filters>.ui-field>.ui-input{width:100%!important;min-width:0!important;font-size:.95rem!important;overflow:visible!important;text-overflow:clip!important}
}

/* Annual forecast uses the same compact full-screen form language as the other Gestão forms. */
.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog{width:min(100%,760px)}
.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__content{padding:16px 18px 20px;background:color-mix(in srgb,var(--color-primary,#2563eb) 1.2%,var(--color-surface,#fff))}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start;max-width:720px;width:100%;margin:0 auto}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>.ui-field{min-width:0;margin:0;gap:6px}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field__label-row{min-height:22px}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field__label{font-size:.84rem;font-weight:750}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field__control{min-height:52px}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-input{height:52px!important;min-height:52px!important;padding-top:8px!important;padding-bottom:8px!important;font-size:1rem!important;border-radius:12px!important}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field__control-icon{width:46px}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field--adorned .ui-input{padding-left:54px!important}
.ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>p.ui-muted{margin:0;padding:2px 2px 0;font-size:.9rem}
.ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__footer{padding-top:10px;padding-bottom:max(10px,env(safe-area-inset-bottom))}
@media(max-width:680px){
  .ui-dialog-backdrop[data-variant="budget-entry"]{padding:0}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog{width:100%;height:100dvh;max-width:none;max-height:100dvh;border-radius:0;grid-template-rows:auto minmax(0,1fr) auto}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__header{padding:11px 14px}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__heading h2{font-size:1.16rem;line-height:1.18}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__heading p{font-size:.82rem;line-height:1.28;margin-top:3px}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__content{padding:12px 16px 16px;overflow-y:auto;overscroll-behavior:contain}
  .ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form{grid-template-columns:1fr;gap:10px;max-width:none}
  .ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-field__control{min-height:50px}
  .ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form .ui-input{height:50px!important;min-height:50px!important}
  .ui-dialog-backdrop[data-variant="budget-entry"] .budget-workspace__form>.budget-workspace__item-values{grid-template-columns:1fr!important;margin:0;padding:8px}
  .ui-dialog-backdrop[data-variant="budget-entry"] .ui-dialog__footer .ui-button{width:100%;min-height:52px}
}
'''
marker = '/* Budget mobile correction: filters never compete for width. */'
if marker not in css:
    css += css_patch

page_path.write_text(page, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Budget flow and layout patched successfully.')
