from pathlib import Path

path = Path('src/modules/engineering/ui/GuidedMeasurementFlow.tsx')
s = path.read_text()

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
    elif new not in s:
        raise SystemExit(f'Expected navigation anchor not found: {old[:90]}')

path.write_text(s)
print('measurement navigation patched' if changed else 'measurement navigation already patched')
