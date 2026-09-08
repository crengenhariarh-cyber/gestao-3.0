from pathlib import Path

path = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = path.read_text(encoding='utf-8')

replacements = [
    (
        "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closeUnitPicker();onChanged();}catch(cause)",
        "setSaving(true);setError(null);try{await replaceMeasurementParityStage(scope,{measurementId:activeMeasurementId,targetKind:stage.targetKind,targetId:stage.targetId,quantity:effectiveQuantity,references:refs.length?selectedUnits:[],originName:origin.name,legacyServiceId:stage.legacyServiceId});await reload();closeUnitPicker();}catch(cause)"
    ),
    (
        "await operations.updateMeasurement({measurementId,measurementNumber,competence,dueDate:header.dueDate||null,expectedPaymentDate:header.expectedPaymentDate||null,paymentMethod:header.paymentMethod||null,notes:header.notes||null});await reload();onChanged();",
        "await operations.updateMeasurement({measurementId,measurementNumber,competence,dueDate:header.dueDate||null,expectedPaymentDate:header.expectedPaymentDate||null,paymentMethod:header.paymentMethod||null,notes:header.notes||null});await reload();"
    ),
    (
        "function closeFlow(){onChanged();onClose();}",
        "function closeFlow(){onClose();}"
    ),
]

changed = False
for old, new in replacements:
    if old in s:
        s = s.replace(old, new)
        changed = True

# Newer measurement persistence/id-lock repairs intentionally supersede the exact
# save/header anchors above. Do not fail CI just because the safe newer form exists.
unsafe_patterns = [
    "closeUnitPicker();onChanged();",
    "await reload();onChanged();",
    "function closeFlow(){onChanged();onClose();}",
]
for pattern in unsafe_patterns:
    if pattern in s:
        raise SystemExit(f'Unsafe navigation behavior still present: {pattern}')

path.write_text(s, encoding='utf-8')
print('measurement navigation patched' if changed else 'measurement navigation already safe')
