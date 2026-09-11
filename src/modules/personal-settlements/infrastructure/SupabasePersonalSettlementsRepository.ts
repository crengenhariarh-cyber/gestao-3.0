import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersonalSettlementsRepository } from '../application/PersonalSettlementsRepository';
import type {
  NewPersonalSettlement,
  PersonalSettlement,
  PersonalSettlementAccount,
  PersonalSettlementItem,
  PersonalSettlementItemInput,
  PersonalSettlementMovement,
  PersonalSettlementMovementInput,
  PersonalSettlementScope,
  PersonalSettlementsSnapshot,
} from '../domain/personalSettlements';

type SettlementRow={id:string;tenant_id:string;company_id:string;person_name:string;direction:'i_owe'|'owes_me';original_amount:number|string;started_on:string;description:string|null;notes:string|null;status:'open'|'partial'|'settled'};
type ItemRow={id:string;settlement_id:string;item_date:string;description:string;amount:number|string;notes:string|null;financial_account_id:string|null};
type MovementRow={id:string;settlement_id:string;movement_date:string;amount:number|string;note:string|null;financial_account_id:string|null};
type AccountRow={account_id:string;name:string;bank_institution:string|null;current_balance:number|string;status:string};
type RpcResponse={data:unknown;error:{message:string}|null};

function text(value:string){return value.trim();}
function nullable(value:string){const normalized=value.trim();return normalized||null;}

export class SupabasePersonalSettlementsRepository implements PersonalSettlementsRepository {
  constructor(private readonly client:SupabaseClient){}

  private async rpc(name:string,args:Record<string,unknown>):Promise<unknown>{
    const response=await this.client.rpc(name,args) as unknown as RpcResponse;
    if(response.error)throw new Error(response.error.message);
    return response.data;
  }

  async load(scope:PersonalSettlementScope):Promise<PersonalSettlementsSnapshot>{
    const [settlementsResult,itemsResult,movementsResult,accountsResult]=await Promise.all([
      this.client.from('personal_settlements').select('id,tenant_id,company_id,person_name,direction,original_amount,started_on,description,notes,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('started_on',{ascending:false}).returns<SettlementRow[]>(),
      this.client.from('personal_settlement_items').select('id,settlement_id,item_date,description,amount,notes,financial_account_id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('item_date',{ascending:false}).returns<ItemRow[]>(),
      this.client.from('personal_settlement_movements').select('id,settlement_id,movement_date,amount,note,financial_account_id').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).order('movement_date',{ascending:false}).returns<MovementRow[]>(),
      this.client.from('financial_account_balances').select('account_id,name,bank_institution,current_balance,status').eq('tenant_id',scope.tenantId).eq('company_id',scope.companyId).eq('status','active').order('sort_order',{ascending:true}).order('name').returns<AccountRow[]>(),
    ]);
    const error=settlementsResult.error??itemsResult.error??movementsResult.error??accountsResult.error;if(error)throw error;
    const settlements:PersonalSettlement[]=(settlementsResult.data??[]).map(row=>({id:row.id,tenantId:row.tenant_id,companyId:row.company_id,personName:row.person_name,direction:row.direction,originalAmount:Number(row.original_amount),startedOn:row.started_on,description:row.description,notes:row.notes,status:row.status}));
    const items:PersonalSettlementItem[]=(itemsResult.data??[]).map(row=>({id:row.id,settlementId:row.settlement_id,itemDate:row.item_date,description:row.description,amount:Number(row.amount),notes:row.notes,financialAccountId:row.financial_account_id}));
    const movements:PersonalSettlementMovement[]=(movementsResult.data??[]).map(row=>({id:row.id,settlementId:row.settlement_id,movementDate:row.movement_date,amount:Number(row.amount),note:row.note,financialAccountId:row.financial_account_id}));
    const accounts:PersonalSettlementAccount[]=(accountsResult.data??[]).map(row=>({id:row.account_id,name:row.name,bankInstitution:row.bank_institution,currentBalance:Number(row.current_balance)}));
    return{settlements,items,movements,accounts};
  }

  async create(input:NewPersonalSettlement):Promise<string>{
    const data=await this.rpc('create_personal_settlement',{p_tenant_id:input.scope.tenantId,p_company_id:input.scope.companyId,p_person_name:text(input.personName),p_direction:input.direction,p_started_on:input.startedOn,p_description:nullable(input.description),p_amount:input.amount,p_notes:nullable(input.notes),p_account_id:input.accountId});return String(data);
  }
  async addItem(input:PersonalSettlementItemInput):Promise<string>{const data=await this.rpc('add_personal_settlement_item',{p_settlement_id:input.settlementId,p_item_date:input.itemDate,p_description:text(input.description),p_amount:input.amount,p_notes:nullable(input.notes),p_account_id:input.accountId});return String(data);}
  async updateItem(itemId:string,input:Omit<PersonalSettlementItemInput,'settlementId'>):Promise<void>{await this.rpc('update_personal_settlement_item',{p_item_id:itemId,p_item_date:input.itemDate,p_description:text(input.description),p_amount:input.amount,p_notes:nullable(input.notes),p_account_id:input.accountId});}
  async deleteItem(itemId:string):Promise<void>{await this.rpc('delete_personal_settlement_item',{p_item_id:itemId});}
  async addMovement(input:PersonalSettlementMovementInput):Promise<string>{const data=await this.rpc('record_personal_settlement_movement',{p_settlement_id:input.settlementId,p_movement_date:input.movementDate,p_amount:input.amount,p_note:nullable(input.note),p_account_id:input.accountId});return String(data);}
  async updateMovement(movementId:string,input:Omit<PersonalSettlementMovementInput,'settlementId'>):Promise<void>{await this.rpc('update_personal_settlement_movement',{p_movement_id:movementId,p_movement_date:input.movementDate,p_amount:input.amount,p_note:nullable(input.note),p_account_id:input.accountId});}
  async deleteMovement(movementId:string):Promise<void>{await this.rpc('delete_personal_settlement_movement',{p_movement_id:movementId});}
  async deleteSettlement(settlementId:string):Promise<void>{await this.rpc('delete_personal_settlement',{p_settlement_id:settlementId});}
}
