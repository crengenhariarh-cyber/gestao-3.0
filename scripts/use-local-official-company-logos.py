from pathlib import Path

p=Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s=p.read_text(encoding='utf-8')
start="""    const companyLogoFallbacks:Record<string,string>={\n      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.svg',\n      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'/gestao-brand.svg',\n    };\n    let companyLogo=companyLogoFallbacks[scope.companyId]??'/gestao-brand.svg';\n    try{\n      const legacySupabaseUrl='https://nuigbsleackrwpoxwxdo.supabase.co';\n      const legacyAnonKey='sb_publishable_mui9_MiItgq_ySgyL_60MA_KLkA0Fe4';\n      const response=await fetch(`${legacySupabaseUrl}/rest/v1/platform_companies?id=eq.${encodeURIComponent(scope.companyId)}&select=logo_url`,{\n        headers:{apikey:legacyAnonKey,Authorization:`Bearer ${legacyAnonKey}`},\n        cache:'no-store',\n      });\n      if(response.ok){\n        const payload=await response.json() as Array<{logo_url?:string|null}>;\n        const registeredLogo=payload[0]?.logo_url??'';\n        if(registeredLogo.startsWith('data:image/'))companyLogo=registeredLogo;\n      }\n    }catch{\n      // Printing must remain available offline or if the legacy registry is unavailable.\n      // The local company-specific asset is used as the safe fallback.\n    }\n"""
replacement="""    const companyLogos:Record<string,string>={\n      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.webp',\n      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'/company-pr.webp',\n    };\n    const companyLogo=companyLogos[scope.companyId]??'/gestao-brand.svg';\n"""
if start in s:
    s=s.replace(start,replacement,1)
elif replacement not in s:
    raise SystemExit('company print logo block not found')
p.write_text(s,encoding='utf-8')
print('Measurement print now uses locally synced official company logos.')
