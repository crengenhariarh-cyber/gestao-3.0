import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { BankInstitution } from '../../finance/domain/accounts';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import { getHrBudgetRepository, getHrOperationsRepository } from '../../hr/infrastructure/createHrRepositories';
import { currentHrCompetence } from '../../hr/ui/useHrBudgetOverview';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';

export interface HomeEntry { installmentId:string; sourceKind:'financial_installment'|'card_statement'; entryType:'income'|'expense'; description:string; counterpartyName:string|null; installmentNumber:number; installmentCount:number; dueDate:string; amount:number; paymentStatus:string; companyName:string; }
export interface HomeBalanceMovement { movementOn:string; signedAmount:number; }
export interface HomeBudgetLimit { id:string; categoryName:string|null; limitAmount:number; warningPercent:number; consumedAmount:number; remainingAmount:number; consumedPercent:number; }
export interface HomeBudgetItem { companyId:string; companyName:string; costCenterId:string|null; costCenterName:string|null; plannedTotal:number; realizedTotal:number; limitTotal:number; limits:readonly HomeBudgetLimit[]; }
export interface HomeBankAccount { tenantId:string; companyId:string; companyName:string; accountId:string; name:string; bankInstitution:BankInstitution|null; currentBalance:number; sortOrder:number; }
export interface HomeCard { tenantId:string; companyId:string; companyName:string; cardId:string; name:string; creditLimit:number; committedAmount:number; availableLimit:number; sortOrder:number; }
export interface HomeOverviewData { month:string; bankBalance:number; incomePlanned:number; incomeRealized:number; expensePlanned:number; expenseRealized:number; entries:readonly HomeEntry[]; balanceMovements:readonly HomeBalanceMovement[]; budgets:readonly HomeBudgetItem[]; bankAccounts:readonly HomeBankAccount[]; cards:readonly HomeCard[]; }
type HomeOverviewState = {status:'idle'|'loading';data:HomeOverviewData|null;errorMessage:null}|{status:'ready';data:HomeOverviewData;errorMessage:null}|{status:'error';data:null;errorMessage:string};
type BudgetLimitConsumptionRow = { limit_id:string; consumed_amount:number|string; remaining_amount:number|string; consumed_percent:number|string; };
type PlanningRow = { item_key:string; source_kind:'financial_installment'|'card_statement'; entry_type:'income'|'expense'; description:string; counterparty_name:string|null; due_date:string; amount:number|string; payment_status:string; };
function currentMonthStart(){const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;}
function isoDate(value:Date){return value.toISOString().slice(0,10);}
function companyName(company:CompanySummary){return company.tradeName??company.legalName;}
function cardDisplayName(name:string){return name.replace(/^\s*HISTÓRICO\s*[·•-]\s*/i,'').trim();}

