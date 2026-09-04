import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const workflowsDir = join(root, '.github', 'workflows');
const hotfixWorkflows = readdirSync(workflowsDir).filter((name) => /^hotfix-.*\.ya?ml$/i.test(name));
if (hotfixWorkflows.length) failures.push(`Workflows hotfix proibidos: ${hotfixWorkflows.join(', ')}`);

const publicDir = join(root, 'public');
const suspiciousGlobalCss = walk(publicDir)
  .map((file) => relative(root, file).replaceAll('\\', '/'))
  .filter((file) => /(?:patch|hotfix|override|polish).*\.css$/i.test(file));
const allowedGlobalCss = new Set(['public/module-polish.css']);
for (const file of suspiciousGlobalCss) {
  if (!allowedGlobalCss.has(file)) failures.push(`Nova camada CSS de remendo não permitida: ${file}`);
}
if (suspiciousGlobalCss.includes('public/module-polish.css')) warnings.push('Baseline legado ainda ativo: public/module-polish.css');

const srcModules = join(root, 'src', 'modules');
const uiFiles = walk(srcModules).filter((file) => /[\\/]ui[\\/].*\.(?:ts|tsx)$/.test(file));
let directSupabaseUi = 0;
let nativeConfirmCount = 0;
let inlineStyleFiles = 0;
for (const file of uiFiles) {
  const source = readFileSync(file, 'utf8');
  if (source.includes('shared/infrastructure/supabase/client')) directSupabaseUi += 1;
  nativeConfirmCount += (source.match(/window\.confirm\s*\(/g) ?? []).length;
  if (source.includes('style={{')) inlineStyleFiles += 1;
  if (statSync(file).size > 45_000) failures.push(`Arquivo de UI acima de 45 KB: ${relative(root, file)}`);
}

const MAX_DIRECT_SUPABASE_UI = 7;
if (directSupabaseUi > MAX_DIRECT_SUPABASE_UI) failures.push(`Acesso direto UI → Supabase aumentou: ${directSupabaseUi} > baseline ${MAX_DIRECT_SUPABASE_UI}`);
else if (directSupabaseUi > 0) warnings.push(`Dívida arquitetural UI → Supabase: ${directSupabaseUi}/${MAX_DIRECT_SUPABASE_UI}; deve diminuir, nunca aumentar.`);

const MAX_NATIVE_CONFIRM = 2;
if (nativeConfirmCount > MAX_NATIVE_CONFIRM) failures.push(`Confirmações nativas aumentaram: ${nativeConfirmCount} > baseline ${MAX_NATIVE_CONFIRM}. Use o Design System.`);
else if (nativeConfirmCount > 0) warnings.push(`Confirmações nativas: ${nativeConfirmCount}/${MAX_NATIVE_CONFIRM}; devem migrar para o componente compartilhado.`);

const MAX_INLINE_STYLE_FILES = 1;
if (inlineStyleFiles > MAX_INLINE_STYLE_FILES) failures.push(`Arquivos de UI com style={{...}} aumentaram: ${inlineStyleFiles} > baseline ${MAX_INLINE_STYLE_FILES}`);
else if (inlineStyleFiles > 0) warnings.push(`Inline style em UI: ${inlineStyleFiles}/${MAX_INLINE_STYLE_FILES}; deve ser eliminado.`);

console.log('Architecture guard');
for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`BLOCK: ${failure}`);
  process.exit(1);
}
console.log('OK: nenhuma nova dívida estrutural acima do baseline foi detectada.');
