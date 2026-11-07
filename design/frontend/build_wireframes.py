from pathlib import Path
import json, math, textwrap, zipfile
from reportlab.lib.colors import toColor
from reportlab.graphics.shapes import Drawing, Rect, String, Line, PolyLine, Circle
from reportlab.graphics import renderSVG,renderPDF
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("FP", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("FP-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
from reportlab.pdfgen.canvas import Canvas
from pypdf import PdfReader,PdfWriter
OUT=Path(__file__).resolve().parent;OUT.mkdir(parents=True,exist_ok=True)
SVG=OUT/'screens';SVG.mkdir(exist_ok=True)
W,H=1440,1000
C={'nav':'#102A43','ink':'#142B40','muted':'#60758A','teal':'#087F8C','mint':'#E6F5F3','bg':'#F3F6FA','line':'#DDE5ED','white':'#FFFFFF','amber':'#9B5D00','pale':'#FFF4DF','red':'#B53737','blue':'#EAF1FB'}
C={k:toColor(v) for k,v in C.items()}
class Page:
 def __init__(self,id,title,task,backend,agent,route,action,note,auth=False):
  self.id=id;self.title=title;self.task=task;self.backend=backend;self.agent=agent;self.route=route;self.action=action;self.note=note;self.d=Drawing(W,H);self.auth=auth
  self.box(0,0,W,H,C['bg'],r=0);self.text(32,29,'FINPILOT / FRONTEND BLUEPRINT',12,C['teal'],bold=True);self.text(32,60,f'{id}  {title}',26,bold=True);self.text(1130,32,task,13,bold=True);self.text(1130,57,'Design reference / v1',12,C['muted'])
  self.box(32,92,1376,800,C['white'],r=12)
  if not auth:self.shell()
  self.line(32,918,1408,918);self.text(32,944,'FRONTEND  '+task,12,bold=True);self.text(300,944,'BACKEND  '+backend,12,C['muted']);self.text(795,944,'AGENTS  '+agent,12,C['muted']);self.wrap(32,965,note,1360,12,C['muted'],leading=16)
 def box(self,x,y,w,h,fill=None,stroke=None,r=10):
  self.d.add(Rect(x,H-y-h,w,h,rx=r,ry=r,fillColor=toColor(fill) if fill is not None else C['white'],strokeColor=toColor(stroke) if stroke is not None else None,strokeWidth=1))
 def text(self,x,y,s,size=14,color=None,bold=False):
  self.d.add(String(x,H-y,str(s),fontName='FP-Bold' if bold else 'FP',fontSize=size,fillColor=toColor(color) if color is not None else C['ink']))
 def wrap(self,x,y,s,width,size=14,color=None,bold=False,leading=21):
  words=s.split();lines=[];line=''
  for word in words:
   trial=(line+' '+word).strip()
   if stringWidth(trial,'FP-Bold' if bold else 'FP',size)>width and line:lines.append(line);line=word
   else:line=trial
  if line:lines.append(line)
  for i,line in enumerate(lines):self.text(x,y+i*leading,line,size,color,bold)
  return y+len(lines)*leading
 def line(self,x,y,x2,y2,color=None):self.d.add(Line(x,H-y,x2,H-y2,strokeColor=toColor(color) if color is not None else C['line'],strokeWidth=1))
 def btn(self,x,y,label,w=150,primary=True):
  self.box(x,y,w,40,C['teal'] if primary else C['white'],None if primary else C['line'],r=7);self.text(x+16,y+25,label,13,C['white'] if primary else C['ink'],True)
 def chip(self,x,y,label,mode='teal',w=None):
  w=w or stringWidth(label,'FP-Bold',11)+22;bg=C['mint'] if mode=='teal' else C['pale'] if mode=='amber' else C['blue'];fg=C['teal'] if mode=='teal' else C['amber'] if mode=='amber' else C['ink'];self.box(x,y,w,25,bg,r=12);self.text(x+11,y+17,label,11,fg,True)
 def card(self,x,y,w,h,title=None,sub=None):
  self.box(x,y,w,h,C['white'],C['line']);
  if title:self.text(x+22,y+32,title,16,bold=True)
  if sub:self.text(x+22,y+55,sub,12,C['muted'])
 def field(self,x,y,label,value,w=360):
  self.text(x,y,label,13,bold=True);self.box(x,y+12,w,45,C['white'],C['line'],7);self.text(x+14,y+40,value,14,C['muted'])
 def metric(self,x,y,w,label,value,sub):
  self.card(x,y,w,116);self.text(x+20,y+27,label,12,C['muted']);self.text(x+20,y+65,value,29,bold=True);self.text(x+20,y+92,sub,12,C['muted'])
 def table(self,x,y,w,headers,rows,col=None,rowh=49):
  col=col or [w/len(headers)]*len(headers);self.box(x,y,w,42,C['bg'],r=6);xx=x
  for h,cw in zip(headers,col):self.text(xx+14,y+26,h,11,C['muted'],True);xx+=cw
  for i,row in enumerate(rows):
   yy=y+42+i*rowh;self.line(x,yy+rowh,x+w,yy+rowh);xx=x
   for j,(s,cw) in enumerate(zip(row,col)):
    self.text(xx+14,yy+30,s,12,C['ink'] if j!=len(row)-1 else C['teal'],j==0);xx+=cw
 def chart(self,x,y,w,h,values=None):
  values=values or [70,72,40,48,60,35,55,65,58,80,73]
  for k in range(4):self.line(x,y+k*h/3,x+w,y+k*h/3)
  pts=[]
  for i,v in enumerate(values):pts.extend([x+i*w/(len(values)-1),H-(y+h-v*h/100)])
  self.d.add(PolyLine(pts,strokeColor=C['teal'],strokeWidth=3,fillColor=None));self.text(x,y+h+25,'Today',11,C['muted']);self.text(x+w-43,y+h+25,'30 days',11,C['muted'])
 def notice(self,x,y,w,title,body):
  self.box(x,y,w,88,C['pale']);self.text(x+18,y+27,title,14,C['amber'],True);self.wrap(x+18,y+52,body,w-36,12,C['amber'],leading=16)
 def shell(self):
  self.box(32,92,220,800,C['nav'],r=0);self.text(57,135,'finpilot',26,C['white'],True);self.text(58,159,'Financial command center',10,'#AFC4D4')
  links=['Overview','Institutions','Accounts','Transactions','Cash & bills','Subscriptions','Debt & readiness','Goals & plans','Assets','Agent workspace','Scenario lab','Settings']
  active={'Connected institutions':'Institutions','Link institution':'Institutions','Consent & selection':'Institutions','Offer comparison':'Subscriptions','Plan comparison':'Goals & plans','Evidence drawer':'Agent workspace','Plan repair':'Goals & plans','Chat interface':'Overview','State patterns':'Overview'}.get(self.title,self.title)
  for i,label in enumerate(links):
   yy=192+i*43
   if label==active:self.box(45,yy-22,194,36,'#24475C',r=6)
   self.text(60,yy,label,13,C['white'] if label==active else '#BED0DD',label==active)
  self.chip(54,825,'SIMULATED DATA','amber',165)
  self.line(252,167,1408,167);self.text(282,128,self.route,11,C['muted']);self.text(282,151,'Maya Chen / Personal finances',14,bold=True);self.chip(1117,114,'Demo workspace','amber',130);self.text(1272,140,'MC',14,bold=True)
  self.text(282,208,self.title,26,bold=True);self.text(282,233,self.action,13,C['muted'])
 def save(self):
  name=self.id+'-'+self.title.lower().replace(' & ','-').replace(' ','-').replace('/','-')
  renderSVG.drawToFile(self.d,str(SVG/(name+'.svg')))
  fp=SVG/(name+'.svg');fp.write_text(fp.read_text().replace('font-family: FP-Bold','font-family: DejaVu Sans; font-weight: bold').replace('font-family: FP','font-family: DejaVu Sans'))
  tmp=OUT/(name+'.pdf');renderPDF.drawToFile(self.d,str(tmp));return name,tmp
pages=[]
def p(*a,**k):
 obj=Page(*a,**k);pages.append(obj);return obj
# 00
q=p('00','Design system','#1 / FP-01','Shared contracts','All roles','/design-system','Shared components for every application section.','Use these tokens and patterns across tasks #1-#8. Financial figures and states are illustrative only.')
for i,(label,key) in enumerate([('Navigation','nav'),('Primary','teal'),('Canvas','bg'),('Opportunity','mint'),('Caution','pale')]):
 x=282+i*214;q.box(x,265,194,85,C[key],C['line']);q.text(x,374,label,13,bold=True);q.text(x,395,'#'+C[key].hexval()[2:].upper(),12,C['muted'])
q.card(282,430,520,190,'Typography & layout');q.text(305,490,'Your financial picture',27,bold=True);q.text(305,528,'$5,400.00',28,bold=True);q.text(305,563,'8px spacing / 12px corners / tabular numerals',13,C['muted'])
q.card(824,430,552,190,'Actions & status');q.btn(845,483,'Run checkup',170);q.btn(1030,483,'View evidence',170,False);q.chip(845,550,'Completed');q.chip(975,550,'Needs review','amber');q.chip(1115,550,'Sample offer','amber')
q.card(282,642,1094,210,'Component inventory');q.wrap(305,698,'Account cards / metric cards / transaction table / institution tiles / evidence drawer / offer comparison / goal progress / plan versions / OTP field / inline notices / empty states / chart wrapper',1000,18,leading=30);q.text(305,812,'Desktop: 1440px reference. Mobile: 390px. All screens share the same visual system.',13,C['muted'])
# login
q=p('01','Sign in','#2 / FP-02','#10','None','/login','Password authentication','Continue -> verification challenge. No authenticated financial session before email-code verification.',auth=True)
q.box(32,92,596,800,C['nav'],r=0);q.text(86,165,'finpilot',36,C['white'],True);q.wrap(86,300,'One clear view. A better next move.',460,46,C['white'],True,leading=56);q.wrap(86,478,'Connect your financial picture. Let specialized agents build a plan around your goals.',450,20,'#BED0DD',leading=31);q.chip(86,773,'Independent hackathon prototype','amber',270)
q.text(760,250,'Welcome back',32,bold=True);q.text(760,286,'Sign in to your FinPilot workspace.',16,C['muted']);q.field(760,347,'Email address','maya.chen@example.test',480);q.field(760,448,'Password','Enter your password',480);q.btn(760,552,'Continue',480);q.wrap(760,632,'Demo accounts only. Never enter real banking credentials.',465,14,C['muted']);q.text(760,741,'Verification is completed on the next screen.',13,C['muted'])
q=p('02','Verify your email','#2 / FP-02','#10','None','/verify','Pending login challenge','Wrong/expired code -> inline error. Resend cooldown; codes single-use. Local Mailpit receives demo email.',auth=True)
q.text(510,187,'finpilot',30,C['teal'],True);q.card(460,245,520,490);q.text(500,306,'Check your email',29,bold=True);q.wrap(500,347,'Enter the 6-digit code sent to m***@example.test.',430,16,leading=25)
for i in range(6):q.box(500+i*69,420,55,65,C['bg'],C['line'],8);q.text(520+i*69,463,'-',25,C['muted'])
q.text(500,530,'Code expires in 04:52',13,C['muted']);q.btn(500,565,'Verify & sign in',440);q.text(500,646,'Resend available in 45 seconds',13,C['muted']);q.text(500,687,'Back to sign in',13,C['teal'])
# overview
q=p('03','Overview','#4 / FP-04','#12, #13','#18, #23','/overview','Your complete financial picture, with a clear next action.','Run checkup -> #7 workspace. Each metric opens its source account or calculation. Chat opens from the shared header.')
q.btn(1198,190,'Run checkup',178)
for i,args in enumerate([('Liquid cash','$5,400','Checking + savings'),('Total debt','$17,600','Cards + loans'),('Net worth','$9,200','Assets less liabilities')]):q.metric(282+i*372,267,350,*args)
q.card(282,405,702,270,'30-day cash forecast','Checking account / illustrative scenario');q.chart(310,492,640,125,[45,48,8,14,45,52,38,35,58,60]);q.chip(789,425,'1 collision','amber',160)
q.card(1006,405,370,270,'Priority findings');q.wrap(1028,465,'Your card payment lands before your next paycheck.',320,18,bold=True);q.wrap(1028,535,'Cash Collision Agent / 2 source records',315,13,C['muted']);q.btn(1028,594,'Review options',220)
q.card(282,699,1094,153,'Financial health indicators');q.text(306,762,'Cash buffer   1.8 months',17,bold=True);q.text(675,762,'Debt / income   18%',17,bold=True);q.text(1024,762,'Card use   32%',17,bold=True);q.text(306,810,'Descriptive app indicators. View calculation assumptions before making a decision.',13,C['muted'])
# institutions
q=p('04','Connected institutions','#3 / FP-03','#11, #12','Integrity #18','/institutions','Connect simulated accounts and control what is shared.','Category -> provider -> simulation login -> consent/account selection -> dashboard. Each connection can be synced or disconnected.')
q.field(282,279,'Search institutions','Search by institution name',520)
for i,(s,w) in enumerate([('Banks',110),('Cards',110),('Investments',140),('Loans',110),('Wallets',110)]):q.chip(282+[0,126,252,408,534][i],360,s,'teal' if i==0 else 'blue',w)
for i,(name,sub,status) in enumerate([('Chase','Checking / savings','Connected'),('Bank of America','Checking / savings','Available'),('PNC','Checking / savings','Available'),('Capital One','Checking / credit cards','Available'),('Ally','Savings / CDs','Available'),('Other categories','Amex, Discover, Fidelity, Vanguard','Explore')]):
 x=282+(i%3)*372;y=418+(i//3)*207;q.card(x,y,350,185);q.text(x+20,y+39,name,20,bold=True);q.text(x+20,y+71,sub,12,C['muted']);q.chip(x+20,y+95,status,'teal' if status=='Connected' else 'blue');q.text(x+20,y+153,'Manage connection' if status=='Connected' else 'Connect simulated account',13,C['teal'])
q=p('05','Link institution','#3 / FP-03','#11','None','/institutions/link','Provider connection / step 1 of 2','Continue validates fictional institution credentials; wrong credentials stay on this screen. No call to the actual bank.')
q.card(470,273,728,536,'Connect Chase','Simulated institution connection');q.notice(496,354,676,'Simulation only','Use the generated institution username and password. Never enter real bank credentials.');q.field(496,490,'Institution username','maya.chen.chase',676);q.field(496,590,'Institution password','Enter demo institution password',676);q.btn(496,705,'Continue to consent',270);q.btn(785,705,'Cancel',170,False)
q=p('06','Consent & selection','#3 / FP-03','#11','Integrity #18','/institutions/consent','Provider connection / step 2 of 2','Connect selected -> scoped connection. Unselected accounts are invisible to agents. Disconnect revokes future access.')
q.card(326,274,1006,550,'Choose what FinPilot can read','Chase / simulated connection');q.table(350,357,958,['Select','Account','Type','Balance'],[['[x]','Everyday checking / 1000','Checking','$350.00'],['[x]','Reserve savings / 1001','Savings','$5,050.00']],[85,400,230,243],64);q.text(351,582,'[x] Allow balances and up to 30 months of transaction history.',16,bold=True);q.wrap(351,627,'Read-only access for planning. No transfers, purchases or bill payments. You can disconnect this institution in Settings.',915,15,C['muted']);q.btn(351,738,'Connect selected accounts',285);q.btn(654,738,'Back',120,False)
q=p('07','Accounts','#4 / FP-04','#12','Integrity #18','/accounts','Balances organized by institution and account type.','Select an account -> filtered transaction history. Manage -> connection flow. Liquid assets stay separate from retirement accounts.')
for i,(name,value,kind) in enumerate([('Chase checking','$350.00','Cash / 1000'),('Chase savings','$5,050.00','Cash / 1001'),('Amex card','$3,600.00','Debt / 1002')]):
 x=282+i*372;q.card(x,276,350,220,name);q.text(x+22,350,value,30,bold=True);q.text(x+22,389,kind,13,C['muted']);q.text(x+22,458,'View transactions',14,C['teal'])
q.card(282,527,1094,285,'Account inventory');q.table(304,589,1050,['Institution','Account','Last sync','Access'],[['Chase','Checking + savings','Today, 10:42 AM','Read-only'],['Amex','Credit card','Today, 10:42 AM','Read-only'],['Demo Auto Finance','Auto loan','Not connected','Connect']],[250,350,250,200])
q=p('08','Transactions','#4 / FP-04','#12','Integrity #18','/transactions','Search 30 months of financial history.','Filter and paginate on the server; row -> evidence drawer. Paired transfers are labeled, not counted as new income/spending.')
q.field(282,277,'Search','Merchant or description',340);q.field(642,277,'Account','All linked accounts',340);q.field(1002,277,'Date range','Last 30 days',374)
q.card(282,372,1094,469);q.table(305,396,1048,['Date','Merchant','Category','Account','Amount'],[['Oct 29','Market Basket','Groceries','Amex','-$84.20'],['Oct 28','StreamPlus','Subscription','Amex','-$18.99'],['Oct 25','Card payment','Transfer','Checking','-$350.00'],['Oct 16','Savings transfer','Transfer','Checking','-$150.00'],['Oct 15','Payroll','Income','Checking','+$2,600.00'],['Oct 12','Electric Co','Utilities','Checking','-$126.50']],[140,320,190,220,178],53);q.text(305,797,'Showing 1-6 of 1,170 records',12,C['muted']);q.btn(1173,776,'Next page',180,False)
q=p('09','Cash & bills','#4 / FP-04','#12, #13','#18','/cash','Know when money arrives and when commitments collide.','Date selection highlights responsible accounts and bills. Review adjustment -> plan comparison; no real transfers.')
q.notice(282,273,1094,'Potential shortfall on Nov 10','Checking $350 minus a planned $1,250 payment leaves -$900 before the Nov 15 paycheck. Savings is separate. Illustrative figures.');q.card(282,384,650,265,'Checking balance forecast');q.chart(310,465,590,118,[55,50,5,8,68,64,55,50]);q.card(954,384,422,265,'Suggested next step');q.wrap(976,452,'Compare payment timing and cash allocation options.',370,20,bold=True);q.btn(976,565,'Compare options',245)
q.card(282,672,1094,188,'Upcoming commitments');q.table(305,722,1048,['Date','Commitment','Account','Amount'],[['Nov 10','Planned card payment','Checking','$1,250'],['Nov 15','Expected paycheck','Checking','+$2,600']],[160,400,280,208],40)
q=p('10','Subscriptions','#5 / FP-05','#13, #14','#19','/subscriptions','Find recurring costs, price changes and alternatives.','Confirm recurrence/usage preferences first. Transaction history alone cannot prove a service is unused. Compare -> offer detail.')
for i,args in enumerate([('Monthly equivalent','$94.95','5 recurring candidates'),('Price changes','+$3.00','StreamPlus since May'),('Potential opportunity','Review 2','Not yet realized savings')]):q.metric(282+i*372,273,350,*args)
q.card(282,412,1094,426);q.table(305,438,1048,['Service','Cadence','Cost','Finding','Action'],[['StreamPlus','Monthly','$18.99','Price increased','Compare offers'],['StreamExtra','Monthly','$18.99','Possible overlap','Confirm usage'],['MusicCloud','Monthly','$10.99','Recurring candidate','Review'],['FitnessClub','Monthly','$42.99','Usage unknown','Confirm usage'],['CloudBox','Monthly','$2.99','Recurring candidate','Review']],[240,160,140,300,208],58)
q=p('11','Offer comparison','#5 / FP-05','#13, #14','#19','/subscriptions/streamplus/offers','Compare actual terms before changing a subscription.','Choose an option -> save proposed action with confirmation. This does not cancel or purchase anything; fixtures must stay labeled.')
q.chip(282,267,'SAMPLE OFFERS / NOT VERIFIED LIVE','amber',340)
for i,(name,price,desc) in enumerate([('Current plan','$18.99 / month','Standard / monthly billing'),('Lower-cost plan','$9.99 / month','Ad-supported / different features'),('Annual option','$15.83 / month','Billed $189.96 upfront')]):
 x=282+i*372;q.card(x,316,350,412,name);q.text(x+22,398,price,26,bold=True);q.wrap(x+22,446,desc,300,16,leading=23);q.wrap(x+22,517,'Eligibility: confirm in provider account. Renewal price: verify. Source: sample catalog.',300,13,C['muted'],leading=22);q.btn(x+22,649,'Keep current' if i==0 else 'Review this option',305,i!=0)
q.notice(282,752,1094,'Savings are conditional','Compare taxes, promotional expiry, features and upfront affordability. Count savings only after a confirmed change; avoid duplicate cancellation/switch savings.')
q=p('12','Debt & readiness','#6 / FP-06','#13, #14','#20','/debts','Evaluate payment options while protecting bill cash.','Run payoff scenario -> calculation evidence. Purchase readiness is planning, not a score-point prediction or loan approval.')
q.metric(282,274,350,'Total debt','$17,600','Cards + auto loan');q.metric(654,274,350,'Card utilization','32%','Based on linked limits');q.metric(1026,274,350,'Monthly minimums','$300','Illustrative obligations')
q.card(282,418,1094,228,'Debt inventory');q.table(305,470,1048,['Debt','Balance','APR','Minimum','Action'],[['Amex card','$3,600','24.99%','$100','Compare'],['Auto loan','$14,000','6.50%','$200','Compare']],[280,200,180,190,198],55)
q.card(282,670,1094,176,'Payment scenario');q.field(305,730,'Extra monthly payment','$200',310);q.btn(650,747,'Compare payoff options',285);q.text(967,756,'Preserve $1,000 cash buffer',13,C['muted'])
q=p('13','Goals & plans','#6 / FP-06','#14','#20','/goals','Coordinate goals instead of competing for the same dollars.','Create/edit goal -> target, deadline, priority and buffer. Compare plans -> explicit tradeoffs; acceptance is server-confirmed.')
q.btn(1192,190,'Create goal',184)
for i,(name,saved,target,pct) in enumerate([('Car fund','$2,400','$8,000',.30),('Emergency cushion','$3,000','$6,000',.50)]):
 y=275+i*204;q.card(282,y,680,184,name);q.text(306,y+76,saved+' of '+target,26,bold=True);q.box(306,y+103,630,9,C['bg'],r=4);q.box(306,y+103,630*pct,9,C['teal'],r=4);q.text(306,y+149,'Target: March 2027 / Priority '+str(i+1),13,C['muted']);q.text(805,y+149,'Edit goal',13,C['teal'])
q.card(984,275,392,388,'Goal allocation');q.wrap(1007,342,'Your goals share the same available monthly budget.',342,23,bold=True,leading=30);q.text(1007,473,'Available after commitments',13,C['muted']);q.text(1007,512,'$1,400 / month',28,bold=True);q.btn(1007,579,'Compare plans',345)
q.notice(282,706,1094,'Preserve your priorities','The agent must reserve required payments and a minimum cash buffer before allocating money to optional goals.')
q=p('14','Plan comparison','#6 / FP-06','#14','#20, #21','/plans/compare','Choose the tradeoff that fits your priorities.','Select -> accept dialog with expected plan version. Stale-version conflict -> refresh comparison. No automatic execution.')
for i,(name,debt,car,buffer) in enumerate([('Debt first','$600','$800','$1,000'),('Balanced','$400','$1,000','$1,000'),('Car first','$200','$1,200','$1,000')]):
 x=282+i*372;q.card(x,275,350,425,name);q.chip(x+22,331,'Proposed plan','blue');q.text(x+22,402,'Monthly extra debt payment',13,C['muted']);q.text(x+22,433,debt,26,bold=True);q.text(x+22,477,'Monthly goal contribution',13,C['muted']);q.text(x+22,508,car,26,bold=True);q.text(x+22,553,'Minimum cash buffer: '+buffer,13,C['muted']);q.btn(x+22,629,'Select plan',305)
q.notice(282,725,1094,'Verify before acceptance','Show forecast horizon, debt assumptions and goal timelines from calculation tools. Future subscription savings remain conditional.')
q=p('15','Assets','#6 / FP-06','#12','#20','/assets','Savings, maturity dates and investment snapshots.','Asset snapshots contribute to net worth; investments and retirement accounts are not spendable cash by default.')
for i,args in enumerate([('Savings','$5,050','Included in liquid cash'),('Investments','$14,000','Snapshot / not live prices'),('CD balance','$7,400','Maturity Jan 15, 2027')]):q.metric(282+i*372,273,350,*args)
q.card(282,418,1094,388,'Asset inventory');q.table(305,477,1048,['Institution','Asset','Valuation date','Amount'],[['Chase','Reserve savings','Oct 31, 2026','$5,050'],['Fidelity','Brokerage snapshot','Oct 31, 2026','$8,000'],['Vanguard','IRA snapshot','Oct 31, 2026','$6,000'],['Ally','Certificate of deposit','Oct 31, 2026','$7,400']],[240,340,260,208],58);q.text(305,777,'Illustrative connected-asset layout; the actual seeded profile may contain fewer accounts.',12,C['muted'])
q=p('16','Agent workspace','#7 / FP-07','#15','#17-#24','/agents','Specialists work together on one financial plan.','Run -> poll actual events. Expand findings -> source evidence. Completed/skipped/failed labels come from real run state, never timers.')
q.btn(1191,190,'Run checkup',185);q.card(282,274,328,568,'Specialists')
roles=[('Data integrity','Completed'),('Cash collision','Completed'),('Subscriptions','Completed'),('Deal scout','Needs input'),('Debt readiness','Completed'),('Goal negotiator','Running'),('Stress test','Queued'),('Plan repair','Event-driven'),('Coordinator','Running')]
for i,(role,status) in enumerate(roles):y=342+i*52;q.text(303,y,role,13,bold=True);q.text(303,y+20,status,11,C['teal'] if status=='Completed' else C['muted'])
q.card(633,274,743,276,'Cash conflict detected');q.chip(657,329,'Cash Collision Agent','amber',220);q.wrap(657,398,'A planned payment arrives before your paycheck.',675,26,bold=True,leading=33);q.text(657,477,'2 records / cash forecast / snapshot 1',13,C['muted']);q.btn(1094,481,'View evidence',255,False)
q.card(633,573,743,269,'Activity trace');q.text(658,635,'10:42:06  Integrity -> reconcile_ledger',14,bold=True);q.text(658,684,'10:42:08  Cash -> forecast_cash',14,bold=True);q.text(658,733,'10:42:11  Goals received available budget',14,bold=True);q.text(658,797,'Concise tool activity only; no hidden model reasoning.',12,C['muted'])
q=p('17','Evidence drawer','#4, #7 / FP-04,07','#12, #15','#18, #23','/agents/findings/:id','Every finding should be inspectable.','Finding -> evidence references and calculation assumptions. Only records owned by this user and authorized connection are accessible.')
q.card(282,275,516,557,'Finding context');q.wrap(306,350,'A payment creates a temporary checking shortfall.',450,27,bold=True,leading=35);q.chip(306,465,'Snapshot 1','blue');q.text(306,528,'Cash Collision Agent',16,bold=True);q.text(306,566,'Source mode: simulated financial data',13,C['muted'])
q.card(822,275,554,557,'Evidence');q.text(846,350,'Checking balance',13,C['muted']);q.text(846,383,'$350.00',25,bold=True);q.text(846,441,'Scheduled payment / Nov 10',13,C['muted']);q.text(846,475,'-$1,250.00',25,bold=True);q.line(846,512,1352,512);q.text(846,551,'Projected balance: -$900.00',22,C['red'],True);q.wrap(846,606,'Assumptions: no other inflows before Nov 15; savings is held in a separate account. Open the linked records to inspect details.',480,14,C['muted'],leading=23);q.btn(846,743,'Open source records',300,False)
q=p('18','Scenario lab','#6 / FP-06','#13, #14','#21','/scenarios','Test the plan before life tests it.','Preset/input -> deterministic stress results. Baseline stays unchanged. Show first failure date and tested horizon, not a guarantee.')
q.card(282,275,360,566,'Scenario controls');q.chip(304,333,'Unexpected expense','teal',220);q.field(304,408,'Expense amount','$900',316);q.field(304,505,'Plan','Balanced / proposed',316);q.field(304,602,'Horizon','30 days',316);q.btn(304,735,'Run stress test',316)
q.card(666,275,710,286,'Baseline vs stress');q.chart(693,352,650,151,[80,75,72,60,66,75,70,80,78]);q.text(693,526,'Compare lines must be labeled in the implemented chart.',12,C['muted'])
q.metric(666,586,344,'Baseline minimum','$1,200','No shortfall in horizon');q.metric(1032,586,344,'Stressed minimum','$300','Buffer breached');q.notice(666,726,710,'Buffer needs attention','The tested expense reduces the cash cushion below the selected $1,000 minimum. Review an alternative allocation.')
q=p('19','Plan repair','#6, #7 / FP-06,07','#14, #15','#22, #23','/plans/revision','A changed situation deserves a revised proposal.','Demo event -> new snapshot -> tool rerun -> proposed revision. Accept explicitly or retain previous accepted plan.')
q.notice(282,275,1094,'New expense received: $900','The prior plan is affected. Plan Repair generated a proposal; your accepted plan has not been replaced.')
q.card(282,391,1094,312,'Before / proposed revision');q.table(305,450,1048,['Allocation','Accepted v1','Proposed v2','Reason'],[['Goal contribution','$1,000','$700','Restore buffer'],['Extra debt payment','$400','$200','Reserve cash'],['Cash reserve','$1,000','$1,500','Expense recovery']],[300,220,220,308],61)
q.btn(282,753,'Review & accept revision',294);q.btn(596,753,'Keep previous plan',255,False);q.text(891,778,'Snapshot 2 / supporting evidence available',12,C['muted'])
q=p('20','Settings','#8 / FP-08','#10, #11, #12','None','/settings','Profile, access and connected institutions.','Logout invalidates session. Disconnect -> explicit confirmation and stale affected findings. Email/security edits are out of scope unless safely implemented.')
q.card(282,275,530,243,'Profile');q.text(307,350,'Maya Chen',23,bold=True);q.text(307,388,'maya.chen@example.test',14,C['muted']);q.chip(307,435,'Email verification enabled');q.card(834,275,542,243,'Session');q.text(858,350,'Current browser session',18,bold=True);q.text(858,388,'Server session / protected cookies',13,C['muted']);q.btn(858,435,'Sign out',230,False)
q.card(282,544,1094,296,'Connected institutions');q.table(306,601,1045,['Institution','Access','Last sync','Action'],[['Chase','Balances + history','Today','Disconnect'],['Amex','Balances + history','Today','Disconnect']],[275,340,230,200],60);q.text(306,801,'Simulation workspace. No real institution credentials stored or transmitted.',13,C['muted'])
q=p('21','Chat interface','#7 / FP-07','#15','#17, #23','/overview?chat=open','A communication layer over the agent workflow.','Chat can read current scoped findings and request runs. It cannot authorize money movement or fabricate completion; richer chat features come later.')
q.card(282,275,644,250,'Financial overview');q.text(308,355,'$5,400.00',39,bold=True);q.text(308,392,'Total liquid cash',15,C['muted']);q.btn(308,443,'Open agent workspace',286)
q.card(950,275,426,567,'Ask FinPilot');q.box(972,345,381,91,C['bg']);q.wrap(988,374,'Why did you flag my checking account?',345,15,leading=22);q.box(972,457,381,205,C['mint']);q.wrap(988,490,'The cash forecast shows a planned payment before your next paycheck. Your savings is in a separate account.',345,15,leading=24);q.text(988,613,'Evidence: forecast / payment / balance',12,C['teal']);q.text(988,643,'Live Nemotron reply to be implemented',11,C['muted']);q.field(972,706,'Message','Ask about your financial plan',381);q.btn(1163,783,'Send',190)
q=p('22','State patterns','#1, #8 / FP-01,08','All endpoints','All roles','/design-system/states','Consistent treatment of missing, partial and failed data.','Apply these states to each data screen. Preserve context and safe retry behavior; never display a fabricated successful result.')
for i,(title,body,action) in enumerate([('No linked accounts','Connect a simulated institution to see your financial picture.','Connect account'),('AI unavailable','Nemotron could not be reached. Your account data is still available.','Retry checkup'),('Partial checkup','Cash analysis completed. Deal Scout needs subscription preferences.','Review completed'),('Stale proposal','Account data changed after this plan was calculated.','Refresh proposal')]):
 x=282+(i%2)*558;y=275+(i//2)*280;q.card(x,y,536,253,title);q.wrap(x+22,y+88,body,486,18,leading=27);q.btn(x+22,y+183,action,260,i%2==0)
q=p('23','Mobile layouts','#1, #4, #7, #8','Same APIs','Same roles','390px responsive reference','Overview and agent workspace share one mobile shell.','Mobile stacks cards; navigation opens as a drawer; chat is a separate drawer. Tables retain usable horizontal scroll. Reference screens are not runtime code.',auth=True)
for x,title in [(265,'Overview'),(785,'Agent workspace')]:
 q.box(x,142,390,706,C['bg'],C['line'],24);q.box(x+1,143,388,68,C['nav'],r=18);q.text(x+21,184,'finpilot',22,C['white'],True);q.text(x+311,183,'Menu',13,C['white']);q.text(x+20,252,title,25,bold=True);q.chip(x+20,274,'SIMULATED DATA','amber',160)
 if title=='Overview':
  q.metric(x+20,323,350,'Liquid cash','$5,400','Checking + savings');q.card(x+20,461,350,184,'Cash forecast');q.chart(x+43,520,300,70);q.notice(x+20,666,350,'1 cash conflict','Review the next payment before Nov 15.');q.btn(x+20,779,'Run checkup',350)
 else:
  q.chip(x+20,324,'Cash: completed');q.chip(x+191,324,'Goals: running','blue',175);q.card(x+20,378,350,235,'Payment timing conflict');q.wrap(x+40,447,'Your planned payment arrives before your paycheck.',308,22,bold=True,leading=29);q.btn(x+40,548,'View evidence',307,False);q.card(x+20,637,350,115,'Run activity');q.text(x+40,705,'forecast_cash completed',14,C['muted']);q.btn(x+20,779,'Ask FinPilot',350)
# Required editor and confirmation states
q=p('24','Goal editor','#6 / FP-06','#14','#20','/goals/new','Create or edit a goal without leaving the planning context.','Save -> validated goal endpoint. Cancel discards unsaved edits. Amount/date errors are inline; changes make dependent proposals stale.')
q.card(365,271,925,566,'Goal details');q.field(391,357,'Goal name','Car fund',870);q.field(391,463,'Target amount','$8,000',417);q.field(844,463,'Deadline','March 1, 2027',417);q.field(391,569,'Priority','1 / Highest',417);q.field(844,569,'Minimum cash buffer','$1,000',417);q.btn(391,738,'Save goal',250);q.btn(658,738,'Cancel',150,False)
q=p('25','Subscription preferences','#5 / FP-05','#14','#19','/subscriptions/:id/preferences','Confirm what matters before comparing alternatives.','Save preferences -> Deal Scout receives confirmed constraints. Unknown usage remains unknown; a planned change is not realized savings.')
q.card(365,271,925,566,'StreamPlus preferences');q.text(391,359,'Do you still use this service?',17,bold=True);q.chip(391,384,'Yes');q.chip(485,384,'No','blue');q.chip(575,384,'Not sure','blue');q.text(391,464,'Features to preserve',17,bold=True);q.text(391,505,'[x] Ad-free viewing     [x] HD quality     [ ] Multiple screens',16);q.text(391,571,'Accept annual billing?',17,bold=True);q.chip(391,594,'Monthly only');q.chip(570,594,'Annual if affordable','blue',230);q.btn(391,738,'Save & compare offers',310);q.btn(718,738,'Cancel',150,False)
q=p('26','Accept plan','#6 / FP-06','#14','#20, #21','/plans/:id/accept','Explicit confirmation before saving the selected plan.','Accept uses expected_version and idempotency key. A stale response shows conflict and refresh; it never silently overwrites a newer version.')
q.card(421,274,813,546,'Accept the Balanced plan?');q.wrap(448,361,'This saves a planning allocation. It does not transfer money or schedule bank payments.',755,21,bold=True,leading=31);q.table(448,454,755,['Monthly allocation','Amount'],[['Extra debt payment','$400'],['Car contribution','$1,000'],['Minimum cash buffer','$1,000']],[530,225],48);q.text(448,693,'[x] I reviewed the assumptions and selected plan version.',15);q.btn(448,746,'Accept plan',280);q.btn(748,746,'Back to comparison',310,False)
q=p('27','Disconnect institution','#3, #8 / FP-03,08','#11','#18, #22','/settings/connections/:id','A clear access-revocation confirmation.','Disconnect -> revoke access and mark affected findings/plans stale. Cancellation preserves connection; no real bank account is closed.')
q.card(421,274,813,546,'Disconnect Chase?');q.wrap(448,365,'FinPilot will lose access to these simulated accounts.',735,24,bold=True,leading=33);q.table(448,455,755,['Account','Current access'],[['Checking / 1000','Balances + history'],['Savings / 1001','Balances + history']],[410,345],58);q.notice(448,648,755,'Affected plans need review','Existing findings may become stale. Reconnect and rerun a checkup before relying on them.');q.btn(448,755,'Disconnect',260);q.btn(728,755,'Keep connection',280,False)
# Save all screens and combined PDF
manifest=[];writer=PdfWriter()
for q in pages:
 name,pdf=q.save();writer.append(str(pdf));manifest.append({'screen_id':q.id,'title':q.title,'svg':'screens/'+name+'.svg','frontend_task':q.task,'backend_tasks':q.backend,'agent_tasks':q.agent,'route':q.route,'interaction':q.note});pdf.unlink()
writer.compress_identical_objects(remove_identicals=True,remove_orphans=True)
with (OUT/'FinPilot_Frontend_Blueprints.pdf').open('wb') as f:writer.write(f)
(OUT/'screen-map.json').write_text(json.dumps(manifest,indent=2)+'\n')
md='# Frontend blueprints\n\n28 vector reference frames covering the scoped frontend. All figures, identities, offers and activity traces are illustrative. These are design references, not completed application features.\n\n[Review PDF](FinPilot_Frontend_Blueprints.pdf) · [Screen gallery](gallery.html) · [Machine-readable map](screen-map.json)\n\n| Screen | Frontend task | Backend | Agents | Editable SVG |\n|---|---|---|---|---|\n'
for s in manifest:md+=f"| {s['screen_id']} {s['title']} | {s['frontend_task']} | {s['backend_tasks']} | {s['agent_tasks']} | [SVG]({s['svg']}) |\n"
md+='''\n## Figma import\n\nCreate a Figma Design file and drag the SVG files onto the canvas. Each is a 1440 x 1000 vector reference frame; desktop app viewport is 1376 x 800. Frame 23 contains 390px mobile references. Font: DejaVu Sans (PDF embedded); substitute Inter or Arial if Figma requests a font. Text and shapes remain vector elements; imports do not automatically create native auto-layout, design-system components, prototype links or production code. Group each import into a named frame using its screen ID. Use page groups Foundations, Authentication, Accounts, Planning, Agents, and Mobile.\n\n## Codex implementation\n\nRead the selected issue, this map, the corresponding SVG and docs/UI_DESIGN.md. Match composition, component hierarchy and states while implementing the issue's acceptance criteria. Preserve authenticated user-scoped APIs and honest fixture labels. Do not hardcode illustrative amounts as real application data. Use frame 00 as shared tokens; frame 22 defines states; frame 23 defines responsive behavior.\n\n## Task boundaries\n\n#1 creates the shared shell/components and route scaffolds. #2 implements auth screens. #3 implements institution linking. #4 implements overview/accounts/transactions/cash plus shared record evidence. #5 implements subscriptions/offers. #6 implements debt/goals/plans/assets/scenarios and plan revision presentation. #7 implements agent workspace, finding evidence and basic chat; share the repair presentation with #6. #8 completes settings composition, visual integration and accessibility checks. Backend or agent dependencies in the map do not change those issue owners.\n'''
(OUT/'README.md').write_text(md)
html='<!doctype html><html lang="en"><meta charset="utf-8"><title>FinPilot frontend blueprints</title><style>body{margin:0;background:#eef2f6;color:#142b40;font:16px system-ui}header{background:#102a43;color:white;padding:32px 5%}main{max-width:1440px;margin:auto;padding:24px}nav{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}a{color:#087f8c}nav a{background:white;border:1px solid #dde5ed;padding:8px;border-radius:6px;text-decoration:none;font-size:12px}section{margin:32px 0}img{width:100%;height:auto;border:1px solid #dde5ed;background:white}small{color:#60758a}</style><header><h1>FinPilot / Frontend blueprints</h1><p>28 editable vector references. Screen-to-task mapping for shared implementation.</p><p>Illustrative data. Design reference only.</p></header><main><nav>'
for s in manifest:html+=f'<a href="#s{s["screen_id"]}">{s["screen_id"]} {s["title"]}</a>'
html+='</nav>'
for s in manifest:html+=f'<section id="s{s["screen_id"]}"><h2>{s["screen_id"]} {s["title"]}</h2><p>{s["frontend_task"]} · Backend {s["backend_tasks"]} · Agents {s["agent_tasks"]}</p><img src="{s["svg"]}" alt="{s["title"]} design reference"><p>{s["interaction"]}</p></section>'
html+='</main></html>';(OUT/'gallery.html').write_text(html)
print(json.dumps({'frames':len(pages),'output':str(OUT),'pdf_pages':len(PdfReader(OUT/'FinPilot_Frontend_Blueprints.pdf').pages)}))
