local _, RG = ...
local G={view="terminal",messageFrames={},questRows={}};RG.Guide=G;G.UI=G
local T=RG.Theme
local function safe(s) s=RG.Character.Public(s);return tostring(s or ""):gsub("|","||") end
local function action(text, width, parent, fn)
    return T.Button(parent,text,width,function(...) RG:Activate("guide");return fn(...) end)
end
function G:CharacterKey() return RG.Character:Key() end
function G:IsShown() return self.frame and self.frame:IsShown() end
function G:SetNotice(text) self.noticeText=text;if self.notice then self.notice:SetText(safe(text)) end end
function G:Run(actionName, fn)
    local ok, result=pcall(fn)
    if not ok then
        self:SetNotice(actionName..": "..tostring(result))
        print("|cffffc45cGrimoire "..actionName..":|r "..safe(result))
    end
    return ok, result
end
function G:SaveDraft()
    if not self.draftMode or not self.composer then return end
    self.saved[self.draftMode == "answer" and "answerDraft" or "draft"] = self.composer:GetText()
end
function G:SyncComposer()
    if not self.composer then return end
    local mode = not self.newMode and self.view == "questions" and RG.UI.QuestionMode(self.data and self.data.selected) == "visible" and "answer" or "message"
    if self.draftMode == mode then return end
    self:SaveDraft();self.draftMode=mode
    self.composer:SetText(self.saved[mode == "answer" and "answerDraft" or "draft"] or "")
end
function G:Navigate(view)
    self.view=view;self.lastText=nil
    self.questionIntent=view == "questions" and {pane=self.selected,untilTime=GetTime()+40} or nil
    RG.Transport:RefreshSoon();self:Refresh()
end
function G:TryOpenQuestion()
    local intent,s=self.questionIntent,self.data and self.data.selected
    if not intent then return end
    if intent.pane~=self.selected or self.view~="questions" or GetTime()>intent.untilTime or not self:IsShown() then self.questionIntent=nil;return end
    if not s or s.cached or not RG.Transport:IsFresh(self.data) or RG.Transport.pending then return end
    self.questionIntent=nil
    if RG.UI.QuestionMode(s)=="queued" then RG.Transport:Send("key","shift+left","",self) end
