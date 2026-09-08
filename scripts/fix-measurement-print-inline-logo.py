from pathlib import Path

p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')

start = s.find("    const companyLogos:Record<string,string>={")
end = s.find("    root.innerHTML=`<header>", start)
if start == -1 or end == -1:
    # Already migrated: validate the production-safe markers instead of failing.
    required = [
        "platform_companies?id=eq.${encodeURIComponent(scope.companyId)}&select=logo_url",
        "registeredLogo.startsWith('data:image/')",
        "'/company-cr.svg'",
    ]
    missing = [marker for marker in required if marker not in s]
    if missing:
        raise SystemExit(f'company logo block not found and migration markers missing: {missing}')
else:
    replacement = """    const companyLogoFallbacks:Record<string,string>={
      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.svg',
      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'/gestao-brand.svg',
    };
    let companyLogo=companyLogoFallbacks[scope.companyId]??'/gestao-brand.svg';
    try{
      const legacySupabaseUrl='https://nuigbsleackrwpoxwxdo.supabase.co';
      const legacyAnonKey='sb_publishable_mui9_MiItgq_ySgyL_60MA_KLkA0Fe4';
      const response=await fetch(`${legacySupabaseUrl}/rest/v1/platform_companies?id=eq.${encodeURIComponent(scope.companyId)}&select=logo_url`,{
        headers:{apikey:legacyAnonKey,Authorization:`Bearer ${legacyAnonKey}`},
        cache:'no-store',
      });
      if(response.ok){
        const payload=await response.json() as Array<{logo_url?:string|null}>;
        const registeredLogo=payload[0]?.logo_url??'';
        if(registeredLogo.startsWith('data:image/'))companyLogo=registeredLogo;
      }
    }catch{
      // Printing must remain available offline or if the legacy registry is unavailable.
      // The local company-specific asset is used as the safe fallback.
    }
"""
    s = s[:start] + replacement + s[end:]

# The print action is asynchronous but React event handlers must remain void-returning.
s = s.replace('onClick={printMeasurement}>⎙ Imprimir medição</Button>', 'onClick={()=>{void printMeasurement();}}>⎙ Imprimir medição</Button>')

# Regression guards: no external Storage URL and no print cancellation just because the logo registry is unreachable.
for forbidden in [
    'company-assets/company-logos/CR_',
    'company-assets/company-logos/PR_',
    "setError('Não foi possível carregar o logo da empresa para a impressão. Tente novamente.')",
]:
    if forbidden in s:
        raise SystemExit(f'forbidden legacy print-logo behavior remains: {forbidden}')

if "platform_companies?id=eq.${encodeURIComponent(scope.companyId)}&select=logo_url" not in s:
    raise SystemExit('official company registry lookup missing')
if "registeredLogo.startsWith('data:image/')" not in s:
    raise SystemExit('embedded registered logo validation missing')
if "'/company-cr.svg'" not in s:
    raise SystemExit('CR local fallback missing')

p.write_text(s, encoding='utf-8')
print('Measurement print now uses the registered CR/PR logo as an embedded data image, with a local fallback.')
