import { useMemo, useState } from 'react';
import { Button } from '../shared/ui/Button';
import { Dialog } from '../shared/ui/Dialog';
import { Input } from '../shared/ui/Input';

interface CentralMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}

type MenuItem = { label: string; to: string; icon?: string };
type MenuSection = { id: string; label: string; icon: string; items: readonly MenuItem[] };

const sections: readonly MenuSection[] = [
  { id:'financeiro', label:'Financeiro', icon:'◉', items:[
    { label:'Lançamentos', to:'/financeiro?tab=lancamentos', icon:'▤' },
    { label:'Contas do mês', to:'/contas-do-mes', icon:'▣' },
    { label:'Bancos', to:'/bancos', icon:'▥' },
    { label:'Cartões', to:'/financeiro?tab=cartoes', icon:'▭' },
    { label:'Dashboard financeiro', to:'/financeiro?tab=resumo', icon:'▥' },
  ]},
  { id:'engenharia', label:'Engenharia', icon:'♜', items:[
    { label:'Contratos', to:'/engenharia', icon:'▤' },
    { label:'Produção', to:'/engenharia?area=producao', icon:'⚒' },
    { label:'Orçamentos', to:'/orcamento', icon:'▦' },
  ]},
  { id:'rh', label:'Recursos Humanos', icon:'♙', items:[
    { label:'Recursos Humanos', to:'/rh', icon:'♙' },
  ]},
];

export function CentralMenu({ open, onClose, onNavigate, onSignOut }: CentralMenuProps) {
  const [expanded,setExpanded]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const visibleSections=useMemo(()=>{
    if(!query)return sections;
    return sections.map(section=>({...section,items:section.items.filter(item=>`${section.label} ${item.label}`.toLocaleLowerCase('pt-BR').includes(query))})).filter(section=>section.items.length>0);
  },[query]);
  function go(to:string){onNavigate(to);onClose();}
  return <Dialog open={open} variant="central-menu" title="Central do Gestão" description="Módulos disponíveis" backLabel="Voltar ao início" onBack={()=>go('/')} onClose={onClose}>
    <div className="central-menu__content">
      <div className="central-menu__identity" aria-hidden="true"><img src="/gestao-icon.svg?v=3" alt=""/></div>
      <div className="central-menu__search"><Input label="Buscar" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar módulo, cadastro ou relatório"/></div>
      <div className="central-menu__sections">{visibleSections.map(section=>{const isExpanded=query?true:expanded===section.id;return <div className="central-menu__section" key={section.id}>
        <Button variant="primary" className="central-menu__section-toggle" aria-expanded={isExpanded} onClick={()=>setExpanded(current=>current===section.id?null:section.id)}><span className="central-menu__section-name"><span className="central-menu__icon" aria-hidden="true">{section.icon}</span>{section.label}</span><span aria-hidden="true">{isExpanded?'⌃':'⌄'}</span></Button>
        {isExpanded&&<div className="central-menu__items">{section.items.map(item=><Button key={item.label} variant="secondary" className="central-menu__item" onClick={()=>go(item.to)}><span className="central-menu__item-main">{item.icon&&<span className="central-menu__item-icon" aria-hidden="true">{item.icon}</span>}<span>{item.label}</span></span></Button>)}</div>}
      </div>})}</div>
      <div className="central-menu__signout"><Button variant="secondary" onClick={onSignOut}>↪ Sair e deslogar</Button></div>
    </div>
  </Dialog>;
}
