"""Opt-in v2 synthetic dataset. Creates a NEW database; never rewrites an existing one.

The existing seed/default app contracts are unchanged. New liability kinds and
entity metadata require the integration described in docs/EXPANDED_DATA.md.
"""
import argparse
import calendar
import json
import random
import sqlite3
from datetime import date
from pathlib import Path
from seed_demo import password_hash

ROOT = Path(__file__).resolve().parents[1]
AS_OF = '2026-11-08'
LIABILITIES = {'credit_card', 'auto_loan', 'mortgage', 'personal_loan', 'student_loan', 'business_loan', 'line_of_credit'}
PROVIDERS = {
 'pnc': ('PNC', 'banks'), 'bofa': ('Bank of America', 'banks'),
 'chase': ('Chase', 'banks'), 'capital-one': ('Capital One', 'banks'),
 'ally': ('Ally', 'banks'), 'amex': ('American Express', 'cards'),
 'discover': ('Discover', 'cards'), 'fidelity': ('Fidelity', 'investments'),
 'vanguard': ('Vanguard', 'investments'), 'paypal': ('PayPal', 'wallets'),
 'demo-auto': ('Demo Auto Finance', 'loans'), 'demo-mortgage': ('Demo Home Lending', 'loans'),
 'demo-personal': ('Demo Private Personal Lending', 'loans'),
 'demo-student': ('Demo Education Finance', 'loans'),
 'demo-business': ('Demo Private Business Capital', 'loans'),
 'demo-working-capital': ('Demo Working Capital Bank', 'loans'),
}
# name, slug, scenario, months, net monthly salary/pension, housing, simulated score,
# institution/type/opening cents. Business account ownership is assigned separately.
PROFILES = [
 ('Maya Chen','maya.chen','Car upgrade with existing auto debt',24,520000,180000,684,[('chase','checking',450000),('chase','savings',350000),('amex','credit_card',190000),('demo-auto','auto_loan',2400000),('ally','savings',220000),('fidelity','ira',3400000)]),
 ('Jordan Brooks','jordan.brooks','Freelance studio: late invoices and working capital',21,0,155000,712,[('bofa','checking',500000),('bofa','savings',300000),('discover','credit_card',160000),('vanguard','ira',2500000),('chase','checking',1800000),('paypal','checking',150000),('demo-business','business_loan',4800000),('demo-working-capital','line_of_credit',1200000),('ally','savings',600000)]),
 ('Priya Shah','priya.shah','Salary plus consulting: subscription overlap and tax reserves',24,760000,210000,758,[('pnc','checking',800000),('pnc','savings',700000),('amex','credit_card',90000),('fidelity','ira',6000000),('bofa','checking',1400000),('paypal','checking',180000),('ally','savings',550000)]),
 ('Luis Rivera','luis.rivera','High utilization, auto and personal debt consolidation',18,440000,145000,612,[('capital-one','checking',400000),('capital-one','savings',170000),('discover','credit_card',720000),('demo-auto','auto_loan',2100000),('demo-personal','personal_loan',1500000),('chase','credit_card',240000),('ally','savings',160000)]),
 ('Amina Hassan','amina.hassan','Homeowner balancing mortgage, car and emergency fund',24,920000,0,741,[('ally','checking',1000000),('ally','savings',850000),('amex','credit_card',230000),('demo-mortgage','mortgage',28500000),('chase','savings',650000),('fidelity','brokerage',8000000),('demo-auto','auto_loan',2300000),('pnc','cd',1800000)]),
 ('Ethan Park','ethan.park','Student: thin credit file and tuition debt',12,240000,85000,658,[('chase','checking',280000),('chase','savings',75000),('discover','credit_card',85000),('vanguard','brokerage',120000),('demo-student','student_loan',1250000),('paypal','checking',10000)]),
 ('Sofia Martinez','sofia.martinez','CD maturity and home repair financing',24,680000,170000,802,[('bofa','checking',850000),('bofa','savings',1200000),('bofa','cd',2400000),('amex','credit_card',60000),('paypal','checking',20000),('vanguard','ira',15000000),('ally','savings',950000),('demo-personal','personal_loan',1800000)]),
 ('Noah Williams','noah.williams','Retiree: fixed pension and home accessibility costs',24,345000,125000,787,[('pnc','checking',500000),('pnc','savings',900000),('discover','credit_card',45000),('vanguard','ira',32000000),('ally','cd',3500000),('fidelity','brokerage',8000000)]),
 ('Zoe Patel','zoe.patel','Home deposit goal with student and auto obligations',18,850000,205000,729,[('capital-one','checking',850000),('capital-one','savings',1200000),('amex','credit_card',180000),('fidelity','brokerage',6500000),('ally','savings',1800000),('demo-student','student_loan',2600000),('demo-auto','auto_loan',2100000),('pnc','cd',1500000)]),
 ('Oliver Reed','oliver.reed','Retail owner: inventory, payroll and duplicate vendor charge',15,0,165000,671,[('ally','checking',600000),('ally','savings',350000),('discover','credit_card',330000),('demo-auto','auto_loan',2700000),('chase','checking',3500000),('amex','credit_card',800000),('paypal','checking',300000),('demo-business','business_loan',9500000),('demo-working-capital','line_of_credit',2200000)]),
]
BUSINESSES = {
 1: {'name':'Brooks Creative Studio LLC','industry':'Design services','formed':'2022-06-01','monthly_sales':1800000,'owner_draw':430000,'expense_ratio':.39,'employees':1,'request':2500000,'purpose':'Bridge late customer invoices'},
 2: {'name':'Shah Analytics LLC','industry':'Analytics consulting','formed':'2023-02-01','monthly_sales':950000,'owner_draw':170000,'expense_ratio':.30,'employees':0,'request':1800000,'purpose':'Equipment and contractor expansion'},
 9: {'name':'Reed Neighborhood Market LLC','industry':'Neighborhood retail','formed':'2021-04-01','monthly_sales':6800000,'owner_draw':470000,'expense_ratio':.62,'employees':4,'request':7500000,'purpose':'Seasonal inventory and payroll buffer'},
}
EXTRA_SCHEMA = '''
CREATE TABLE fixture_entities(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,entity_type TEXT NOT NULL,industry TEXT,formed_on TEXT,employees INTEGER,source_mode TEXT NOT NULL CHECK(source_mode='fixture'),UNIQUE(id,user_id));
CREATE TABLE fixture_account_details(account_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,entity_id TEXT NOT NULL,purpose TEXT NOT NULL,restricted_cash INTEGER NOT NULL DEFAULT 0,term_months INTEGER,payment_cents INTEGER,source_mode TEXT NOT NULL CHECK(source_mode='fixture'),FOREIGN KEY(account_id,user_id) REFERENCES accounts(id,user_id),FOREIGN KEY(entity_id,user_id) REFERENCES fixture_entities(id,user_id));
CREATE TABLE fixture_credit_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),score INTEGER NOT NULL CHECK(score BETWEEN 300 AND 850),model TEXT NOT NULL,as_of TEXT NOT NULL,source_mode TEXT NOT NULL CHECK(source_mode='fixture'),late_payments_24m INTEGER NOT NULL,hard_inquiries_12m INTEGER NOT NULL,oldest_account_months INTEGER NOT NULL);
CREATE TABLE fixture_invoices(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,entity_id TEXT NOT NULL,account_id TEXT NOT NULL,customer TEXT NOT NULL,issued_on TEXT NOT NULL,due_on TEXT NOT NULL,amount_cents INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('paid','overdue','open')),paid_on TEXT,transaction_id TEXT REFERENCES transactions(id),FOREIGN KEY(account_id,user_id) REFERENCES accounts(id,user_id),FOREIGN KEY(entity_id,user_id) REFERENCES fixture_entities(id,user_id));
CREATE TABLE fixture_monthly_business_metrics(user_id TEXT NOT NULL,entity_id TEXT NOT NULL,month TEXT NOT NULL,revenue_cents INTEGER NOT NULL,operating_cost_cents INTEGER NOT NULL,interest_cents INTEGER NOT NULL,debt_service_cents INTEGER NOT NULL,owner_draw_cents INTEGER NOT NULL,tax_transfer_cents INTEGER NOT NULL,tax_paid_cents INTEGER NOT NULL,PRIMARY KEY(entity_id,month),FOREIGN KEY(entity_id,user_id) REFERENCES fixture_entities(id,user_id));
CREATE TABLE fixture_borrowing_goals(user_id TEXT PRIMARY KEY REFERENCES users(id),entity_id TEXT NOT NULL,purpose TEXT NOT NULL,requested_cents INTEGER NOT NULL,term_months INTEGER NOT NULL,source_mode TEXT NOT NULL CHECK(source_mode='fixture'),FOREIGN KEY(entity_id,user_id) REFERENCES fixture_entities(id,user_id));
'''

