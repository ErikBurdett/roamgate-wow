local _, RG = ...
local M={};RG.Models=M
local T=RG.Theme
local function safe(s)return tostring(s or ""):gsub("|","||")end
function M:Choices(owner)
    return (owner.data and owner.data.modelChoices) or (RG.latest and RG.latest.modelChoices) or {
        {kind="codex",label="Codex",defaultModel="",models={{"","Installed default"}}},
        {kind="claude",label="Claude",defaultModel="",models={{"","Installed default"},{"sonnet","Sonnet"},{"opus","Opus"},{"haiku","Haiku"}}}
    }
end
function M:Menu(picker, anchor, choices, choose)
    if picker.menu and picker.menu:IsShown() and picker.menu.anchor==anchor then picker.menu:Hide();return end
    if not picker.menu then
        local menu=T.Panel(picker);menu:SetFrameStrata("FULLSCREEN_DIALOG");menu:SetWidth(286);menu.buttons={};picker.menu=menu
        self.menuCount=(self.menuCount or 0)+1
        menu.scroll=CreateFrame("ScrollFrame","RoamgateModelMenuScroll"..self.menuCount,menu,"UIPanelScrollFrameTemplate");menu.scroll:SetPoint("TOPLEFT",8,-8);menu.scroll:SetPoint("BOTTOMRIGHT",-28,8)
        menu.body=CreateFrame("Frame",nil,menu.scroll);menu.body:SetSize(250,1);menu.scroll:SetScrollChild(menu.body)
    end
    local menu=picker.menu;menu.anchor=anchor;menu:ClearAllPoints();menu:SetPoint("BOTTOMLEFT",anchor,"TOPLEFT",0,4);menu:SetHeight(math.min(296,#choices*28+16));menu.body:SetHeight(#choices*28);menu.scroll:SetVerticalScroll(0)
    for _,b in ipairs(menu.buttons)do b:Hide()end
    for i,c in ipairs(choices)do
        local b=menu.buttons[i]
        if not b then b=T.Button(menu.body,"",250,function()end);menu.buttons[i]=b end
        b:SetPoint("TOPLEFT",0,-(i-1)*28);b:SetText(safe(c[2]));b:SetScript("OnClick",function()menu:Hide();choose(c[1])end);b:Show()
    end
    menu:Show()
end
function M:Build(parent, owner, ui, scope)
    RoamgateDB.newChatModels=RoamgateDB.newChatModels or {}
    local saved=RoamgateDB.newChatModels[scope] or {kind=scope=="guide" and "claude" or "codex",model=""}
    RoamgateDB.newChatModels[scope]=saved
    saved.byProvider=saved.byProvider or {};saved.byProvider[saved.kind]=saved.model
    local f=CreateFrame("Frame",nil,parent);f:SetHeight(30);f.saved=saved;ui.modelPicker=f
    local title=T.Label(f,"New chat",11);title:SetPoint("LEFT",0,0)
    f.provider=T.Button(f,"",100,function()
        local choices={};for _,p in ipairs(self:Choices(owner))do table.insert(choices,{p.kind,p.label})end
        self:Menu(f,f.provider,choices,function(kind)
            saved.byProvider[saved.kind]=saved.model;saved.kind=kind
            for _,p in ipairs(self:Choices(owner))do if p.kind==kind then
                saved.model=saved.byProvider[kind]
                if saved.model==nil then saved.model=p.defaultModel or "" end
            end end
            self:Refresh(ui,owner);RG:Activate(scope)
        end)
    end);f.provider:SetPoint("LEFT",title,"RIGHT",10,0)
    f.model=T.Button(f,"",216,function()
        for _,p in ipairs(self:Choices(owner))do if p.kind==saved.kind then self:Menu(f,f.model,p.models,function(model)saved.model=model;saved.byProvider[saved.kind]=model;self:Refresh(ui,owner);RG:Activate(scope)end)end end
    end);f.model:SetPoint("LEFT",f.provider,"RIGHT",8,0)
    local note=T.Label(f,"This chat only",11);note:SetPoint("LEFT",f.model,"RIGHT",10,0)
    f:SetScript("OnHide",function()if f.menu then f.menu:Hide()end end)
    self:Refresh(ui,owner);return f
end
function M:Refresh(ui,owner)
    local f=ui.modelPicker;if not f then return end
    local saved=f.saved;ui.newKind,ui.newModel=saved.kind,saved.model
    f.provider:SetText(safe(saved.kind));f.model:SetText(safe(saved.model=="" and "Installed default" or saved.model))
    for _,p in ipairs(self:Choices(owner))do if p.kind==saved.kind then
        f.provider:SetText(safe(p.label));for _,m in ipairs(p.models)do if m[1]==saved.model then f.model:SetText(safe(m[2]))end end
    end end
    local enabled=not RG.Transport.pending;f.provider:SetEnabled(enabled);f.model:SetEnabled(enabled)
    if not enabled and f.menu then f.menu:Hide()end
end
