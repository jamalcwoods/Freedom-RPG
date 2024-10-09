const { populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const { getPlayerDBData } = require("../firebaseTools")
const { clone, runEnemyCombatAI, weightedRandom, simulateCPUSPAssign, simulateCPUAbilityAssign } = require("../tools")
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

function loadPlayerData(players,loadedData,callback){
    if(players[0]){
        getPlayerDBData(players[0],function(player){
            loadedData.push(player)
            players.splice(0,1)
            loadPlayerData(players,loadedData,callback)
        })
    } else {
        callback(loadedData)
    }
}

module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"startLobby"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(interaction.user.id == session.session_data.owner){
            if(session.session_data.players.length > 1){
                let lobbyPlayers = clone(session.session_data.players)
                let newSession;
                switch(session.session_data.lobbyType){
                    case "FFA":
                        loadPlayerData(lobbyPlayers,[],function(fighters){
                            newSession = {
                                type:"combat",
                                session_id: Math.floor(Math.random() * 100000),
                                user_ids:session.user_ids,
                                session_data:populateCombatData(fighters,{
                                    fightType:"pvp",
                                    lobby:session.session_id,
                                    returnSession:session.session_id,
                                    showAbilityNames:false
                                })
                            }
                            interaction.update({
                                content:" ",
                                components:populateCombatControls(newSession),
                                embeds:populateCombatWindow(newSession)
                            })

                            session.session_data.onHold = true

                            callback({
                                updateSession:session,
                                addSession:newSession
                            })
                        })
                        break;
                    case "WILD":
                        loadPlayerData(lobbyPlayers,[],function(fighters){
                            let encounterType = weightedRandom([
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
                            
                            let townData = session.session_data.townData
                            let lobbyLevel = 0

                            let alliances = []
                            for(var i = 0;i < fighters.length; i++){
                                alliances.push(0)
                                lobbyLevel += fighters[i].level
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
                                            ,
                                            expMulti:1.1
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
                                            },
                                            expMulti:1.25
                                        },
                                        {
                                            allowance:5,
                                            statLevel:0.55,
                                            intelligence:{
                                                reuse:0.4
                                            },
                                            expMulti:1.25
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
                                            },
                                            expMulti:1.5
                                        },
                                        {
                                            allowance:4,
                                            statLevel:0.4,
                                            intelligence:{
                                                reuse:0.5
                                            },
                                            expMulti:1.5
                                        },
                                        {
                                            allowance:4,
                                            statLevel:0.4,
                                            intelligence:{
                                                reuse:0.5
                                            },
                                            expMulti:1.5
                                        }
                                    ]
                                    break;
                            }
            
                            for(e in enemies){
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
                                let enemyScalar = 1/lifeCount
                                let enemy = enemies[e]
                                let mobs = getMobsFromRegions(data.creatures,townData.regions,"wild")
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
                                let allowance = enemy.allowance
                                let intelligence = enemy.intelligence
                                let expMulti = [null,1,2.25,3.5][lifeCount]
                                if(enemy.expMulti){
                                    expMulti *= enemy.expMulti
                                }
                                enemy = {
                                    rareVar: rare,
                                    name:  nameTag + " " + mob.Name,
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
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
                                        "hp":5,
                                        "atk":3,
                                        "def":3,
                                        "spatk":3,
                                        "spdef":3,
                                        "spd":3
                                    },
                                    lootPoint:true,
                                    weakPoint:true,
                                    region:mob.region,
                                    expMulti:expMulti
                                }
                                
                                let statPoints = Math.ceil(((lobbyLevel) * 8) * statLevel)
                                enemy = simulateCPUSPAssign(enemy,statPoints,mob)
                                enemy = simulateCPUAbilityAssign(enemy,mob.innateAbilities,Math.ceil(allowance * (1 + lobbyLevel/10)))                    
            
                                enemy.droptable = data.standardDroptables.basicWild
            
                                fighters.push(enemy)
                            }
                            for(var i = 0; i < enemies.length; i++){
                                alliances.push(1)
                            }
                            
                            newSession = {
                                type:"combat",
                                session_id: Math.floor(Math.random() * 100000),
                                user_ids:session.user_ids,
                                server_id:interaction.guildId,
                                session_data:populateCombatData(fighters,{
                                    fightType:"pve",
                                    alliances:alliances,
                                    canFlee:true,
                                    canPerfect:true,
                                    freeExplore:false,
                                    lobby:session.session_id,
                                    returnSession:session.session_id,
                                    showAbilityNames:false
                                })
                            }
                            
                            runEnemyCombatAI(newSession.session_data.fighters)

                            interaction.update({
                                content:" ",
                                components:populateCombatControls(newSession),
                                embeds:populateCombatWindow(newSession)
                            })

                            session.session_data.onHold = true

                            callback({
                                updateSession:session,
                                addSession:newSession
                            })
                        })
                        break;
                }
            } else {
                interaction.reply({ content: "Need more than 1 player to start a lobby", ephemeral: true });
            }
        } else {
            interaction.reply({ content: "Only the lobby owner may start a lobby", ephemeral: true });
        }
        
    }
}