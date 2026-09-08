from pathlib import Path

path = Path('src/modules/engineering/ui/EngineeringOperationsPanel.tsx')
text = path.read_text(encoding='utf-8')
old = """      const [year,month]=anchor.competence.split('-').map(Number);\n      const date=new Date(Date.UTC(year,month-1+(next-anchor.number),1));\n"""
new = """      const parts=anchor.competence.split('-');\n      const year=Number(parts[0]??0);\n      const month=Number(parts[1]??1);\n      const date=new Date(Date.UTC(year,month-1+(next-anchor.number),1));\n"""
if old in text:
    text = text.replace(old, new)
    path.write_text(text, encoding='utf-8')
    print('measurement auto-sequence typecheck fixed')
elif new in text:
    print('measurement auto-sequence typecheck already fixed')
else:
    raise SystemExit('auto-sequence target not found')
