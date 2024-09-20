const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateCombatWindow, populateCombatData, populateCombatControls} = require("../sessionTools.js")
const { runEnemyCombatAI, weightedRandom, simulateCPUSPAssign, simulateCPUAbilityAssign, clone, run} = require("../tools.js")
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
        if(playerData.abilities && playerData.abilities.length > 0){
            let choices = config.choices
            let fighters, newSession;
            let now = new Date()
            let townData = config.townData
            let townRank = weightedRandom([
                {
                    chance:40,
                    obj:Math.ceil(Math.random() * (townData.level * 0.4))
                },
                {
                    chance:30,
                    obj:Math.ceil(townData.level * 0.4 + Math.random() * (townData.level * 0.3))
                },
                {
                    chance:20,
                    obj:Math.ceil(townData.level * 0.7 + Math.random() * (townData.level * 0.2))
                },
                {
                    chance:10,
                    obj:Math.ceil(townData.level * 0.9 + Math.random() * (townData.level * 0.1))
                },
            ])
            switch(choices[0].value){
                case "wild":     
                    playerData.exploreStreak = 0   
                    playerData.leaderEncounter = 0
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

                        enemy.droptable = data.standardDroptables.basicWild

                        fighters.push(enemy)
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
                            canPerfect:true,
                            freeExplore:true
                        })
                    }
                    
                    runEnemyCombatAI(newSession.session_data.fighters)

                    if(playerData.tutorial == 5){

                        fighters = [playerData]

                        let enemy = {
                            rareVar: false,
                            name:  "Thieving Goblin",
                            id:Math.floor(Math.random() * 1000),
                            cpu:true,
                            intelligence:0.5,
                            stance:"none",
                            race:"0",
                            combatStyle:"0",
                            exp:0,
                            abilitypoints:0,
                            statpoints:0,
                            lives:1,
                            abilities:[
                                {
                                    "critical": 10,
                                    "damage_type": "atk",
                                    "damage_val": 50,
                                    "name": "Goblin's Fury",
                                    "speed": 1,
                                    "stance": "none",
                                    "action_type": "attack",
                                    "numHits": 1,
                                    "recoil": 0,
                                    "targetType": "1",
                                    "accuracy": 100
                                },
                                {
                                    "action_type": "guard",
                                    "name": "Basic Guard",
                                    "guard_val": 20,
                                    "guard_type": "def",
                                    "success_level": "100",
                                    "counter_val": 0,
                                    "counter_type": "def",
                                    "speed": 3
                                }
                            ],
                            level:1,
                            totalExp:0,
                            stats:{
                                "hp":20,
                                "atk":20,
                                "def":3,
                                "spatk":1,
                                "spdef":1,
                                "spd":5
                            },
                            weakPoint:true
                        }

                        enemy.droptable = [{
                            "chance": 40,
                            "obj": {
                            "type": "resource",
                            "resource": "gold",
                            "resourceName": "gold",
                            "amount": 2000
                            }
                        }]

                        fighters.push(enemy)

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[interaction.user.id],
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:alliances,
                                canPerfect:true,
                                combatTest:true
                            })
                        }

                        runEnemyCombatAI(newSession.session_data.fighters)

                        newSession.session_data.battlelog.alerts.push("A thieving goblin! Take him down, he may have stolen some gold from the town!")
                    } else if (playerData.tutorial != "completed"){
                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
                    } else {
                        if(config.forceUpdateInteraction){
                            interaction.update({
                                content:" ",
                                components:populateCombatControls(newSession),
                                embeds:populateCombatWindow(newSession)
                            })
                        } else {
                            interaction.reply({
                                content:" ",
                                components:populateCombatControls(newSession),
                                embeds:populateCombatWindow(newSession)
                            })
                        }
                        
                        callback({
                            addSession:newSession
                        })
                    }
                    break;
                case "intTown":
                    if(playerData.tutorial != "completed"){
                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
                    } else {
                        if(townRank * 10 > townData.reputations[interaction.user.id]) {
                            townRank = 1
                        }
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
                                            "spdef": 0.8,
                                            "hp": 1.75,
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
                                            stance:"none",
                                            race:"0",
                                            combatStyle:"0",
                                            exp:0,
                                            abilitypoints:0,
                                            statpoints:0,
                                            lives:2,
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
                                        }
                                        basicEnemy = {
                                            name:"Subservient Brute",
                                            id:Math.floor(Math.random() * 1000),
                                            cpu:true,
                                            stance:"none",
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
                                        }
                                        break;
                                    case 1:
                                        bossScalar = {
                                            "atk": 1,
                                            "spatk": 1.2,
                                            "spd": 1,
                                            "def": 0.8,
                                            "spdef": 1,
                                            "hp": 1.75,
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
                                            stance:"none",
                                            race:"0",
                                            combatStyle:"0",
                                            exp:0,
                                            abilitypoints:0,
                                            statpoints:0,
                                            lives:2,
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true,
                                        }
                                        basicEnemy = {
                                            name:"Subservient Mage",
                                            id:Math.floor(Math.random() * 1000),
                                            cpu:true,
                                            stance:"none",
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
                                        }
                                        break;
                                }

                                bossEnemy = clone(simulateCPUAbilityAssign(bossEnemy,[],5 + Math.floor(townRank * 1.25)))
                                basicEnemy = clone(simulateCPUAbilityAssign(basicEnemy,[],5 + Math.floor(townRank * 1.25)))
                                fighters = [
                                    playerData,
                                    simulateCPUSPAssign(clone(basicEnemy),townRank * 60,enemyScalar),
                                    simulateCPUSPAssign(clone(basicEnemy),townRank * 60,enemyScalar),
                                    simulateCPUSPAssign(clone(bossEnemy),townRank * 60,bossScalar)
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
                                        dialogue:[
                                            "A large commotion seems to happening near by. You approach to discover strangely clothed figures wrecking havoc amongst the townspeople. They must be stopped"
                                        ],
                                        rewardPlayer:false,
                                        openingDialogue:0,
                                        canPerfect:true,
                                        encounterRewards:{
                                            val:townRank,
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
                    }
                    break;
                case "extTown":
                    if (playerData.tutorial != "completed"){
                        interaction.reply({ content: "You must complete the tutorial before accessing this command. For help seeing what's next to do, perform the `/tutorial` command", ephemeral: true });    
                    } else {
                        if(townRank * 10 > townData.reputations[interaction.user.id]) {
                            townRank = 1
                        }
                        let extMissionType = Math.floor(Math.random() * 3)
                        extMissionType = 0
                        switch(extMissionType){
                            case 0: 
                                let woundedUnit = {
                                    discrim:1234,
                                    object: true,
                                    name:  "Wounded Explorer",
                                    id: "explorer",
                                    cpu:true,
                                    stance:"none",
                                    race:"0",
                                    combatStyle:"0",
                                    exp:0,
                                    abilitypoints:0,
                                    statpoints:0,
                                    lives:1,
                                    abilities:[],
                                    level:townRank * 10,
                                    totalExp:0,
                                    stats:{
                                        "hp":60,
                                        "atk":0,
                                        "def":15,
                                        "spatk":0,
                                        "spdef":15,
                                        "spd":0
                                    }
                                }
        
                                let wallScalar = {
                                    "atk": 0,
                                    "spatk": 0,
                                    "spd": 0,
                                    "def": 0.15,
                                    "spdef": 0.15,
                                    "hp": 1,
                                }
                    
                                let enemy,enemyScalar,groupName;
                                
                                switch(Math.floor(Math.random() * 3)){
                                    case 0:
                                        enemy = {
                                            target:1234,
                                            name:"Enraged Petrite",
                                            id:Math.floor(Math.random() * 1000),
                                            cpu:true,
                                            stance:"none",
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
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
                                            target:1234,
                                            name:"Fiendish Goblin",
                                            id:Math.floor(Math.random() * 1000),
                                            cpu:true,
                                            stance:"none",
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
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
                                            target:1234,
                                            name:"Giant Spider",
                                            id:Math.floor(Math.random() * 1000),
                                            cpu:true,
                                            stance:"none",
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
                                            },
                                            lootPoint:true,
                                            weakPoint:true
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
                    
                                enemy = clone(simulateCPUAbilityAssign(enemy,[],5 + Math.floor(townRank * 1.25)))
                    
                                fighters = [
                                    playerData,
                                    simulateCPUSPAssign(woundedUnit,townRank * 20,wallScalar),
                                    simulateCPUSPAssign(clone(enemy),townRank * 50,enemyScalar),
                                    simulateCPUSPAssign(clone(enemy),townRank * 50,enemyScalar)
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
                                                                skillpoints:townRank * 50,
                                                                allowance:5 + Math.floor(townRank * 1.25)
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        dialogue:[
                                            "You hear screams for help and rush to find a traveler cornered by " + groupName + ". As you prepare to engage, the predators notice you and begin to surround the two of you"
                                        ],
                                        rewardPlayer:false,
                                        openingDialogue:0,
                                        canPerfect:true,
                                        encounterRewards:{
                                            val:townRank,
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
                    }
                    break;
            }
        } else {
            interaction.reply({ content: "You have no abilities assigned, so you can not enter combat! Add abilities:\n\nUsing `/abilities create`\nor\nvisit the training hall in town using `/town` and 'Learn New Abilities'", ephemeral: true });
        }
	}
};