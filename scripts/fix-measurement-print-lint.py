from pathlib import Path

p = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = p.read_text(encoding='utf-8')
old = "    const esc=(value:unknown)=>String(value??'').replace(/[&<>\\\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[char]??char));"
new = "    const esc=(value:unknown)=>safeText(value).replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[char]??char));"
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('measurement print esc anchor not found')
p.write_text(s, encoding='utf-8')
print('Measurement print lint repair applied.')
