local RG = {}
assert(loadfile("addon/Roamgate/Transport.lua"))("Roamgate", RG)
local body = RG.Transport.Fields({"0123456789abcdef",1,1,"message","w1:p1","term","proof","Hello\n你好 | Héllo : \"\\","",1})
io.write(RG.Transport:Frame(body, 0, 1))
