const { populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const { getPlayerDBData,} = require("../firebaseTools")
const { simulateCPUSPAssign, simulateCPUAbilityAssign, clone, runEnemyCombatAI} = require("../tools.js")

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
        getSession:true
    },
    data:{
        name:"raidMission"
    },
    execute(interaction,componentConfig,callback){
        
        let session = componentConfig.session
        
        let missionType = session.session_data.town.raid.missions[2][0].type

        let newSession,fighters,additionalLevels;
        switch(componentConfig.args[0]){
            case "0":
                switch(missionType){
                    case 0:
                         
                    let wallUnit = {
                        object: true,
                        name:  "Town Wall",
                        id: "wall",
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        skillpoints:0,
                        lives:1,
                        abilities:[],
                        level:1,
                        totalExp:0,
                        stats:{
                            "hp":150,
                            "atk":0,
                            "def":10,
                            "spatk":0,
                            "spdef":10,
                            "spd":0
                        }
                    }
        
                    let enemy = {
                        name:"Raiding Creature",
                        id:Math.floor(Math.random() * 1000),
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        skillpoints:0,
                        lives:1,
                        abilities:[],
                        level:12,
                        totalExp:0,
                        stats:{
                            "hp":22,
                            "atk":11,
                            "def":11,
                            "spatk":11,
                            "spdef":11,
                            "spd":11
                        }
                    }
        
                    enemy = simulateCPUAbilityAssign(enemy,[],5)
                    additionalLevels = 3 + Math.floor(Math.random() * 5)
                    enemy.level += additionalLevels
        
                    fighters = [
                        session.session_data.player,
                        wallUnit,
                        simulateCPUSPAssign(clone(enemy),additionalLevels * 6),
                        simulateCPUSPAssign(clone(enemy),additionalLevels * 6)
                    ]
        
                    newSession = {
                        type:"combat",
                        session_id: Math.floor(Math.random() * 100000),
                        user_ids:session.user_ids,
                        server_id:interaction.guildId,
                        session_data:populateCombatData(fighters,{
                            fightType:"pve",
                            alliances:[0,0,1,1],
                            canFlee:false,
                            raidMission:{
                                missionLevel:0,
                                type:0
                            },
                            events:[
                                {
                                    type:1,
                                    data:{
                                        staticData:{
                                            id:"wall"
                                        }
                                    },
                                    result:"win_1"
                                },
                                {
                                    type:0,
                                    data:{
                                        count:10
                                    },
                                    result:"win_0"
                                },
                                {
                                    type:1,
                                    data:{
                                        team:1    
                                    },
                                    result:"respawn"
                                }
                            ],
                            triggers:{
                                respawn:{
                                    actionType:0,
                                    data:{
                                        units:[
                                            {
                                                chance:100,
                                                obj:{
                                                    unit:simulateCPUSPAssign(clone(enemy),additionalLevels),
                                                    alliance:1
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        })
                    } 
                    break;
        
                    case 1:
            
                        let largeEnemy = {
                            name:"Large Enemy",
                            id:"large",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            skillpoints:0,
                            lives:1,
                            abilities:[],
                            level:50,
                            totalExp:0,
                            stats:{
                                "hp":200,
                                "atk":30,
                                "def":100,
                                "spatk":30,
                                "spdef":100,
                                "spd":50
                            }
                        }
            
                        largeEnemy = simulateCPUAbilityAssign(largeEnemy,[],8)
            
                        fighters = [
                            session.session_data.player,
                            clone(largeEnemy)
                        ]
            
                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:false,
                                raidMission:{
                                    missionLevel:0,
                                    type:1
                                },
                                events:[
                                    {
                                        type:2,
                                        data:{
                                            staticData:{
                                                id:"large"
                                            },
                                            records:{
                                                timesHit:15
                                            }
                                        },
                                        result:"win_0"
                                    }
                                ]
                            })
                        }
                        break;
                    
                    case 2:
                        let rallyPoint = {
                            name:"Enemy Beacon",
                            object: true,
                            id:"beacon",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            skillpoints:0,
                            lives:1,
                            abilities:[],
                            level:20,
                            totalExp:0,
                            stats:{
                                "hp":75,
                                "atk":0,
                                "def":40,
                                "spatk":0,
                                "spdef":40,
                                "spd":1
                            }
                        }
        
                        let rallyEnemy = {
                            name:"Raiding Creature",
                            id:"large",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            skillpoints:0,
                            lives:1,
                            abilities:[],
                            level:20,
                            totalExp:0,
                            stats:{
                                "hp":10,
                                "atk":5,
                                "def":5,
                                "spatk":5,
                                "spdef":5,
                                "spd":5
                            }
                        }
            
                        rallyEnemy = simulateCPUAbilityAssign(rallyEnemy,[],7)
            
                        fighters = [
                            session.session_data.player,
                            simulateCPUSPAssign(clone(rallyEnemy),19 * 6),
                            clone(rallyPoint),
                            simulateCPUSPAssign(clone(rallyEnemy),19 * 6)
                        ]
            
        
                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1,1],
                                canFlee:false,
                                raidMission:{
                                    missionLevel:0,
                                    type:2
                                },
                                events:[
                                    {
                                        type:1,
                                        data:{
                                            staticData:{
                                                id:"beacon"
                                            }
                                        },
                                        result:"win_0"
                                    }
                                ]
                            })
                        }
                        break;
        
                }
                
                break;
            
            case "1":
                let raidBoss = clone(session.session_data.town.raid.leader.unit)
    
                raidBoss = simulateCPUAbilityAssign(raidBoss,[],8)
    
                fighters = [
                    session.session_data.player,
                    clone(raidBoss)
                ]
    
                newSession = {
                    type:"combat",
                    session_id: Math.floor(Math.random() * 100000),
                    user_ids:session.user_ids,
                    server_id:interaction.guildId,
                    session_data:populateCombatData(fighters,{
                        fightType:"pve",
                        alliances:[0,1],
                        canFlee:false,
                        raidMission:{
                            missionLevel:1,
                            type:0
                        },
                        events:[
                            {
                                type:1,
                                data:{
                                    staticData:{
                                        id:"raidBoss"
                                    }
                                },
                                result:"win_0"
                            },
                        ],
                        combatRewards:{
                            raidBossClear:true
                        }
                    })
                }
                
                break;
        }
        
        runEnemyCombatAI(newSession.session_data.fighters)

        interaction.update({
            content:" ",
            components:populateCombatControls(newSession),
            embeds:populateCombatWindow(newSession)
        })

        callback({
            addSession: newSession,
            removeSession: session
        })
    }
}