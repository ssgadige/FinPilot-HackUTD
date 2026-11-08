"""Disposable synthetic data only. No network, no external dependencies."""
import argparse, calendar, hashlib, json, random, secrets, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
AS_OF='2026-11-07'
PROFILES=[
 ('Maya Chen','maya.chen','Car purchase planner',520000,180000,'auto_loan'),
 ('Jordan Brooks','jordan.brooks','Irregular income freelancer',430000,155000,'brokerage'),
 ('Priya Shah','priya.shah','Subscription heavy professional',760000,210000,'ira'),
 ('Luis Rivera','luis.rivera','High card utilization',390000,145000,'auto_loan'),
 ('Amina Hassan','amina.hassan','Mortgage household',920000,255000,'mortgage'),
 ('Ethan Park','ethan.park','Student with limited buffer',185000,85000,'brokerage'),
 ('Sofia Martinez','sofia.martinez','Saver with CD maturity',680000,170000,'cd'),
 ('Noah Williams','noah.williams','Retiree on fixed income',345000,125000,'ira'),
 ('Zoe Patel','zoe.patel','Home down payment planner',850000,205000,'brokerage'),
 ('Oliver Reed','oliver.reed','Irregular charges and missing preferences',470000,165000,'auto_loan')]
INSTITUTIONS=[('pnc','PNC','banks'),('bofa','Bank of America','banks'),('chase','Chase','banks'),('capital-one','Capital One','banks'),('ally','Ally','banks'),('amex','American Express','cards'),('discover','Discover','cards'),('fidelity','Fidelity','investments'),('vanguard','Vanguard','investments'),('demo-auto','Demo Auto Finance','loans'),('demo-mortgage','Demo Mortgage','loans'),('paypal','PayPal','wallets')]
LIABILITIES={'credit_card','auto_loan','mortgage'}
def password_hash(password,salt=None):
 salt=salt or secrets.token_hex(16)
 digest=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1,dklen=32).hex()
 return f'scrypt$16384$8$1${salt}${digest}'
def verify_password(password,encoded):
 import hmac
 try:
  scheme,n,r,p,salt,digest=encoded.split('$')
  if (scheme,n,r,p)!=('scrypt','16384','8','1'): return False
  actual=hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=int(n),r=int(r),p=int(p),dklen=32).hex()
  return hmac.compare_digest(actual,digest)
 except (ValueError,TypeError):return False

