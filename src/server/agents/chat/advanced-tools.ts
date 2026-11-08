import { z } from 'zod';
import { scopedTool } from '../evidence/index.ts';
import { loanCalculation,savingsCalculation } from '../../tools/finance/calculators.ts';
import { lookupMarket, type MarketKind } from '../../offers/market.ts';

const scope=z.literal('snapshot');
const cents=z.number().int().min(0).max(100_000_000);
const loan=z.strictObject({scope,principal_cents:cents.optional(),apr_bps:z.number().int().min(0).max(10000).optional(),months:z.number().int().min(1).max(600).optional(),extra_payment_cents:cents.optional()});
const savings=z.strictObject({scope,target_cents:cents.optional(),saved_cents:cents.optional(),months:z.number().int().min(1).max(600).optional(),apy_bps:z.number().int().min(0).max(3000).optional()});
const numeric={type:'integer',minimum:0};
const parameters=(properties:Record<string,unknown>)=>({type:'object',properties:{scope:{type:'string',enum:['snapshot']},...properties},required:['scope'],additionalProperties:false});
function mentionedAmount(text:string,cents:number) {
  return [...text.matchAll(/(?<![-\w])(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(k\b)?/gi)].some(m=>Math.round(Number(m[1].replaceAll(',',''))*(m[2]?1000:1)*100)===cents);
}
function mentionedMonths(text:string,months:number) {return [...text.matchAll(/(\d+)\s*(months?|years?)\b/gi)].some(m=>Number(m[1])*(m[2].toLowerCase().startsWith('year')?12:1)===months);}
function mentionedRate(text:string,bps:number) {return [...text.matchAll(/(\d+(?:\.\d{1,2})?)\s*(?:%|percent)(?!\w)|(?:APR|APY)\s*(?:of|:|=)?\s*(\d+(?:\.\d{1,2})?)/gi)].some(m=>Math.round(Number(m[1]??m[2])*100)===bps);}

export function advancedCoachTools(authorize:()=>Promise<unknown>,credit:()=>Promise<unknown>,userText:string) {
  return {
    calculate_loan:scopedTool('calculate_loan',async(args)=>{
      await authorize();const p=loan.parse(args);const missing:string[]=[];
      if(!p.principal_cents||!mentionedAmount(userText,p.principal_cents))missing.push('Loan amount');
      if(p.apr_bps===undefined||!mentionedRate(userText,p.apr_bps))missing.push('Annual percentage rate (APR)');
      if(!p.months||!mentionedMonths(userText,p.months))missing.push('Repayment term in months or years');
      if(p.extra_payment_cents&&!mentionedAmount(userText,p.extra_payment_cents))missing.push('Extra monthly payment');
      if(missing.length)return {calculation:null,missing_inputs:missing,instruction:'Ask for the missing inputs. Do not assume a lender rate, approval or term.'};
      const result=loanCalculation(p.principal_cents!,p.apr_bps!,p.months!,p.extra_payment_cents??0);
      const {schedule,...summary}=result;
      return {inputs:{principal_cents:p.principal_cents,apr_bps:p.apr_bps,months:p.months,extra_payment_cents:p.extra_payment_cents??0},...summary,scheduled_payment_cents:schedule[0]?.payment_cents??summary.payment_cents,schedule_preview:schedule.slice(0,12),schedule_rows:schedule.length,hypothetical:true,missing_inputs:[],approval_status:'unknown'};
    },{parameters:parameters({principal_cents:numeric,apr_bps:numeric,months:numeric,extra_payment_cents:numeric}),needsInformation:d=>!!(d as {missing_inputs:string[]}).missing_inputs.length}),
    calculate_savings:scopedTool('calculate_savings',async args=>{
      await authorize();const p=savings.parse(args);const missing:string[]=[];
      if(!p.target_cents||!mentionedAmount(userText,p.target_cents))missing.push('Savings target');
      if(p.saved_cents===undefined||!mentionedAmount(userText,p.saved_cents))missing.push('Amount already saved');
      if(!p.months||!mentionedMonths(userText,p.months))missing.push('Time to save in months or years');
      if(p.apy_bps&&!mentionedRate(userText,p.apy_bps))missing.push('Annual savings yield (APY)');
      if(missing.length)return {calculation:null,missing_inputs:missing,instruction:'Ask for the missing inputs; no rate is invented.'};
      return {...savingsCalculation(p.target_cents!,p.saved_cents!,p.months!,p.apy_bps??0),inputs:p,hypothetical:true,missing_inputs:[],assumed_apy_bps:p.apy_bps??0};
    },{parameters:parameters({target_cents:numeric,saved_cents:numeric,months:numeric,apy_bps:numeric}),needsInformation:d=>!!(d as {missing_inputs:string[]}).missing_inputs.length}),
    read_credit_profile:scopedTool('read_credit_profile',async()=>{await authorize();return credit();}),
    search_offers:scopedTool('search_offers',async(args,_ctx,signal)=>{
      await authorize();const p=z.strictObject({scope,kind:z.enum(['auto_loan','personal_loan','mortgage','credit_card'])}).parse(args);
      const result=await lookupMarket(p.kind as MarketKind,signal);await authorize();return result;
    },{parameters:{type:'object',properties:{scope:{type:'string',enum:['snapshot']},kind:{type:'string',enum:['auto_loan','personal_loan','mortgage','credit_card']}},required:['scope','kind'],additionalProperties:false}}),
  };
}
