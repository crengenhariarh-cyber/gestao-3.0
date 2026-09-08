from pathlib import Path

p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')

# Rebuild the print function on every CI run so stale print implementations cannot survive.
start = s.find('  function printMeasurement(){')
if start != -1:
    end = s.find('  function closeFlow(){onClose();}', start)
    if end == -1:
        raise SystemExit('closeFlow anchor not found after printMeasurement')
    s = s[:start] + s[end:]

anchor = "  async function finalizeMeasurement(){if(!activeMeasurementId){setError('Salve ao menos um serviço antes de finalizar a medição.');return;}try{await saveHeader();await operations.setMeasurementStatus(activeMeasurementId,'close');onChanged();onClose();}catch{return;}}\n  function closeFlow(){onClose();}"

print_fn = r'''  async function finalizeMeasurement(){if(!activeMeasurementId){setError('Salve ao menos um serviço antes de finalizar a medição.');return;}try{await saveHeader();await operations.setMeasurementStatus(activeMeasurementId,'close');onChanged();onClose();}catch{return;}}
  function printMeasurement(){
    if(!model||!activeMeasurementId||measurementGross<=0)return;
    document.getElementById('measurement-print-root')?.remove();
    document.getElementById('measurement-print-style')?.remove();
    const esc=(value:unknown)=>String(value??'').replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]??char));
    const measurement=model.measurements.find(item=>item.id===activeMeasurementId);
    const status=measurement?.status==='draft'?'RASCUNHO':(measurement?.status??'').toLocaleUpperCase('pt-BR');
    const rows=model.origins.flatMap(origin=>origin.services.map(service=>{
      const quantity=model.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===service.targetKind&&line.targetId===service.targetId).reduce((sum,line)=>sum+line.measuredQuantity,0);
      if(quantity<=0)return null;
      return `<tr><td>${esc(originLabel(origin))}</td><td>${esc(service.code||'—')}</td><td>${esc(service.description)}</td><td>${esc(service.unit)}</td><td class="num">${esc(quantity.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td class="num">${esc(currency.format(service.unitPrice))}</td><td class="num strong">${esc(currency.format(quantity*service.unitPrice))}</td></tr>`;
    }).filter((row):row is string=>Boolean(row))).join('');
    const competence=header.competence?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(`${header.competence}-01T12:00:00`)):'—';
    const formatDate=(value:string)=>{if(!value)return '—';const [y,m,d]=value.split('-');return y&&m&&d?`${d}/${m}/${y}`:value;};
    const root=document.createElement('div');
    root.id='measurement-print-root';
    root.innerHTML=`<header><div class="brand"><img id="measurement-print-logo" src="/gestao-brand.svg" alt="Gestão 3.0"></div><div class="title"><h1>Medição ${esc(header.measurementNumber||'—')}</h1><span class="badge">${esc(status)}</span></div></header><section class="meta"><div class="box"><span>Competência</span><strong>${esc(competence)}</strong></div><div class="box"><span>Vencimento previsto</span><strong>${esc(formatDate(header.dueDate))}</strong></div><div class="box"><span>Forma de pagamento</span><strong>${esc(header.paymentMethod||'—')}</strong></div></section><section class="financial"><div class="box"><span>Bruto</span><strong>${esc(currency.format(measurementGross))}</strong></div><div class="box"><span>INSS</span><strong>${esc(currency.format(inssValue))}</strong></div><div class="box"><span>ISS</span><strong>${esc(currency.format(issValue))}</strong></div><div class="box"><span>Retenção</span><strong>${esc(currency.format(rtValue))}</strong></div><div class="box net"><span>Líquido</span><strong>${esc(currency.format(measurementNet))}</strong></div></section><h2>Serviços desta medição</h2><table><thead><tr><th style="width:15%">Origem</th><th style="width:9%">Código</th><th style="width:35%">Descrição</th><th style="width:7%">Un.</th><th style="width:9%;text-align:right">Qtd.</th><th style="width:12%;text-align:right">Unitário</th><th style="width:13%;text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table><div class="obs"><strong>Observações:</strong> ${esc(header.notes||'—')}</div><div class="footer"><span>Gestão 3.0 · Engenharia</span><span>Documento emitido em ${esc(new Date().toLocaleString('pt-BR'))}</span></div>`;
    const style=document.createElement('style');
    style.id='measurement-print-style';
    style.textContent=`#measurement-print-root{position:fixed;left:-100000px;top:0;width:794px;visibility:hidden;background:#fff;color:#111827}@media print{@page{size:A4 portrait;margin:12mm}html,body{background:#fff!important}body>*{display:none!important}#measurement-print-root{display:block!important;position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;visibility:visible!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important;font-size:10.5px!important}#measurement-print-root *{visibility:visible!important;box-sizing:border-box!important}#measurement-print-root header{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;border-bottom:2px solid #1d4ed8!important;padding-bottom:10px!important;margin-bottom:14px!important}#measurement-print-root .brand{display:flex!important;align-items:center!important}#measurement-print-root .brand img{display:block!important;width:150px!important;max-height:54px!important;object-fit:contain!important;object-position:left center!important}#measurement-print-root .title{text-align:right!important}#measurement-print-root .title h1{font-size:18px!important;margin:0 0 4px!important}#measurement-print-root .badge{display:inline-block!important;border:1px solid #d97706!important;color:#92400e!important;background:#fffbeb!important;border-radius:999px!important;padding:3px 8px!important;font-weight:700!important;font-size:9px!important}#measurement-print-root .meta{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;margin-bottom:12px!important}#measurement-print-root .box{display:block!important;border:1px solid #d1d5db!important;border-radius:8px!important;padding:8px!important}#measurement-print-root .box span{display:block!important;color:#6b7280!important;font-size:8.5px!important;margin-bottom:3px!important;text-transform:uppercase!important}#measurement-print-root .box strong{font-size:11px!important}#measurement-print-root .financial{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:6px!important;margin:12px 0!important}#measurement-print-root .financial .box{padding:7px!important}#measurement-print-root .financial .net{border-color:#86efac!important;background:#f0fdf4!important}#measurement-print-root h2{font-size:12px!important;margin:14px 0 7px!important}#measurement-print-root table{display:table!important;width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}#measurement-print-root thead{display:table-header-group!important}#measurement-print-root tbody{display:table-row-group!important}#measurement-print-root tr{display:table-row!important;break-inside:avoid!important}#measurement-print-root th,#measurement-print-root td{display:table-cell!important;border-bottom:1px solid #e5e7eb!important;padding:6px 5px!important;vertical-align:top!important;word-wrap:break-word!important}#measurement-print-root th{background:#f3f4f6!important;text-align:left!important;font-size:8px!important;text-transform:uppercase!important;color:#4b5563!important}#measurement-print-root .num{text-align:right!important}#measurement-print-root .strong{font-weight:700!important}#measurement-print-root .obs{display:block!important;margin-top:12px!important;border:1px solid #e5e7eb!important;border-radius:8px!important;padding:8px!important;min-height:34px!important}#measurement-print-root .footer{display:flex!important;margin-top:16px!important;padding-top:8px!important;border-top:1px solid #e5e7eb!important;color:#6b7280!important;font-size:8px!important;justify-content:space-between!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}`;
    document.head.appendChild(style);
    document.body.appendChild(root);
    const trigger=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    const logo=root.querySelector<HTMLImageElement>('#measurement-print-logo');
    if(logo&&!logo.complete){let fired=false;const done=()=>{if(fired)return;fired=true;setTimeout(trigger,150);};logo.addEventListener('load',done,{once:true});logo.addEventListener('error',done,{once:true});setTimeout(done,1800);}else{setTimeout(trigger,150);}
    // Deliberately keep the print DOM alive. Android's print spooler can snapshot
    // the page after window.print()/afterprint returns; removing it early creates
    // a blank PDF preview. It is removed on the next print invocation instead.
  }
  function closeFlow(){onClose();}'''

if anchor not in s:
    raise SystemExit('finalize/closeFlow anchor not found')
s = s.replace(anchor, print_fn, 1)
s = s.replace('onClick={()=>window.print()}>⎙ Imprimir medição</Button>', 'onClick={printMeasurement}>⎙ Imprimir medição</Button>')

p.write_text(s, encoding='utf-8')
print('Android-safe measurement print patch applied.')
