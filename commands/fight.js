const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateCombatWindow, populateCombatData, populateCombatControls} = require("../sessionTools.js")
const { runEnemyCombatAI, weightedRandom, simulateCPUSPAssign, simulateCPUAbilityAssign} = require("../tools.js")
const data = require("../data.json")


module.exports = {
	data: new SlashCommandBuilder()
		.setName('fight')
		.setDescription('Start Combat ')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of Fight')
                .setRequired(true)
                .addChoice('Fight an Enemy In The Wild', 'wild')),
    config:{
        getPlayerData:true
    },
	async execute(interaction,config,callback) {
        let playerData = config.playerData
        let choices = config.choices
        let fighters, newSession;
        switch(choices[0].value){
            case "wild":
                let encounterType = weightedRandom([
                    {
                        chance:15,
                        obj:0
                    },
                    {
                        chance:50,
                        obj:1
                    },
                    {
                        chance:25,
                        obj:2
                    },
                    {
                        chance:10,
                        obj:3
                    },
                ])
                
                let enemies = []
                switch(encounterType){
                    case 0:
                        enemies = [
                            {
                                allowance:5,
                                statLevel:1.5,
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
                                    reuse:0.4
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
                                    reuse:0.6
                                }
                            },
                            {
                                allowance:5,
                                statLevel:0.55,
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
                                statLevel:0.15,
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
                        skillpoints:0,
                        lives:1,
                        abilities:[],
                        level:0,
                        totalExp:0,
                        stats:{
                            "hp":9 + (-4 + Math.random() * 7),
                            "atk":4 + (-2 + Math.random() * 5),
                            "def":4 + (-2 + Math.random() * 5),
                            "spatk":4 + (-2 + Math.random() * 5),
                            "spdef":4 + (-2 + Math.random() * 5),
                            "spd":4 + (-2 + Math.random() * 5)
                        }
                    }
                    let statPoints = ((playerData.level - 1) * 6) * statLevel
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
                        canFlee:true
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
};