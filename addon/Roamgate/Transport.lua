local _, RG = ...
local floor, char, byte, concat = math.floor, string.char, string.byte, table.concat
local COLS, ROWS, CELL, CHUNK = 128, 5, 4, 600
local T = { slot = 1, sequence = 0, receivedAt = 0, nonce = "", part = 0, elapsed = 0, loadElapsed = 0 }
RG.Transport = T

local function u32(n)
    return char(floor(n / 16777216) % 256, floor(n / 65536) % 256, floor(n / 256) % 256, n % 256)
end
local function u16(n) return char(floor(n / 256) % 256, n % 256) end
local function checksum(s)
    local a, b = 1, 0
    for i = 1, #s do a = (a + byte(s, i)) % 65521; b = (b + a) % 65521 end
    return b * 65536 + a
end
local function fields(list)
    local out = {}
    for i, value in ipairs(list) do value = tostring(value); out[i] = #value .. ":" .. value end
    return concat(out)
end
T.Checksum, T.Fields = checksum, fields

function T:Packet()
    local p = self.pending or {}
    local owner = (p.scope == "guide" or (not self.pending and RG.activeSurface == "guide")) and RG.Guide or RG
    local ui = owner.UI
    return fields({ self.nonce, self.slot, p.id or 0, p.op or "view", p.pane or owner.selected or "",
        p.terminal or "", p.proof or "", p.text or ui.view or "terminal", p.extra or owner.browsePath or "", ui:IsShown() and "1" or "0",
        owner == RG and "work" or "guide", owner == RG and "" or owner:CharacterKey(), p.provider or "", p.model or "" })