end
function G:RefreshContext()
    local ok, character=pcall(RG.Character.Collect, RG.Character);self.dirty=false
    if not ok then
        self.contextError=tostring(character);self.character=nil
        if self.characterText then self.characterText:SetText(safe("Character details unavailable.\n\n"..self.contextError)) end
        for _,row in ipairs(self.questRows) do row:Hide() end
        if self.questEmpty then self.questEmpty:SetText("Character context could not be read. You can turn it off below to send your own question.");self.questEmpty:Show() end
        self:SetNotice("Character context failed. Turn off Character & quests to send without it.")
        return false
    end
    self.character=character;self.contextError=nil
    if not self.characterText then return true end
    self.characterText:SetText(safe(self.character.summary.."\n"..(self.character.coordinates or "")))
    for _,row in ipairs(self.questRows) do row:Hide() end
    for i,q in ipairs(self.character.quests) do
        local row=self.questRows[i]
        if not row then
            row=CreateFrame("Button",nil,self.questBody);row:SetSize(225,42)
            row.text=T.Label(row,"",12,{0.23,0.13,0.06});row.text:SetPoint("TOPLEFT",4,-3);row.text:SetWidth(215);row.text:SetHeight(36)
            row:SetHighlightTexture("Interface\\QuestFrame\\UI-QuestTitleHighlight");self.questRows[i]=row
        end
        row:SetPoint("TOPLEFT",0,-(i-1)*44);row.text:SetText(safe("["..q.level.."] "..q.title..(q.complete and " (complete)" or "")))
        row:SetScript("OnClick",function() RG:Activate("guide");self.questID=q.key;self:Suggest("Help me with the quest \""..q.title.."\". What should I do next?");self:SetNotice("Selected quest objectives will accompany your question.") end);row:Show()
    end
    self.questBody:SetHeight(math.max(1,#self.character.quests*44))
    self.questEmpty:SetText(self.character.questAPI and "No active quests are available in the quest log." or "Quest details are unavailable from this client. You can type a quest name below.")
    self.questEmpty:SetShown(#self.character.quests==0)
    return true
end
function G:Suggest(text)
    self:Navigate("terminal")
    local current=self.composer:GetText();self.composer:SetText(current:match("%S") and (current.."\n"..text) or text);self.composer:SetFocus()
end
function G:Receive(data)
    if data.character~=self:CharacterKey() then return end
    local previous=self.data and self.data.selected
    self.data=data
    if data.selected then self.selected=data.selected.pane;self.saved.pane=self.selected
    elseif data.guidePane and data.guidePane~="" then
        self.selected=data.guidePane;self.saved.pane=self.selected
        if previous and previous.pane==self.selected then local cached={};for k,v in pairs(previous)do cached[k]=v end;cached.cached=true;data.selected=cached end
    else self.selected=nil;self.saved.pane=nil end
    if self:IsShown() then self:Refresh() else self:UpdateStatus() end
end
function G:ActionResult(sent, ack)
    self:SetNotice(ack.message)
    if ack.state=="ok" then
        local mode=sent.op=="answer" and "answer" or "message"
        local field=mode=="answer" and "answerDraft" or "draft"
        if (sent.op=="answer" or sent.op=="guide_new" or sent.op=="guide_message") then
            if self.saved[field]==sent.text then self.saved[field]="" end
            if self.draftMode==mode and self.composer:GetText()==sent.text then self.composer:SetText("") end
        end
        if sent.op=="guide_new" then self.newMode=false;self.selected=ack.pane;self.saved.pane=ack.pane end
    end
end
function G:Send()
    self:Run("Send failed",function()self:Submit()end)
end
function G:Submit()
    RG:Activate("guide")
    local s=self.data and self.data.selected
    if not self.newMode and RG.UI.QuestionMode(s)~="none" and self.draftMode~="answer" then
        self:SetNotice("Your game question is saved. Review the agent's request first.");self:Navigate("questions");return
    end
    local text=self.composer:GetText();if not text:match("%S") then self:SetNotice("Write a question or choose one from the left page.");return end
    if self.draftMode=="answer" and not self.newMode then
        RG.Transport:Send("answer",text,"",self);return
    end
    if self.includeContext and not self:RefreshContext() then return end
    local context=self.includeContext and RG.Character:Text(self.character,self.questID) or ""
    RG.Transport:Send((self.newMode or not self.selected) and "guide_new" or "guide_message",text,context,self)
end
function G:Build()
    RoamgateDB.guideCharacters=RoamgateDB.guideCharacters or {}
    local key=self:CharacterKey();RoamgateDB.guideCharacters[key]=RoamgateDB.guideCharacters[key] or {};self.saved=RoamgateDB.guideCharacters[key]
    self.selected=self.saved.pane;self.includeContext=self.saved.includeContext~=false
    local f=T.Panel(UIParent,"RoamgateGuideWindow");self.frame=f
    f:SetSize(1000,740);f:SetScale(RoamgateDB.scale or math.min(1,(UIParent:GetWidth()-90)/1000,(UIParent:GetHeight()-90)/740))
    f:SetPoint("CENTER",UIParent,"CENTER",self.saved.x or 50,self.saved.y or 0);f:SetFrameStrata("DIALOG");f:SetMovable(true);f:SetClampedToScreen(true);f:EnableMouse(true)
    T.Book(f,280);table.insert(UISpecialFrames,"RoamgateGuideWindow")
    f:SetScript("OnMouseDown",function() RG:Activate("guide") end)
    local titlebar=CreateFrame("Frame",nil,f);titlebar:SetPoint("TOPLEFT",8,-7);titlebar:SetPoint("TOPRIGHT",-40,-7);titlebar:SetHeight(58);titlebar:EnableMouse(true);titlebar:RegisterForDrag("LeftButton")
    titlebar:SetScript("OnDragStart",function() RG:Activate("guide");f:StartMoving() end)
    titlebar:SetScript("OnDragStop",function() f:StopMovingOrSizing();local x,y=f:GetCenter();local px,py=UIParent:GetCenter();self.saved.x,self.saved.y=x-px,y-py end)
    local icon=titlebar:CreateTexture(nil,"ARTWORK");icon:SetSize(42,42);icon:SetPoint("LEFT",13,0);icon:SetTexture("Interface\\Icons\\INV_Misc_Book_11")
    local title=T.Label(titlebar,"ADVENTURER'S GRIMOIRE",23);title:SetPoint("TOPLEFT",72,-8)
    local sub=T.Label(titlebar,"YOUR CHARACTER. YOUR QUESTS. YOUR JOURNEY.",11);sub:SetPoint("TOPLEFT",73,-36)
    self.connection=T.Label(titlebar,"",12);self.connection:SetPoint("TOPRIGHT",-8,-15)
    local close=CreateFrame("Button",nil,f,"UIPanelCloseButton");close:SetPoint("TOPRIGHT",-3,-3)
    local left=T.Panel(f,nil,true);left:SetPoint("TOPLEFT",14,-78);left:SetPoint("BOTTOMLEFT",14,44);left:SetWidth(263);T.Page(left,true)
    local chapter=T.Label(left,"The Adventurer",18,{0.24,0.12,0.04});chapter:SetPoint("TOPLEFT",16,-16)
    self.characterText=T.Label(left,"",12,{0.24,0.14,0.07});self.characterText:SetPoint("TOPLEFT",16,-46);self.characterText:SetWidth(230);self.characterText:SetHeight(136)
    local overview=action("About my character",226,left,function()self:Suggest("Tell me about my character and what I should focus on at this level.")end);overview:SetPoint("TOPLEFT",17,-186)
    local gear=action("Equipment & abilities",226,left,function()self:Suggest("Review my equipped items and suggest useful equipment or ability improvements for my level.")end);gear:SetPoint("TOPLEFT",17,-216)
    local route=action("What should I do next?",226,left,function()self:Suggest("Given my location and current quests, what should I do next? Suggest a practical order.")end);route:SetPoint("TOPLEFT",17,-246)
    local quests=T.Label(left,"Your Quest Log",17,{0.24,0.12,0.04});quests:SetPoint("TOPLEFT",17,-287)
    local scroll=CreateFrame("ScrollFrame","RoamgateGuideQuestScroll",left,"UIPanelScrollFrameTemplate");scroll:SetPoint("TOPLEFT",13,-317);scroll:SetPoint("BOTTOMRIGHT",-30,16)
    self.questBody=CreateFrame("Frame",nil,scroll);self.questBody:SetSize(225,1);scroll:SetScrollChild(self.questBody)
    self.questEmpty=T.Label(self.questBody,"",12,{0.3,0.18,0.09});self.questEmpty:SetPoint("TOPLEFT",5,-5);self.questEmpty:SetWidth(210)
    local right=CreateFrame("Frame",nil,f);right:SetPoint("TOPLEFT",300,-82);right:SetPoint("BOTTOMRIGHT",-22,46)
    self.sessionTitle=T.Label(right,"A companion for your adventures",18);self.sessionTitle:SetPoint("TOPLEFT",3,0);self.sessionTitle:SetWidth(665);self.sessionTitle:SetHeight(27)
    local live=action("Live reply",100,right,function()self:Navigate("terminal")end);live:SetPoint("TOPLEFT",0,-36)
    local history=action("Conversation",110,right,function()self:Navigate("conversation")end);history:SetPoint("LEFT",live,"RIGHT",6,0)
    local context=action("Context",86,right,function()self:RefreshContext();self:Navigate("context")end);context:SetPoint("LEFT",history,"RIGHT",6,0)
    self.questions=action("Questions",100,right,function()self:Navigate("questions")end);self.questions:SetPoint("LEFT",context,"RIGHT",6,0)
    self.refresh=action("Refresh",86,right,function()RG.Transport:RefreshSoon();self:RefreshContext();self:SetNotice("Refreshing your guide and local character details.")end);self.refresh:SetPoint("TOPRIGHT",0,-36)
    local page=T.Panel(right);page:SetPoint("TOPLEFT",0,-72);page:SetPoint("BOTTOMRIGHT",0,188);T.Page(page,false)
    self.scroll=CreateFrame("ScrollFrame","RoamgateGuideReplyScroll",page,"UIPanelScrollFrameTemplate");self.scroll:SetPoint("TOPLEFT",14,-14);self.scroll:SetPoint("BOTTOMRIGHT",-30,15)
    self.content=CreateFrame("Frame",nil,self.scroll);self.content:SetSize(625,1);self.scroll:SetScrollChild(self.content)
    self.scroll:SetScript("OnSizeChanged",function(_,w)self.content:SetWidth(w);self.lastText=nil;self:Render()end)
    self.controls=CreateFrame("Frame",nil,right);self.controls:SetPoint("BOTTOMLEFT",0,153);self.controls:SetSize(674,30);self.keyButtons={}
    for i,entry in ipairs({{"Up","up",40},{"Down","down",48},{"Tab","tab",42},{"Space","space",55},{"1","1",28},{"2","2",28},{"3","3",28},{"4","4",28},{"Cancel","esc",60},{"Question","shift+left",86}}) do
        local b=action(entry[1],entry[3],self.controls,function()if entry[2]=="shift+left" then self:Navigate("questions") else RG.Transport:Send("key",entry[2],"",self) end end);b.questionKey=entry[2]
        if i==1 then b:SetPoint("LEFT",0,0) else b:SetPoint("LEFT",self.keyButtons[i-1],"RIGHT",4,0) end;self.keyButtons[i]=b
    end
    self.confirm=action("Confirm / Enter",130,self.controls,function()local s=self.data and self.data.selected;if s then self.confirmProof=s.proof;StaticPopup_Show("ROAMGATE_GUIDE_CONFIRM",safe(s.title)) end end);self.confirm:SetPoint("RIGHT",0,0)
    StaticPopupDialogs.ROAMGATE_GUIDE_CONFIRM={text="Send Enter to the guide question shown for:\n\n%s\n\nReview the highlighted choice before confirming.",button1="Send Enter",button2="Go back",timeout=0,whileDead=true,hideOnEscape=true,preferredIndex=3,OnAccept=function()local s=self.data and self.data.selected;if s and s.proof==self.confirmProof then RG.Transport:Send("key","enter","",self)else self:SetNotice("The question changed. Review the current choice.")end end}
    local compose=T.Panel(right);compose:SetPoint("BOTTOMLEFT",0,49);compose:SetPoint("BOTTOMRIGHT",0,49);compose:SetHeight(96)
    local cs=CreateFrame("ScrollFrame","RoamgateGuideComposeScroll",compose,"UIPanelScrollFrameTemplate");cs:SetPoint("TOPLEFT",13,-10);cs:SetPoint("BOTTOMRIGHT",-29,10)
    self.composer=CreateFrame("EditBox","RoamgateGuideComposer",cs);self.composer:SetMultiLine(true);self.composer:SetAutoFocus(false);self.composer:SetFont("Fonts\\ARIALN.TTF",16,"");self.composer:SetTextColor(0.93,0.88,0.75);self.composer:SetMaxBytes(2000);self.composer:SetSize(625,76);cs:SetScrollChild(self.composer)
    cs:SetScript("OnSizeChanged",function(_,w)self.composer:SetWidth(w)end)
    self.composer:SetScript("OnTextChanged",function()self:SaveDraft()end);self.composer:SetScript("OnEditFocusGained",function()RG:Activate("guide")end)
    self.composer:SetScript("OnEscapePressed",function(e)e:ClearFocus()end);self.composer:SetScript("OnEnterPressed",function(e)if IsShiftKeyDown()then e:Insert("\n")else self:Send()end end)
    self.composer:SetScript("OnCursorChanged",function(_,_,y,_,h)local n=-y;local current=cs:GetVerticalScroll();if n<current then cs:SetVerticalScroll(n)elseif n+h>current+cs:GetHeight()then cs:SetVerticalScroll(n+h-cs:GetHeight())end end)
    self.send=action("Open guide & ask",154,right,function()self:Send()end);self.send:SetPoint("BOTTOMRIGHT",0,12)
    self.newChat=action("New conversation",145,right,function()self.newMode=true;self:SetNotice("Your next question will open a separate guide conversation.");self:UpdateStatus();self.composer:SetFocus()end);self.newChat:SetPoint("BOTTOMLEFT",0,12)
    self.contextToggle=action("",225,right,function()self.includeContext=not self.includeContext;self.saved.includeContext=self.includeContext;self:UpdateStatus()end);self.contextToggle:SetPoint("LEFT",self.newChat,"RIGHT",8,0)
    self.notice=T.Label(f,"",11);self.notice:SetPoint("BOTTOMLEFT",32,20);self.notice:SetPoint("BOTTOMRIGHT",-32,20);self.notice:SetHeight(16)
    f:SetScript("OnHide",function()self.composer:ClearFocus();if RG.UI:IsShown()then RG:Activate("work")end end)
    self:SyncComposer();self:RefreshContext();self:SetNotice("Ask a question to open your own guide chat. Character context is attached only when you send.");self:Refresh();f:Hide()
    local events=CreateFrame("Frame");for _,event in ipairs({"QUEST_LOG_UPDATE","PLAYER_LEVEL_UP","ZONE_CHANGED_NEW_AREA","PLAYER_EQUIPMENT_CHANGED"})do events:RegisterEvent(event)end
    events:SetScript("OnEvent",function()self.dirty=true end)
end
function G:Render()
    if not self.content then return end
    local s=self.data and self.data.selected;local entries
    if self.view=="context" then entries={{role="character context",text=self.character and RG.Character:Text(self.character,self.questID) or (self.contextError or "Character details have not loaded yet.")}}
    elseif s then
        if self.view=="conversation" and #(s.entries or {})>0 then entries=s.entries
        else entries={{role=RG.UI.QuestionMode(s)=="visible" and "question · review before confirming" or "guide · live reply",text=self.view=="questions" and (s.questionScreen or s.screen) or s.screen}} end
    else entries={{role="Welcome, adventurer",text="Open a dedicated Roamgate chat for your journey through WoW Forever.\n\nAsk about your class, equipment, the world, or a quest. Choose a quest on the left to prepare a question with its objectives.\n\nThe guide receives a fresh character snapshot only when you send. Your work conversations stay in the other grimoire."}} end
    local key=self.view..(self.selected or "");for _,e in ipairs(entries)do key=key..e.role..e.text end
    if key==self.lastText then return end;self.lastText=key
    local bottom=self.view~="questions" and self.scroll:GetVerticalScrollRange()-self.scroll:GetVerticalScroll()<45
    for _,m in ipairs(self.messageFrames)do m:Hide()end
    local y,width=0,math.max(280,self.content:GetWidth()-8)
    for i,e in ipairs(RG.UI.TextBlocks(entries))do
        local m=self.messageFrames[i]
        if not m then m=CreateFrame("Frame",nil,self.content);m.role=T.Label(m,"",11);m.role:SetPoint("TOPLEFT",0,0);m.text=T.Label(m,"",14,{0.91,0.87,0.75});self.messageFrames[i]=m end
        m:SetPoint("TOPLEFT",0,-y);m:SetWidth(width);m.role:SetText(e.continuation and "" or safe(e.role:upper()))
        m.text:SetPoint("TOPLEFT",0,e.continuation and 0 or -23);m.text:SetWidth(width);m.text:SetWordWrap(true);m.text:SetNonSpaceWrap(true)
        m.text:SetFont(s and self.view~="context" and "Interface\\AddOns\\Roamgate\\Media\\Mono.ttf" or "Fonts\\ARIALN.TTF",s and 13 or 16,"");m.text:SetText(safe(e.text))
        local h=m.text:GetStringHeight()+(e.continuation and 12 or 42);m:SetHeight(h);m:Show();y=y+h
    end
    self.content:SetHeight(math.max(1,y));if bottom then self.scroll:SetVerticalScroll(math.max(0,y-self.scroll:GetHeight()))elseif self.lastView~=self.view then self.scroll:SetVerticalScroll(0)end;self.lastView=self.view
end
function G:UpdateStatus()
    if not self.frame then return end
    self:SyncComposer()
    local fresh=self.data and RG.Transport:IsFresh(self.data);local s=self.data and self.data.selected
    local ready=fresh and self.data.mode=="interactive" and not RG.Transport.pending and not RG.Transport.exhausted
    self.connection:SetText(fresh and "|cff84c99dConnected through Roamgate|r" or "Waiting for companion")
    self.sessionTitle:SetText(safe(self.newMode and "A new chapter" or (s and s.title or "A companion for your adventures")))
    local question=RG.UI.QuestionMode(s)
    local blocked=question~="none" and not self.newMode
    self.controls:SetShown(blocked or false)
    self.send:SetText(self.draftMode=="answer" and "Paste answer" or (blocked and "Review question" or ((self.newMode or not self.selected) and "Open guide & ask" or "Ask your guide")))
    self.send:SetEnabled(ready and ((self.newMode or not self.selected) and self.data.guideStartProof or (s and s.activeAgent~=false and not s.cached)) and true or false)
    self.newChat:SetEnabled(ready and true or false)
    self.contextToggle:SetText(self.includeContext and "Character & quests: attached" or "Character & quests: off")
    local canAnswer=ready and s and not s.cached and not self.newMode
    for _,b in ipairs(self.keyButtons)do b:SetEnabled(canAnswer and (b.questionKey=="shift+left" and question=="queued" or b.questionKey~="shift+left" and question=="visible") or false)end
    self.confirm:SetEnabled(canAnswer and question=="visible" or false)
    self.questions:SetText(question=="queued" and "Open question" or "Questions")
    if RG.Transport.pending and RG.Transport.pending.scope=="guide" and GetTime()-RG.Transport.pendingAt>25 then self:SetNotice("Waiting for guide startup or delivery. Your question is retained; do not resend it yet.")end
end
function G:Refresh()if self.dirty then self:RefreshContext()end;self:UpdateStatus();self:Render();self:TryOpenQuestion()end
function RoamgateGuideToggle()
    if not G.frame then return end
    if G:IsShown()then G.frame:Hide()else RG:Activate("guide");G.frame:Show();G:Run("Open failed",function()G:RefreshContext();G:Refresh()end);RG.Transport:RefreshSoon()end
end
