from pathlib import Path

TSX = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = TSX.read_text(encoding='utf-8')

legacy = "['draft','closed','approved'].includes(line.measurementStatus)"
current = "countsAgainstMeasurementBalance(line.measurementStatus)"

count = s.count(legacy)
if count:
    s = s.replace(legacy, "['closed','approved'].includes(line.measurementStatus)")
    TSX.write_text(s, encoding='utf-8')
    print(f'draft isolation applied; replacements={count}')
elif current in s or "['closed','approved'].includes(line.measurementStatus)" in s:
    print('draft isolation already applied; no changes required')
else:
    raise SystemExit('measurement status anchor not found: GuidedMeasurementFlow structure changed unexpectedly')
