local _, RG = ...
local Theme = {}; RG.Theme = Theme
function Theme.Label(parent, text, size, color)
    local f = parent:CreateFontString(nil, "OVERLAY")
    f:SetFont("Fonts\\FRIZQT__.TTF", size or 15, "")
    f:SetTextColor(unpack(color or {0.9,0.76,0.47})); f:SetJustifyH("LEFT"); f:SetJustifyV("TOP"); f:SetText(text or "")
    return f
end
function Theme.Panel(parent, name, paper)
    local f = CreateFrame("Frame", name, parent, "BackdropTemplate")
    f:SetBackdrop({bgFile="Interface\\Buttons\\WHITE8X8",edgeFile="Interface\\DialogFrame\\UI-DialogBox-Border",tile=true,tileSize=32,edgeSize=24,insets={left=6,right=6,top=6,bottom=6}})
    if paper then f:SetBackdropColor(0.74,0.64,0.43,1) else f:SetBackdropColor(0.055,0.04,0.027,0.99) end
    f:SetBackdropBorderColor(0.9,0.78,0.53,1)
    return f
end
function Theme.Button(parent, text, width, action)
    local b = CreateFrame("Button",nil,parent,"UIPanelButtonTemplate");b:SetSize(width,26);b:SetText(text);b:SetScript("OnClick",action);return b
end
function Theme.Book(frame, divider)
    frame:SetBackdrop({bgFile="Interface\\Buttons\\WHITE8X8",edgeFile="Interface\\DialogFrame\\UI-DialogBox-Border",tile=true,tileSize=32,edgeSize=32,insets={left=9,right=9,top=9,bottom=9}})
    frame:SetBackdropColor(0.09,0.055,0.033,1);frame:SetBackdropBorderColor(1,0.86,0.59,1)
    local leather=frame:CreateTexture(nil,"BACKGROUND",nil,1);leather:SetPoint("TOPLEFT",10,-10);leather:SetPoint("BOTTOMRIGHT",-10,10)
    leather:SetTexture("Interface\\DialogFrame\\UI-DialogBox-Background");leather:SetVertexColor(0.55,0.35,0.20,0.6)
    local rail=frame:CreateTexture(nil,"BORDER");rail:SetColorTexture(0.045,0.025,0.012,1)
    rail:SetPoint("BOTTOMLEFT",14,9);rail:SetPoint("BOTTOMRIGHT",-14,9);rail:SetHeight(30)
    for _,y in ipairs({9,39}) do local line=frame:CreateTexture(nil,"BORDER");line:SetColorTexture(0.55,0.38,0.16,0.8);line:SetHeight(1);line:SetPoint("BOTTOMLEFT",18,y);line:SetPoint("BOTTOMRIGHT",-18,y) end
    for _, right in ipairs({false,true}) do
        local cap=frame:CreateTexture(nil,"OVERLAY");cap:SetTexture("Interface\\MainMenuBar\\UI-MainMenuBar-EndCap-Dwarf");cap:SetSize(90,90)
        cap:SetPoint(right and "BOTTOMRIGHT" or "BOTTOMLEFT",frame,right and "BOTTOMRIGHT" or "BOTTOMLEFT",right and 35 or -35,-8)
        if right then cap:SetTexCoord(1,0,0,1) end
    end
    local spine=frame:CreateTexture(nil,"BORDER");spine:SetColorTexture(0.025,0.016,0.01,0.9);spine:SetWidth(12)
    spine:SetPoint("TOPLEFT",divider,-76);spine:SetPoint("BOTTOMLEFT",divider,42)
    for _, dx in ipairs({-2,12}) do local line=frame:CreateTexture(nil,"BORDER");line:SetColorTexture(0.62,0.43,0.18,0.9);line:SetWidth(1);line:SetPoint("TOPLEFT",divider+dx,-76);line:SetPoint("BOTTOMLEFT",divider+dx,42) end
    local seal=frame:CreateTexture(nil,"BORDER");seal:SetTexture("Interface\\SpellBook\\SpellBook-SkillLineTab");seal:SetSize(66,66);seal:SetPoint("TOPLEFT",14,-6)
end
function Theme.Page(frame, paper)
    local page=frame:CreateTexture(nil,"BACKGROUND",nil,1);page:SetPoint("TOPLEFT",9,-9);page:SetPoint("BOTTOMRIGHT",-9,9)
    page:SetTexture("Interface\\QuestFrame\\QuestBG");page:SetVertexColor(paper and 0.9 or 0.15,paper and 0.83 or 0.12,paper and 0.65 or 0.09,1)
    -- QuestBG has unused transparent atlas space; keep the parchment interior.
    page:SetTexCoord(0.06,0.55,0.06,0.55)
    return page
end