def seed(destination,reset=False):
 destination=Path(destination);destination.parent.mkdir(parents=True,exist_ok=True)
 if destination.exists():
  if not reset:raise SystemExit('Database exists. Use --reset only for this disposable demo database.')
  destination.unlink()
 db=sqlite3.connect(destination);db.executescript((ROOT/'data/schema.sql').read_text())
 rng=random.Random(20261107);credentials=[];counts={};counter=0
 def tx(uid,aid,date,merchant,category,delta,group=None):
  nonlocal counter
  counter+=1
  db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)',(f'tx-{counter:07d}',uid,aid,date,merchant,category,delta,group))
 for iid,name,cat in INSTITUTIONS:db.execute('INSERT INTO institutions VALUES(?,?,?,1)',(iid,name,cat))
 months=[(2024+(4+i)//12,(4+i)%12+1) for i in range(30)]
 for i,(name,slug,persona,income,rent,extra_kind) in enumerate(PROFILES):
  uid=f'demo-{i+1:02d}';pw='123';email=slug+'@mail.finpilot.test'
  db.execute('INSERT INTO users(id,name,email,password_hash,persona) VALUES(?,?,?,?,?)',(uid,name,email,password_hash(pw),persona))
  bank=['chase','bofa','pnc','capital-one','ally'][i%5];card='amex' if i%2==0 else 'discover'
  extra=('demo-auto' if extra_kind=='auto_loan' else 'demo-mortgage' if extra_kind=='mortgage' else bank if extra_kind=='cd' else 'fidelity' if i%2==0 else 'vanguard')
  # CD belongs to the same bank; add wallet as third distinct provider for that persona.
  providers=list(dict.fromkeys([bank,card,extra]));
  if len(providers)<3:providers.append('paypal')
  creds={'user_id':uid,'name':name,'persona':persona,'email':email,'app_password':pw,'verification_recipient':email,'verification_sender':'security@finpilot.test','verification_sender_name':'FinPilot Demo','institutions':[]}
  for iid in providers:
   username=email;ipw='123'
   db.execute('INSERT INTO institution_logins VALUES(?,?,?,?,?)',(uid+'-'+iid,uid,iid,username,password_hash(ipw)))
   creds['institutions'].append({'institution_id':iid,'username':username,'email':email,'password':ipw,'verification_recipient':email,'verification_sender':f'verification@{iid}.finpilot.test','verification_sender_name':next(name for key,name,_ in INSTITUTIONS if key==iid)+' Simulator'})
  credentials.append(creds)
  opening_check=income*(4 if i in [2,6,8] else 2);opening_save=income*(6 if i in [6,8] else 2)
  opening_card=[190000,160000,90000,720000,230000,85000,60000,45000,180000,330000][i]
  extra_balance=1800000 if extra_kind=='auto_loan' else 28500000 if extra_kind=='mortgage' else income*12
  definitions=[('checking',bank,opening_check),('savings',bank,opening_save),('credit_card',card,opening_card),(extra_kind,extra,extra_balance)]
  if len(set([x[1] for x in definitions]))<3:definitions.append(('checking','paypal',10000))
  aids={}
  for j,(kind,iid,opening) in enumerate(definitions):
   aid=f'{uid}-a{j+1}';aids.setdefault(kind,aid)
   limit=800000 if i==3 else 1200000 if kind=='credit_card' else None
   if kind!='credit_card':limit=None
   db.execute('INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(aid,uid,iid,kind,f'{kind.replace("_"," ").title()} • Simulation',str(1000+i*10+j),opening,opening,limit,2499 if kind=='credit_card' else 650 if kind in LIABILITIES else 350,3500 if kind in LIABILITIES else None,'2027-01-15' if kind=='cd' else None))
  subs=[('StreamPlus',1599),('MusicCloud',1099),('CloudBox',299)]
  if i in [2,9]:subs += [('StreamExtra',1899),('FitnessClub',4999),('DesignSuite',2999)]
  if i==5:subs=[('StudentMusic',599),('CloudBox',299)]
  for s,(merchant,cost) in enumerate(subs):
   db.execute('INSERT INTO subscriptions(id,user_id,account_id,merchant,cadence,amount_cents) VALUES(?,?,?,?,?,?)',(f'{uid}-sub{s}',uid,aids['credit_card'],merchant,'monthly',cost+300 if merchant=='StreamPlus' else cost))
  for m,(year,month) in enumerate(months):
   prefix=f'{year}-{month:02d}';ndays=calendar.monthrange(year,month)[1]
   pay=round(income*rng.uniform(.65,1.35)) if i==1 else income
   if i==7:pay=income
   for day,amount in [(1,pay//2),(15,pay-pay//2)]:tx(uid,aids['checking'],f'{prefix}-{day:02d}','Client income' if i==1 else 'Pension' if i==7 else 'Payroll','income',amount)
   tx(uid,aids['checking'],prefix+'-03','Housing payment','housing',-rent)
   for merchant,cat,base,day in [('Electric Co','utilities',13000,12),('Internet Co','utilities',6500,18),('Insurance Co','insurance',14500,22)]:tx(uid,aids['checking'],f'{prefix}-{day:02d}',merchant,cat,-round(base*rng.uniform(.8,1.2)))
   spend=0
   for k in range(20+i%5):
    cat,merchant,lo,hi=rng.choice([('groceries','Market Basket',1200,8500),('dining','Cafe District',800,4200),('transport','Transit Fuel',1200,6500),('shopping','Everyday Store',800,9000)])
    amt=round(rng.randint(lo,hi)*(.4 if i==5 else 1));spend+=amt;day=rng.randint(1,ndays)
    tx(uid,aids['credit_card'],f'{prefix}-{day:02d}',merchant,cat,amt)
   for s,(merchant,base) in enumerate(subs):
    amt=base+(300 if merchant=='StreamPlus' and m>=24 else 0);spend+=amt
    tx(uid,aids['credit_card'],f'{prefix}-{5+s:02d}',merchant,'subscription',amt)
   # Paired asset transfers and cross-account debt payments: never count as new earnings/expenses twice.
   transfer=15000 if i!=5 else 2000;group=f'{uid}-{m}-save'
   tx(uid,aids['checking'],prefix+'-16','Transfer to savings','transfer',-transfer,group)
   tx(uid,aids['savings'],prefix+'-16','Transfer from checking','transfer',transfer,group)
   payment=spend+(1000 if i!=3 else 0);group=f'{uid}-{m}-card'
   tx(uid,aids['checking'],prefix+'-25','Card payment','transfer',-payment,group)
   tx(uid,aids['credit_card'],prefix+'-25','Card payment','transfer',-payment,group)
   # Synthetic interest approximately offsets extra payment; yields varying outstanding principal.
   interest=1000 if i!=3 else 0
   if interest:tx(uid,aids['credit_card'],prefix+'-28','Card interest','interest',interest)
   if extra_kind in ('auto_loan','mortgage'):
    loan_pay=24000 if extra_kind=='auto_loan' else 120000;group=f'{uid}-{m}-loan'
    tx(uid,aids['checking'],prefix+'-20','Loan payment','transfer',-loan_pay,group)
    tx(uid,aids[extra_kind],prefix+'-20','Loan payment','transfer',-loan_pay,group)
    tx(uid,aids[extra_kind],prefix+'-28','Loan interest','interest',9000 if extra_kind=='auto_loan' else 95000)
   else:tx(uid,aids[extra_kind],prefix+'-28','Synthetic interest or valuation','valuation',rng.randint(-12000,22000))
   # Move monthly excess into savings; retain persona-specific checking buffers.
   check_delta=db.execute('SELECT COALESCE(SUM(delta_cents),0) FROM transactions WHERE account_id=?',(aids['checking'],)).fetchone()[0]
   retained=[40000,90000,150000,45000,180000,25000,120000,80000,200000,60000][i]
   sweep=max(0,opening_check+check_delta-retained)
   if sweep:
    group=f'{uid}-{m}-sweep'
    tx(uid,aids['checking'],f'{prefix}-{ndays:02d}','Savings sweep','transfer',-sweep,group)
    tx(uid,aids['savings'],f'{prefix}-{ndays:02d}','Savings sweep','transfer',sweep,group)
  if i==9:
   for n in [0,1]:tx(uid,aids['credit_card'],'2026-10-29','Possible duplicate vendor','shopping',12999)
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-income1',uid,aids['checking'],'income','Expected income',income//2,1,1))
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-income2',uid,aids['checking'],'income','Expected income',income-income//2,15,1))
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-rent',uid,aids['checking'],'expense','Housing',rent,3,1))
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-utilities',uid,aids['checking'],'expense','Utilities and insurance',34000,12,1))
  db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(uid+'-card-payment',uid,aids['checking'],'expense','Planned card statement payment',opening_card,10,1))
  for j,(title,target,deadline) in enumerate([('Car fund' if i==0 else 'Home down payment' if i==8 else 'Emergency cushion',800000+i*100000,'2027-03-01'),('Debt reduction',250000+i*20000,'2027-02-01')]):db.execute('INSERT INTO goals VALUES(?,?,?,?,?,?,?)',(uid+f'-g{j}',uid,title,target,50000*(i%4),deadline,j+1))
  counts[uid]=db.execute('SELECT count(*) FROM transactions WHERE user_id=?',(uid,)).fetchone()[0]
 db.execute('UPDATE accounts SET balance_cents=opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0)')
 for key,value in [('as_of',AS_OF),('history_start','2024-05-01'),('history_end','2026-10-31'),('source_mode','fixture'),('seed_version','1')]:db.execute('INSERT INTO meta VALUES(?,?)',(key,value))
 db.commit();db.close()
 try:destination.chmod(0o600)
 except OSError:pass
 credential_path=destination.parent/'demo-credentials.json';credential_path.write_text(json.dumps(credentials,indent=2)+'\n')
 try:credential_path.chmod(0o600)
 except OSError:pass
 manifest={'as_of':AS_OF,'months':30,'users':10,'counts':counts,'transactions':sum(counts.values()),'database':destination.name,'all_financial_data':'synthetic','credentials_file':credential_path.name}
 (destination.parent/'seed-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps(manifest))
 return manifest
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--database',default=str(ROOT/'data/finpilot-demo.sqlite'));p.add_argument('--reset',action='store_true');a=p.parse_args();seed(a.database,a.reset)

