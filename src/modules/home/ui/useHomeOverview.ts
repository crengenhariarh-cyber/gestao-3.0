import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import { getHrBudgetRepository } from '../../hr/infrastructure/createHrRepositories';
import { currentHrCompetence } from '../../hr/ui/useHrBudgetOverview';

export interface HomeEntry { installmentId:string; entryType:'income'|'expense'; description:string; counterpartyName:string|null; installmentNumber:number; installmentCount:number; dueDate:string; amount:number; companyName:string; }
export interface HomeBalanceMovement { movementOn:string; signedAmount:number; }
export interface HomeBudgetItem { companyId:string; companyName:string; costCenterId:string|null; costCenterName:string|null; plannedTotal:number; realizedTotal:number; }
export interface HomeBankAccount { companyId:string; companyName:string; accountId:string; name:string; currentBalance:number; }
export interface HomeOverviewData { month:string; bankBalance:number; incomePlanned:number; incomeRealized:number; expensePlanned:number; expenseRealized:number; entries:readonly HomeEntry[]; balanceMovements:readonly HomeBalanceMovement[]; budgets:readonly HomeBudgetItem[]; bankAccounts:readonly HomeBankAccount[]; }
type HomeOverviewState = {status:'idle'|'loading';data:HomeOverviewData|null;errorMessage:null}|{status:'ready';data:HomeOverviewData;errorMessage:null}|{status:'error';data:null;errorMessage:string};
function currentMonthStart(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
function isoDate(value:Date){return value.toISOString().slice(0,10);}
function companyName(company:CompanySummary){return company.tradeName??company.legalName;}

export function useHomeOverview(companies:readonly CompanySummary[],refreshToken=0):HomeOverviewState{
 const finance=useMemo(()=>getFinanceRepositories(),[]); const hr=useMemo(()=>getHrBudgetRepository(),[]); const companyKey=companies.map(c=>c.id).sort().join(',');
 const [state,setState]=useState<HomeOverviewState>({status:'idle',data:null,errorMessage:null});
 useEffect(()=>{
  if(companies.length===0){setState({status:'idle',data:null,errorMessage:null});return;}
  let cancelled=false; const month=currentMonthStart(); const hrMonth=currentHrCompetence().month; const movementTo=new Date(); const movementFrom=new Date(); movementFrom.setDate(movementTo.getDate()-364);
  setState({status:'loading',data:null,errorMessage:null});
  void Promise.all(companies.map(async company=>{const scope={tenantId:company.tenantId,companyId:company.id}; const [summary,balances,movements,entries,budget]=await Promise.all([
   finance.monthly.summarize({...scope,competenceFrom:month,competenceTo:month}),finance.accounts.listBalances(scope),finance.accounts.listMovements(scope,isoDate(movementFrom),isoDate(movementTo)),finance.entries.list(scope),hr.getOverview({...scope,competenceMonth:hrMonth,year:Number(hrMonth.slice(0,4))})]); return {company,summary,balances,movements,entries,budget};}))
  .then(results=>{if(cancelled)return; let bankBalance=0,incomePlanned=0,incomeRealized=0,expensePlanned=0,expenseRealized=0; const entries:HomeEntry[]=[],balanceMovements:HomeBalanceMovement[]=[],budgets:HomeBudgetItem[]=[],bankAccounts:HomeBankAccount[]=[];
   results.forEach(({company,summary,balances,movements,entries:companyEntries,budget})=>{const label=companyName(company); const dashboardAccounts=balances.filter(i=>i.status==='active'&&i.includeInDashboard); const ids=new Set(dashboardAccounts.map(i=>i.accountId));
    bankBalance+=dashboardAccounts.reduce((t,i)=>t+i.currentBalance,0); dashboardAccounts.forEach(i=>bankAccounts.push({companyId:company.id,companyName:label,accountId:i.accountId,name:i.name,currentBalance:i.currentBalance}));
    movements.filter(i=>ids.has(i.accountId)).forEach(i=>balanceMovements.push({movementOn:i.movementOn,signedAmount:i.direction==='inflow'?i.amount:-i.amount}));
    summary.forEach(i=>{if(i.entryType==='income'){incomePlanned+=i.plannedAmount;incomeRealized+=i.realizedAmount;}else{expensePlanned+=i.plannedAmount;expenseRealized+=i.realizedAmount;}});
    companyEntries.filter(i=>i.competenceMonth.slice(0,7)===month.slice(0,7)).forEach(i=>entries.push({installmentId:i.installmentId,entryType:i.entryType,description:i.description,counterpartyName:i.counterpartyName,installmentNumber:i.installmentNumber,installmentCount:i.installmentCount,dueDate:i.dueDate,amount:i.amount,companyName:label}));
    budget.monthlyBudget.filter(i=>i.costCenterId!==null&&(i.plannedTotal!==0||i.realizedTotal!==0)).forEach(i=>budgets.push({companyId:company.id,companyName:label,costCenterId:i.costCenterId,costCenterName:i.costCenterName,plannedTotal:i.plannedTotal,realizedTotal:i.realizedTotal}));
   }); setState({status:'ready',data:{month,bankBalance,incomePlanned,incomeRealized,expensePlanned,expenseRealized,entries,balanceMovements,budgets,bankAccounts},errorMessage:null});
  }).catch(()=>{if(!cancelled)setState({status:'error',data:null,errorMessage:'Não foi possível carregar a visão consolidada.'});});
  return()=>{cancelled=true;};
 },[finance,hr,companyKey,refreshToken,companies]); return state;
}
