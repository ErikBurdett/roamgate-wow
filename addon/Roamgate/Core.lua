local _, RG = ...
local events = CreateFrame("Frame")
RG.statuses = {}
RG.sessionCache = {}
function RG:Activate(surface)
    if self.activeSurface ~= surface then self.activeSurface = surface; self.Transport:RefreshSoon() end
end
function RG:CachedSelection(pane)
    local cached = self.sessionCache[pane]
    if not cached then return nil end
    local copy = {}; for k,v in pairs(cached) do copy[k] = v end
    copy.cached = true
    return copy
end
function RG:Receive(data)
    local incoming = data; data = {}; for k,v in pairs(incoming) do data[k] = v end
    self.latest = incoming
    if incoming.scope == "guide" and self.Guide then self.Guide:Receive(incoming); data.selected = nil end
    if data.selected then self.sessionCache[data.selected.pane] = data.selected end
    for pane, cached in pairs(self.sessionCache) do
        local found
        for _, agent in ipairs(data.agents or {}) do
            if agent.pane == pane and agent.terminal == cached.terminal and agent.kind == cached.kind then found = true; break end
        end
        if not found then self.sessionCache[pane] = nil end
    end
    if not data.selected then data.selected = self:CachedSelection(self.selected) end
    self.data = data
    for _, agent in ipairs(data.agents or {}) do
        local previous = self.statuses[agent.pane]
        if previous and previous ~= agent.status and (agent.status == "blocked" or (agent.status == "done" and previous == "working")) then
            self.UI:Notify(agent)
        end
        self.statuses[agent.pane] = agent.status
    end
    if self.UI:IsShown() then self.UI:Refresh() else self.UI:UpdateStatus() end
end
function RG:Select(pane)
    self:Activate("work")
    if self.selected == pane then
        if self.UI.unread then self.UI.unread[pane] = nil end
        self.Transport:RefreshSoon(); self.UI:Refresh(); return
    end
    self.UI:SaveScroll()
    self.UI:SaveDraft()
    self.selected = pane; RoamgateDB.selected = pane
    if self.data and (not self.data.selected or self.data.selected.pane ~= pane) then self.data.selected = self:CachedSelection(pane) end
    if self.UI.unread then self.UI.unread[pane] = nil end
    self.UI.view = "terminal"; self.browsePath = ""; self.UI.lastContent = nil
    self.Transport:RefreshSoon()
    self.UI:Refresh()
end
function RoamgateToggle()
    if not RG.UI.frame then return end
    if RG.UI:IsShown() then RG.UI.frame:Hide() else RG:Activate("work"); RG.UI.frame:Show(); RG.Transport:RefreshSoon(); RG.UI:Refresh() end
end
function RoamgateToggleWindows()
    if not RG.UI.frame then return end
    local work, guide = RG.UI:IsShown(), RG.Guide and RG.Guide:IsShown()
    if work or guide then
        RG.minimizedWindows = {work=work,guide=guide,active=RG.activeSurface}
        if work then RG.UI.frame:Hide() end
        if guide then RG.Guide.frame:Hide() end
        StaticPopup_Hide("ROAMGATE_CONFIRM"); StaticPopup_Hide("ROAMGATE_GUIDE_CONFIRM")
        RG.UI.confirmProof=nil; RG.Guide.confirmProof=nil
    else
        local restore = RG.minimizedWindows or {work=true,active="work"}
        RG.minimizedWindows=nil
        if restore.work then RoamgateToggle() end
        if restore.guide then RG.Guide:Open() end
        local active = restore.active=="guide" and restore.guide and "guide" or (restore.work and "work" or "guide")
        RG:Activate(active)
        local ui = active=="guide" and RG.Guide or RG.UI
        ui.frame:Raise()
    end
end
BINDING_HEADER_ROAMGATE = "Roamgate"
BINDING_NAME_ROAMGATE_TOGGLE = "Minimize / restore both Roamgate windows"
BINDING_NAME_ROAMGATE_GUIDE = "Open Adventurer's Grimoire"
function RG:InstallBinding()
    if InCombatLockdown() then self.bindingDeferred = true; return end
    self.bindingDeferred = nil
    if not RoamgateDB.bindingInitialized then
        if not GetBindingKey("ROAMGATE_TOGGLE") and GetBindingAction("ALT-R") == "" then
            if SetBinding("ALT-R", "ROAMGATE_TOGGLE") then SaveBindings(GetCurrentBindingSet()) end
        end
        RoamgateDB.bindingInitialized = true
    end
    if not RoamgateDB.guideBindingInitialized then
        if not GetBindingKey("ROAMGATE_GUIDE") and GetBindingAction("ALT-G") == "" then
            if SetBinding("ALT-G", "ROAMGATE_GUIDE") then SaveBindings(GetCurrentBindingSet()) end
        end
        RoamgateDB.guideBindingInitialized = true
    end
end
events:RegisterEvent("PLAYER_LOGIN")
events:RegisterEvent("PLAYER_LOGOUT")
events:RegisterEvent("UI_SCALE_CHANGED")
events:RegisterEvent("PLAYER_REGEN_ENABLED")
events:SetScript("OnEvent", function(_, event)
    if event == "PLAYER_LOGIN" then
        RoamgateDB = RoamgateDB or {}; RoamgateDB.drafts = RoamgateDB.drafts or {}
        RG.selected = RoamgateDB.selected
        RG.UI:Build(); RG.Transport:Start()
        RG.Guide:Run("Startup failed",function()RG.Guide:Build()end)
        RG:InstallBinding()
        SLASH_ROAMGATE1, SLASH_ROAMGATE2 = "/rg", "/roamgate"
        SlashCmdList.ROAMGATE = function(msg)
            if msg == "reload" then
                if InCombatLockdown() then print("Roamgate: wait until combat ends to reload.") else ReloadUI() end
            elseif msg == "hud" then
                RoamgateDB.hudHidden = not RoamgateDB.hudHidden; RG.UI:UpdateHUD()
            elseif msg == "guide" or msg == "book" then
                RoamgateGuideToggle()
            elseif msg == "sound" then
                RoamgateDB.quiet = not RoamgateDB.quiet; print("Roamgate sounds " .. (RoamgateDB.quiet and "off" or "on"))
            elseif msg:match("^scale ") then
                local n = tonumber(msg:match("^scale (.+)"))
                if n and n >= 0.65 and n <= 1.4 then RoamgateDB.scale = n; RG.UI.frame:SetScale(n) end
            else RoamgateToggle() end
        end
        SLASH_ROAMGATEGUIDE1 = "/rgg"
        SlashCmdList.ROAMGATEGUIDE = RoamgateGuideToggle
        print("|cffd8b76aRoamgate|r ready. Type |cff77c5ed/rg|r or use the minimap portal. Keep the local companion running.")
    elseif event == "PLAYER_LOGOUT" then
        RG.UI:SaveDraft()
    elseif event == "UI_SCALE_CHANGED" and RG.Transport.strip then
        RG.Transport:ApplyScale()
    elseif event == "PLAYER_REGEN_ENABLED" then
        if RG.bindingDeferred then RG:InstallBinding() end
        if RG.UI.queuedNotice then RG.UI:SetNotice(RG.UI.queuedNotice); RG.UI.queuedNotice = nil end
    end
end)
