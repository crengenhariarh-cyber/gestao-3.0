export type BankTone='itau'|'nubank'|'inter'|'santander'|'caixa'|'sicoob'|'bradesco'|'bb'|'sicredi'|'c6'|'generic';
export interface BankBrand { tone: BankTone; mark: string; bank: string; }

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pt-BR').trim();

const aliases: readonly { match: RegExp; brand: BankBrand }[] = [
  { match: /(^|\s)CR ENGENHARIA(\s|$)/, brand: { tone:'nubank', mark:'nu', bank:'Nubank' } },
  { match: /(^|\s)CAMILA(\s|$)/, brand: { tone:'caixa', mark:'CAIXA', bank:'CAIXA' } },
  { match: /(^|\s)PR INSTALACOES(\s|$)/, brand: { tone:'inter', mark:'inter', bank:'Inter' } },
];

export function getBankBrand(name:string):BankBrand {
  const value=normalize(name);
  if(value.includes('NUBANK')||/(^|\s)NU(\s|$)/.test(value))return{tone:'nubank',mark:'nu',bank:'Nubank'};
  if(value.includes('ITAU'))return{tone:'itau',mark:'itaú',bank:'Itaú'};
  if(value.includes('INTER'))return{tone:'inter',mark:'inter',bank:'Inter'};
  if(value.includes('SANTANDER'))return{tone:'santander',mark:'Santander',bank:'Santander'};
  if(value.includes('CAIXA'))return{tone:'caixa',mark:'CAIXA',bank:'CAIXA'};
  if(value.includes('SICOOB'))return{tone:'sicoob',mark:'SICOOB',bank:'Sicoob'};
  if(value.includes('BRADESCO'))return{tone:'bradesco',mark:'bradesco',bank:'Bradesco'};
  if(value.includes('BANCO DO BRASIL')||/(^|\s)BB(\s|$)/.test(value))return{tone:'bb',mark:'BB',bank:'Banco do Brasil'};
  if(value.includes('SICREDI'))return{tone:'sicredi',mark:'Sicredi',bank:'Sicredi'};
  if(value.includes('C6'))return{tone:'c6',mark:'C6',bank:'C6 Bank'};
  const alias=aliases.find((item)=>item.match.test(value));
  return alias?.brand ?? {tone:'generic',mark:'▥',bank:'Banco'};
}
