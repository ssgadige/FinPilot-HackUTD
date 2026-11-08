import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AuthProvider} from '@/components/auth/auth-provider';
import {ChatPopup} from '@/components/chat-popup';

let post=vi.fn<(path:string,options:RequestInit)=>Promise<Response>>();
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open');}});
 post=vi.fn<(path:string,options:RequestInit)=>Promise<Response>>(async()=>Response.json({error:{code:'ai_unavailable'}},{status:503}));
 vi.stubGlobal('fetch',vi.fn(async(path:string,options:RequestInit)=>path.endsWith('/me')?Response.json({id:'test-user',display_name:'Test user',email:'test@example.test'},{headers:{'X-CSRF-Token':'test-only-csrf'}}):post(path,options)));
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('opens a keyboard accessible popup and reports provider failure without inventing a reply',async()=>{
 const user=userEvent.setup();render(<AuthProvider><ChatPopup/></AuthProvider>);
 await user.click(await screen.findByRole('button',{name:'Chat with FinPilot'}));
 const input=screen.getByLabelText('Message FinPilot');expect(input).toHaveFocus();
 await user.type(input,'Explain my spending');await user.click(screen.getByRole('button',{name:'Send'}));
 await screen.findByRole('alert');expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
 expect(input).toHaveValue('Explain my spending');expect(screen.queryByText('FinPilot:')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Close chat'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Chat with FinPilot'})).toHaveFocus());
});
it('shows only backend replies and clears the conversation when account access changes',async()=>{
 post.mockImplementation(async()=>Response.json({reply:'Review the returned account evidence.',conversation_id:'owned-test-conversation',evidence_ids:[],requested_run_id:null,source_mode:'fixture',inference_source_mode:'fixture'}));
 const user=userEvent.setup();render(<AuthProvider><ChatPopup/></AuthProvider>);
 await user.click(await screen.findByRole('button',{name:'Chat with FinPilot'}));await user.type(screen.getByLabelText('Message FinPilot'),'Explain my accounts');await user.click(screen.getByRole('button',{name:'Send'}));
 await screen.findByText('Review the returned account evidence.');
 fireEvent(window,new Event('finpilot:finance-invalidated'));
 expect(screen.queryByText('Review the returned account evidence.')).not.toBeInTheDocument();
});
