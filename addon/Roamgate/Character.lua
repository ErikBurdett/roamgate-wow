local _, RG = ...
local C = {}; RG.Character = C
local function call(fn, ...)
    if type(fn) ~= "function" then return nil end
    local result = {pcall(fn, ...)}
    if result[1] then return unpack(result, 2, #result) end
end
local function clean(value)
    return tostring(value or ""):gsub("|T.-|t", ""):gsub("|A.-|a", ""):gsub("|H.-|h(.-)|h", "%1"):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("[%z\1-\8\11-\31\127]", "")
end
local function cut(text, limit)
    if #text <= limit then return text end
    while limit > 0 and (text:byte(limit+1) or 0) >= 128 and (text:byte(limit+1) or 0) < 192 do limit = limit - 1 end
    return text:sub(1,limit)
end
C.Clean, C.Cut = clean, cut
function C:Key()
    return call(UnitGUID,"player") or ("name:" .. clean(call(UnitName,"player")) .. "@" .. clean(call(GetRealmName)))
end
function C:Collect()
    local version, build = call(GetBuildInfo)
    local s={key=self:Key(),name=clean(call(UnitName,"player")),realm=clean(call(GetRealmName)),level=call(UnitLevel,"player") or 0,class=clean(call(UnitClass,"player")),race=clean(call(UnitRace,"player")),faction=clean(call(UnitFactionGroup,"player")),zone=clean(call(GetZoneText)),subzone=clean(call(GetSubZoneText)),version=clean(version),build=clean(build),quests={},gear={}}
    local map = C_Map and call(C_Map.GetBestMapForUnit,"player")
    local position = map and call(C_Map.GetPlayerMapPosition,map,"player")
    if position then local x,y=call(position.GetXY,position);if x and y then s.coordinates=string.format("%.1f, %.1f (map %s)",x*100,y*100,tostring(map)) end end
    local health,maximum=call(UnitHealth,"player"),call(UnitHealthMax,"player")
    s.health=health and maximum and (tostring(health).." / "..tostring(maximum)) or "unavailable"
    local stats={};for i,name in ipairs({"Strength","Agility","Stamina","Intellect","Spirit"}) do local base,effective=call(UnitStat,"player",i);if effective or base then table.insert(stats,name.." "..tostring(effective or base)) end end;s.stats=table.concat(stats,", ")
    for i=1,19 do if i~=4 then local link=call(GetInventoryItemLink,"player",i);if link then table.insert(s.gear,clean(link).." (item "..(link:match("item:(%d+)") or "?")..")") end end end
    local count = (C_QuestLog and call(C_QuestLog.GetNumQuestLogEntries)) or call(GetNumQuestLogEntries) or 0
    s.questAPI = count > 0 or type(GetNumQuestLogEntries)=="function" or (C_QuestLog and type(C_QuestLog.GetNumQuestLogEntries)=="function")
    for i=1,math.min(count,150) do
        local info=C_QuestLog and call(C_QuestLog.GetInfo,i)
        if not info then
            local title,level,group,header,collapsed,complete,daily,id=call(GetQuestLogTitle,i)
            if title then info={title=title,level=level,isHeader=header,isComplete=complete,questID=id} end
        end
        if info and not info.isHeader then
            local q={id=info.questID or 0,title=clean(info.title),level=info.level or 0,complete=info.isComplete==true or info.isComplete==1,objectives={}}
            q.key=q.id>0 and q.id or ("log:"..i)
            local objectives=C_QuestLog and q.id>0 and call(C_QuestLog.GetQuestObjectives,q.id)
            if objectives then for _,o in ipairs(objectives) do table.insert(q.objectives,clean(o.text)..(o.finished and " [complete]" or "")) end
            else for j=1,(call(GetNumQuestLeaderBoards,i) or 0) do local text,kind,done=call(GetQuestLogLeaderBoard,j,i);if text then table.insert(q.objectives,clean(text)..(done and " [complete]" or "")) end end end
            table.insert(s.quests,q)
        end
    end
    s.summary=string.format("%s\nLevel %s %s %s\n%s · %s\n%s%s\nHealth %s",s.name,s.level,s.race,s.class,s.faction,s.realm,s.zone,s.subzone~="" and (" / "..s.subzone) or "",s.health)
    return s
end
function C:Text(s, questID)
    local lines={"Game: World of Warcraft Forever "..s.version.." (build "..s.build..")",s.summary,"Location: "..(s.coordinates or "coordinates unavailable"),"Stats: "..s.stats}
    local selected
    for _,q in ipairs(s.quests) do if q.key==questID then selected=q;break end end
    if selected then table.insert(lines,"Selected quest: ["..selected.id.."] "..selected.title.." (level "..selected.level..")");for _,o in ipairs(selected.objectives) do table.insert(lines,"  "..o) end end
    table.insert(lines,"Equipped items: "..table.concat(s.gear,", "))
    table.insert(lines,"Current quest log:")
    if not s.questAPI then table.insert(lines,"Quest API unavailable in this client; ask the player for the quest text.") end
    for _,q in ipairs(s.quests) do
        table.insert(lines,"["..q.id.."] "..q.title.." (level "..q.level..")"..(q.complete and " [complete]" or ""))
        if q~=selected then for _,o in ipairs(q.objectives) do table.insert(lines,"  "..o) end end
    end
    local text=table.concat(lines,"\n")
    return #text<=4900 and text or (cut(text,4840).."\n[Snapshot shortened; ask for a specific quest.]")
end
