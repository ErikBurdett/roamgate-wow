local _, RG = ...
local events = CreateFrame("Frame")
RG.statuses = {}
function RG:Receive(data)
    self.data = data
    for _, agent in ipairs(data.agents or {}) do
        local previous = self.statuses[agent.pane]
        if previous and previous ~= agent.status and (agent.status == "blocked" or (agent.status == "done" and previous == "working")) then
            self.UI:Notify(agent)
        end
        self.statuses[agent.pane] = agent.status
    end
    self.UI:Refresh()
end
function RG:Select(pane)
    if self.selected then RoamgateDB.drafts[self.selected] = self.UI.composer:GetText() end
    self.selected = pane; RoamgateDB.selected = pane
    if self.UI.unread then self.UI.unread[pane] = nil end
    self.UI.composer:SetText(RoamgateDB.drafts[pane] or "")
    self.UI.view = "conversation"; self.browsePath = ""; self.UI.lastContent = nil
    self.Transport.loadElapsed = 3
    self.UI:Refresh()
end
function RoamgateToggle()
    if not RG.UI.frame then return end
    if RG.UI:IsShown() then RG.UI.frame:Hide() else RG.UI.frame:Show(); RG.Transport.loadElapsed = 3; RG.UI:Refresh() end
end
BINDING_HEADER_ROAMGATE = "Roamgate"
BINDING_NAME_ROAMGATE_TOGGLE = "Open / close Roamgate"
events:RegisterEvent("PLAYER_LOGIN")
events:RegisterEvent("PLAYER_LOGOUT")
events:RegisterEvent("UI_SCALE_CHANGED")
events:RegisterEvent("PLAYER_REGEN_ENABLED")
events:SetScript("OnEvent", function(_, event)
    if event == "PLAYER_LOGIN" then
        RoamgateDB = RoamgateDB or {}; RoamgateDB.drafts = RoamgateDB.drafts or {}
        RG.selected = RoamgateDB.selected
        RG.UI:Build(); RG.Transport:Start()
        SLASH_ROAMGATE1, SLASH_ROAMGATE2 = "/rg", "/roamgate"
        SlashCmdList.ROAMGATE = function(msg)
            if msg == "reload" then
                if InCombatLockdown() then print("Roamgate: wait until combat ends to reload.") else ReloadUI() end
            elseif msg == "hud" then
                RoamgateDB.hudHidden = not RoamgateDB.hudHidden; RG.UI:UpdateHUD()
            elseif msg == "sound" then
                RoamgateDB.quiet = not RoamgateDB.quiet; print("Roamgate sounds " .. (RoamgateDB.quiet and "off" or "on"))
            elseif msg:match("^scale ") then
                local n = tonumber(msg:match("^scale (.+)"))
                if n and n >= 0.65 and n <= 1.4 then RoamgateDB.scale = n; RG.UI.frame:SetScale(n) end
            else RoamgateToggle() end
        end
        print("|cffd8b76aRoamgate|r ready. Type |cff77c5ed/rg|r or use the minimap portal. Keep the local companion running.")
    elseif event == "PLAYER_LOGOUT" then
        if RG.selected then RoamgateDB.drafts[RG.selected] = RG.UI.composer:GetText() end
    elseif event == "UI_SCALE_CHANGED" and RG.Transport.strip then
        RG.Transport:ApplyScale()
    elseif event == "PLAYER_REGEN_ENABLED" and RG.UI.queuedNotice then
        RG.UI:SetNotice(RG.UI.queuedNotice); RG.UI.queuedNotice = nil
    end
end)
