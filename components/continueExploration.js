const { populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const { runEnemyCombatAI, weightedRandom, simulateCPUSPAssign, simulateCPUAbilityAssign, clone, capitalize } = require("../tools")
const data = require("../data.json")

function getMobsFromRegions(mobList,regions,encounterTag){
    let returnList = []
    for(mob of mobList){
        if(regions.includes(mob.region) && mob.encounterTags.includes(encounterTag)){
            returnList.push(mob)
        }
    }
    return returnList
}

module.exports = {
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
    data:{
        name:"continueExploration"
    },
    execute(interaction,componentConfig,callback){
        let townData = componentConfig.townData
        let playerData = componentConfig.playerData
        let fighters, newSession;
        let now = new Date()
        if(playerData.lastEncounter){
            comboEncounter = now.getTime() > playerData.lastEncounter && now.getTime() <= playerData.lastEncounter + 60000
        } else {
            comboEncounter = false
        }
        if(!playerData.exploreStreak){
            playerData.exploreStreak = 0
        }
        if(comboEncounter){
            playerData.exploreStreak++
        } else {
            playerData.exploreStreak = 1
        }

        let encounterType;
        if(playerData.exploreStreak >= 6){
            playerData.exploreRegion = townData.regions[Math.floor(Math.random() * 2)]    
            encounterType = weightedRandom([
                {
                    chance:30,
                    obj:0
                },
                {
                    chance:20,
                    obj:1
                },
                {
                    chance:25,
                    obj:2
                },
                {
                    chance:25,
                    obj:3
                },
            ])
            if(playerData.leaderEncounter <= 0){
                encounterType = weightedRandom([
                    {
                        chance:50,
                        obj:2
                    },
                    {
                        chance:50,
                        obj:3
                    }
                ])
            }
        } else {
            encounterType = weightedRandom([
                {
                    chance:25,
                    obj:0
                },
                {
                    chance:55,
                    obj:1
                },
                {
                    chance:12,
                    obj:2
                },
                {
                    chance:8,
                    obj:3
                },
            ])
        }
        
        let enemies = []
        switch(encounterType){
            case 0:
                enemies = [
                    {
                        allowance:8,
                        statLevel:1.25,
                        intelligence:{
                            reuse:0.3
                        }
                    }
                ]
                break;
            case 1:
                enemies = [
                    {
                        allowance:6,
                        statLevel:1,
                        intelligence:{
                            reuse:0.3
                        }
                    }
                ]
                break;
            case 2:
                enemies = [
                    {
                        allowance:5,
                        statLevel:0.55,
                        intelligence:{
                            reuse:0.4
                        }
                    },
                    {
                        allowance:5,
                        statLevel:0.55,
                        intelligence:{
                            reuse:0.4
                        }
                    }
                ]
                break;
            case 3:
                enemies = [
                    {
                        allowance:4,
                        statLevel:0.4,
                        intelligence:{
                            reuse:0.5
                        }
                    },
                    {
                        allowance:4,
                        statLevel:0.4,
                        intelligence:{
                            reuse:0.5
                        }
                    },
                    {
                        allowance:4,
                        statLevel:0.4,
                        intelligence:{
                            reuse:0.5
                        }
                    }
                ]
                break;
        }

        
        fighters = [playerData]
        for(e in enemies){
            let enemyScalar = 1 + playerData.exploreStreak * 0.05
            let lifeCount = weightedRandom([
                {
                    chance:75,
                    obj:1
                },
                {
                    chance:20,
                    obj:2
                },
                {
                    chance:5,
                    obj:3
                }
            ])
            enemyScalar /= lifeCount
            let enemy = enemies[e]
            enemy.statLevel += playerData.exploreStreak * 0.05
            let mobs;
            if(playerData.exploreStreak > 5){
                mobs = getMobsFromRegions(data.creatures,[playerData.exploreRegion],"base")
            } else {
                mobs = getMobsFromRegions(data.creatures,townData.regions,"wild")
            }
            let index = Math.floor(Math.random() * mobs.length)
            let mob = clone(mobs[index])
            let nameTag = mob.normTag;
            let statLevel = enemy.statLevel * enemyScalar
            let rare = false;
            if(Math.ceil(Math.random() * 100) > 80){
                statLevel *= 1.20
                nameTag = mob.rareTag
                rare = true
            }
            let allowance = Math.ceil(enemy.allowance * enemyScalar)
            let intelligence = enemy.intelligence
            enemy = {
                rareVar: rare,
                name:  nameTag + " " + mob.Name,
                id:Math.floor(Math.random() * 1000),
                cpu:true,
                tele:0.75,
                intelligence:intelligence,
                stance:"none",
                race:"0",
                combatStyle:"0",
                exp:0,
                abilitypoints:0,
                statpoints:0,
                lives:lifeCount,
                abilities:[],
                level:0,
                totalExp:0,
                stats:{
                    "hp":10,
                    "atk":5,
                    "def":5,
                    "spatk":5,
                    "spdef":5,
                    "spd":5
                },
                lootPoint:true,
                weakPoint:true,
                region:mob.region
            }
            let statPoints = Math.ceil(((playerData.level) * 8) * statLevel)
            enemy = simulateCPUSPAssign(enemy,statPoints,mob)
            enemy = simulateCPUAbilityAssign(enemy,mob.innateAbilities,Math.ceil(allowance * (1 + playerData.level/10)))                    

            if(mob.encounterTags.includes("base")){
                enemy.droptable = data.standardDroptables.baseWild
            } else {
                enemy.droptable = data.standardDroptables.basicWild
            }   
            

            fighters.push(enemy)
        }
        
        let alliances = [0]
        for(var i = 0; i < enemies.length; i++){
            alliances.push(1)
        }

        if(playerData.leaderEncounter <= 0 && playerData.exploreStreak > 6){
            let leaderScalar = {
                "atk": 1,
                "spatk": 1,
                "spd": 1,
                "def": 1,
                "spdef": 1,
                "hp": 1.25,
            }
            let leader = {
                name: capitalize(playerData.exploreRegion) + " Settlement Leader",
                id:"leader",
                tele:0.5,
                cpu:true,
                stance:"none",
                race:"0",
                combatStyle:"0",
                exp:0,
                abilitypoints:0,
                statpoints:0,
                lives:2,
                abilities:[],
                level:0,
                totalExp:0,
                stats:{
                    "hp":10,
                    "atk":5,
                    "def":5,
                    "spatk":5,
                    "spdef":5,
                    "spd":5
                },
                lootPoint:true,
                weakPoint:true
            }
            let statLevel = 1.5 * (1 + (20 * 0.075))
            let statPoints = Math.ceil(((playerData.level) * 8) * statLevel)
            leader = simulateCPUSPAssign(leader,statPoints,leaderScalar)
            leader = simulateCPUAbilityAssign(leader,[],Math.ceil(8 * (1 + playerData.level/10))) 
            leader.droptable = data.standardDroptables.settlementLeader
            fighters.push(leader)
            alliances.push(1)
            
        }

        newSession = {
            type:"combat",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[interaction.user.id],
            server_id:interaction.guildId,
            session_data:populateCombatData(fighters,{
                fightType:"pve",
                alliances:alliances,
                canFlee:true,
                canPerfect:true,
                freeExplore:true
            })
        }

        if(playerData.leaderEncounter <= 0 && playerData.exploreStreak > 6){
            newSession.session_data.battlelog.alerts.push("The settlement leader has come to confront you!")
            newSession.session_data.options.settlementBattle = true
        }
        
        if(playerData.exploreStreak == 6){
            newSession.session_data.battlelog.alerts.push("You seem to have stumbled upon a " + playerData.exploreRegion.toLowerCase() + " settlement. Enemies will likely be tougher, but may drop more valuable rewards.")
        } 

        runEnemyCombatAI(newSession.session_data.fighters)

        interaction.update({
            content:" ",
            components:populateCombatControls(newSession),
            embeds:populateCombatWindow(newSession)
        })
        
        callback({
            addSession:newSession
        })
    }
}