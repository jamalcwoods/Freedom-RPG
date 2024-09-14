const { populateCloseInteractionMessage, populateCombatData, populateCombatWindow, populateCombatControls} = require("../sessionTools.js")
const data = require ("../data.json");
const { clone } = require("../tools.js")

module.exports = {
    config:{
        getSession:true,
        newPlayer:true
    },
    data:{
        name:"duelResponse"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let val = componentConfig.args[0]
        let response;
        if(interaction.user.id == session.user_ids[1]){
            if(val == "1"){ 
                response = "Duel Request Denied"
                interaction.update(populateCloseInteractionMessage(response,true))
                callback({
                    removeSession:session
                })
            } else {
                let fighter = {
                    name:"",
                    race:"0",
                    combatStyle:"0",
                    exp:0,
                    abilitypoints:0,
                    statpoints:0,
                    lives:parseInt(session.session_data.lifeCount),
                    abilities:[
                        {
                            "critical": 15,
                            "damage_type": "atk",
                            "damage_val": 40,
                            "name": "Physical Attack",
                            "speed": 1,
                            "faction": -1,
                            "action_type": "attack",
                            "numHits": 1,
                            "recoil": 0,
                            "targetType": "1",
                            "accuracy": 100
                        },
                        {
                            "action_type": "guard",
                            "name": "Guard",
                            "guard_val": 40,
                            "guard_type": "def",
                            "success_level": 100,
                            "counter_val": 100,
                            "counter_type": "def",
                            "speed": 3
                        },
                        {
                            "critical": 40,
                            "damage_type": "spatk",
                            "damage_val": 40,
                            "name": "Magic Attack",
                            "speed": 1,
                            "faction": -1,
                            "action_type": "attack",
                            "numHits": 1,
                            "recoil": 0,
                            "targetType": "1",
                            "accuracy": 70
                        },
                        {
                            "action_type": "stats",
                            "name": "Fortify",
                            "statChangeCount": 2,
                            "effects": [
                                {
                                    "target": "0",
                                    "stat": "def",
                                    "value": 1
                                },
                                {
                                    "target": "0",
                                    "stat": "spdef",
                                    "value": 2
                                },
                                {
                                    "target": "0",
                                    "stat": "spd",
                                    "value": -1
                                }
                            ],
                            "speed": 0
                        },
                        {
                            "action_type": "stats",
                            "name": "Empower",
                            "statChangeCount": 2,
                            "effects": [
                                {
                                    "target": "0",
                                    "stat": "atk",
                                    "value": 1
                                },
                                {
                                    "target": "0",
                                    "stat": "spatk",
                                    "value": 1
                                }
                            ],
                            "speed": 1
                        }, {
                            "critical": 5,
                            "damage_type": "atk",
                            "damage_val": 20,
                            "name": "Quick Attack",
                            "speed": 2,
                            "faction": -1,
                            "action_type": "attack",
                            "numHits": 1,
                            "recoil": 0,
                            "targetType": "1",
                            "accuracy": 100
                        }
                    ],
                    level:1,
                    totalExp:0,
                    stats:{
                        "hp":30,
                        "atk":25,
                        "def":5,
                        "spatk":25,
                        "spdef":5,
                        "spd":25
                    }
                }

                fighters = [
                    clone(fighter),
                    clone(fighter)
                ]

                fighters[0].name = session.session_data.names[0]
                fighters[0].id = session.user_ids[0]

                fighters[1].name = session.session_data.names[1]
                fighters[1].id = session.user_ids[1]

                let newSession = {
                    type:"combat",
                    session_id: Math.floor(Math.random() * 100000),
                    user_ids:session.user_ids,
                    session_data:populateCombatData(fighters,{
                        fightType:"pvp",
                        alliances:[0,1],
                        progressiveCombat:false,
                        canFlee:true,
                        showAbilityNames:true
                    })
                }

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
        } else if(interaction.user.id == session.user_ids[0] && val == "1"){
            response = "Duel Request Cancelled"
            interaction.update(populateCloseInteractionMessage(response,true))
            callback({
                removeSession:session
            })
        } else {
            interaction.reply({ content: 'Only the challenged player can accept a duel challenge', ephemeral: true });
        }
    }   
}