
const {populateTownVisitControls, populateTownVisitWindow, populateCombatData, populateCombatWindow, populateCombatControls } = require("../sessionTools.js")
const {clone, runEnemyCombatAI} = require("../tools.js")
module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"trainingOption"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "townVisit"){

            let newSession = []

            let fighters = []

            let enemy1,enemy2,enemy3,playerClone

            if(interaction.values[0].slice(0,6) == "lesson"){
                switch(interaction.values[0]){
                    case "lesson0":
                        enemy1 = {
                            object: true,
                            name:"Practice Dummy",
                            id:"dummy",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":1,
                                "atk":0,
                                "def":1,
                                "spatk":0,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 40,
                                "name": "Basic Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },{
                                "action_type": "guard",
                                "name": "Basic Guard",
                                "guard_val": 20,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            },{
                                "action_type": "stats",
                                "name": "Basic Buff",
                                "statChangeCount": 1,
                                "effects": [
                                {
                                    "target": "0",
                                    "stat": "atk",
                                    "value": 1
                                }
                                ],
                                "speed": 1
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    }
                                ],
                                dialogue:[
                                    "To complete most combat scenarios, you will need to lower an enemy's health to 0 before they do the same to you. To aid you in this, you have access to abilities that can damage enemies, prevent you from taking damage, and increase your stats.\n\nClick the 'My Fighter' button to see all your abilities and stats, then choose the ability that will help you defeat the Practice Dummy"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson1":
                        enemy1 = {
                            object: true,
                            name:"Practice Dummy #1",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":1,
                                "atk":0,
                                "def":1,
                                "spatk":0,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        enemy2 = {
                            object: true,
                            name:"Practice Dummy #2",
                            id:"dummy2",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":100,
                                "atk":0,
                                "def":100,
                                "spatk":0,
                                "spdef":100,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 40,
                                "name": "Basic Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },{
                                "action_type": "stats",
                                "name": "Basic Buff",
                                "statChangeCount": 1,
                                "effects": [
                                {
                                    "target": "1",
                                    "stat": "atk",
                                    "value": 1
                                }
                                ],
                                "speed": 1
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1,
                            enemy2
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },
                                    {
                                        type:0,
                                        data:{
                                            count:2
                                        },
                                        result:"win_1"
                                    },{
                                        type:1,
                                        data:{
                                            staticData:{
                                                id:"dummy1"
                                            }
                                        },
                                        result:"win_0"
                                    }
                                ],
                                dialogue:[
                                    "In some battles, you will have multiple enemies. In these situations you will have to target your attacks at specific enemies, unless your ability is able to affect multiple enemies at once.\n\nFor this lesson, only defeat Practice Dummy #1"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson2":
                        enemy1 = {
                            object: true,
                            name:"Practice Dummy #1",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":10,
                                "atk":0,
                                "def":1,
                                "spatk":0,
                                "spdef":100,
                                "spd":1
                            }
                        }

                        enemy2 = {
                            object: true,
                            name:"Practice Dummy #2",
                            id:"dummy2",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":10,
                                "atk":0,
                                "def":100,
                                "spatk":0,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 40,
                                "name": "Basic Physical Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },
                            {
                                "critical": 0,
                                "damage_type": "spatk",
                                "damage_val": 40,
                                "name": "Basic Special Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1,
                            enemy2
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:3
                                        },
                                        result:"win_1"
                                    }
                                ],
                                dialogue:[
                                    "When dealing damage with an attack, the damage will be reduced depending on the stat that increased the damage and the respective defensive stat of your target.\n\nAttacks made stronger by your atk stat are reduced by an enemy's def stat\nAttacks made stronger by your spatk stat are reduced by an enemy's spdef stat\n\nWhen in combat, you can determine a fighter's higher defensive stat by looking at the color of their health bar\n\n🟪 = spdef is higher\n🟫 = def is higher\n🟩 = both stats are relatively the same\n\nCheck your abilities by pressing 'My Fighter' and then use this knowledge to defeat the practice dummies in less than 3 turns"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson3":
                        enemy1 = {
                            name:"Practice Fighter",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[{
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 30,
                                "name": "Physical Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":10,
                                "atk":1000,
                                "def":100,
                                "spatk":0,
                                "spdef":100,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 40,
                                "name": "Basic Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },
                            {
                                "action_type": "guard",
                                "name": "Special Guard",
                                "guard_val": 50,
                                "guard_type": "spdef",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            },{
                                "action_type": "guard",
                                "name": "Physical Guard",
                                "guard_val": 30,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:0
                                        },
                                        result:"win_0"
                                    }
                                ],
                                dialogue:[
                                    "Guard abilities allow you to reduce the base damage of incoming attacks for a turn. If an attack's base damage is lowered below 0, it will deal no damage.\n\nYour opponent is going to use an ability that scales off of their atk stat and has a base damage of 30. Click the 'My Fighter' button to determine what ability you should use in order to survive their attack."
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson4":
                        enemy1 = {
                            name:"Practice Fighter",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[{
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 30,
                                "name": "Physical Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":5,
                                "atk":1000,
                                "def":1,
                                "spatk":0,
                                "spdef":100,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "spatk",
                                "damage_val": 40,
                                "name": "Slow Attack",
                                "speed": 0,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },
                            {
                                "action_type": "guard",
                                "name": "Strong Guard",
                                "guard_val": 60,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            },{
                                "action_type": "guard",
                                "name": "Counter Guard",
                                "guard_val": 30,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 30,
                                "counter_type": "def",
                                "speed": 3
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:0
                                        },
                                        result:"win_1"
                                    }
                                ],
                                dialogue:[
                                    "Guard abilities can sometimes be used offensively as long as the type of incoming attack matches the type of guard\n\ndef guards can counter atk based abilities\nspdef guards can counter spatk based abilities\n\nUse the proper ability to survive the incoming attack and defeat your opponent in the same turn."
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson5":
                        enemy1 = {
                            name:"Harmless Fighter #1",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":24,
                                "atk":1,
                                "def":10,
                                "spatk":1,
                                "spdef":10,
                                "spd":1
                            }
                        }

                        enemy2 = {
                            name:"Harmless Fighter #2",
                            id:"dummy2",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":24,
                                "atk":1,
                                "def":10,
                                "spatk":1,
                                "spdef":10,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 40,
                                "name": "Physical Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1,
                            enemy2
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:7
                                        },
                                        result:"win_1"
                                    }
                                ],
                                dialogue:[
                                    "Using the same ability repeatedly on the same targets causes it to become predictable by enemies. To ensure that you are always able to land your attacks, it is advised that you switch targets or avoid using the same ability back to back.\n\nNote: Unlike attacks, using a guard reduces the success rate of any guard ability you use until you use a non-guard ability\n\nAlternate your abilities to defeat the fighters in 8 turns"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;

                    case "lesson6":
                        enemy1 = {
                            name:"Defensive Fighter",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[{
                                "action_type": "guard",
                                "name": "Basic Guard",
                                "guard_val": 20,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            }],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":20,
                                "atk":1,
                                "def":10,
                                "spatk":1,
                                "spdef":10,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "action_type": "stats",
                                "name": "Power Spike",
                                "statChangeCount": 1,
                                "effects": [
                                {
                                    "target": "0",
                                    "stat": "atk",
                                    "value": 4
                                }
                                ],
                                "speed": 1
                            },{
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 20,
                                "name": "Physical Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:3
                                        },
                                        result:"win_1"
                                    }
                                ],
                                dialogue:[
                                    "Stat changing abilities can be used to still give yourself an advantage over an opponent should they choose to go on the defensive. Additionally, unlike attacks and guards, they can be used repeatedly without any diminishing effect\n\nUse your abilities to defeat the fighter in 4 turns."
                                ],
                                openingDialogue:0
                            })
                        }
                        break;
                        
                    case "lesson7":
                        enemy1 = {
                            name:"Practice Fighter",
                            id:"dummy1",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[{
                                "action_type": "guard",
                                "name": "Basic Guard",
                                "guard_val": 30,
                                "guard_type": "def",
                                "success_level": 100,
                                "counter_val": 0,
                                "counter_type": "def",
                                "speed": 3
                            }],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":5,
                                "atk":1,
                                "def":10,
                                "spatk":1,
                                "spdef":10,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 50,
                                "name": "Strong Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            },{
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 30,
                                "name": "Fast Attack",
                                "speed": 4,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:0
                                        },
                                        result:"win_1"
                                    }
                                ],
                                dialogue:[
                                    "There are 4 tiers of speed for abilities. An ability's speed tier determines when it happens in the order of combat. If two abilities of the same speed tier are used by different fighters, the fighter with the higher speed stat will have their ability go first.\n\nAdditionally, by default, guards are in the second highest speed tier, but some abilities can be used before them, which can allow damage to be dealt before a unit can prepare a guard.\n\nDefeat the practice fighter in 1 turn"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;
                        
                    case "lesson8":
                        enemy1 = {
                            name:"Practice Dummy #1",
                            id:"dummy",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:3,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":1,
                                "atk":1,
                                "def":1,
                                "spatk":1,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        enemy2 = {
                            name:"Practice Dummy #2",
                            id:"dummy",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":1,
                                "atk":1,
                                "def":1,
                                "spatk":1,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        enemy3 = {
                            name:"Practice Dummy #3",
                            id:"dummy",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:3,
                            abilities:[],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":1,
                                "atk":1,
                                "def":1,
                                "spatk":1,
                                "spdef":1,
                                "spd":1
                            }
                        }

                        playerClone = clone(session.session_data.player)

                        delete playerClone.boosters
                        delete playerClone.gear
                        delete playerClone.weapon
                        playerClone.lives = 1

                        playerClone.stats = {
                            "hp":10,
                            "atk":10,
                            "def":10,
                            "spatk":10,
                            "spdef":10,
                            "spd":10
                        }
                        playerClone.abilities = [
                            {
                                "critical": 0,
                                "damage_type": "atk",
                                "damage_val": 30,
                                "name": "Basic Attack",
                                "speed": 1,
                                "faction": -1,
                                "action_type": "attack",
                                "numHits": 1,
                                "recoil": 0,
                                "targetType": 1,
                                "accuracy": 100
                            }
                        ]

                        fighters = [
                            playerClone,
                            enemy1,
                            enemy2,
                            enemy3
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:session.user_ids,
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1,1],
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:[
                                    {
                                        type:0,
                                        data:{
                                            all:true
                                        },
                                        result:"dialogue_0"
                                    },{
                                        type:0,
                                        data:{
                                            count:1
                                        },
                                        result:"win_1"
                                    },{
                                        type:1,
                                        data:{
                                            staticData:{
                                                id:"dummy"
                                            }
                                        },
                                        result:"win_0"
                                    }
                                ],
                                dialogue:[
                                    "The number of ❤️s under a fighter's name is an indication of how many lives they have. When a fighter's health goes to 0 while they have more than 1 life, their health will be fully refilled and they will lose one life.\n\nDefeat one of the practice dummies in less than 2 turns"
                                ],
                                openingDialogue:0
                            })
                        }
                        break;
                }

                session.session_data.onHold = true

                runEnemyCombatAI(newSession.session_data.fighters)

                interaction.update({
                    content:" ",
                    components:populateCombatControls(newSession),
                    embeds:populateCombatWindow(newSession)
                })
        
                callback({
                    updateSession:session,
                    addSession:newSession
                })
            } else {
                session.session_data.temp = {
                    viewingAbilities:true
                }

                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session)
                })
        
                callback({
                    updateSession: session
                })
            }
        }
    }
}