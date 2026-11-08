"""Design reference calculations. Not a replacement for the app's authorized tools.
Loan apr_pct inputs represent the nominal annual interest accrual rate, not a fee-inclusive APR."""
from decimal import Decimal,ROUND_HALF_UP,ROUND_CEILING
from collections import defaultdict
D=Decimal

def amount(v):
 n=D(str(v))
 if not n.is_finite():raise ValueError('Finite number required')
 return n

def cents(v):return int((amount(v)*100).quantize(D(1),rounding=ROUND_HALF_UP))
def pos(v,zero=True):
 n=amount(v)
 if n<0 or (not zero and n==0):raise ValueError('Value outside allowed range')
 return n

def net_worth(assets_cents,liabilities_cents):return sum(assets_cents)-sum(liabilities_cents)
def ratio(numerator,denominator):
 n=pos(numerator);d=pos(denominator)
 return None if d==0 else (n/d*100).quantize(D('.01'),rounding=ROUND_HALF_UP)
def buffer_months(cash_cents,essential_monthly_cents):
 c=amount(cash_cents);e=pos(essential_monthly_cents)
 return None if e==0 else (c/e).quantize(D('.01'),rounding=ROUND_HALF_UP)
def loan_payment(principal,apr_pct,months):
 p=pos(principal);apr=pos(apr_pct)
 if not isinstance(months,int) or not 1<=months<=1200:raise ValueError('Term must be 1-1200 whole months')
 r=apr/D(1200)
 return cents(p/months if r==0 else p*r/(1-(1+r)**(-months)))
def loan_schedule(principal,apr_pct,months,extra=0):
 balance=cents(pos(principal));payment=loan_payment(principal,apr_pct,months)+cents(pos(extra));rate=pos(apr_pct)/D(1200);rows=[]
 for m in range(1,months+1):
  if balance==0:break
  interest=int((D(balance)*rate).quantize(D(1),rounding=ROUND_HALF_UP))
  # Final month clears the rounding residual, disclosed in the schedule.
  paid=balance+interest if m==months else min(payment,balance+interest)
  if paid<=interest:raise ValueError('Payment does not amortize the balance')
  principal_paid=paid-interest;balance-=principal_paid
  rows.append(dict(month=m,payment_cents=paid,interest_cents=interest,principal_cents=principal_paid,balance_cents=balance))
 return rows

def goal_contribution(target,saved,months,apy_pct=0):
 target=pos(target);saved=pos(saved);apy=pos(apy_pct)
 if not isinstance(months,int) or not 1<=months<=1200:raise ValueError('Months must be 1-1200')
 r=(1+apy/100)**(D(1)/12)-1
 gap=target-saved*(1+r)**months
 if gap<=0:return 0
 contribution=gap/months if r==0 else gap*r/((1+r)**months-1)
 return int((contribution*100).quantize(D(1),rounding=ROUND_CEILING))
def future_apy(principal,apy_pct,years):return cents(pos(principal)*(1+pos(apy_pct)/100)**pos(years))
def monthly_equivalent(price,cadence):
 factors={'monthly':D(1),'annual':D(1)/12,'quarterly':D(1)/3,'weekly':D(52)/12}
 if cadence not in factors:raise ValueError('Unsupported cadence')
 return cents(pos(price)*factors[cadence])
def first_year_cost(monthly_price,promo_months=0,promo_price=0,upfront=0,fees=0):
 if not isinstance(promo_months,int) or not 0<=promo_months<=12:raise ValueError('Promo months must be 0-12')
 return cents(pos(monthly_price)*(12-promo_months)+pos(promo_price)*promo_months+pos(upfront)+pos(fees))
def budget(income_cents,commitments_cents,allocations_cents):
 available=income_cents-sum(commitments_cents)
 allocated=sum(allocations_cents)
 if any(x<0 for x in allocations_cents) or any(x<0 for x in commitments_cents):raise ValueError('Negative allocation')
 return dict(available_cents=available,allocated_cents=allocated,remainder_cents=available-allocated,feasible=available>=allocated)
def forecast(opening_cents,events):
 days=defaultdict(int)
 for date,delta in events:days[date]+=delta
 balance=opening_cents;minimum=balance;shortfall=None;rows=[]
 for date in sorted(days):
  balance+=days[date];minimum=min(minimum,balance)
  if balance<0 and shortfall is None:shortfall=date
  rows.append({'date':date,'balance_cents':balance})
 return dict(rows=rows,minimum_cents=minimum,first_shortfall=shortfall,closing_cents=balance)
