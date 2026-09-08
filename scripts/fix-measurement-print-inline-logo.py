from pathlib import Path

# The Android print spooler must receive an already embedded image, never an external URL.
p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')

old_signature = "  function printMeasurement(){"
new_signature = "  async function printMeasurement(){"
if old_signature in s:
    s = s.replace(old_signature, new_signature, 1)
elif new_signature not in s:
    raise SystemExit('printMeasurement signature not found')

old_logo = """    const companyLogo=companyLogos[scope.companyId]??'/gestao-brand.svg';
    root.innerHTML=`<header><div class=\"brand\"><img id=\"measurement-print-logo\" src=\"${companyLogo}\" alt=\"Logo da empresa\"></div>"""
new_logo = """    const companyLogoUrl=companyLogos[scope.companyId]??'/gestao-brand.svg';
    let companyLogo='';
    try{
      const response=await fetch(companyLogoUrl,{cache:'force-cache'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      companyLogo=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Logo inválido'));reader.onerror=()=>reject(reader.error??new Error('Falha ao ler logo'));reader.readAsDataURL(blob);});
      if(!companyLogo.startsWith('data:image/'))throw new Error('Formato de logo inválido');
    }catch{
      setError('Não foi possível carregar o logo da empresa para a impressão. Tente novamente.');
      return;
    }
    root.innerHTML=`<header><div class=\"brand\"><img id=\"measurement-print-logo\" src=\"${companyLogo}\" alt=\"Logo da empresa\"></div>"""
if old_logo in s:
    s = s.replace(old_logo, new_logo, 1)
elif new_logo not in s:
    raise SystemExit('company logo block not found')

old_gate = """    const trigger=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    const logo=root.querySelector<HTMLImageElement>('#measurement-print-logo');
    if(logo&&!logo.complete){let fired=false;const done=()=>{if(fired)return;fired=true;setTimeout(trigger,150);};logo.addEventListener('load',done,{once:true});logo.addEventListener('error',done,{once:true});setTimeout(done,1800);}else{setTimeout(trigger,150);}"""
new_gate = """    const trigger=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
    const logo=root.querySelector<HTMLImageElement>('#measurement-print-logo');
    const printWithLogo=()=>setTimeout(trigger,150);
    const failLogo=()=>{root.remove();style.remove();setError('O logo da empresa não pôde ser renderizado. A impressão foi cancelada para não gerar um documento sem identificação.');};
    if(!logo){failLogo();return;}
    if(logo.complete){if(logo.naturalWidth>0)printWithLogo();else failLogo();}
    else{logo.addEventListener('load',printWithLogo,{once:true});logo.addEventListener('error',failLogo,{once:true});}"""
if old_gate in s:
    s = s.replace(old_gate, new_gate, 1)
elif new_gate not in s:
    raise SystemExit('logo print gate not found')

if "const companyLogo=companyLogos[scope.companyId]" in s:
    raise SystemExit('external companyLogo binding still present')
if "logo.addEventListener('error',done" in s:
    raise SystemExit('print-on-logo-error behavior still present')
if "reader.readAsDataURL(blob)" not in s:
    raise SystemExit('inline data URL conversion missing')

p.write_text(s, encoding='utf-8')
print('Measurement print logo is now embedded before Android print.')