export function useHomeOverview(companies:readonly CompanySummary[],refreshToken=0):HomeOverviewState{
 const finance=useMemo(()=>getFinanceRepositories(),[]); const hr=useMemo(()=>getHrBudgetRepository(),[]); const hrOperations=useMemo(()=>getHrOperationsRepository(),[]); const supabase=useMemo(()=>getSupabaseClient(),[]); const companyKey=companies.map(c=>c.id).sort().join(',');
 const [state,setState]=useState<HomeOverviewState>({status:'idle',data:null,errorMessage:null});
 useEffect(()=>{
  if(companies.length===0){setState({status:'idle',data:null,errorMessage:null});return;}
  let cancelled=false; const month=currentMonthStart(); const hrMonth=currentHrCompetence().month; const movementTo=new Date(); const movementFrom=new Date(); movementFrom.setDate(movementTo.getDate()-364);
  setState({status:'loading',data:null,errorMessage:null});
  void Promise.all(companies.map(async company=>{const scope={tenantId:company.tenantId,companyId:company.id}; const [summary,balances,movements,budget,operational,cardLimits,limitConsumptionResult,planningResult]=await Promise.all([
   finance.monthly.summarize({...scope,competenceFrom:month,competenceTo:month}),finance.accounts.listBalances(scope),finance.accounts.listMovements(scope,isoDate(movementFrom),isoDate(movementTo)),hr.getOverview({...scope,competenceMonth:hrMonth,year:Number(hrMonth.slice(0,4))}),hrOperations.getSnapshot(scope,hrMonth),finance.cards.listLimits(scope),supabase.from('budget_limit_control').select('limit_id,consumed_amount,remaining_amount,consumed_percent').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('competence_month',hrMonth).returns<BudgetLimitConsumptionRow[]>(),supabase.from('finance_planning_items').select('item_key,source_kind,entry_type,description,counterparty_name,due_date,amount,payment_status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('due_date').returns<PlanningRow[]>()]);
   if(limitConsumptionResult.error)throw limitConsumptionResult.error; if(planningResult.error)throw planningResult.error;
   return {company,summary,balances,movements,budget,operational,cardLimits,limitConsumption:limitConsumptionResult.data??[],planning:planningResult.data??[]};}))
  .then(results=>{if(cancelled)return; let bankBalance=0,incomePlanned=0,incomeRealized=0,expensePlanned=0,expenseRealized=0; const entries:HomeEntry[]=[],balanceMovements:HomeBalanceMovement[]=[],budgets:HomeBudgetItem[]=[],bankAccounts:HomeBankAccount[]=[],cards:HomeCard[]=[];
   results.forEach(({company,summary,balances,movements,budget,operational,cardLimits,limitConsumption,planning})=>{const label=companyName(company); const dashboardAccounts=balances.filter(i=>i.status==='active'&&i.includeInDashboard); const ids=new Set(dashboardAccounts.map(i=>i.accountId)); const consumptionByLimit=new Map(limitConsumption.map(row=>[row.limit_id,row]));
    bankBalance+=dashboardAccounts.reduce((t,i)=>t+i.currentBalance,0); dashboardAccounts.forEach(i=>bankAccounts.push({tenantId:company.tenantId,companyId:company.id,companyName:label,accountId:i.accountId,name:i.name,bankInstitution:i.bankInstitution,currentBalance:i.currentBalance,sortOrder:i.sortOrder}));
    cardLimits.forEach(i=>cards.push({tenantId:company.tenantId,companyId:company.id,companyName:label,cardId:i.cardId,name:cardDisplayName(i.name),creditLimit:i.creditLimit,committedAmount:i.committedAmount,availableLimit:i.availableLimit,sortOrder:i.sortOrder}));
    movements.filter(i=>ids.has(i.accountId)).forEach(i=>balanceMovements.push({movementOn:i.movementOn,signedAmount:i.direction==='inflow'?i.amount:-i.amount}));
    summary.forEach(i=>{if(i.entryType==='income'){incomePlanned+=i.plannedAmount;incomeRealized+=i.realizedAmount;}else{expensePlanned+=i.plannedAmount;expenseRealized+=i.realizedAmount;}});
    planning.forEach(i=>entries.push({installmentId:i.item_key,sourceKind:i.source_kind,entryType:i.entry_type,description:i.description,counterpartyName:i.counterparty_name,installmentNumber:1,installmentCount:1,dueDate:i.due_date,amount:Number(i.amount),paymentStatus:i.payment_status,companyName:label}));
    budget.monthlyBudget.filter(i=>i.costCenterId!==null&&i.plannedManual!==0).forEach(i=>{const limits=operational.budgetLimits.filter(l=>l.status==='active'&&l.costCenterId===i.costCenterId).map(l=>{const consumption=consumptionByLimit.get(l.id);return{id:l.id,categoryName:l.categoryName,limitAmount:l.limitAmount,warningPercent:l.warningPercent,consumedAmount:Number(consumption?.consumed_amount??0),remainingAmount:Number(consumption?.remaining_amount??l.limitAmount),consumedPercent:Number(consumption?.consumed_percent??0)};}); const limitTotal=limits.reduce((t,l)=>t+l.limitAmount,0); const limitConsumed=limits.reduce((t,l)=>t+l.consumedAmount,0); budgets.push({companyId:company.id,companyName:label,costCenterId:i.costCenterId,costCenterName:i.costCenterName,plannedTotal:i.plannedTotal,realizedTotal:limitTotal>0?limitConsumed:i.realizedTotal,limitTotal,limits});});
   });
   entries.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.description.localeCompare(b.description)); bankAccounts.sort((a,b)=>a.tenantId.localeCompare(b.tenantId)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)); cards.sort((a,b)=>a.tenantId.localeCompare(b.tenantId)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
   setState({status:'ready',data:{month,bankBalance,incomePlanned,incomeRealized,expensePlanned,expenseRealized,entries,balanceMovements,budgets,bankAccounts,cards},errorMessage:null});
  }).catch(()=>{if(!cancelled)setState({status:'error',data:null,errorMessage:'Não foi possível carregar a visão consolidada.'});});
  return()=>{cancelled=true;};
 },[finance,hr,hrOperations,supabase,companyKey,refreshToken,companies]); return state;
}
