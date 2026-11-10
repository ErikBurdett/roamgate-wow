-- Native API contract harness; exercises addon state and callbacks, not a claim
-- that the game rendered this mock. The installed client remains the UI oracle.
local RG, checks, now = {}, 0, 100
local function check(value, message) assert(value, message); checks = checks + 1 end
local Object = {}
function Object:SetScript(name, fn) self.scripts[name] = fn end
function Object:GetScript(name) return self.scripts[name] end
function Object:SetSize(w,h) self.width,self.height = w,h end
function Object:SetWidth(w) self.width=w end
function Object:SetHeight(h) self.height=h end
function Object:GetWidth() return self.width or 700 end
function Object:GetHeight() return self.height or 400 end
function Object:GetCenter() return 500,350 end
function Object:GetEffectiveScale() return 1 end
function Object:SetText(s) self.text=s; if self.scripts.OnTextChanged then self.scripts.OnTextChanged(self) end end
function Object:GetText() return self.text or "" end
function Object:GetStringHeight() return math.max(18, math.ceil(#self:GetText()/80)*18) end
function Object:Show() self.shown=true end
function Object:Hide() self.shown=false; if self.scripts.OnHide then self.scripts.OnHide(self) end end
function Object:SetShown(b) if b then self:Show() else self:Hide() end end
function Object:IsShown() return self.shown end
function Object:SetEnabled(b) self.enabled=b end
function Object:Enable() self.enabled=true end
function Object:Disable() self.enabled=false end
function Object:SetFocus() self.focused=true end
function Object:ClearFocus() self.focused=false end
function Object:SetVerticalScroll(n) self.scroll=n end
function Object:GetVerticalScroll() return self.scroll or 0 end
function Object:GetVerticalScrollRange() return math.max(0,(self.child and self.child:GetHeight() or 0)-self:GetHeight()) end
function Object:SetScrollChild(c) self.child=c end
function Object:Insert(s) self:SetText(self:GetText()..s) end
local all={}
local function object(name)
    local o={scripts={},shown=true,enabled=true,name=name}
    setmetatable(o,{__index=function(_,k)
        if Object[k] then return Object[k] end
        if k:match("^[A-Z]") then return function() end end
        return nil
    end})
    if name then _G[name]=o end
    table.insert(all,o); return o
end
function Object:CreateTexture() return object() end
function Object:CreateFontString() return object() end
function CreateFrame(_, name) return object(name) end
UIParent=object(); UIParent:SetSize(2048,1152)
Minimap=object(); UISpecialFrames={}; StaticPopupDialogs={}; SlashCmdList={}; GameTooltip=object()
SOUNDKIT={IG_MAINMENU_OPTION_CHECKBOX_ON=1}
function GetTime() return now end
function GetServerTime() return 10000 end
function GetPhysicalScreenSize() return 2560,1440 end
function UnitGUID() return "Player-1-abc123" end
function UnitName() return "Adventurer" end
function GetRealmName() return "Realm" end
function UnitLevel() return 27 end
function UnitClass() return "Warrior" end
function UnitRace() return "Human" end
function UnitFactionGroup() return "Alliance" end
function GetZoneText() return "Duskwood" end
function GetSubZoneText() return "Raven Hill" end
function GetBuildInfo() return "1.60.1","70862" end
function GetNumQuestLogEntries() return 2 end
function GetQuestLogTitle(i) if i==1 then return "Duskwood",0,0,true else return "A test quest",28,0,false,false,0,false,123 end end
function GetNumQuestLeaderBoards() return 1 end
function GetQuestLogLeaderBoard() return "Wolves: 2/8","monster",false end
function InCombatLockdown() return false end
function IsShiftKeyDown() return false end
function PlaySound() end
function ReloadUI() end
function StaticPopup_Show(name) _G.popup=name end
local bindings={}
function GetBindingKey(action) for key, value in pairs(bindings) do if value==action then return key end end end
function GetBindingAction(key) return bindings[key] or "" end
function SetBinding(key,action) bindings[key]=action;return true end
function SaveBindings() end
function GetCurrentBindingSet() return 1 end
RoamgateDB={drafts={}}
C_AddOns={LoadAddOn=function() return true end}
for _, name in ipairs({"Config","Transport","Theme","Character","UI","Guide","Core"}) do assert(loadfile("addon/Roamgate/"..name..".lua"))("Roamgate",RG) end
local startupCollect=RG.Character.Collect
RG.Character.Collect=function()error("Character startup API failure")end
local login=all[#all];login.scripts.OnEvent(login,"PLAYER_LOGIN")
check(type(SlashCmdList.ROAMGATEGUIDE)=="function","a character read error cannot prevent /rgg registration")
check(RG.Guide.contextError and RG.Guide.characterText:GetText():find("startup API failure",1,true),"startup error remains visible instead of a blank character page")
RG.Character.Collect=startupCollect;RG.Guide:RefreshContext()
check(not RG.Guide.contextError and RG.Guide.character.name=="Adventurer","character page recovers after a successful read")
check(not RG.UI:IsShown(),"starts closed")
check(RG.UI.view=="terminal","Live terminal is the default view")
check(bindings["ALT-R"]=="ROAMGATE_TOGGLE","Alt+R default toggle binding installed")
bindings["ALT-R"]="EXISTING_ACTION";RoamgateDB.bindingInitialized=nil;RG:InstallBinding()
check(bindings["ALT-R"]=="EXISTING_ACTION","existing keybinding is never overwritten")
RoamgateToggle();check(RG.UI:IsShown(),"slash/binding opens")
RG.Transport:Tick(0.3);check(#RG.Transport.cells==640,"fixed optical strip geometry")
RG.UI:UpdateStatus();check(not RG.UI.send.enabled,"offline actions disabled")
local s={pane="w1:p1",terminal="t1",kind="codex",status="idle",workspace="Project",title="A title |Tbad|t",cwd="/project",proof="proof-1",entries={{role="assistant",text="Hello | world"}},screen="A terminal",historyStatus="History"}
local data={timestamp=10000,mode="interactive",agents={s},selected=s}
RG:Receive(data);RG.Transport.receivedAt=100;RG:Select(s.pane);RG.UI:UpdateStatus()
check(RG.UI.send.enabled,"fresh view enables send")
check(RG.UI.sessionTitle:GetText():find("||Tbad||t",1,true),"untrusted text cannot inject WoW markup")
RG.UI.composer:SetText("First task");check(RoamgateDB.drafts[s.pane]=="First task","draft retained")
RG.UI:SendMessage();check(RG.Transport.pending.text=="First task","sends exact user message")
local pending=RG.Transport.pending
check(not RG.Transport:Send("message","duplicate"),"one in-flight action")
RG.UI:ActionResult(pending,{state="error",message="Rejected"});check(RG.UI.composer:GetText()=="First task","failed delivery preserves draft")
RG.UI.composer:SetText("New draft while sending")
RG.UI:ActionResult(pending,{state="ok",message="Sent"});check(RG.UI.composer:GetText()=="New draft while sending","ack never erases newer typing")
RG.Transport.pending=nil
RG.UI:Navigate("conversation","");s.status="blocked";s.screen="> 1. Allow\n  2. Decline";RG:Receive(data)
check(RG.UI.view=="questions","blocked sessions open exact question")
check(RG.UI.composer:GetText()=="" and RoamgateDB.drafts[s.pane]=="New draft while sending","answer editor never inherits the task draft")
check(RG.UI.confirm.enabled,"fresh question confirm enabled")
RG.UI.confirm.scripts.OnClick();check(popup=="ROAMGATE_CONFIRM","Enter has explicit confirmation")
s.proof="changed";StaticPopupDialogs.ROAMGATE_CONFIRM.OnAccept();check(not RG.Transport.pending,"changed question rejected before confirmation")
RG.UI.confirm.scripts.OnClick();StaticPopupDialogs.ROAMGATE_CONFIRM.OnAccept();check(RG.Transport.pending.op=="key" and RG.Transport.pending.text=="enter","reviewed Enter sends one key")
RG.Transport.pending=nil
now=200;RG.UI:UpdateStatus();check(not RG.UI.send.enabled and not RG.UI.confirm.enabled,"stale view disables input")
now=100;data.mode="read-only";RG:Receive(data);check(not RG.UI.send.enabled,"read-only disables input")
data.mode="interactive";RG:Receive(data)
local received=RG.Transport.receivedAt
C_AddOns={LoadAddOn=function() RoamgateInbox={nonce="wrong",timestamp=10000};return true end}
RG.Transport:Load();check(RG.Transport.receivedAt==received,"wrong nonce ignored")
RG.UI.composer:SetText("Keep this");RG:Select("w2:p1");check(RoamgateDB.answerDrafts["w1:p1"]=="Keep this","switch preserves the separate answer draft")
check(not RG.UI.send.enabled,"old selected payload cannot send to new selection")
RG:Select(s.pane)
RG.UI:Navigate("files","")
data.browser={view="files",path="",root="/project",entries={{name="docs",path="docs",type="directory"}}}
RG:Receive(data)
check(RG.UI.messageFrames[2].text:GetText()=="[Folder] docs","file browser renders directory")
RG.UI.messageFrames[2].scripts.OnClick();check(RG.UI.view=="files" and RG.browsePath=="docs","directory navigation uses requested relative path")
data.workspaces={{id="w1",name="Project",count=1}};RG:Receive(data);RG.UI:WorkspaceMenu(RG.UI.frame)
RG.UI.workspaceMenu.buttons[2].scripts.OnClick();check(RG.UI.workspaceFilter=="w1","workspace selection filters all panes")
RG.UI.frame:Hide();RG.UI:Notify(s)
check(not RG.UI:IsShown(),"HUD notification does not steal game focus")
check(RG.UI.hudNews:GetText()=="1 new notification","HUD counts unread activity")
RG.UI:OpenPane(s.pane);check(RG.UI.unread[s.pane]==nil,"opening a thread clears its local notification")
RG.UI.hudCollapse.scripts.OnClick();check(RG.UI.hud:GetHeight()==42,"HUD collapses to one bar")
RG.UI:Navigate("conversation","");s.status="idle";RG:Receive(data)
local previousText=RG.UI.messageFrames[1].text:GetText()
RoamgateToggle()
RG:Receive({timestamp=10000,mode="interactive",agents={s}})
RoamgateToggle()
check(RG.UI.messageFrames[1].text:GetText()==previousText,"minimize restores cached conversation immediately")
check(not RG.UI.send.enabled and not RG.Transport:Send("message","unsafe"),"cached display cannot authorize an action")
RG:Receive(data);check(RG.UI.send.enabled,"fresh selection restores action controls")
RG.UI:Navigate("terminal","");RG.UI.composer:SetText("My next work task")
s.status="blocked";s.questionMode="queued";s.screen="Queued follow-up inputs\n ? 1 question\n shift+← to answer";RG:Receive(data)
check(RG.UI.composer:GetText()=="My next work task" and RG.UI.send:GetText()=="Review question","queued request preserves ordinary work draft")
check(not RG.UI.confirm.enabled,"queued request cannot receive Enter")
s.cached=true;RG.UI:Navigate("questions","")
check(not RG.Transport.pending and RG.UI.questionIntent,"question navigation waits for a fresh selected view")
s.cached=nil;RG:Receive(data)
check(RG.Transport.pending.op=="key" and RG.Transport.pending.text=="shift+left","Questions opens the queued tray without Enter")
RG.Transport.pending=nil;s.questionMode="visible";s.screen="Which approach?\n>1. First\n2. Second";RG:Receive(data)
check(RG.UI.draftMode=="answer" and RG.UI.composer:GetText()=="Keep this","opening the actual question restores its separate answer draft")
RG.UI.composer:SetText("My answer");RG.UI:SendMessage()
check(RG.Transport.pending.op=="answer","visible question text is pasted separately")
RG.UI:ActionResult(RG.Transport.pending,{state="ok",message="Pasted"});RG.Transport.pending=nil
check(RoamgateDB.drafts[s.pane]=="My next work task","answer acknowledgement leaves the work draft intact")
s.questionMode="none";s.status="working";RG:Receive(data)
check(RG.UI.composer:GetText()=="My next work task" and not RG.Transport.pending,"resolved question restores work draft without auto-sending")
local unicode=string.rep("A雪🌍\n",600);local parts=RG.UI.TextBlocks({{role="assistant",text=unicode}});local joined={}
for _, part in ipairs(parts) do check(#part.text<=1800,"native text block is bounded");table.insert(joined,part.text) end
check(table.concat(joined)==unicode,"long chat blocks preserve full Unicode text")
RG.UI.composer:SetText(string.rep("long message ",400));RG.UI:SendMessage();RG.Transport:Tick(0.25)
local part=RG.Transport.part;RG.Transport:Load()
check(RG.Transport.part==part,"fast polling cannot interrupt a multi-frame outbound message")
RG.Transport.pending=nil
local character=RG.Character:Collect()
check(character.level==27 and #character.quests==1,"character and legacy quest API snapshot")
check(RG.Character:Text(character,123):find("Wolves: 2/8",1,true),"selected quest objectives included")
local originalQuestLog=C_QuestLog
C_QuestLog={GetNumQuestLogEntries=function()return 1 end,GetInfo=function()return {title="Modern quest",questID=456,level=27}end,GetQuestObjectives=function()return {{text="Visit the inn",finished=false}}end}
check(RG.Character:Collect().quests[1].title=="Modern quest","modern quest API supported")
C_QuestLog=originalQuestLog
RG.UI.composer:SetText("Work draft to preserve")
local workPane=RG.selected
RoamgateGuideToggle();check(RG.Guide:IsShown() and RG.activeSurface=="guide","guide opens a separate window")
check(RG.selected==workPane and RG.UI.composer:GetText()=="Work draft to preserve","opening guide preserves work target and draft")
RG.Guide:Receive({timestamp=10000,mode="interactive",scope="guide",character="Player-1-abc123",guideStartProof="guide-start",guidePane=""})
RG.Guide.composer:SetText("What should I do next?");RG.Guide:Send()
check(RG.Transport.pending.op=="guide_new" and RG.Transport.pending.scope=="guide","guide starts through its own scoped command")
check(RG.Transport.pending.pane=="" and RG.Transport.pending.extra:find("Duskwood",1,true),"guide bootstrap carries character context, never a work pane")
local sent=RG.Transport.pending
RG.Guide:ActionResult(sent,{state="error",message="Try later"});check(RG.Guide.composer:GetText()==sent.text,"guide delivery failure preserves draft")
RG.Transport.pending=nil
local gs={pane="wG:p1",terminal="tg",kind="codex",workspace="WoW Adventures",title="My guide",status="idle",proof="guide-proof",screen="Hello adventurer",entries={},activeAgent=true}
RG:Receive({timestamp=10000,mode="interactive",scope="guide",character="Player-1-abc123",guideStartProof="guide-start",guidePane=gs.pane,selected=gs,agents={s,gs}})
check(RG.Guide.selected==gs.pane and RG.selected==workPane,"guide response cannot change the work selection")
RG.Guide.composer:SetText("A follow-up");RG.Guide:Send()
check(RG.Transport.pending.op=="guide_message" and RG.Transport.pending.pane==gs.pane,"follow-up targets the linked guide")
RG.Transport.pending=nil
RG.Guide:Receive({timestamp=10000,mode="interactive",scope="guide",character="Player-1-abc123",guideStartProof="guide-start",guidePane=gs.pane})
check(RG.Guide.selected==gs.pane and RG.Guide.data.selected.cached,"hidden guide retains its selected chat")
check(not RG.Guide.send.enabled,"cached guide view cannot authorize input")
RG.Guide.includeContext=false;RG.Guide:Receive({timestamp=10000,mode="interactive",scope="guide",character="Player-1-abc123",guideStartProof="guide-start",guidePane=gs.pane,selected=gs})
RG.Guide:Send();check(RG.Transport.pending.extra=="","character context can be withheld")
RG.Transport.pending=nil
RG.Guide.composer:SetText("My next game question");gs.status="blocked";gs.questionMode="queued"
local guideData={timestamp=10000,mode="interactive",scope="guide",character="Player-1-abc123",guideStartProof="guide-start",guidePane=gs.pane,selected=gs}
RG.Guide:Receive(guideData)
check(RG.Guide.composer:GetText()=="My next game question" and not RG.Guide.confirm.enabled,"guide queued question preserves draft and disables Enter")
RG.Guide:Navigate("questions")
check(RG.Transport.pending.scope=="guide" and RG.Transport.pending.text=="shift+left","guide Questions opens only its own tray")
RG.Transport.pending=nil;gs.questionMode="visible";RG.Guide:Receive(guideData)
check(RG.Guide.composer:GetText()=="" and RG.Guide.saved.draft=="My next game question","guide answer composer is separate from game question")
RG.Guide.composer:SetText("My guide answer");RG.Guide:Send()
check(RG.Transport.pending.op=="answer","guide pastes the explicit answer")
RG.Guide:ActionResult(RG.Transport.pending,{state="ok",message="Pasted"});RG.Transport.pending=nil
gs.status="idle";gs.questionMode="none";RG.Guide:Receive(guideData)
check(RG.Guide.composer:GetText()=="My next game question","guide restores its question after answering")
local collect=RG.Character.Collect
RG.Character.Collect=function()error("Character API unavailable")end
check(not RG.Guide:RefreshContext() and RG.Guide.characterText:GetText():find("Character API unavailable",1,true),"character read failures are visible in the Grimoire")
RG.Guide.includeContext=true;RG.Guide.composer.scripts.OnEnterPressed(RG.Guide.composer)
check(not RG.Transport.pending and RG.Guide.composer:GetText()=="My next game question","Enter preserves the draft when requested context cannot load")
RG.Guide.includeContext=false;RG.Guide.composer.scripts.OnEnterPressed(RG.Guide.composer)
check(RG.Transport.pending.op=="guide_message" and RG.Transport.pending.extra=="","Enter sends without invoking broken character APIs when context is off")
RG.Transport.pending=nil
gs.status="blocked";gs.questionMode="visible";RG.Guide:Navigate("questions");RG.Guide.includeContext=true
RG.Guide.composer:SetText("A reviewed answer");RG.Guide.composer.scripts.OnEnterPressed(RG.Guide.composer)
check(RG.Transport.pending.op=="answer","answering an agent never depends on character collection")
RG.Transport.pending=nil;RG.Character.Collect=collect
check(bindings["ALT-G"]=="ROAMGATE_GUIDE","Alt+G opens the guide without changing Alt+R")
print("Lua addon contract: "..checks.." checks passed")
