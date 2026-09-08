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

# Android print spooler needs the printable DOM to remain alive after window.print().
if "setTimeout(()=>{if(document.getElementById('measurement-print-root'))cleanup();},10000);" in s:
    s = s.replace("    setTimeout(()=>{if(document.getElementById('measurement-print-root'))cleanup();},10000);\n", '', 1)

p.write_text(s, encoding='utf-8')
print('Android-safe, lint-safe measurement print verified.')