end
function T:Frame(body, part, serial)
    local count = math.ceil(#body / CHUNK)
    local chunk = string.sub(body, part * CHUNK + 1, (part + 1) * CHUNK)
    local header = "RGW1" .. u32(serial) .. char(part, count) .. u16(#chunk) .. u32(checksum(body)) .. u32(checksum(chunk)) .. u32(#body)
    local frame = header .. chunk
    return frame .. string.rep(char(0), COLS * ROWS - #frame)
end
function T:IsFresh(data)
    data = data or RG.latest or RG.data
    return self.receivedAt > 0 and GetTime() - self.receivedAt < 40 and data and math.abs(GetServerTime() - (data.timestamp or 0)) < 45
end
function T:RefreshSoon()
    if not self.pending then self.body, self.part = nil, 0 end
    self.elapsed = 0.24
    self.urgentUntil = GetTime() + 2
    self.loadElapsed = 0
end
function T:Send(op, text, extra, owner)
    owner = owner or RG
    local ui, data = owner.UI, owner.data
    if self.pending then ui:SetNotice("Waiting for the companion to acknowledge the last action."); return false end
    local s = data and data.selected
    local starting = owner == RG.Guide and (op == "guide_new" or op == "guide_select") and data and data.guideStartProof
    if not self:IsFresh(data) or (not starting and (not s or s.pane ~= owner.selected or not s.proof or s.cached)) then ui:SetNotice("Wait for a fresh view of this session before sending."); self:RefreshSoon(); return false end
    if data.mode ~= "interactive" then ui:SetNotice("The companion is in read-only mode."); return false end
    if #text > 6000 or #(extra or "") > 5000 then ui:SetNotice("Message or context is too long."); return false end
    self.sequence = self.sequence + 1
    self.pending = { id = self.sequence, op = op, text = text, extra = extra or "", pane = starting and "" or s.pane, terminal = starting and "" or s.terminal, proof = starting or s.proof, scope = owner == RG and "work" or "guide" }
    if op=="new" or op=="guide_new" then self.pending.provider=ui.newKind;self.pending.model=ui.newModel or "" end
    self.part, self.body, self.pendingAt = 0, nil, GetTime()
    self:RefreshSoon()
    ui:SetNotice(starting and (op=="guide_select" and "Opening guide conversation..." or "Opening your guide chat...") or ("Sending to " .. s.workspace .. " / " .. s.kind .. "..."))
    ui:UpdateStatus()
    return true
end
function T:Load()
    if self.slot > RG.SLOT_COUNT then
        self.exhausted = true; RG.UI:SetNotice("Update slots used. Reload UI when out of combat to reconnect."); return
    end
    _G.RoamgateInbox = nil
    local load = C_AddOns and C_AddOns.LoadAddOn or LoadAddOn
    local ok, reason = load(string.format("RoamgateData%04d", self.slot))
    self.slot = self.slot + 1
    if not self.pending then self.body, self.part = nil, 0 end
    local data = _G.RoamgateInbox; _G.RoamgateInbox = nil
    if ok and type(data) == "table" and data.nonce == self.nonce then
        self.receivedAt = GetTime()
        local ack = data.ack
        if self.pending and ack and ack.id == self.pending.id and ack.nonce == self.nonce then
            local sent = self.pending
            self.pending = nil
            if sent.scope == "guide" and RG.Guide then RG.Guide:ActionResult(sent, ack) else RG.UI:ActionResult(sent, ack) end
        end
        RG:Receive(data)
    elseif not ok then
        RG.UI:SetNotice("Update file unavailable (" .. tostring(reason) .. "). Check the companion and enabled Roamgate data addons.")
    end
    if self.slot == RG.SLOT_COUNT - 100 then print("|cffd8b76aRoamgate:|r 100 updates left. Reload UI at a convenient break.") end
end
function T:ApplyScale()
    local _, h = GetPhysicalScreenSize()
    self.strip:SetScale((768 / h) / UIParent:GetEffectiveScale())
end
function T:Start()
    for i = 1, 16 do self.nonce = self.nonce .. string.format("%x", math.random(0, 15)) end
    local f = CreateFrame("Frame", "RoamgateTransport", UIParent)
    self.strip = f
    f:SetFrameStrata("TOOLTIP"); f:SetFrameLevel(1000)
    self:ApplyScale(); f:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 0, 0)
    f:SetSize(COLS * 4, ROWS * 2); f:EnableMouse(false)
    self.cells = {}
    for i = 0, COLS * ROWS - 1 do
        local pair = {}
        for half = 0, 1 do
            local tex = f:CreateTexture(nil, "OVERLAY")
            tex:SetSize(2, 2); tex:SetPoint("TOPLEFT", f, "TOPLEFT", (i % COLS) * 4 + half * 2, -floor(i / COLS) * 2)
            tex:SetColorTexture(16 / 255, 16 / 255, 16 / 255, 1); tex:Hide()
            pair[half + 1] = tex
        end
        self.cells[i + 1] = pair
    end
    f:SetScript("OnUpdate", function(_, elapsed) self:Tick(elapsed) end)
end
function T:Tick(elapsed)
    self.elapsed, self.loadElapsed = self.elapsed + elapsed, self.loadElapsed + elapsed
    if self.elapsed >= 0.24 then
        self.elapsed = 0
        if not self.body or self.part >= math.ceil(#self.body / CHUNK) then self.part, self.body = 0, self:Packet() end
        local frame = self:Frame(self.body, self.part, self.pending and self.pending.id or 0)
        local used = 24 + math.min(CHUNK, #self.body - self.part * CHUNK)
        for i = 1, #frame do
            local n = byte(frame, i)
            for half = 1, 2 do
                local tex = self.cells[i][half]
                if i <= used then
                    local v = (16 + (half == 1 and floor(n / 16) or n % 16) * 14) / 255
                    tex:SetColorTexture(v, v, v, 1); tex:Show()
                else tex:Hide() end
            end
        end
        self.part = self.part + 1
    end
    local owner = RG.activeSurface == "guide" and RG.Guide or RG
    local selected = owner.data and owner.data.selected
    local interval = (self.pending or GetTime() < (self.urgentUntil or 0)) and 1 or (owner.UI:IsShown() and (RG.UI.QuestionMode(selected) ~= "none" and 3 or (selected and selected.status == "working" and 5 or 12)) or ((RG.UI.hud and RG.UI.hud:IsShown() and not RoamgateDB.hudCollapsed) and 12 or 30))
    if self.receivedAt == 0 then interval = 1.5 end
    if self.loadElapsed >= interval then
        self.loadElapsed = 0
        if not self.exhausted then self:Load() end
        RG.UI:UpdateStatus()
        if RG.Guide then RG.Guide:UpdateStatus() end
    end
end
