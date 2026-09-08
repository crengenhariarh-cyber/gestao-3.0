from pathlib import Path

p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text(encoding='utf-8')
start="""    const companyLogoFallbacks:Record<string,string>={
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
replacement="""    const companyLogos:Record<string,string>={
      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.webp',
      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'/company-pr.webp',
    };
    const companyLogo=companyLogos[scope.companyId]??'/gestao-brand.svg';
"""
if start in s:
    s=s.replace(start,replacement,1)
elif replacement not in s:
    raise SystemExit('company print logo block not found')
# Local assets make printing synchronous; remove async so ESLint require-await remains satisfied.
s=s.replace('  async function printMeasurement(){\n','  function printMeasurement(){\n',1)
p.write_text(s,encoding='utf-8')
print('Measurement print now uses locally synced official company logos with lint-safe synchronous printing.')
