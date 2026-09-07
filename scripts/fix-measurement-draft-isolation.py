from pathlib import Path

TSX = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = TSX.read_text()

old = "['draft','closed','approved'].includes(line.measurementStatus)"
new = "['closed','approved'].includes(line.measurementStatus)"
count = s.count(old)
if count == 0:
    if new not in s:
        raise SystemExit('measurement status anchor not found')
else:
    s = s.replace(old, new)

TSX.write_text(s)
print(f'draft isolation applied; replacements={count}')
