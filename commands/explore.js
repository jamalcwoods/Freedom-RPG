const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateCombatWindow, populateCombatData, populateCombatControls} = require("../sessionTools.js")
const { runEnemyCombatAI, weightedRandom, simulateCPUSPAssign, simulateCPUAbilityAssign, clone, run} = require("../tools.js")
const data = require("../data.json")


module.exports = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('Start Combat')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Exploration Action')
                .setRequired(true)
                .addChoice('Look for an enemy to fight in the wild', 'wild')
                .addChoice('Explore the town outskirts', 'extTown')
                .addChoice('Patrol the town for conflict', 'intTown')),
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
	async execute(interaction,config,callback) {
        let playerData = config.playerData
        let choices = config.choices
        let fighters, newSession;
        let now = new Date()
        let comboEncounter;
        let townData = config.townData
        if(playerData.lastEncounter){
            comboEncounter = now.getTime() > playerData.lastEncounter && now.getTime() <= playerData.lastEncounter + 20000
        } else {
            comboEncounter = false
        }
        
        switch(choices[0].value){
            case "wild":        
                let encounterType = weightedRandom([
                    {
                        chance:20,
                        obj:0
                    },
                    {
                        chance:65,
                        obj:1
                    },
                    {
                        chance:10,
                        obj:2
                    },
                    {
                        chance:5,
                        obj:3
                    },
                ])
                
                let enemies = []
                switch(encounterType){
                    case 0:
                        enemies = [
                            {
                                allowance:5,
                                statLevel:1.25,
                                intelligence:{
                                    reuse:0.75
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
                                    reuse:0.5
                                }
                            }
                        ]
                        break;
                    case 2:
                        enemies = [
                            {
                                allowance:5,
                                statLevel:0.45,
                                intelligence:{
                                    reuse:0.6
                                }
                            },
                            {
                                allowance:5,
                                statLevel:0.45,
                                intelligence:{
                                    reuse:0.6
                                }
                            }
                        ]
                        break;
                    case 3:
                        enemies = [
                            {
                                allowance:5,
                                statLevel:0.25,
                                intelligence:{
                                    reuse:0.8
                                }
                            },
                            {
                                allowance:5,
                                statLevel:0.25,
                                intelligence:{
                                    reuse:0.8
                                }
                            },
                            {
                                allowance:5,
                                statLevel:0.25,
                                intelligence:{
                                    reuse:0.8
                                }
                            }
                        ]
                        break;
                }

                

                for(e in enemies){
                    let enemyScalar = 1
                    if(comboEncounter){
                        enemyScalar + (0.25 * playerData.encounterStreak)
                    }
                    let enemy = enemies[e]
                    let index = Math.floor(Math.random() * data.creatures.length)
                    let mob = data.creatures[index]
                    let nameTag = mob.normTag;
                    let statLevel = enemy.statLevel * enemyScalar
                    let rare = false;
                    if(Math.ceil(Math.random() * 100) > 90){
                        statLevel *= 1.25
                        nameTag = mob.rareTag
                        rare = true
                    }
                    let allowance = enemy.allowance
                    let intelligence = enemy.intelligence
                    enemy = {
                        rareVar: rare,
                        name:  nameTag + " " + mob.Name,
                        id:Math.floor(Math.random() * 1000),
                        cpu:true,
                        intelligence:intelligence,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        abilitypoints:0,
                        statpoints:0,
                        lives:1,
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
                        }
                    }
                    let statPoints = ((playerData.level) * 6) * statLevel
                    enemy = simulateCPUSPAssign(enemy,statPoints,mob)
                    enemy = simulateCPUAbilityAssign(enemy,mob.innateAbilities,allowance)

                    

                    if(mob.droptable){
                        enemy.droptable = mob.droptable   
                    }
                    enemies[e] = enemy
                }
                
                fighters = [playerData]
                for(var i = 0; i < enemies.length; i++){
                    fighters.push(enemies[i])
                }
                let alliances = [0]
                for(var i = 0; i < enemies.length; i++){
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
                        encounterStreak:comboEncounter 
                    })
                }
                
                runEnemyCombatAI(newSession.session_data.fighters)

                interaction.reply({
                    content:" ",
                    components:populateCombatControls(newSession),
                    embeds:populateCombatWindow(newSession)
                })
                callback({
                    addSession:newSession
                })
                
                break;
            case "intTown":
                let intMissionType = Math.floor(Math.random() * 3)
                intMissionType = 0
                switch(intMissionType){
                    case 0: 
                        let bossScalar,enemyScalar,enemyAbility,bossEnemy,basicEnemy;
                        switch(Math.floor(Math.random() * 2)){
                            case 0:
                                bossScalar = {
                                    "atk": 1.2,
                                    "spatk": 1,
                                    "spd": 1,
                                    "def": 1,
                                    "spdef": 0.5,
                                    "hp": 1.5,
                                }
                                enemyScalar = {
                                    "atk": 1.8,
                                    "spatk": 0.2,
                                    "spd": 1,
                                    "def": 1,
                                    "spdef": 0.5,
                                    "hp": 0.4,
                                }
                                enemyAbility = {
                                    "critical": 30,
                                    "damage_type": "atk",
                                    "damage_val": 30,
                                    "name": "Chaotic Strike",
                                    "speed": 1,
                                    "faction": -1,
                                    "action_type": "attack",
                                    "numHits": 1,
                                    "recoil": 0,
                                    "targetType": "1",
                                    "accuracy": 90
                                }
                                bossEnemy = {
                                    name:"Commanding Warrior",
                                    id:"commander",
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
                                    abilities:[enemyAbility],
                                    level:0,
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
                                basicEnemy = {
                                    name:"Subservient Brute",
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
                                    abilities:[enemyAbility],
                                    level:0,
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
                                break;
                            case 1:
                                bossScalar = {
                                    "atk": 1,
                                    "spatk": 1.2,
                                    "spd": 1,
                                    "def": 0.5,
                                    "spdef": 1,
                                    "hp": 1.5,
                                }
                                enemyScalar = {
                                    "atk": 0.2,
                                    "spatk": 1.8,
                                    "spd": 1,
                                    "def": 0.5,
                                    "spdef": 1,
                                    "hp": 0.4,
                                }
                                enemyAbility = {
                                    "critical": 30,
                                    "damage_type": "spatk",
                                    "damage_val": 30,
                                    "name": "Chaotic Surge",
                                    "speed": 1,
                                    "faction": -1,
                                    "action_type": "attack",
                                    "numHits": 1,
                                    "recoil": 0,
                                    "targetType": "1",
                                    "accuracy": 90
                                }
                                bossEnemy = {
                                    name:"Commanding Arc-Mage",
                                    id:"commander",
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
                                    abilities:[enemyAbility],
                                    level:0,
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
                                basicEnemy = {
                                    name:"Subservient Mage",
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
                                    abilities:[enemyAbility],
                                    level:0,
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
                                break;
                        }

                        bossEnemy = clone(simulateCPUAbilityAssign(bossEnemy,[],5 + Math.floor(townData.level * 1.25)))
                        basicEnemy = clone(simulateCPUAbilityAssign(basicEnemy,[],5 + Math.floor(townData.level * 1.25)))
                        fighters = [
                            playerData,
                            simulateCPUSPAssign(clone(basicEnemy),townData.level * 60,enemyScalar),
                            simulateCPUSPAssign(clone(basicEnemy),townData.level * 60,enemyScalar),
                            simulateCPUSPAssign(clone(bossEnemy),townData.level * 60,bossScalar)
                        ]

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[interaction.user.id],
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,1,1,1],
                                canFlee:true,
                                events:[
                                    {
                                        type:1,
                                        data:{
                                            staticData:{
                                                id:"commander"
                                            }
                                        },
                                        result:"win_0"
                                    }
                                ],
                                dialogue:[
                                    "A large commotion seems to happening near by. You approach to discover strangely clothed figures wrecking havoc amongst the townspeople. They must be stopped"
                                ],
                                openingDialogue:0,
                                encounterRewards:{
                                    type:choices[0].value
                                }
                            })
                        } 

                        runEnemyCombatAI(newSession.session_data.fighters)

                        interaction.reply({
                            content:" ",
                            components:populateCombatControls(newSession),
                            embeds:populateCombatWindow(newSession)
                        })
                        callback({
                            addSession:newSession
                        })
                        break;
                }
                break;
            case "extTown":
                let extMissionType = Math.floor(Math.random() * 3)
                extMissionType = 0
                switch(extMissionType){
                    case 0: 
                        let woundedUnit = {
                            object: true,
                            name:  "Wounded Explorer",
                            id: "explorer",
                            cpu:true,
                            faction:"-1",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[],
                            level:townData.level * 10,
                            totalExp:0,
                            stats:{
                                "hp":20,
                                "atk":0,
                                "def":30,
                                "spatk":0,
                                "spdef":30,
                                "spd":0
                            }
                        }

                        let wallScalar = {
                            "atk": 0,
                            "spatk": 0,
                            "spd": 0,
                            "def": 0,
                            "spdef": 0,
                            "hp": 1,
                        }
            
                        let enemy,enemyScalar,groupName;
                        
                        switch(Math.floor(Math.random() * 3)){
                            case 0:
                                enemy = {
                                    name:"Enraged Petrite",
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
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
                                    }
                                }
                                enemyScalar = {
                                    "atk": 0.5,
                                    "spatk": 0.5,
                                    "spd": 0.5,
                                    "def": 1.25,
                                    "spdef": 1.25,
                                    "hp": 1.25,
                                }
                                groupName = "sentient rocks"
                                break;
                            case 1:
                                enemy = {
                                    name:"Fiendish Goblin",
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
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
                                    }
                                }
                                enemyScalar = {
                                    "atk": 1,
                                    "spatk": 1,
                                    "spd": 1,
                                    "def": 1,
                                    "spdef": 1,
                                    "hp": 1,
                                }
                                groupName = "mischievous goblins"
                                break;
                            case 2:
                                enemy = {
                                    name:"Giant Spider",
                                    id:Math.floor(Math.random() * 1000),
                                    cpu:true,
                                    faction:"-1",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
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
                                    }
                                }
                                enemyScalar = {
                                    "atk": 1.5,
                                    "spatk": 1.5,
                                    "spd": 1.5,
                                    "def": 0.5,
                                    "spdef": 0.5,
                                    "hp": 0.5,
                                }
                                groupName = "a swarm of giant spiders"
                                break;
                        }
            
                        enemy = clone(simulateCPUAbilityAssign(enemy,[],5 + Math.floor(townData.level * 1.25)))
            
                        fighters = [
                            playerData,
                            simulateCPUSPAssign(woundedUnit,townData.level * 6,wallScalar),
                            simulateCPUSPAssign(clone(enemy),townData.level * 50,enemyScalar),
                            simulateCPUSPAssign(clone(enemy),townData.level * 50,enemyScalar)
                        ]
            
                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[interaction.user.id],
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:[0,0,1,1],
                                canFlee:true,
                                events:[
                                    {
                                        type:1,
                                        data:{
                                            staticData:{
                                                id:"explorer"
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
                                                        unit:clone(enemy),
                                                        alliance:1,
                                                        skillpoints:townData.level * 50,
                                                        allowance:5
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                },
                                dialogue:[
                                    "You hear screams for help and rush to find a traveler cornered by " + groupName + ". As you prepare to engage, the predators notice you and begin to surround the two of you"
                                ],
                                openingDialogue:0,
                                encounterRewards:{
                                    type:choices[0].value
                                }
                            })
                        } 

                        runEnemyCombatAI(newSession.session_data.fighters)

                        interaction.reply({
                            content:" ",
                            components:populateCombatControls(newSession),
                            embeds:populateCombatWindow(newSession)
                        })
                        callback({
                            addSession:newSession
                        })
                        break;
                }
                break;
        }
	}
};