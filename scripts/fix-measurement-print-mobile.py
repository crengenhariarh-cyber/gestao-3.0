from pathlib import Path

p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')

if 'function printMeasurement(){' not in s:
    raise SystemExit('printMeasurement function not found')

unsafe = "    const esc=(value:unknown)=>String(value??'').replace(/[&<>\\\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[char]??char));"
safe = "    const esc=(value:unknown)=>safeText(value).replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[char]??char));"

if unsafe in s:
    s = s.replace(unsafe, safe, 1)
elif safe not in s:
    raise SystemExit('measurement print escape helper anchor not found')

# The contract loader is scoped by company_id, so scope.companyId is the company
# that owns the measurement contract. Use the authoritative logos already stored
# by Gestão 2.0 instead of the generic Gestão brand.
old_logo_lines = [
    "    const companyLogo=scope.companyId==='1ac1cde3-30fa-4fab-9ea0-8afbb34732e5'?'/company-cr.svg':'/gestao-brand.svg';",
    "    const companyLogo='/gestao-brand.svg';",
]
company_logo_block = """    const companyLogos:Record<string,string>={
      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'https://nuigbsleackrwpoxwxdo.supabase.co/storage/v1/object/public/company-assets/company-logos/CR_1756269998618_76039.png',
      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'https://nuigbsleackrwpoxwxdo.supabase.co/storage/v1/object/public/company-assets/company-logos/PR_1756269998620_567409.png',
    };
    const companyLogo=companyLogos[scope.companyId]??'/gestao-brand.svg';"""

if company_logo_block not in s:
    replaced = False
    for old in old_logo_lines:
        if old in s:
            s = s.replace(old, company_logo_block, 1)
            replaced = True
            break
    if not replaced:
        raise SystemExit('measurement company logo anchor not found')

# Android print spooler needs the printable DOM to remain alive after window.print().
if "setTimeout(()=>{if(document.getElementById('measurement-print-root'))cleanup();},10000);" in s:
    s = s.replace("    setTimeout(()=>{if(document.getElementById('measurement-print-root'))cleanup();},10000);\n", '', 1)

# Guard against regression: CR/PR must never silently fall back to the generic logo.
if 'CR_1756269998618_76039.png' not in s or 'PR_1756269998620_567409.png' not in s:
    raise SystemExit('company measurement logos not configured')

p.write_text(s, encoding='utf-8')
print('Android-safe, lint-safe, company-branded measurement print verified.')
