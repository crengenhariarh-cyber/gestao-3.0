from pathlib import Path

p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')

old = "    root.id='measurement-print-root';\n    root.innerHTML=`<header><div class=\"brand\"><img id=\"measurement-print-logo\" src=\"/gestao-brand.svg\" alt=\"Gestão 3.0\"></div>"
new = "    root.id='measurement-print-root';\n    const companyLogo=scope.companyId==='1ac1cde3-30fa-4fab-9ea0-8afbb34732e5'?'/company-cr.svg':'/gestao-brand.svg';\n    root.innerHTML=`<header><div class=\"brand\"><img id=\"measurement-print-logo\" src=\"${companyLogo}\" alt=\"Logo da empresa\"></div>"

if new in s:
    print('Company print logo already applied.')
elif old in s:
    s = s.replace(old, new, 1)
    p.write_text(s, encoding='utf-8')
    print('Company print logo applied.')
else:
    raise SystemExit('measurement print logo anchor not found')