def seed(destination):
 destination=Path(destination)
 if destination.exists():
  raise SystemExit('Refusing to overwrite an existing database. Choose a new --database path.')
 for filename in ('demo-credentials.json','seed-manifest.json'):
  if (destination.parent/filename).exists():
   raise SystemExit('Refusing to overwrite existing generated outputs. Choose a new directory.')
 destination.parent.mkdir(parents=True,exist_ok=True)
 schema=(ROOT/'data/schema.sql').read_text()
 schema=schema.replace("'auto_loan','mortgage'", "'auto_loan','mortgage','personal_loan','student_loan','business_loan','line_of_credit'")
 db=sqlite3.connect(destination)
 db.executescript(schema+EXTRA_SCHEMA)
 rng=random.Random(20261108)
 tx_counter=0
 def tx(uid,aid,day,merchant,category,delta,group=None):
  nonlocal tx_counter
  tx_counter+=1
  tid=f'x2-tx-{tx_counter:07d}'
  db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)',(tid,uid,aid,day,merchant,category,delta,group))
  return tid
 def pair(uid,src,dst,day,amount,key):
  tx(uid,src,day,'Transfer out','transfer',-amount,key)
  tx(uid,dst,day,'Transfer in' if kinds[dst] not in LIABILITIES else 'Debt payment','transfer',amount if kinds[dst] not in LIABILITIES else -amount,key)
 credentials=[]
 for iid,(name,category) in PROVIDERS.items():
  db.execute('INSERT INTO institutions VALUES(?,?,?,1)',(iid,name,category))
 for i,(name,slug,scenario,nmonths,salary,housing,score,definitions) in enumerate(PROFILES):
  uid=f'demo-{i+1:02d}'; email=slug+'@mail.finpilot.test'
  db.execute('INSERT INTO users(id,name,email,password_hash,persona) VALUES(?,?,?,?,?)',(uid,name,email,password_hash('123'),scenario))
  personal=uid+'-personal'; business=uid+'-business' if i in BUSINESSES else None
  db.execute('INSERT INTO fixture_entities VALUES(?,?,?,?,?,?,?,?)',(personal,uid,name,'personal',None,None,0,'fixture'))
  spec=BUSINESSES.get(i)
  if spec:
   db.execute('INSERT INTO fixture_entities VALUES(?,?,?,?,?,?,?,?)',(business,uid,spec['name'],'business',spec['industry'],spec['formed'],spec['employees'],'fixture'))
  db.execute('INSERT INTO fixture_credit_profiles VALUES(?,?,?,?,?,?,?,?)',(uid,score,'FinPilot simulated score; not FICO or bureau-derived',AS_OF,'fixture',2 if i==3 else 1 if i==9 else 0,3 if i in (0,3,9) else 1,18 if i==5 else 90+i*9))
  providers=list(dict.fromkeys(x[0] for x in definitions))
  cred={'user_id':uid,'name':name,'persona':scenario,'email':email,'app_password':'123','verification_recipient':email,'verification_sender':'security@finpilot.test','source_mode':'fixture','history_months':nmonths,'simulated_credit_score':score,'institutions':[]}
  for iid in providers:
   db.execute('INSERT INTO institution_logins VALUES(?,?,?,?,?)',(uid+'-'+iid,uid,iid,email,password_hash('123')))
   cred['institutions'].append({'institution_id':iid,'institution_name':PROVIDERS[iid][0],'username':email,'password':'123','verification_recipient':email,'verification_sender':f'verification@{iid}.finpilot.test','accounts':[]})
  accounts=[]; kinds={}; personal_cards=[]; business_cards=[]; loans=[]
  for j,(iid,kind,opening) in enumerate(definitions):
   aid=f'{uid}-a{j+1}'; kinds[aid]=kind
   is_business=bool(spec and (iid in ('paypal','demo-business','demo-working-capital') or (iid=='chase' and i in (1,9)) or (iid=='bofa' and i==2) or (iid=='amex' and i==9) or (iid=='ally' and i in (1,2))))
   entity=business if is_business else personal
   restricted=is_business and kind=='savings'
   purpose='Tax reserve' if restricted else 'Business operating' if is_business else 'Personal'
   apr=2499 if kind=='credit_card' else 1090 if kind=='line_of_credit' else 650 if kind=='mortgage' else 890 if kind in LIABILITIES else 350
   limit=(800000 if i==3 and iid=='discover' else 2400000 if is_business else 1200000) if kind=='credit_card' else opening*3 if kind=='line_of_credit' else None
   term=360 if kind=='mortgage' else 120 if kind=='student_loan' else 84 if kind=='business_loan' else 60 if kind in LIABILITIES else None
   monthly_rate=apr/120000
   payment=round(opening*monthly_rate/(1-(1+monthly_rate)**(-term))) if term and kind!='credit_card' else max(2500,round(opening*.03)) if kind=='credit_card' else None
   label=f'{purpose} {kind.replace("_"," ").title()} | Simulator'
   db.execute('INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(aid,uid,iid,kind,label,str(1000+i*20+j),opening,opening,limit,apr,payment,'2027-01-15' if kind=='cd' else None))
   db.execute('INSERT INTO fixture_account_details VALUES(?,?,?,?,?,?,?,?)',(aid,uid,entity,purpose,int(restricted),term,payment,'fixture'))
   record={'account_id':aid,'kind':kind,'opening_cents':opening,'entity_id':entity,'label':label,'restricted_cash':bool(restricted),'payment_cents':payment,'apr_bps':apr}
   accounts.append(record)
   next(x for x in cred['institutions'] if x['institution_id']==iid)['accounts'].append(record)
   if kind=='credit_card':(business_cards if is_business else personal_cards).append(record)
   elif kind in LIABILITIES:loans.append(record)
  checking=accounts[0]; savings=accounts[1]; card=personal_cards[0]
  business_check=None
  # Bank operating account is separate from the payment-processor wallet.
  if spec:
   wallet_ids=[z['account_id'] for x in cred['institutions'] if x['institution_id']=='paypal' for z in x['accounts']]
   business_check=next(a for a in accounts if a['entity_id']==business and a['kind']=='checking' and a['account_id'] not in wallet_ids)
  tax_reserve=next((a for a in accounts if a['restricted_cash']),None)
  start_index=2026*12+9-(nmonths-1)
  months=[(idx//12,idx%12+1) for idx in range(start_index,2026*12+10)]
  cred['history_start']=f'{months[0][0]}-{months[0][1]:02d}-01';cred['history_end']='2026-10-31'
  for m,(year,month) in enumerate(months):
   ym=f'{year}-{month:02d}'; ndays=calendar.monthrange(year,month)[1]
   if salary:
    for day,amount in ((1,salary//2),(15,salary-salary//2)):
     tx(uid,checking['account_id'],f'{ym}-{day:02d}','Pension' if i==7 else 'Net payroll','income',amount)
   if housing:tx(uid,checking['account_id'],ym+'-03','Housing rent','housing',-housing)
   for merchant,amount,day in [('Electric Co',13000,12),('Internet Co',6500,18),('Insurance Co',14500,22)]:
    tx(uid,checking['account_id'],f'{ym}-{day:02d}',merchant,'utilities' if day!=22 else 'insurance',-round(amount*rng.uniform(.85,1.15)))
   spending=0
   for k in range(18+i%5):
    category,merchant=rng.choice([('groceries','Market Basket'),('dining','Cafe District'),('transport','Transit Fuel'),('shopping','Everyday Store')])
    amount=rng.randint(800,6500)//(2 if i==5 else 1);spending+=amount
    tx(uid,card['account_id'],f'{ym}-{rng.randint(1,ndays):02d}',merchant,category,amount)
   subs=[('StreamPlus',1599+(300 if m>=nmonths-6 else 0)),('MusicCloud',1099),('CloudBox',299)]
   if i in (2,9):subs += [('StreamExtra',1899),('FitnessClub',4999),('DesignSuite',2999)]
   if i==5:subs=[('StudentMusic',599),('CloudBox',299)]
   for s,(merchant,amount) in enumerate(subs):
    tx(uid,card['account_id'],f'{ym}-{5+s:02d}',merchant,'subscription',amount);spending+=amount
    if m==len(months)-1:db.execute('INSERT INTO subscriptions(id,user_id,account_id,merchant,cadence,amount_cents) VALUES(?,?,?,?,?,?)',(f'{uid}-sub{s}',uid,card['account_id'],merchant,'monthly',amount))
   interest=round(card['opening_cents']*card['apr_bps']/120000)
   tx(uid,card['account_id'],ym+'-28','Card interest','interest',interest)
   pair(uid,checking['account_id'],card['account_id'],ym+'-28',spending+interest,f'{uid}-{m}-card')
   if spec:
    sales=round(spec['monthly_sales']*rng.uniform(.72,1.28)*(1.20 if i==9 and month in (10,11,12) else 1))
    # Paid invoice deposits are the sales ledger; no second revenue entry.
    for inv in range(4):
     amount=sales//4+(sales%4 if inv==3 else 0);day=4+inv*6;paid=f'{ym}-{day:02d}'
     tid=tx(uid,business_check['account_id'],paid,f'Customer {inv+1} invoice receipt','business_revenue',amount)
     db.execute('INSERT INTO fixture_invoices VALUES(?,?,?,?,?,?,?,?,?,?,?)',(f'{uid}-{ym}-paid{inv}',uid,business,business_check['account_id'],f'Fictional customer {inv+1}',ym+'-01',f'{ym}-{min(day+2,28):02d}',amount,'paid',paid,tid))
    opcost=round(sales*spec['expense_ratio'])
    categories=[('Inventory supplier' if i==9 else 'Contractor services','inventory' if i==9 else 'contractors',.52),('Employee payroll','payroll',.30),('Business rent and software','business_overhead',.18)]
    left=opcost
    for n,(merchant,cat,ratio) in enumerate(categories):
     amount=round(opcost*ratio) if n<2 else left;left-=amount
     tx(uid,business_check['account_id'],f'{ym}-{10+n*5:02d}',merchant,cat,-amount)
    # No employees for Priya: recorded payroll is contractor compensation.
    if spec['employees']==0:db.execute("UPDATE transactions SET merchant='Project contractor',category='contractors' WHERE user_id=? AND account_id=? AND posted_date=? AND category='payroll'",(uid,business_check['account_id'],ym+'-15'))
    draw=spec['owner_draw'];pair(uid,business_check['account_id'],checking['account_id'],ym+'-02',draw,f'{uid}-{m}-draw')
    tax=round(max(0,sales-opcost)*.20) if tax_reserve else 0
    if tax:pair(uid,business_check['account_id'],tax_reserve['account_id'],ym+'-26',tax,f'{uid}-{m}-tax-reserve')
    tax_paid=0
    if tax_reserve and month in (1,4,6,9):
     reserve_balance=db.execute('SELECT opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0) FROM accounts WHERE id=?',(tax_reserve['account_id'],)).fetchone()[0]
     tax_paid=round(max(0,reserve_balance)*.65)
     if tax_paid:tx(uid,tax_reserve['account_id'],ym+'-27','Simulated quarterly tax payment','estimated_tax',-tax_paid)
    bizinterest=0;bizservice=0
    if business_cards:
     bc=business_cards[0];charge=round(sales*.04);bi=round(bc['opening_cents']*bc['apr_bps']/120000)
     tx(uid,bc['account_id'],ym+'-07','Business software renewal','business_overhead',charge)
     tx(uid,bc['account_id'],ym+'-27','Business card interest','interest',bi)
     pair(uid,business_check['account_id'],bc['account_id'],ym+'-28',charge+bi,f'{uid}-{m}-business-card');bizinterest+=bi;bizservice+=charge+bi;opcost+=charge
    for a in loans:
     if a['entity_id']!=business:continue
     balance=db.execute('SELECT opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0) FROM accounts WHERE id=?',(a['account_id'],)).fetchone()[0]
     interest=round(balance*a['apr_bps']/120000);payment=min(balance+interest,a['payment_cents'])
     tx(uid,a['account_id'],ym+'-19','Business borrowing interest','interest',interest)
     pair(uid,business_check['account_id'],a['account_id'],ym+'-20',payment,f'{uid}-{m}-{a["account_id"]}-loan');bizinterest+=interest;bizservice+=payment
    db.execute('INSERT INTO fixture_monthly_business_metrics VALUES(?,?,?,?,?,?,?,?,?,?)',(uid,business,ym,sales,opcost,bizinterest,bizservice,draw,tax,tax_paid))
   for a in loans:
    if a['entity_id']!=personal:continue
    balance=db.execute('SELECT opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0) FROM accounts WHERE id=?',(a['account_id'],)).fetchone()[0]
    interest=round(balance*a['apr_bps']/120000);payment=min(balance+interest,a['payment_cents'])
    tx(uid,a['account_id'],ym+'-19','Loan interest','interest',interest)
    pair(uid,checking['account_id'],a['account_id'],ym+'-20',payment,f'{uid}-{m}-{a["account_id"]}-loan')
   pair(uid,checking['account_id'],savings['account_id'],ym+'-16',2000 if i==5 else 15000,f'{uid}-{m}-savings')
   for a in accounts:
    if a['kind'] in ('savings','cd'):
     balance=db.execute('SELECT opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0) FROM accounts WHERE id=?',(a['account_id'],)).fetchone()[0]
     tx(uid,a['account_id'],ym+'-28','Deposit interest','interest',round(max(0,balance)*a['apr_bps']/120000))
    elif a['kind'] in ('ira','brokerage'):
     tx(uid,a['account_id'],ym+'-28','Synthetic market valuation','valuation',round(a['opening_cents']*rng.uniform(-.025,.035)))
   # Processor wallet balances receive/settle paired funds, never duplicate sales.
   if spec:
    wallet=next(a for a in accounts if a['account_id'] in [z['account_id'] for x in cred['institutions'] if x['institution_id']=='paypal' for z in x['accounts']])
    pair(uid,business_check['account_id'],wallet['account_id'],ym+'-24',25000,f'{uid}-{m}-wallet-fund')
    pair(uid,wallet['account_id'],business_check['account_id'],ym+'-27',25000,f'{uid}-{m}-wallet-settle')
  if spec:
   for inv,(issued,due,amount,status) in enumerate([('2026-09-15','2026-10-15',spec['monthly_sales']//5,'overdue'),('2026-10-20','2026-11-20',spec['monthly_sales']//4,'open')]):
    db.execute('INSERT INTO fixture_invoices VALUES(?,?,?,?,?,?,?,?,?,?,?)',(uid+f'-unpaid{inv}',uid,business,business_check['account_id'],f'Fictional pending customer {inv+1}',issued,due,amount,status,None,None))
  if i==9:
   for n in range(2):tx(uid,business_cards[0]['account_id'],'2026-10-29','Possible duplicate inventory vendor','inventory',12999)
   db.execute("UPDATE fixture_monthly_business_metrics SET operating_cost_cents=operating_cost_cents+25998 WHERE user_id=? AND month='2026-10'",(uid,))
  for a in loans:
   payer=business_check if a['entity_id']==business else checking
   db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(a['account_id']+'-due',uid,payer['account_id'],'expense',a['label']+' payment',a['payment_cents'],20,1))
  # Business projections include operating inflows/outflows and owner draws as transfer pairs.
  # Legacy forecast cannot classify transfer schedules; do not seed misleading projections.
  for day in (1,15):
   recurring=salary//2
   if recurring:db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(f'{uid}-pay{day}',uid,checking['account_id'],'income','Expected net pension' if i==7 else 'Expected net salary',recurring,day,1))
  if housing:db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-housing',uid,checking['account_id'],'expense','Housing rent',housing,3,1))
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-utilities',uid,checking['account_id'],'expense','Utilities and insurance',34000,12,1))
  purpose=spec['purpose'] if spec else 'Car upgrade' if i==0 else 'Home purchase deposit' if i==8 else 'Debt consolidation' if i==3 else 'Emergency or home improvement'
  requested=spec['request'] if spec else 2500000 if i==0 else 32000000 if i==8 else 1800000
  db.execute('INSERT INTO fixture_borrowing_goals VALUES(?,?,?,?,?,?)',(uid,business or personal,purpose,requested,36 if spec else 360 if i==8 else 60,'fixture'))
  for j,(title,target) in enumerate([('Emergency reserve',salary*3 if salary else spec['owner_draw']*3),(purpose,requested)]):
   db.execute('INSERT INTO goals VALUES(?,?,?,?,?,?,?)',(f'{uid}-g{j}',uid,title,target,50000*(i%4),'2027-06-01',j+1))
  credentials.append(cred)
 db.execute('UPDATE accounts SET balance_cents=opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0)')
 for key,value in [('as_of',AS_OF),('source_mode','fixture'),('seed_version','2-expanded-opt-in'),('requires_expanded_contract','true'),('history_end','2026-10-31')]:db.execute('INSERT INTO meta VALUES(?,?)',(key,value))
 manifest={'as_of':AS_OF,'seed_version':'2-expanded-opt-in','source_mode':'fixture','requires_expanded_contract':True,'users':10,'institutions_per_user':{c['user_id']:len(c['institutions']) for c in credentials},'history_months_per_user':{c['user_id']:c['history_months'] for c in credentials},'institution_logins':db.execute('SELECT count(*) FROM institution_logins').fetchone()[0],'accounts':db.execute('SELECT count(*) FROM accounts').fetchone()[0],'transactions':tx_counter,'businesses':len(BUSINESSES),'connections_initially_unlinked':True}
 db.commit();db.close();destination.chmod(0o600)
 for filename,data in [('demo-credentials.json',credentials),('seed-manifest.json',manifest)]:
  path=destination.parent/filename
  # Output directory must be dedicated: never overwrite another seed's credentials.
  if path.exists():raise SystemExit(f'Output already exists: {path}; choose a new directory.')
  path.write_text(json.dumps(data,indent=2)+'\n');path.chmod(0o600)
 print(json.dumps(manifest));return manifest

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--database',required=True,help='New database in a new dedicated output directory')
 seed(parser.parse_args().database)
