local _, RG = ...
local U = { view = "terminal", rows = {}, messageFrames = {}, filter = "all", scrollPositions = {} }
RG.UI = U
local GOLD, BLUE, INK = {0.85, 0.72, 0.42}, {0.46, 0.77, 0.92}, {0.055, 0.065, 0.075}
local LABELS = { blocked = "NEEDS YOU", working = "WORKING", idle = "READY", done = "FINISHED", unknown = "UNKNOWN" }
local COLORS = { blocked = "ffffc45c", working = "ff77c5ed", idle = "ff9ca99b", done = "ff84c99d", unknown = "ffa0a0a0" }
local ORDER = { blocked = 1, working = 2, done = 3, idle = 4, unknown = 5 }
local function safe(s) return tostring(s or ""):gsub("|", "||") end
-- Bound each native FontString and split at line boundaries where possible.
-- Keep UTF-8 characters intact; long code/transcripts must remain scrollable.
local function blocks(entries)
    local result = {}
    for _, e in ipairs(entries) do
        local text, start = tostring(e.text or ""):gsub("\r\n", "\n"):gsub("\r", ""), 1
        repeat
            local finish = math.min(#text, start + 1799)
            if finish < #text then
                local newline = text:sub(start, finish):match(".*()\n")
                if newline and newline > 900 then finish = start + newline - 1
                else while finish > start and (text:byte(finish + 1) or 0) >= 128 and (text:byte(finish + 1) or 0) < 192 do finish = finish - 1 end end
            end
            table.insert(result, {role=e.role,text=text:sub(start,finish),link=e.link,continuation=start>1})
            start = finish + 1
        until start > #text
    end
    return result
end
U.TextBlocks = blocks
local function label(parent, size, color, font)
    local t = parent:CreateFontString(nil, "OVERLAY")
    t:SetFont(font or "Fonts\\FRIZQT__.TTF", size, "")
    t:SetTextColor(unpack(color or GOLD)); t:SetJustifyH("LEFT"); t:SetJustifyV("TOP")
    return t
end
local function panel(parent, name)
    return RG.Theme.Panel(parent, name)
end
local function button(parent, text, width, fn)
    local b = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
    b:SetSize(width, 26); b:SetText(text); b:SetScript("OnClick", function(...) RG:Activate("work"); if fn then return fn(...) end end)
    return b
end
local function edit(parent, name, multi)
    local e = CreateFrame("EditBox", name, parent)
    e:SetAutoFocus(false); e:SetMultiLine(multi or false); e:SetFont("Fonts\\ARIALN.TTF", 17, "")
    e:SetTextColor(0.92, 0.90, 0.82); e:SetMaxBytes(multi and 6000 or 100)
    e:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
    e:SetScript("OnEditFocusGained", function() RG:Activate("work") end)
    return e
end
function U:IsShown() return self.frame and self.frame:IsShown() end
function U.QuestionMode(s)
    if not s then return "none" end
    if s.questionMode then return s.questionMode end
    local screen = s.screen or ""
    if s.kind == "codex" and screen:find("Queued follow%-up inputs") and screen:find("to answer", 1, true) then return "queued" end
    return s.status == "blocked" and "visible" or "none"
end
function U:SaveDraft()
    if not self.draftPane or not self.composer then return end
    RoamgateDB.answerDrafts = RoamgateDB.answerDrafts or {}
    local drafts = self.draftMode == "answer" and RoamgateDB.answerDrafts or RoamgateDB.drafts
    drafts[self.draftPane] = self.composer:GetText()
end
function U:SyncComposer()
    if not self.composer then return end
    local s = RG.data and RG.data.selected
    local mode = not self.newMode and self.view == "questions" and s and s.pane == RG.selected and self.QuestionMode(s) == "visible" and "answer" or "message"
    if self.draftPane == RG.selected and self.draftMode == mode then return end
    self:SaveDraft(); self.draftPane, self.draftMode = RG.selected, mode
    RoamgateDB.answerDrafts = RoamgateDB.answerDrafts or {}
    local drafts = mode == "answer" and RoamgateDB.answerDrafts or RoamgateDB.drafts
    self.composer:SetText(RG.selected and drafts[RG.selected] or "")
end
function U:TryOpenQuestion()
    local intent, s = self.questionIntent, RG.data and RG.data.selected
    if not intent then return end
    if intent.pane ~= RG.selected or self.view ~= "questions" or GetTime() > intent.untilTime or not self:IsShown() then self.questionIntent = nil; return end
    if not s or s.pane ~= RG.selected or s.cached or not RG.Transport:IsFresh(RG.data) or RG.Transport.pending then return end
    self.questionIntent = nil
    if self.QuestionMode(s) == "queued" then RG.Transport:Send("key", "shift+left") end
end
function U:SaveScroll()
    if self.contentLocation and self.scroll then
        self.scrollPositions[self.contentLocation] = {offset=self.scroll:GetVerticalScroll(), bottom=self.scroll:GetVerticalScrollRange()-self.scroll:GetVerticalScroll()<45}
    end
end
function U:SetNotice(text)
    self.noticeText = text
    if self.notice then self.notice:SetText(safe(text)) end
end
function U:Build()
    local f = panel(UIParent, "RoamgateWindow"); self.frame = f
    f:SetSize(1080, 740); f:SetScale(RoamgateDB.scale or math.min(1, (UIParent:GetWidth() - 60) / 1080, (UIParent:GetHeight() - 70) / 740))
    f:SetPoint("CENTER", UIParent, "CENTER", RoamgateDB.x or 0, RoamgateDB.y or 0)
    f:SetFrameStrata("DIALOG"); f:SetMovable(true); f:SetClampedToScreen(true); f:EnableMouse(true)
    f:SetResizable(true); f:SetResizeBounds(940, 650, 1600, 1100)
    RG.Theme.Book(f, 290)
    f:SetScript("OnMouseDown", function() RG:Activate("work") end)
    table.insert(UISpecialFrames, "RoamgateWindow")
    local titlebar = CreateFrame("Frame", nil, f); titlebar:SetPoint("TOPLEFT", 8, -7); titlebar:SetPoint("TOPRIGHT", -40, -7); titlebar:SetHeight(58)
    titlebar:EnableMouse(true); titlebar:RegisterForDrag("LeftButton")
    titlebar:SetScript("OnDragStart", function() RG:Activate("work"); f:StartMoving() end)
    titlebar:SetScript("OnDragStop", function()
        f:StopMovingOrSizing(); local x, y = f:GetCenter(); local px, py = UIParent:GetCenter()
        RoamgateDB.x, RoamgateDB.y = x - px, y - py
    end)
    local emblem = titlebar:CreateTexture(nil, "ARTWORK"); emblem:SetSize(44, 44); emblem:SetPoint("LEFT", 12, 0)
    emblem:SetTexture("Interface\\Icons\\INV_Misc_Book_09")
    local title = label(titlebar, 24); title:SetPoint("TOPLEFT", 70, -7); title:SetText("ROAMGATE")
    local sub = label(titlebar, 12, BLUE); sub:SetPoint("TOPLEFT", 71, -34); sub:SetText("THE WORKING GRIMOIRE")
    local guideButton = button(titlebar, "Adventurer's Grimoire", 190, function() RoamgateGuideToggle() end); guideButton:SetPoint("LEFT", 345, -1)
    self.connection = label(titlebar, 13, {0.65, 0.71, 0.64}); self.connection:SetPoint("TOPRIGHT", -10, -9)
    self.summary = label(titlebar, 12, {0.65, 0.65, 0.61}); self.summary:SetPoint("TOPRIGHT", -10, -31)
    local close = CreateFrame("Button", nil, f, "UIPanelCloseButton"); close:SetPoint("TOPRIGHT", -2, -2)
    local line = f:CreateTexture(nil, "ARTWORK"); line:SetColorTexture(0.48, 0.39, 0.21, 0.6); line:SetHeight(1); line:SetPoint("TOPLEFT", 16, -67); line:SetPoint("TOPRIGHT", -16, -67)

    local side = panel(f); side:SetPoint("TOPLEFT", 12, -77); side:SetPoint("BOTTOMLEFT", 12, 42); side:SetWidth(278)
    RG.Theme.Page(side, false)
    local searchBox = panel(side); searchBox:SetPoint("TOPLEFT", 9, -9); searchBox:SetPoint("TOPRIGHT", -9, -9); searchBox:SetHeight(34)
    self.search = edit(searchBox, "RoamgateSearch"); self.search:SetPoint("TOPLEFT", 10, -5); self.search:SetPoint("BOTTOMRIGHT", -8, 5)
    self.searchHint = label(searchBox, 14, {0.53, 0.53, 0.49}, "Fonts\\ARIALN.TTF"); self.searchHint:SetPoint("LEFT", 10, 0); self.searchHint:SetText("Search workspaces and sessions...")
    self.search:SetScript("OnTextChanged", function(e) self.searchHint:SetShown(e:GetText() == ""); self:RenderList() end)
    self.filterButton = button(side, "All sessions", 124, function()
        self.filter = self.filter == "all" and "attention" or "all"
        self.filterButton:SetText(self.filter == "all" and "All sessions" or "Needs you"); self:RenderList()
    end); self.filterButton:SetPoint("TOPLEFT", 10, -48)
    local refresh = button(side, "Refresh", 124, function() RG.Transport:RefreshSoon(); self:SetNotice("Refreshing your sessions...") end); refresh:SetPoint("TOPRIGHT", -10, -48)
    self.workspaceButton = button(side, "All workspaces", 258, function() self:WorkspaceMenu(side) end); self.workspaceButton:SetPoint("TOPLEFT", 10, -81)
    self.listScroll = CreateFrame("ScrollFrame", "RoamgateSessionScroll", side, "UIPanelScrollFrameTemplate")
    self.listScroll:SetPoint("TOPLEFT", 8, -120); self.listScroll:SetPoint("BOTTOMRIGHT", -28, 12)
    self.list = CreateFrame("Frame", nil, self.listScroll); self.list:SetSize(235, 1); self.listScroll:SetScrollChild(self.list)

    local main = CreateFrame("Frame", nil, f); main:SetPoint("TOPLEFT", 304, -80); main:SetPoint("BOTTOMRIGHT", -20, 42); self.main = main
    self.sessionTitle = label(main, 19); self.sessionTitle:SetPoint("TOPLEFT", 3, 0); self.sessionTitle:SetPoint("TOPRIGHT", -8, 0); self.sessionTitle:SetHeight(26)
    self.breadcrumb = label(main, 13, BLUE, "Fonts\\ARIALN.TTF"); self.breadcrumb:SetPoint("TOPLEFT", 4, -30); self.breadcrumb:SetPoint("TOPRIGHT", -5, -30); self.breadcrumb:SetHeight(20)
    self.tabs = {}
    for i, tab in ipairs({ {"Conversation", "conversation"}, {"Live terminal", "terminal"}, {"Questions", "questions"}, {"Files", "files"}, {"Changes", "changes"} }) do
        local b = button(main, tab[1], 98, function() self:Navigate(tab[2], "") end)
        b:SetPoint("TOPLEFT", (i - 1) * 103, -57); self.tabs[tab[2]] = b
    end
    self.stop = button(main, "Stop", 68, function() RG.Transport:Send("stop", "", "") end); self.stop:SetPoint("TOPRIGHT", -2, -57)
    self.contentPanel = panel(main); self.contentPanel:SetPoint("TOPLEFT", 0, -103); self.contentPanel:SetPoint("BOTTOMRIGHT", 0, 201)
    RG.Theme.Page(self.contentPanel, false)
    self.contentStatus = label(main, 11, {0.65,0.7,0.72}, "Fonts\\ARIALN.TTF"); self.contentStatus:SetPoint("TOPLEFT", 5, -85); self.contentStatus:SetPoint("TOPRIGHT", -5, -85); self.contentStatus:SetHeight(14)
    self.scroll = CreateFrame("ScrollFrame", "RoamgateConversationScroll", self.contentPanel, "UIPanelScrollFrameTemplate")
    self.scroll:SetPoint("TOPLEFT", 13, -13); self.scroll:SetPoint("BOTTOMRIGHT", -30, 13)
    self.content = CreateFrame("Frame", nil, self.scroll); self.content:SetSize(700, 1); self.scroll:SetScrollChild(self.content)
    self.scroll:SetScript("OnSizeChanged", function(_, w) self.content:SetWidth(math.max(300, w)); self.lastContent = nil; self:RenderContent() end)
    self.jump = button(main, "Latest", 68, function() self.scroll:SetVerticalScroll(self.scroll:GetVerticalScrollRange()) end); self.jump:SetPoint("BOTTOMRIGHT", -28, 205)

    self.controls = CreateFrame("Frame", nil, main); self.controls:SetPoint("BOTTOMLEFT", 0, 160); self.controls:SetPoint("BOTTOMRIGHT", 0, 160); self.controls:SetHeight(34)
    self.keyButtons = {}
    for i, entry in ipairs({ {"Up", "up", 42}, {"Down", "down", 52}, {"Tab", "tab", 42}, {"Space", "space", 56}, {"1", "1", 28}, {"2", "2", 28}, {"3", "3", 28}, {"4", "4", 28}, {"Cancel", "esc", 60}, {"Question", "shift+left", 86} }) do
        local b = button(self.controls, entry[1], entry[3], function() if entry[2] == "shift+left" then self:Navigate("questions", "") else RG.Transport:Send("key", entry[2]) end end)
        b.questionKey = entry[2]
        if i == 1 then b:SetPoint("LEFT", 0, 0) else b:SetPoint("LEFT", self.keyButtons[i - 1], "RIGHT", 4, 0) end
        self.keyButtons[i] = b
    end
    self.confirm = button(self.controls, "Confirm / Enter", 126, function()
        local selected = RG.data and RG.data.selected
        if not selected then return end
        self.confirmProof = selected.proof
        StaticPopup_Show("ROAMGATE_CONFIRM", safe(selected.title))
    end); self.confirm:SetPoint("RIGHT", 0, 0)
    StaticPopupDialogs.ROAMGATE_CONFIRM = {
        text = "Send Enter to the question currently displayed for:\n\n%s\n\nReview the highlighted option in Live terminal before confirming.",
        button1 = "Send Enter", button2 = "Go back", timeout = 0, whileDead = true, hideOnEscape = true, preferredIndex = 3,
        OnAccept = function()
            local selected = RG.data and RG.data.selected
            if selected and selected.proof == self.confirmProof then RG.Transport:Send("key", "enter")
            else self:SetNotice("The question changed while confirming. Review it again.") end
        end,
    }
    self.composePanel = panel(main); self.composePanel:SetPoint("BOTTOMLEFT", 0, 45); self.composePanel:SetPoint("BOTTOMRIGHT", 0, 45); self.composePanel:SetHeight(110)
    local composeScroll = CreateFrame("ScrollFrame", "RoamgateComposerScroll", self.composePanel, "UIPanelScrollFrameTemplate")
    composeScroll:SetPoint("TOPLEFT", 12, -10); composeScroll:SetPoint("BOTTOMRIGHT", -28, 10)
    self.composer = edit(composeScroll, "RoamgateComposer", true); self.composer:SetSize(680, 90)
    composeScroll:SetScrollChild(self.composer)
    composeScroll:SetScript("OnSizeChanged", function(_, w) self.composer:SetWidth(w) end)
    self.composer:SetScript("OnTextChanged", function(e)
        self:SaveDraft()
        if self.counter then self.counter:SetText(#e:GetText() .. " / 6000 bytes") end
    end)
    self.composer:SetScript("OnEnterPressed", function(e)
        if IsShiftKeyDown() then e:Insert("\n") else self:SendMessage() end
    end)
    self.composer:SetScript("OnCursorChanged", function(_, _, y, _, h)
        local offset = -y; local current = composeScroll:GetVerticalScroll(); local height = composeScroll:GetHeight()
        if offset < current then composeScroll:SetVerticalScroll(offset)
        elseif offset + h > current + height then composeScroll:SetVerticalScroll(offset + h - height) end
    end)
    self.newButton = button(main, "New chat", 95, function()
        self.newMode = not self.newMode
        self.newKind = (RG.data and RG.data.selected and RG.data.selected.kind) or "codex"
        if not ({codex=true,claude=true,hermes=true,opencode=true})[self.newKind] then self.newKind = "codex" end
        if self.newMode then self:SetNotice("Write the first task below. The new chat will use the selected project folder.") end
        self:Refresh(); self.composer:SetFocus()
    end); self.newButton:SetPoint("BOTTOMLEFT", 0, 9)
    self.kindButton = button(main, "codex", 95, function()
        local kinds = {"codex", "claude", "hermes", "opencode"}
        for i, k in ipairs(kinds) do if k == self.newKind then self.newKind = kinds[i % #kinds + 1]; break end end
        self.kindButton:SetText(self.newKind); self:Refresh()
    end); self.kindButton:SetPoint("LEFT", self.newButton, "RIGHT", 8, 0); self.kindButton:Hide()
    self.send = button(main, "Send message", 130, function() self:SendMessage() end); self.send:SetPoint("BOTTOMRIGHT", 0, 9)
    self.counter = label(main, 11, {0.58, 0.58, 0.54}, "Fonts\\ARIALN.TTF"); self.counter:SetPoint("BOTTOMRIGHT", -145, 24); self.counter:SetText("0 / 6000 bytes")
    local hint = label(main, 11, {0.58, 0.58, 0.54}, "Fonts\\ARIALN.TTF"); hint:SetPoint("BOTTOMRIGHT", -145, 9); hint:SetText("Enter sends · Shift+Enter new line · Esc releases keyboard")
    self.notice = label(f, 12, {0.70, 0.70, 0.64}, "Fonts\\ARIALN.TTF"); self.notice:SetPoint("BOTTOMLEFT", 22, 18); self.notice:SetPoint("BOTTOMRIGHT", -200, 18); self.notice:SetHeight(18)
    self.reload = button(f, "Reload UI", 95, function() if InCombatLockdown() then self:SetNotice("Reload when combat ends.") else ReloadUI() end end); self.reload:SetPoint("BOTTOMRIGHT", -24, 11)
    local grip = CreateFrame("Button", nil, f); grip:SetSize(18, 18); grip:SetPoint("BOTTOMRIGHT", -3, 3)
    local gt = grip:CreateTexture(nil, "ARTWORK"); gt:SetAllPoints(); gt:SetTexture("Interface\\ChatFrame\\UI-ChatIM-SizeGrabber-Up")
    grip:SetScript("OnMouseDown", function() f:StartSizing("BOTTOMRIGHT") end); grip:SetScript("OnMouseUp", function() f:StopMovingOrSizing() end)
    f:SetScript("OnHide", function() self:SaveScroll(); self.composer:ClearFocus(); self.search:ClearFocus(); if RG.Guide and RG.Guide:IsShown() then RG:Activate("guide") end end)
    self:BuildMinimap()
    self:BuildHUD()
    self:SyncComposer()
    self:SetNotice("Alt+R minimizes / restores both books. /rg opens work; /rgg opens your character guide.")
    self:Refresh(); f:Hide()
end
function U:BuildMinimap()
    local b = CreateFrame("Button", "RoamgateMinimap", Minimap); b:SetSize(32, 32)
    b:SetPoint("CENTER", Minimap, "CENTER", 78, -54); b:SetFrameStrata("MEDIUM"); b:SetFrameLevel(8)
    local icon = b:CreateTexture(nil, "ARTWORK"); icon:SetTexture("Interface\\Icons\\Spell_Arcane_TeleportStormWind"); icon:SetSize(22, 22); icon:SetPoint("CENTER")
    local rim = b:CreateTexture(nil, "OVERLAY"); rim:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder"); rim:SetSize(54, 54); rim:SetPoint("TOPLEFT")
    self.badge = label(b, 13, {1, 0.8, 0.28}); self.badge:SetPoint("BOTTOMRIGHT", 2, -1)
    b:SetScript("OnClick", RoamgateToggle)
    b:SetScript("OnEnter", function()
        GameTooltip:SetOwner(b, "ANCHOR_LEFT"); GameTooltip:AddLine("Roamgate", unpack(GOLD)); GameTooltip:AddLine("Your workspaces in Azeroth", 0.7, 0.8, 0.85)
        GameTooltip:AddLine(self.noticeText or "Click to open", 0.8, 0.8, 0.75, true); GameTooltip:Show()
    end); b:SetScript("OnLeave", function() GameTooltip:Hide() end)
    local guide = CreateFrame("Button", "RoamgateGuideMinimap", Minimap); self.guideMinimap=guide
    guide:SetSize(32,32);guide:SetPoint("CENTER",Minimap,"CENTER",44,-84);guide:SetFrameStrata("MEDIUM");guide:SetFrameLevel(8)
    local book=guide:CreateTexture(nil,"ARTWORK");book:SetTexture("Interface\\Icons\\INV_Misc_Book_11");book:SetSize(22,22);book:SetPoint("CENTER")
    local bookRim=guide:CreateTexture(nil,"OVERLAY");bookRim:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder");bookRim:SetSize(54,54);bookRim:SetPoint("TOPLEFT")
    guide:SetScript("OnClick",RoamgateGuideToggle)
    guide:SetScript("OnEnter",function()
        GameTooltip:SetOwner(guide,"ANCHOR_LEFT");GameTooltip:AddLine("Adventurer's Grimoire",unpack(GOLD))
        GameTooltip:AddLine("Your character, quests, and game advice",0.7,0.8,0.85)
        GameTooltip:AddLine("Click to open or close your guide.",0.8,0.8,0.75);GameTooltip:Show()
    end);guide:SetScript("OnLeave",function()GameTooltip:Hide()end)
end
function U:OpenPane(pane)
    RG:Activate("work")
    if pane then RG:Select(pane) end
    self.frame:Show(); RG.Transport:RefreshSoon(); self:Refresh()
end
function U:BuildHUD()
    self.unread = {}
    local hud = panel(UIParent, "RoamgateHUD"); self.hud = hud
    hud:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 0, 0); hud:SetWidth(540); hud:SetHeight(116)
    hud:SetFrameStrata("MEDIUM"); hud:SetBackdropColor(0.025, 0.045, 0.07, 0.97)
    local open = CreateFrame("Button", nil, hud); open:SetSize(460, 26); open:SetPoint("TOPLEFT", 12, -11)
    open:SetScript("OnClick", function() self:OpenPane(RG.selected) end)
    local title = label(open, 14); title:SetPoint("LEFT", 0, 0); title:SetText("ROAMGATE")
    self.hudConnection = label(open, 11, BLUE, "Fonts\\ARIALN.TTF"); self.hudConnection:SetPoint("LEFT", 108, 0)
    local collapse = button(hud, "-", 26, function()
        RoamgateDB.hudCollapsed = not RoamgateDB.hudCollapsed; self:UpdateHUD()
    end); collapse:SetPoint("TOPRIGHT", -9, -11); self.hudCollapse = collapse
    self.hudThread = CreateFrame("Button", nil, hud); self.hudThread:SetPoint("TOPLEFT", 12, -40); self.hudThread:SetSize(512, 40)
    self.hudThread:SetScript("OnClick", function() self:OpenPane(RG.selected) end)
    self.hudTitle = label(self.hudThread, 14, {0.9,0.88,0.78}, "Fonts\\ARIALN.TTF"); self.hudTitle:SetPoint("TOPLEFT"); self.hudTitle:SetWidth(510); self.hudTitle:SetHeight(18)
    self.hudMeta = label(self.hudThread, 11, BLUE, "Fonts\\ARIALN.TTF"); self.hudMeta:SetPoint("TOPLEFT", 0, -21); self.hudMeta:SetWidth(510); self.hudMeta:SetHeight(16)
    self.hudAttention = button(hud, "No questions", 120, function()
        local target
        for _, a in ipairs(RG.data and RG.data.agents or {}) do if a.status == "blocked" then target = a.pane; break end end
        if target then self:OpenPane(target); self:Navigate("questions", "") else self:OpenPane(RG.selected) end
    end); self.hudAttention:SetPoint("BOTTOMLEFT", 10, 8)
    self.hudNews = button(hud, "Caught up", 106, function()
        local target, newest = nil, 0
        for pane, n in pairs(self.unread) do if n.at >= newest then target, newest = pane, n.at end end
        self:OpenPane(target or RG.selected)
    end); self.hudNews:SetPoint("LEFT", self.hudAttention, "RIGHT", 8, 0)
    self.hudOpen = button(hud, "Open workspace", 135, function() self:OpenPane(RG.selected) end); self.hudOpen:SetPoint("LEFT",self.hudNews,"RIGHT",8,0)
    self.hudGuide = RG.Theme.Button(hud, "Open grimoire", 135, function() RG.Guide:Open() end); self.hudGuide:SetPoint("LEFT",self.hudOpen,"RIGHT",8,0)
    self.hudNews:SetScript("OnEnter", function(b)
        GameTooltip:SetOwner(b,"ANCHOR_BOTTOM"); GameTooltip:AddLine("Recent activity", unpack(GOLD))
        local count = 0
        for _, n in pairs(self.unread) do
            GameTooltip:AddLine(safe(n.title), 0.8, 0.85, 0.9, true); count = count + 1
            if count >= 5 then break end
        end
        if count == 0 then GameTooltip:AddLine("You are caught up.", 0.65,0.7,0.65) end
        GameTooltip:Show()
    end); self.hudNews:SetScript("OnLeave", function() GameTooltip:Hide() end)
    self:UpdateHUD()
end
function U:UpdateHUD()
    if not self.hud then return end
    local data, selected, working, questions, unread = RG.data or {}, nil, 0, 0, 0
    for _, a in ipairs(data.agents or {}) do
        if a.pane == RG.selected then selected = a end
        if a.status == "working" then working = working + 1 end
        if a.status == "blocked" then questions = questions + 1 end
    end
    for _ in pairs(self.unread) do unread = unread + 1 end
    local fresh = RG.Transport:IsFresh()
    self.hudConnection:SetText((fresh and "|cff84c99dConnected|r" or "|cffffc45cConnecting|r") .. "  ·  " .. working .. " working  ·  " .. questions .. " need you")
    self.hudTitle:SetText(safe(selected and selected.title or "Choose a conversation to follow"))
    self.hudMeta:SetText(selected and (safe(selected.workspace .. "  /  " .. selected.kind) .. "   |c" .. (COLORS[selected.status] or COLORS.unknown) .. (LABELS[selected.status] or "TERMINAL") .. "|r") or (#(data.workspaces or {}) .. " workspaces  ·  " .. #(data.agents or {}) .. " sessions"))
    self.hudAttention:SetText(questions > 0 and (questions .. (questions == 1 and " question" or " questions")) or "No questions")
    self.hudNews:SetText(unread > 0 and (unread .. " new") or "Caught up")
    local expanded = not RoamgateDB.hudCollapsed
    self.hud:SetHeight(expanded and 116 or 42); self.hudCollapse:SetText(expanded and "-" or "+")
    self.hudThread:SetShown(expanded); self.hudAttention:SetShown(expanded); self.hudNews:SetShown(expanded); self.hudOpen:SetShown(expanded); self.hudGuide:SetShown(expanded)
    self.hud:SetShown(not RoamgateDB.hudHidden)
end
function U:SendMessage()
    local s = RG.data and RG.data.selected
    if not s then return end
    if not self.newMode and self.QuestionMode(s) ~= "none" and self.draftMode ~= "answer" then
        self:SetNotice("Your task draft is saved. Review the question before sending more work."); self:Navigate("questions", ""); return
    end
    local text = self.composer:GetText()
    if not text:match("%S") then self:SetNotice("Write a message first."); return end
    if self.newMode then RG.Transport:Send("new", text, self.newKind)
    elseif self.draftMode == "answer" then RG.Transport:Send("answer", text)
    else RG.Transport:Send("message", text) end
end
function U:Navigate(view, path)
    RG:Activate("work")
    self:SaveScroll()
    self.view, RG.browsePath, self.lastContent = view, path or "", nil
    self.questionIntent = view == "questions" and {pane=RG.selected, untilTime=GetTime()+40} or nil
    RG.Transport:RefreshSoon(); self:Refresh()
end
function U:WorkspaceMenu(parent)
    if self.workspaceMenu and self.workspaceMenu:IsShown() then self.workspaceMenu:Hide(); return end
    if not self.workspaceMenu then
        local menu = panel(parent); menu:SetSize(270, 340); menu:SetPoint("TOPLEFT", parent, "TOPLEFT", 4, -112); menu:SetFrameStrata("FULLSCREEN_DIALOG")
        local scroll = CreateFrame("ScrollFrame", "RoamgateWorkspaceMenuScroll", menu, "UIPanelScrollFrameTemplate"); scroll:SetPoint("TOPLEFT", 8, -8); scroll:SetPoint("BOTTOMRIGHT", -28, 8)
        menu.body = CreateFrame("Frame", nil, scroll); menu.body:SetSize(230, 1); scroll:SetScrollChild(menu.body); menu.buttons = {}; self.workspaceMenu = menu
    end
    local menu = self.workspaceMenu
    for _, b in ipairs(menu.buttons) do b:Hide() end
    local choices = {{id="",name="All workspaces"}}
    for _, w in ipairs(RG.data and RG.data.workspaces or {}) do table.insert(choices, w) end
    for i, w in ipairs(choices) do
        local b = menu.buttons[i]
        if not b then b = button(menu.body, "", 230, function() end); menu.buttons[i] = b end
        b:SetPoint("TOPLEFT", 0, -(i-1)*30); b:SetText(safe(w.name .. (w.count and " ("..w.count..")" or "")))
        b:SetScript("OnClick", function()
            self.workspaceFilter = w.id; self.workspaceButton:SetText(safe(w.name)); menu:Hide(); self.listScroll:SetVerticalScroll(0); self:RenderList()
        end); b:Show()
    end
    menu.body:SetHeight(#choices * 30); menu:Show()
end
function U:ActionResult(sent, ack)
    self:SetNotice(ack.message or "Companion acknowledged the action.")
    if ack.state == "ok" and (sent.op == "message" or sent.op == "answer" or sent.op == "new") then
        local mode = sent.op == "answer" and "answer" or "message"
        local drafts = mode == "answer" and RoamgateDB.answerDrafts or RoamgateDB.drafts
        if drafts and drafts[sent.pane] == sent.text then drafts[sent.pane] = "" end
        if self.draftPane == sent.pane and self.draftMode == mode and self.composer:GetText() == sent.text then self.composer:SetText("") end
        if sent.op == "new" and ack.pane then self.newMode = false; RG:Select(ack.pane) end
    end
end
function U:RenderList()
    if not self.list then return end
    local data = RG.data or {}; local filtered = {}; local query = (self.search:GetText() or ""):lower()
    local signature = query .. self.filter .. (self.workspaceFilter or "") .. (RG.selected or "")
    for _, a in ipairs(data.agents or {}) do signature = signature .. a.pane .. (a.status or "") .. a.title .. a.workspace .. (a.tab or "") .. a.kind end
    if signature == self.lastList then return end
    self.lastList = signature
    for _, r in ipairs(self.rows) do r:Hide() end
    for _, a in ipairs(data.agents or {}) do
        if (not self.workspaceFilter or self.workspaceFilter == "" or a.workspaceId == self.workspaceFilter) and (self.filter == "all" or a.status == "blocked") and (a.title .. " " .. a.workspace .. " " .. a.kind .. " " .. (a.tab or "")):lower():find(query, 1, true) then table.insert(filtered, a) end
    end
    table.sort(filtered, function(a, b)
        local x, y = ORDER[a.status] or 5, ORDER[b.status] or 5
        if x ~= y then return x < y end
        if a.workspace ~= b.workspace then return a.workspace < b.workspace end
        return a.pane < b.pane
    end)
    local y, group = 0, nil
    for i, a in ipairs(filtered) do
        local r = self.rows[i]
        if not r then
            r = CreateFrame("Button", nil, self.list, "BackdropTemplate"); r:SetSize(235, 74)
            r:SetBackdrop({bgFile="Interface\\Buttons\\WHITE8X8", edgeFile="Interface\\Tooltips\\UI-Tooltip-Border", edgeSize=12})
            r.heading = label(r, 10); r.heading:SetPoint("TOPLEFT", 6, -1)
            r.title = label(r, 14, {0.88,0.85,0.73}, "Fonts\\ARIALN.TTF"); r.title:SetPoint("TOPLEFT", 10, -20); r.title:SetWidth(215); r.title:SetHeight(34)
            r.meta = label(r, 11, BLUE, "Fonts\\ARIALN.TTF"); r.meta:SetPoint("BOTTOMLEFT", 10, 7); r.meta:SetWidth(215); r.meta:SetHeight(14)
            r:SetScript("OnClick", function(row) RG:Select(row.pane); self:Navigate("terminal", "") end)
            r:SetScript("OnEnter", function(self)
                GameTooltip:SetOwner(self, "ANCHOR_RIGHT"); GameTooltip:AddLine(safe(self.fullTitle), 0.85, 0.72, 0.42, true); GameTooltip:AddLine(safe(self.cwd), 0.7, 0.7, 0.7, true); GameTooltip:AddLine(self.pane, 0.45, 0.7, 0.8); GameTooltip:Show()
            end); r:SetScript("OnLeave", function() GameTooltip:Hide() end)
            self.rows[i] = r
        end
        r.pane, r.fullTitle, r.cwd = a.pane, a.title, a.cwd
        r:SetPoint("TOPLEFT", 0, -y); r:Show()
        r.heading:SetText(group ~= a.status and ("|c" .. (COLORS[a.status] or COLORS.unknown) .. (LABELS[a.status] or "UNKNOWN") .. "|r") or "")
        r.title:SetText(safe(a.title)); r.meta:SetText(safe(a.workspace .. " · " .. a.kind))
        local selected = a.pane == RG.selected
        r:SetBackdropColor(selected and 0.25 or 0.06, selected and 0.21 or 0.07, selected and 0.12 or 0.08, selected and 0.75 or 0.35)
        r:SetBackdropBorderColor(selected and 0.78 or 0.20, selected and 0.65 or 0.20, selected and 0.32 or 0.18, selected and 1 or 0.4)
        y, group = y + 78, a.status
    end
    self.list:SetHeight(math.max(1, y))
    if not self.empty then self.empty = label(self.list, 14, {0.65,0.65,0.61}, "Fonts\\ARIALN.TTF"); self.empty:SetPoint("TOPLEFT", 12, -16); self.empty:SetWidth(210) end
    self.empty:SetText(RG.data and "No matching agent sessions." or "Your sessions will appear here when the companion connects.")
    self.empty:SetShown(#filtered == 0)
end
function U:RenderContent()
    if not self.content then return end
    local s = RG.data and RG.data.selected
    if s and s.pane ~= RG.selected then s = nil end
    local entries = {}
    if not RG.selected then entries = {{role="guide", text="Your workspace, a portal away.\n\nSelect a session on the left to read its conversation, send work, or answer a question. Your messages go to the same agent you use in Roamgate.\n\nThe minimap badge lights up when a session needs you."}}
    elseif not s then entries = {{role="guide", text="Opening the selected session...\n\nThe companion will bring its latest conversation and terminal into this panel."}}
    elseif self.view == "files" or self.view == "file" or self.view == "changes" or self.view:match("^diff:") then
        local browser = RG.data.browser
        if not browser or browser.view ~= self.view or browser.path ~= (RG.browsePath or "") then
            entries = {{role="guide",text="Loading this workspace view..."}}
        elseif browser.loading then entries = {{role="guide",text="Loading this workspace view..."}}
        elseif browser.error then entries = {{role="guide",text=browser.error}}
        else
            entries = {{role="workspace",text=(browser.root or "") .. "\n" .. (browser.path or "")}}
            if self.view == "file" or self.view == "files" then
                if browser.path ~= "" then table.insert(entries, {role="navigate",text="< Up to containing folder",link={view="files",path=browser.path:gsub("/?[^/]+/?$", "")}}) end
            elseif self.view:match("^diff:") then table.insert(entries,{role="navigate",text="< Back to changed files",link={view="changes",path=""}}) end
            for _, item in ipairs(browser.entries or {}) do
                local dir = item.type == "directory"
                local target = item.type == "diff" and ("diff:" .. item.kind) or (dir and "files" or "file")
                local title = (dir and "[Folder] " or "") .. item.name
                if item.type == "diff" then title = title .. "  ·  " .. item.status .. "  +" .. (item.additions or 0) .. " / -" .. (item.deletions or 0) end
                table.insert(entries,{role=dir and "folder" or item.type,text=title,link={view=target,path=item.path}})
            end
            if self.view == "file" or self.view:match("^diff:") then
                local text = browser.binary and "Binary file: a text preview is not available in this panel." or browser.text
                if browser.truncated then text = text .. "\n\n[Preview truncated. Open the full file in Roamgate.]" end
                table.insert(entries,{role="source",text=text ~= "" and text or "(Empty file or no textual changes.)"})
            elseif #(browser.entries or {}) == 0 then table.insert(entries,{role="guide",text=self.view == "changes" and "No uncommitted changes." or "This folder is empty."}) end
        end
    elseif self.view == "terminal" or self.view == "questions" then
        entries = {{role = self.QuestionMode(s) == "visible" and "question" or "terminal", text = self.view == "questions" and (s.questionScreen or s.screen) or s.screen}}
    elseif #s.entries > 0 then entries = s.entries
    else entries = {{role="fallback", text=s.transcript or s.screen}} end
    local question = self.QuestionMode(s)
    self.contentStatus:SetText(question == "queued" and "Question waiting in the agent's tray · click Questions to open it. Your task draft is saved." or (self.draftMode == "answer" and "Answer draft · paste, review, then Confirm / Enter. Your task draft is saved separately." or (s and (self.view == "conversation" and safe(s.historyStatus) or (s.cached and "Saved view · refreshing..." or "")) or "")))
    local location = self.view .. (RG.selected or "") .. (RG.browsePath or "")
    local key = location .. tostring(self.content:GetWidth())
    for _, e in ipairs(entries) do key = key .. e.role .. e.text end
    if self.lastContent == key then return end
    self.lastContent = key
    local saved = self.contentLocation ~= location and self.scrollPositions[location] or nil
    local nearBottom = saved and saved.bottom or (self.contentLocation == location and self.scroll:GetVerticalScrollRange() - self.scroll:GetVerticalScroll() < 45)
    if self.contentLocation ~= location and not saved then nearBottom = self.view == "conversation" or self.view == "terminal" end
    self.contentLocation = location
    for _, f in ipairs(self.messageFrames) do f:Hide() end
    local y, width = 0, math.max(280, self.content:GetWidth() - 14)
    for i, e in ipairs(blocks(entries)) do
        local m = self.messageFrames[i]
        if not m then
            m = CreateFrame("Button", nil, self.content)
            m.role = label(m, 11); m.role:SetPoint("TOPLEFT", 3, 0)
            m.text = label(m, 16, {0.89,0.88,0.82}, "Fonts\\ARIALN.TTF"); m.text:SetPoint("TOPLEFT", 3, -22); m.text:SetSpacing(4)
            m.rule = m:CreateTexture(nil, "ARTWORK"); m.rule:SetHeight(1); m.rule:SetColorTexture(0.38,0.34,0.23,0.35); m.rule:SetPoint("BOTTOMLEFT", 0, 7); m.rule:SetPoint("BOTTOMRIGHT", 0, 7)
            self.messageFrames[i] = m
        end
        m:SetPoint("TOPLEFT", 0, -y); m:SetWidth(width)
        local role = e.continuation and "" or (({user="YOU",assistant="AGENT",question="CURRENT QUESTION · EXACT TERMINAL VIEW",terminal="LIVE TERMINAL",fallback="RECENT TERMINAL · HISTORY NOT LINKED",guide="ROAMGATE"})[e.role] or e.role:upper())
        m.role:SetText(role); m.role:SetTextColor(unpack(e.role == "user" and BLUE or GOLD))
        local mono = self.view == "terminal" or self.view == "questions" or e.role == "source" or e.role == "fallback"
        m.text:SetFont(mono and "Interface\\AddOns\\Roamgate\\Media\\Mono.ttf" or "Fonts\\ARIALN.TTF", mono and 13 or 16, "")
        m.text:SetPoint("TOPLEFT", 3, e.continuation and 0 or -22); m.text:SetWordWrap(true); m.text:SetNonSpaceWrap(true)
        m.text:SetTextColor(unpack(e.link and BLUE or {0.89,0.88,0.82}))
        m:SetScript("OnClick", e.link and function() self:Navigate(e.link.view,e.link.path) end or nil)
        m.text:SetWidth(width - 6); m.text:SetText(safe(e.text)); local h = m.text:GetStringHeight() + (e.continuation and 18 or 48)
        m.rule:SetShown(not e.continuation)
        m:SetHeight(h); m:Show(); y = y + h
    end
    self.content:SetHeight(math.max(1, y))
    if nearBottom then self.scroll:SetVerticalScroll(math.max(0, y - self.scroll:GetHeight()))
    elseif saved then self.scroll:SetVerticalScroll(math.min(saved.offset, math.max(0,y-self.scroll:GetHeight())))
    elseif self.lastLocation ~= location then self.scroll:SetVerticalScroll(0) end
    self.lastLocation = location
    local activeTab = self.view == "file" and "files" or (self.view:match("^diff:") and "changes" or self.view)
    for key2, b in pairs(self.tabs) do if key2 == activeTab and not (key2 == "questions" and question == "queued") then b:Disable() else b:Enable() end end
end
function U:Refresh()
    if not self.frame then return end
    local data = RG.data or {}; local s = data.selected
    if s and s.pane ~= RG.selected then s = nil end
    self.sessionTitle:SetText(s and safe(s.title) or (RG.selected and "Opening session..." or "Welcome to Roamgate"))
    self.breadcrumb:SetText(s and safe(s.workspace .. "  /  " .. s.kind .. "  /  " .. s.cwd) or "Connected to the work you already have in progress")
    local blocked = self.QuestionMode(s) ~= "none"
    self.controls:SetShown(blocked and not self.newMode)
    self.newButton:SetText(self.newMode and "Cancel new" or "New chat"); self.kindButton:SetShown(self.newMode or false)
    self.kindButton:SetText(self.newKind or "codex")
    if blocked and self.view == "conversation" and self.lastBlockedPane ~= s.pane then self.view = "questions"; self.lastContent = nil end
    self.lastBlockedPane = blocked and s.pane or nil
    self:SyncComposer()
    self.send:SetText(self.newMode and "Start chat" or (self.draftMode == "answer" and "Paste answer" or (blocked and "Review question" or "Send message")))
    self:RenderList(); self:RenderContent(); self:UpdateStatus(); self:TryOpenQuestion()
end
function U:UpdateStatus()
    if not self.connection then return end
    local data = RG.data or {}; local fresh = RG.Transport:IsFresh(); local n, working = 0, 0
    for _, a in ipairs(data.agents or {}) do if a.status == "blocked" then n = n + 1 elseif a.status == "working" then working = working + 1 end end
    self.badge:SetText(n > 0 and tostring(n) or "")
    self.connection:SetText(fresh and (data.mode == "interactive" and "|cff84c99dConnected to this machine|r" or "Read-only connection") or "|cffffc45cWaiting for companion|r")
    self.summary:SetText(n .. " need you  ·  " .. working .. " working  ·  " .. math.max(0, RG.SLOT_COUNT - RG.Transport.slot + 1) .. " updates left")
    local s = data.selected
    local ready = fresh and data.mode == "interactive" and s and s.pane == RG.selected and not s.cached and not RG.Transport.pending and not RG.Transport.exhausted
    self.send:SetEnabled(ready and (self.newMode or s.activeAgent ~= false) and true or false); self.newButton:SetEnabled(ready and true or false)
    self.stop:SetEnabled(ready and s.status == "working" or false)
    local question = self.QuestionMode(s)
    for _, b in ipairs(self.keyButtons) do b:SetEnabled(ready and (b.questionKey == "shift+left" and question == "queued" or b.questionKey ~= "shift+left" and question == "visible") or false) end
    self.confirm:SetEnabled(ready and question == "visible" or false)
    self.reload:SetEnabled(not InCombatLockdown() and not RG.Transport.pending)
    if RG.Transport.pending and GetTime() - RG.Transport.pendingAt > 25 then self:SetNotice("No acknowledgement yet. Your action is retained; it will not be sent twice. Check the companion.") end
    self:UpdateHUD()
end
function U:Notify(agent)
    local text = agent.workspace .. " · " .. agent.title .. (agent.status == "blocked" and " needs you." or " finished.")
    if self.unread and (RG.selected ~= agent.pane or not self:IsShown()) then self.unread[agent.pane] = {title=text,at=GetTime()} end
    self:UpdateHUD()
    if InCombatLockdown() then self.queuedNotice = text; return end
    self:SetNotice(text); print("|cffd8b76aRoamgate:|r " .. safe(text))
    if not RoamgateDB.quiet then PlaySound(SOUNDKIT.IG_MAINMENU_OPTION_CHECKBOX_ON, "Master") end
end
